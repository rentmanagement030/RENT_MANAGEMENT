import { Prisma, Bill, BillStatus, BillType, RentStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { NotFoundError, ConflictError, ValidationError } from "../utils/http";
import { buildPagination, parsePagination } from "../utils/pagination";
import { add, sub, zero, toDecimal, gt, numberMoney } from "../utils/money";
import { getSettings } from "./settings.service";
import { getPeriodFinancialSummary } from "./financial.service";
import { writeAuditLog } from "../utils/audit";
import { nanoid } from "nanoid";
import type { Request } from "express";

const billInclude = {
  tenant: { select: { id: true, name: true, phone: true } },
  property: { select: { id: true, name: true, number: true, type: true, ebNumber: true } },
  rentRecord: { select: { id: true, billingMonth: true, dueDate: true } },
  createdBy: { select: { id: true, name: true } },
  items: true,
  penalties: { orderBy: { createdAt: "desc" } },
  allocations: { include: { payment: { select: { id: true, receiptNumber: true, paymentDate: true, paymentMethod: true } } } },
} satisfies Prisma.BillInclude;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Rule 2 — configurable mid-month transfer rule (default FULL_MONTH).
 *
 * FULL_MONTH  -> the whole month is billed at the rent that was in effect on
 *                the first day of the month (the "old rent" when a transfer
 *                happens mid-month). Historical bills are never modified.
 * PRORATED    -> the month is billed day-weighted across transfer effective
 *                dates: old rent for the days before the transfer, new rent
 *                from the transfer date onward.
 *
 * Transfer history is read-only here and only affects bills generated
 * afterwards. Future months use the tenant's current rent automatically.
 */
export async function computeMonthRentForTenant(
  tenant: { id: string; rent: Prisma.Decimal; joiningDate?: Date | null },
  billingMonth: string,
  mode: "FULL_MONTH" | "PRORATED" = "PRORATED",
): Promise<Prisma.Decimal> {
  const [y, m] = billingMonth.split("-").map((n) => Number(n));
  if (!y || !m || m < 1 || m > 12) return tenant.rent;

  const monthStart = new Date(y, m - 1, 1);
  const nextMonth = new Date(y, m, 1);
  const daysInMonth = Math.round((nextMonth.getTime() - monthStart.getTime()) / MS_PER_DAY);

  // If tenant has joiningDate, check if billing month is before or on joining month
  if (tenant.joiningDate) {
    const jDate = new Date(tenant.joiningDate);
    const joinYear = jDate.getFullYear();
    const joinMonth = jDate.getMonth() + 1;
    const joinDay = jDate.getDate();
    const joinMonthStr = `${joinYear}-${String(joinMonth).padStart(2, "0")}`;

    if (billingMonth < joinMonthStr) {
      // Tenant had not joined yet in this billing month
      return new Prisma.Decimal(0);
    }

    if (billingMonth === joinMonthStr && joinDay > 1) {
      // Mid-month joining pro-rata calculation:
      // Formula: (Rent / daysInMonth) * remainingDays
      // E.g., for 10000 rent on 15 Aug (31 days): (10000 / 31) * 16 = 5161.29
      const remainingDays = Math.max(1, daysInMonth - joinDay);
      const fullRent = tenant.rent.toNumber();
      const perDayRent = fullRent / daysInMonth;
      const proratedRent = Math.round(perDayRent * remainingDays * 100) / 100;
      return new Prisma.Decimal(proratedRent);
    }
  }

  const transfers = await prisma.tenantTransferHistory.findMany({
    where: { tenantId: tenant.id },
    orderBy: { effectiveFrom: "asc" },
    select: { effectiveFrom: true, fromRent: true, toRent: true },
  });

  // Rent timeline derived from transfer history (never rewritten):
  //   before transfers[0].effectiveFrom           -> transfers[0].fromRent
  //   between transfers[i] and transfers[i+1]     -> transfers[i].toRent
  //   after the last transfer                     -> transfers[last].toRent
  let rentAtMonthStart = tenant.rent;
  if (transfers.length > 0) {
    const latestBeforeStart = [...transfers].reverse().find((t) => t.effectiveFrom <= monthStart);
    rentAtMonthStart = latestBeforeStart ? latestBeforeStart.toRent : transfers[0].fromRent;
  }

  if (mode === "FULL_MONTH") {
    return rentAtMonthStart;
  }

  let currentRent = rentAtMonthStart;
  let cursor = monthStart.getTime();
  let prorated = new Prisma.Decimal(0);

  for (const t of transfers) {
    if (t.effectiveFrom <= monthStart || t.effectiveFrom >= nextMonth) continue;
    const transferTime = startOfLocalDay(t.effectiveFrom).getTime();
    const segmentDays = Math.max(0, Math.floor((transferTime - cursor) / MS_PER_DAY));
    prorated = prorated.plus(currentRent.times(segmentDays));
    currentRent = t.toRent;
    cursor = transferTime;
  }

  const consumedDays = Math.floor((cursor - monthStart.getTime()) / MS_PER_DAY);
  const remainingDays = Math.max(0, daysInMonth - consumedDays);
  prorated = prorated.plus(currentRent.times(remainingDays));

  return prorated.dividedBy(daysInMonth).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export interface BillInput {
  tenantId: string;
  propertyId: string;
  billType: Exclude<BillType, "RENT">;
  billingMonth: string;
  dueDate: Date;
  graceDate?: Date;
  amount: number;
  notes?: string;
  items?: { description: string; quantity?: number; unitPrice?: number; amount: number }[];
}

export async function generateBillNumber(prefix: string): Promise<string> {
  const d = new Date();
  const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  const suffix = nanoid(6).toUpperCase();
  return `${prefix}-${ym}-${suffix}`;
}

export function computeBillStatus(
  bill: Pick<Bill, "dueDate" | "status" | "paidAmount" | "outstanding">,
  now = new Date(),
): BillStatus {
  if (bill.status === "DRAFT" || bill.status === "WAIVED" || bill.status === "CANCELLED") {
    return bill.status;
  }
  if (bill.outstanding.lessThanOrEqualTo(0)) return "PAID";
  if (bill.paidAmount.greaterThan(0)) return bill.dueDate < now ? "OVERDUE" : "PARTIAL";
  return bill.dueDate < now ? "OVERDUE" : "PENDING";
}

export async function listBills(query: Record<string, unknown>) {
  // Automatically generate current / past month bills without waiting for manual action (Never future months)
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const billingMonth = query.billingMonth ? String(query.billingMonth) : undefined;
  const targetGenMonth = billingMonth || currentMonth;
  if (targetGenMonth <= currentMonth) {
    await generateMonthlyBills(targetGenMonth).catch(() => null);
  }

  const { page, pageSize } = parsePagination(query);
  const tenantId = query.tenantId ? String(query.tenantId) : undefined;
  const propertyId = query.propertyId ? String(query.propertyId) : undefined;
  const billType = query.billType ? String(query.billType) : undefined;
  const status = query.status ? String(query.status) : undefined;
  const search = String(query.search ?? "").trim();

  const where: Prisma.BillWhereInput = {
    ...(tenantId ? { tenantId } : {}),
    ...(propertyId ? { propertyId } : {}),
    ...(billType ? { billType: billType as BillType } : {}),
    ...(status ? { status: status as BillStatus } : {}),
    ...(billingMonth ? { billingMonth } : {}),
    ...(search
      ? {
          OR: [
            { billNumber: { contains: search, mode: "insensitive" } },
            { tenant: { name: { contains: search, mode: "insensitive" } } },
            { tenant: { phone: { contains: search } } },
          ],
        }
      : {}),
  };

  const [total, bills] = await Promise.all([
    prisma.bill.count({ where }),
    prisma.bill.findMany({
      where,
      include: billInclude,
      orderBy: [{ billingMonth: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return buildPagination(bills, total, { page, pageSize });
}

export async function getBill(id: string) {
  const bill = await prisma.bill.findUnique({ where: { id }, include: billInclude });
  if (!bill) throw new NotFoundError("Bill not found");
  return bill;
}

function validateAmounts(input: BillInput) {
  if (!gt(input.amount, 0)) {
    throw new ValidationError([{ path: "amount", message: "Bill amount must be greater than zero" }]);
  }
  if (input.items) {
    const itemSum = input.items.reduce((s, i) => add(s, toDecimal(i.amount)), zero());
    if (gt(itemSum, toDecimal(input.amount))) {
      throw new ValidationError([{ path: "items", message: "Item amounts exceed the bill amount" }]);
    }
  }
}

export async function createBill(input: BillInput, req: Request, actorId: string) {
  validateAmounts(input);

  if (input.billType === "OTHER" && (!input.notes || !input.notes.trim())) {
    throw new ValidationError([{ path: "notes", message: "Purpose / Notes is required for OTHER bill type." }]);
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId } });
  if (!tenant) throw new NotFoundError("Tenant not found");
  const property = await prisma.property.findUnique({ where: { id: input.propertyId } });
  if (!property) throw new NotFoundError("Property not found");
  if (tenant.propertyId && tenant.propertyId !== property.id) {
    throw new ConflictError("Bill property does not match the tenant's property");
  }

  // 1. Standard bill type check: Only 1 bill per standard type per month
  if (input.billType !== "OTHER") {
    const existing = await prisma.bill.findFirst({
      where: {
        tenantId: input.tenantId,
        billingMonth: input.billingMonth,
        billType: input.billType,
        status: { notIn: ["CANCELLED"] },
      },
    });
    if (existing) {
      throw new ConflictError(
        `A ${input.billType} bill statement already exists for this resident for ${input.billingMonth}. Each standard bill can only be generated once per month. To add additional charges for this month, select 'OTHER' bill type and enter the purpose in notes.`
      );
    }
  } else {
    // 2. OTHER bill handling: If an OTHER bill already exists for this month, append the charge to it
    const existingOther = await prisma.bill.findFirst({
      where: {
        tenantId: input.tenantId,
        billingMonth: input.billingMonth,
        billType: "OTHER",
        status: { notIn: ["CANCELLED"] },
      },
    });

    if (existingOther) {
      const addAmount = toDecimal(input.amount);
      const newAmount = add(existingOther.amount, addAmount);
      const newOutstanding = add(existingOther.outstanding, addAmount);
      const appendedNotes = existingOther.notes
        ? `${existingOther.notes} | ${input.notes!.trim()} (₹${input.amount})`
        : `${input.notes!.trim()} (₹${input.amount})`;

      const updated = await prisma.bill.update({
        where: { id: existingOther.id },
        data: {
          amount: newAmount,
          outstanding: newOutstanding,
          notes: appendedNotes,
          status: computeBillStatus({
            dueDate: existingOther.dueDate,
            status: existingOther.status,
            paidAmount: existingOther.paidAmount,
            outstanding: newOutstanding,
          }),
          ...(input.items && input.items.length
            ? {
                items: {
                  create: input.items.map((i) => ({
                    description: i.description,
                    quantity: i.quantity !== undefined ? toDecimal(i.quantity) : null,
                    unitPrice: i.unitPrice !== undefined ? toDecimal(i.unitPrice) : null,
                    amount: toDecimal(i.amount),
                  })),
                },
              }
            : {
                items: {
                  create: [
                    {
                      description: input.notes!.trim(),
                      amount: addAmount,
                    },
                  ],
                },
              }),
        },
        include: billInclude,
      });

      await writeAuditLog(req, {
        action: "bill.updated",
        entityType: "bill",
        entityId: updated.id,
        metadata: { billNumber: updated.billNumber, billType: "OTHER", billingMonth: input.billingMonth, addedAmount: input.amount, purpose: input.notes },
      }, actorId);

      return updated;
    }
  }

  const { billingBillPrefix } = await getSettings(false);
  const billNumber = await generateBillNumber(String(billingBillPrefix ?? "INV"));
  const amount = toDecimal(input.amount);
  const graceDate = input.graceDate ?? new Date(input.dueDate.getTime() + 3 * 24 * 60 * 60 * 1000);
  const due = input.dueDate;

  const bill = await prisma.bill.create({
    data: {
      billNumber,
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      billType: input.billType,
      billingMonth: input.billingMonth,
      dueDate: due,
      graceDate,
      amount,
      paidAmount: zero(),
      penaltyAmount: zero(),
      outstanding: amount,
      status: computeBillStatus({ dueDate: due, status: "PENDING", paidAmount: zero(), outstanding: amount }),
      notes: input.notes ?? null,
      createdById: actorId,
      ...(input.items && input.items.length
        ? {
            items: {
              create: input.items.map((i) => ({
                description: i.description,
                quantity: i.quantity !== undefined ? toDecimal(i.quantity) : null,
                unitPrice: i.unitPrice !== undefined ? toDecimal(i.unitPrice) : null,
                amount: toDecimal(i.amount),
              })),
            },
          }
        : input.billType === "OTHER" && input.notes
        ? {
            items: {
              create: [
                {
                  description: input.notes.trim(),
                  amount,
                },
              ],
            },
          }
        : {}),
    },
    include: billInclude,
  });

  await writeAuditLog(req, {
    action: "bill.created",
    entityType: "bill",
    entityId: bill.id,
    metadata: { billNumber, billType: input.billType, billingMonth: input.billingMonth, amount: input.amount },
  }, actorId);

  const { notifyBillGenerated } = await import("./notification.service");
  await notifyBillGenerated(bill.id).catch(() => null);

  return bill;
}

/**
 * Create several non-rent bills in one call (multi-bill generation).
 * Each entry is validated against the tenant's property and skipped if a
 * bill for the same tenant/type/month already exists instead of failing.
 */
export async function createBillsBatch(
  billingMonth: string,
  bills: Array<Pick<BillInput, "tenantId" | "billType" | "dueDate" | "amount" | "graceDate" | "notes" | "items">>,
  req: Request,
  actorId: string,
) {
  const created: string[] = [];
  const skipped: { tenantId: string; billType: string }[] = [];

  for (const input of bills) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: input.tenantId },
      select: { id: true, propertyId: true },
    });
    if (!tenant || !tenant.propertyId) {
      skipped.push({ tenantId: input.tenantId, billType: input.billType });
      continue;
    }
    try {
      const bill = await createBill({ ...input, propertyId: tenant.propertyId, billingMonth }, req, actorId);
      created.push(bill.id);
    } catch (err) {
      if (err instanceof ConflictError) {
        skipped.push({ tenantId: input.tenantId, billType: input.billType });
        continue;
      }
      throw err;
    }
  }

  await writeAuditLog(req, {
    action: "bill.batch_created",
    entityType: "bill",
    metadata: { billingMonth, created: created.length, skipped: skipped.length },
  }, actorId);

  return { billingMonth, created: created.length, skipped: skipped.length };
}

export async function updateBill(
  id: string,
  input: Partial<Pick<BillInput, "dueDate" | "graceDate" | "amount" | "notes">>,
  req: Request,
  actorId: string,
) {
  const bill = await prisma.bill.findUnique({ where: { id } });
  if (!bill) throw new NotFoundError("Bill not found");
  if (bill.status === "PAID" || bill.status === "WAIVED" || bill.status === "CANCELLED") {
    throw new ConflictError("Only draft or open bills can be edited");
  }

  let amount = bill.amount;
  let dueDate = bill.dueDate;
  let graceDate = bill.graceDate;
  if (input.amount !== undefined) {
    amount = toDecimal(input.amount);
    if (!gt(amount, 0)) {
      throw new ValidationError([{ path: "amount", message: "Bill amount must be greater than zero" }]);
    }
    if (gt(amount, add(bill.paidAmount, bill.outstanding))) {
      throw new ValidationError([{ path: "amount", message: "New amount is less than the amount already paid" }]);
    }
  }
  if (input.dueDate) dueDate = input.dueDate;
  if (input.graceDate) graceDate = input.graceDate;

  const outstanding = sub(add(amount, bill.penaltyAmount), bill.paidAmount);
  const status = computeBillStatus({ dueDate, status: bill.status, paidAmount: bill.paidAmount, outstanding });

  const updated = await prisma.bill.update({
    where: { id },
    data: {
      amount,
      dueDate,
      graceDate,
      outstanding,
      status,
      notes: input.notes !== undefined ? input.notes || null : undefined,
    },
    include: billInclude,
  });

  await writeAuditLog(req, {
    action: "bill.updated",
    entityType: "bill",
    entityId: id,
    metadata: { changed: Object.keys(input) },
  }, actorId);

  return updated;
}

export async function cancelBill(id: string, req: Request, actorId: string) {
  const bill = await prisma.bill.findUnique({ where: { id } });
  if (!bill) throw new NotFoundError("Bill not found");
  if (bill.status === "PAID" || bill.status === "WAIVED") {
    throw new ConflictError("Paid or waived bills cannot be cancelled");
  }
  if (bill.paidAmount.greaterThan(0)) {
    throw new ConflictError("Bills with payments cannot be cancelled");
  }

  const updated = await prisma.bill.update({
    where: { id },
    data: { status: "CANCELLED", outstanding: zero() },
  });

  await writeAuditLog(req, {
    action: "bill.cancelled",
    entityType: "bill",
    entityId: id,
    metadata: { billNumber: bill.billNumber },
  }, actorId);
  return updated;
}

export async function deleteBillPermanently(id: string, req: Request, actorId: string) {
  const bill = await prisma.bill.findUnique({ where: { id } });
  if (!bill) throw new NotFoundError("Bill not found");
  if (bill.status !== "CANCELLED") {
    throw new ConflictError("Only cancelled bills can be permanently deleted");
  }

  await prisma.bill.delete({ where: { id } });

  await writeAuditLog(req, {
    action: "bill.deleted",
    entityType: "bill",
    entityId: id,
    metadata: { billNumber: bill.billNumber },
  }, actorId);
  return { message: "Bill deleted permanently" };
}

// ---------------------------------------------------------------------------
// Monthly generation (idempotent)
// ---------------------------------------------------------------------------

/**
 * Create RENT bills for every active tenant for the given billing month.
 * Skips tenants that already have a bill (idempotent). Also ensures the
 * underlying RentRecord exists so the legacy rent ledger stays in sync.
 */
export async function generateMonthlyBills(
  billingMonth: string,
  req?: Request,
  actorId?: string,
) {
  const { billingDueDay, billingBillPrefix, transferBillingMode } = await getSettings(false);
  const dueDay = Number(billingDueDay ?? 5);
  const transferMode: "FULL_MONTH" | "PRORATED" = transferBillingMode === "PRORATED" ? "PRORATED" : "FULL_MONTH";
  const [y, m] = billingMonth.split("-").map((n) => Number(n));
  if (!y || !m || m < 1 || m > 12) {
    throw new ValidationError([{ path: "billingMonth", message: "Invalid billing month, expected YYYY-MM" }]);
  }
  const dueDate = new Date(y, m - 1, dueDay);

  const tenants = await prisma.tenant.findMany({
    where: { status: "ACTIVE", propertyId: { not: null } },
    include: { property: { select: { id: true } } },
  });

  const created: string[] = [];
  const skipped: string[] = [];

  for (const tenant of tenants) {
    const propertyId = tenant.propertyId!;

    // 1. RENT Bill
    const existingRentBill = await prisma.bill.findUnique({
      where: {
        tenantId_billingMonth_billType: {
          tenantId: tenant.id,
          billingMonth,
          billType: "RENT",
        },
      },
    });
    if (!existingRentBill) {
      const monthRent = await computeMonthRentForTenant(tenant, billingMonth, transferMode);
      let rentRecord = await prisma.rentRecord.findUnique({
        where: { tenantId_billingMonth: { tenantId: tenant.id, billingMonth } },
      });
      if (!rentRecord) {
        rentRecord = await prisma.rentRecord.create({
          data: {
            tenantId: tenant.id,
            propertyId,
            billingMonth,
            dueDate,
            rent: monthRent,
            additionalCharges: zero(),
            previousBalance: zero(),
            paidAmount: zero(),
            outstanding: monthRent,
            status: "PENDING",
          },
        });
      }

      const bill = await prisma.bill.create({
        data: {
          billNumber: await generateBillNumber(String(billingBillPrefix ?? "INV")),
          tenantId: tenant.id,
          propertyId,
          rentRecordId: rentRecord.id,
          billType: "RENT",
          billingMonth,
          dueDate,
          graceDate: new Date(dueDate.getTime() + 3 * 24 * 60 * 60 * 1000),
          amount: monthRent,
          paidAmount: rentRecord.paidAmount,
          penaltyAmount: zero(),
          outstanding: rentRecord.outstanding,
          status: computeBillStatus({
            dueDate,
            status: "PENDING",
            paidAmount: rentRecord.paidAmount,
            outstanding: rentRecord.outstanding,
          }),
          createdById: actorId ?? null,
        },
      });
      created.push(bill.id);

      const { notifyBillGenerated } = await import("./notification.service");
      await notifyBillGenerated(bill.id).catch(() => null);
    } else {
      skipped.push(tenant.id);
    }
  }

  if (req && actorId) {
    await writeAuditLog(req, {
      action: "bill.month_generated",
      entityType: "bill",
      metadata: { billingMonth, created: created.length, skipped: skipped.length },
    }, actorId);
  }

  return { billingMonth, created: created.length, skipped: skipped.length };
}

/** Ensure a RENT bill exists for a rent record (used by payment flows). */
export async function ensureRentBill(tx: Prisma.TransactionClient, rentRecordId: string, createdById?: string | null) {
  const rentRecord = await tx.rentRecord.findUnique({ where: { id: rentRecordId } });
  if (!rentRecord) throw new NotFoundError("Rent record not found");

  let bill = await tx.bill.findFirst({
    where: { rentRecordId, billType: "RENT" },
  });
  if (!bill) {
    bill = await tx.bill.create({
      data: {
        billNumber: await generateBillNumber("INV"),
        tenantId: rentRecord.tenantId,
        propertyId: rentRecord.propertyId,
        rentRecordId,
        billType: "RENT",
        billingMonth: rentRecord.billingMonth,
        dueDate: rentRecord.dueDate,
        graceDate: new Date(rentRecord.dueDate.getTime() + 3 * 24 * 60 * 60 * 1000),
        amount: add(rentRecord.rent, rentRecord.additionalCharges),
        paidAmount: rentRecord.paidAmount,
        penaltyAmount: zero(),
        outstanding: rentRecord.outstanding,
        status: computeBillStatus({
          dueDate: rentRecord.dueDate,
          status: "PENDING",
          paidAmount: rentRecord.paidAmount,
          outstanding: rentRecord.outstanding,
        }),
        createdById: createdById ?? null,
      },
    });
  }
  return bill;
}

// ---------------------------------------------------------------------------
// Payments / allocations
// ---------------------------------------------------------------------------

/** Apply a payment amount to a bill (inside a transaction). */
export async function applyPaymentToBill(
  tx: Prisma.TransactionClient,
  billId: string,
  amount: Prisma.Decimal,
) {
  const bill = await tx.bill.findUnique({ where: { id: billId } });
  if (!bill) throw new NotFoundError("Bill not found");
  if (bill.status === "WAIVED" || bill.status === "CANCELLED") {
    throw new ConflictError("Cannot pay a waived or cancelled bill");
  }

  if (gt(amount, bill.outstanding)) {
    throw new ValidationError([{ path: "allocations", message: `Allocated amount exceeds outstanding on bill ${bill.billNumber}` }]);
  }

  const paidAmount = add(bill.paidAmount, amount);
  const outstanding = sub(bill.outstanding, amount);
  const status = computeBillStatus({ dueDate: bill.dueDate, status: bill.status, paidAmount, outstanding });

  await tx.bill.update({
    where: { id: billId },
    data: { paidAmount, outstanding, status },
  });

  // Mirror RENT bill changes back to the linked rent record.
  if (bill.billType === "RENT" && bill.rentRecordId) {
    const rentRecord = await tx.rentRecord.findUnique({ where: { id: bill.rentRecordId } });
    if (rentRecord) {
      const rrPaid = add(rentRecord.paidAmount, amount);
      const total = add(add(rentRecord.previousBalance, rentRecord.rent), rentRecord.additionalCharges);
      const rrOutstanding = sub(total, rrPaid);
      const rrStatus: RentStatus =
        rrOutstanding.lessThanOrEqualTo(0)
          ? "PAID"
          : rrPaid.greaterThan(0)
            ? rentRecord.dueDate < new Date()
              ? "OVERDUE"
              : "PARTIAL"
            : rentRecord.dueDate < new Date()
              ? "OVERDUE"
              : "PENDING";
      await tx.rentRecord.update({
        where: { id: rentRecord.id },
        data: { paidAmount: rrPaid, outstanding: rrOutstanding, status: rrStatus },
      });
    }
  }

  return bill;
}

/** Recalculate bill paidAmount, outstanding, and status from all allocated payments. */
export async function recalculateBill(tx: Prisma.TransactionClient, billId: string) {
  const bill = await tx.bill.findUnique({
    where: { id: billId },
    include: { allocations: { include: { payment: true } } },
  });
  if (!bill) return;

  let paidAmount = zero();
  for (const alloc of bill.allocations) {
    const pStatus = alloc.payment?.paymentStatus;
    if (pStatus === "SUCCESS" || pStatus === "VERIFIED") {
      paidAmount = add(paidAmount, alloc.amount);
    }
  }

  const totalBillCost = add(bill.amount, bill.penaltyAmount);
  const outstanding = paidAmount.greaterThanOrEqualTo(totalBillCost) ? zero() : sub(totalBillCost, paidAmount);
  const status = computeBillStatus({ dueDate: bill.dueDate, status: bill.status, paidAmount, outstanding });

  await tx.bill.update({
    where: { id: billId },
    data: { paidAmount, outstanding, status },
  });

  if (bill.billType === "RENT" && bill.rentRecordId) {
    const rentRecord = await tx.rentRecord.findUnique({ where: { id: bill.rentRecordId } });
    if (rentRecord) {
      const rrTotal = add(add(rentRecord.previousBalance, rentRecord.rent), rentRecord.additionalCharges);
      const rrOutstanding = paidAmount.greaterThanOrEqualTo(rrTotal) ? zero() : sub(rrTotal, paidAmount);
      const rrStatus: RentStatus =
        rrOutstanding.lessThanOrEqualTo(0)
          ? "PAID"
          : paidAmount.greaterThan(0)
            ? rentRecord.dueDate < new Date()
              ? "OVERDUE"
              : "PARTIAL"
            : rentRecord.dueDate < new Date()
              ? "OVERDUE"
              : "PENDING";
      await tx.rentRecord.update({
        where: { id: rentRecord.id },
        data: { paidAmount, outstanding: rrOutstanding, status: rrStatus },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Penalties
// ---------------------------------------------------------------------------

export interface PenaltyCalc {
  daysOverdue: number;
  rate: Prisma.Decimal;
  amount: Prisma.Decimal;
  applicable: boolean;
}

export async function computePenaltyForBill(billId: string, now = new Date()): Promise<PenaltyCalc> {
  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: {
      home: { select: { latePenalty: true } },
      property: { select: { latePenalty: true } },
      tenant: {
        include: {
          home: { select: { latePenalty: true } },
          property: { select: { latePenalty: true } },
        },
      },
    },
  });
  if (!bill) throw new NotFoundError("Bill not found");

  // Late fee must ONLY be calculated from RENT bills. Utility bills have NO overdue penalty!
  if (bill.billType !== "RENT") {
    return { daysOverdue: 0, rate: zero(), amount: zero(), applicable: false };
  }

  // Once the underlying rent bill is fully paid, waived, or cancelled, late fee accrual stops.
  if (bill.outstanding.lessThanOrEqualTo(0) || bill.status === "PAID" || bill.status === "WAIVED" || bill.status === "CANCELLED") {
    return { daysOverdue: 0, rate: zero(), amount: zero(), applicable: false };
  }

  // Priority for overdue penalty amount:
  // 1. Home late penalty set during creation
  // 2. Property late penalty set during creation
  // 3. Fallback to settings / default (50)
  let penaltyPerDay = 50;
  if (bill.home?.latePenalty != null) {
    penaltyPerDay = Number(bill.home.latePenalty);
  } else if (bill.tenant?.home?.latePenalty != null) {
    penaltyPerDay = Number(bill.tenant.home.latePenalty);
  } else if (bill.property?.latePenalty != null) {
    penaltyPerDay = Number(bill.property.latePenalty);
  } else if (bill.tenant?.property?.latePenalty != null) {
    penaltyPerDay = Number(bill.tenant.property.latePenalty);
  } else {
    const settings = await getSettings(false);
    penaltyPerDay = Number(settings.latePenaltyPerDay ?? settings.billingPenaltyRate ?? 50);
  }

  const rate = toDecimal(String(Math.max(0, penaltyPerDay)));

  if (penaltyPerDay <= 0) {
    return { daysOverdue: 0, rate, amount: zero(), applicable: false };
  }

  // Calculate days overdue based on bill dueDate
  const dueStart = new Date(bill.dueDate.getFullYear(), bill.dueDate.getMonth(), bill.dueDate.getDate(), 0, 0, 0, 0);
  const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  let daysOverdue = 0;
  if (nowStart > dueStart) {
    const diffMs = nowStart.getTime() - dueStart.getTime();
    daysOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }

  if (daysOverdue <= 0) {
    return { daysOverdue: 0, rate, amount: zero(), applicable: false };
  }

  const amount = rate.times(daysOverdue).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  return { daysOverdue, rate, amount, applicable: amount.greaterThan(0) };
}

/** Recompute and apply penalty for a single bill (idempotent per day, updates existing record). */
export async function applyPenaltyToBill(billId: string, req?: Request, actorId?: string, now = new Date()) {
  const bill = await prisma.bill.findUnique({ where: { id: billId } });
  if (!bill) throw new NotFoundError("Bill not found");

  const calc = await computePenaltyForBill(billId, now);

  const updated = await prisma.$transaction(async (tx) => {
    // Upsert a SINGLE LATE_FEE bill for this tenant & month (no duplicates)
    const existingLateFee = await tx.bill.findFirst({
      where: { tenantId: bill.tenantId, billingMonth: bill.billingMonth, billType: "LATE_FEE" },
    });

    if (existingLateFee) {
      // Never modify a late fee that has already been PAID without explicit admin action
      if (existingLateFee.status === "PAID") {
        return existingLateFee;
      }

      const newAmount = calc.applicable ? calc.amount : existingLateFee.amount;
      const outstanding = gt(newAmount, existingLateFee.paidAmount)
        ? sub(newAmount, existingLateFee.paidAmount)
        : zero();

      return tx.bill.update({
        where: { id: existingLateFee.id },
        data: {
          amount: newAmount,
          outstanding,
          status: computeBillStatus({
            dueDate: existingLateFee.dueDate,
            status: existingLateFee.status,
            paidAmount: existingLateFee.paidAmount,
            outstanding,
          }),
        },
      });
    } else {
      if (!calc.applicable || calc.amount.equals(0)) {
        return bill;
      }
      const billNumber = `BILL-${bill.billingMonth.replace("-", "")}-LF-${bill.id.slice(-4).toUpperCase()}`;
      return tx.bill.create({
        data: {
          billNumber,
          tenantId: bill.tenantId,
          propertyId: bill.propertyId,
          rentRecordId: bill.rentRecordId,
          billType: "LATE_FEE",
          billingMonth: bill.billingMonth,
          dueDate: bill.dueDate,
          graceDate: bill.graceDate,
          amount: calc.amount,
          paidAmount: zero(),
          penaltyAmount: zero(),
          outstanding: calc.amount,
          status: "PENDING",
          createdById: actorId ?? null,
        },
      });
    }
  });

  if (req && actorId) {
    await writeAuditLog(req, {
      action: "bill.penalty_applied",
      entityType: "bill",
      entityId: billId,
      metadata: { amount: numberMoney(calc.amount), daysOverdue: calc.daysOverdue, billNumber: bill.billNumber },
    }, actorId);
  }

  return updated;
}

/** Recompute penalties for all open overdue bills. */
export async function applyAllPenalties(now = new Date()) {
  const bills = await prisma.bill.findMany({
    where: {
      billType: "RENT",
      status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
      outstanding: { gt: 0 },
    },
  });

  let applied = 0;
  for (const bill of bills) {
    const calc = await computePenaltyForBill(bill.id, now);
    await applyPenaltyToBill(bill.id, undefined, undefined, now);
    if (calc.applicable) applied += 1;
  }
  return applied;
}

export async function waivePenalty(billId: string, req: Request, actorId: string) {
  const bill = await prisma.bill.findUnique({ where: { id: billId } });
  if (!bill) throw new NotFoundError("Bill not found");

  const updated = await prisma.$transaction(async (tx) => {
    await tx.penalty.updateMany({
      where: { billId, status: "ACTIVE" },
      data: { status: "WAIVED" },
    });
    const outstanding = gt(bill.paidAmount, bill.amount) ? zero() : sub(bill.amount, bill.paidAmount);
    return tx.bill.update({
      where: { id: billId },
      data: { penaltyAmount: zero(), outstanding, status: computeBillStatus({ dueDate: bill.dueDate, status: bill.status, paidAmount: bill.paidAmount, outstanding }) },
    });
  });

  await writeAuditLog(req, {
    action: "bill.penalty_waived",
    entityType: "bill",
    entityId: billId,
    metadata: { billNumber: bill.billNumber },
  }, actorId);
  return updated;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export async function billSummary(query: Record<string, unknown> = {}) {
  const billingMonth = query.billingMonth ? String(query.billingMonth) : undefined;
  const from = query.from ? new Date(String(query.from)) : undefined;
  const to = query.to ? new Date(String(query.to)) : undefined;

  const summary = await getPeriodFinancialSummary({ billingMonth, from, to });

  const where: Prisma.BillWhereInput = {
    status: { not: "CANCELLED" },
    ...(summary.billingMonth ? { billingMonth: summary.billingMonth } : {}),
  };

  const [statusGroups, typeGroups] = await Promise.all([
    prisma.bill.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.bill.groupBy({ by: ["billType"], where, _sum: { amount: true, paidAmount: true, outstanding: true } }),
  ]);

  return {
    total: summary.totalBilled,
    collected: summary.collected,
    outstanding: summary.allTimeOutstanding ?? summary.outstanding,
    pending: summary.pending,
    overdue: summary.overdue,
    collectionRate: summary.collectionRate,
    totalPaymentsReceived: summary.totalPaymentsReceived,
    unallocated: summary.unallocated,
    count: statusGroups.reduce((s, g) => s + g._count._all, 0),
    byStatus: Object.fromEntries(
      statusGroups.map((g) => [g.status, g._count._all]),
    ),
    byType: Object.fromEntries(
      typeGroups.map((g) => [
        g.billType,
        {
          total: numberMoney(g._sum.amount ?? zero()),
          collected: numberMoney(g._sum.paidAmount ?? zero()),
          outstanding: numberMoney(g._sum.outstanding ?? zero()),
        },
      ]),
    ),
  };
}
