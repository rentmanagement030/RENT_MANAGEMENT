import { Prisma, RentStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { NotFoundError, ConflictError } from "../utils/http";
import { buildPagination, parsePagination } from "../utils/pagination";
import { add, sub, zero, toDecimal } from "../utils/money";
import { writeAuditLog } from "../utils/audit";
import { getPeriodFinancialSummary } from "./financial.service";
import { getSettings } from "./settings.service";
import { generateBillNumber, computeBillStatus } from "./bill.service";
import type { Request } from "express";

const rentInclude = {
  tenant: { select: { id: true, name: true, phone: true } },
  property: { select: { id: true, name: true, number: true, type: true } },
  payments: { orderBy: { createdAt: "desc" } },
} satisfies Prisma.RentRecordInclude;

export interface RentRecordInput {
  tenantId: string;
  propertyId: string;
  billingMonth: string;
  dueDate: Date;
  rent: number;
  additionalCharges?: number;
}

export function computeOutstanding(
  prev: Prisma.Decimal | number,
  rent: Prisma.Decimal | number,
  additional: Prisma.Decimal | number,
  paid: Prisma.Decimal | number,
) {
  return sub(add(add(prev, rent), additional), paid);
}

export function computeStatus(
  paid: Prisma.Decimal | number,
  total: Prisma.Decimal | number,
  dueDate: Date,
  outstanding: Prisma.Decimal | number,
): RentStatus {
  if (toDecimal(outstanding).lessThanOrEqualTo(0)) return "PAID";
  if (toDecimal(paid).greaterThan(0)) return dueDate < new Date() ? "OVERDUE" : "PARTIAL";
  return dueDate < new Date() ? "OVERDUE" : "PENDING";
}

/**
 * Automatically generate monthly rent records and bills for all active tenants.
 * Features:
 * - Strict duplicate prevention (idempotent per tenant & billingMonth)
 * - Pro-rata rent calculation for mid-month joinings:
 *   (e.g., joins 15th Aug: 10000 / 31 = 322.58 * 16 = 5161.29)
 * - Full normal rent and standard due date for subsequent months
 */
export async function autoGenerateMonthlyRent(targetMonth?: string, actorId?: string) {
  const now = new Date();
  const billingMonth = targetMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [y, m] = billingMonth.split("-").map((n) => Number(n));
  if (!y || !m || m < 1 || m > 12) return { created: 0, skipped: 0 };

  const { billingDueDay, billingBillPrefix } = await getSettings(false).catch(() => ({ billingDueDay: 5, billingBillPrefix: "INV" }));
  const defaultDueDay = Number(billingDueDay ?? 5);

  const activeTenants = await prisma.tenant.findMany({
    where: { status: "ACTIVE", propertyId: { not: null } },
  });

  const created: string[] = [];
  const skipped: string[] = [];

  for (const tenant of activeTenants) {
    const propertyId = tenant.propertyId!;

    // 1. Strict Duplicate Check
    const existing = await prisma.rentRecord.findUnique({
      where: {
        tenantId_billingMonth: {
          tenantId: tenant.id,
          billingMonth,
        },
      },
    });

    if (existing) {
      skipped.push(tenant.id);
      continue;
    }

    // 2. Joining date validation & Mid-month Pro-rata calculation
    let joinDay = 1;
    let isJoiningMonth = false;
    if (tenant.joiningDate) {
      const jDate = new Date(tenant.joiningDate);
      const joinYear = jDate.getFullYear();
      const joinMonth = jDate.getMonth() + 1;
      joinDay = jDate.getDate();
      const joinMonthStr = `${joinYear}-${String(joinMonth).padStart(2, "0")}`;

      if (billingMonth < joinMonthStr) {
        // Tenant has not joined yet in this billing month
        skipped.push(tenant.id);
        continue;
      }
      if (billingMonth === joinMonthStr) {
        isJoiningMonth = true;
      }
    }

    const daysInMonth = new Date(y, m, 0).getDate();
    let monthRent: Prisma.Decimal;

    if (isJoiningMonth && joinDay > 1) {
      // Pro-rata for mid-month joining
      const remainingDays = Math.max(1, daysInMonth - joinDay);
      const fullRent = tenant.rent.toNumber();
      const perDayRent = fullRent / daysInMonth;
      const proratedRent = Math.round(perDayRent * remainingDays * 100) / 100;
      monthRent = new Prisma.Decimal(proratedRent);
    } else {
      monthRent = tenant.rent;
    }

    // Determine due date
    const dueDay = isJoiningMonth ? Math.max(defaultDueDay, joinDay) : defaultDueDay;
    const dueDate = new Date(y, m - 1, Math.min(dueDay, daysInMonth));

    // Previous outstanding balance calculation
    const previous = await prisma.rentRecord.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { billingMonth: "desc" },
    });
    const previousBalance = previous ? previous.outstanding : zero();
    const total = add(previousBalance, monthRent);
    const status = computeStatus(0, 0, dueDate, total);

    try {
      const record = await prisma.rentRecord.create({
        data: {
          tenantId: tenant.id,
          propertyId,
          homeId: tenant.homeId || null,
          billingMonth,
          dueDate,
          rent: monthRent,
          additionalCharges: zero(),
          previousBalance,
          paidAmount: zero(),
          outstanding: total,
          status,
        },
      });

      // Ensure corresponding Bill is also created
      const existingBill = await prisma.bill.findUnique({
        where: {
          tenantId_billingMonth_billType: {
            tenantId: tenant.id,
            billingMonth,
            billType: "RENT",
          },
        },
      });

      if (!existingBill) {
        const newBill = await prisma.bill.create({
          data: {
            billNumber: await generateBillNumber(String(billingBillPrefix ?? "INV")),
            tenantId: tenant.id,
            propertyId,
            rentRecordId: record.id,
            billType: "RENT",
            billingMonth,
            dueDate,
            graceDate: new Date(dueDate.getTime() + 3 * 24 * 60 * 60 * 1000),
            amount: monthRent,
            paidAmount: zero(),
            penaltyAmount: zero(),
            outstanding: total,
            status: computeBillStatus({
              dueDate,
              status: "PENDING",
              paidAmount: zero(),
              outstanding: total,
            }),
            createdById: actorId ?? null,
          },
        });

        const { notifyBillGenerated } = await import("./notification.service");
        await notifyBillGenerated(newBill.id).catch(() => null);
      }

      created.push(record.id);
    } catch {
      skipped.push(tenant.id);
    }
  }

  return { created: created.length, skipped: skipped.length };
}

export async function listRentRecords(query: Record<string, unknown>) {
  // Automatically generate current / queried month rent dues without waiting for manual action
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const billingMonth = query.billingMonth ? String(query.billingMonth) : undefined;
  await autoGenerateMonthlyRent(billingMonth || currentMonth).catch(() => null);

  const { page, pageSize } = parsePagination(query);
  const tenantId = query.tenantId ? String(query.tenantId) : undefined;
  const propertyId = query.propertyId ? String(query.propertyId) : undefined;
  const status = query.status ? String(query.status) : undefined;

  const summary = await getPeriodFinancialSummary({ billingMonth, propertyId });

  const where: Prisma.RentRecordWhereInput = {
    ...(tenantId ? { tenantId } : {}),
    ...(propertyId ? { propertyId } : {}),
    ...(status ? { status: status as RentStatus } : {}),
    ...(billingMonth ? { billingMonth } : {}),
  };

  const [total, records, rentAggregation] = await Promise.all([
    prisma.rentRecord.count({ where }),
    prisma.rentRecord.findMany({
      where,
      include: rentInclude,
      orderBy: [{ billingMonth: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.rentRecord.aggregate({
      where,
      _sum: {
        rentAmount: true,
        paidAmount: true,
        dueAmount: true,
      },
    }),
  ]);

  const totalRentBilled = Number(rentAggregation._sum.rentAmount ?? 0);
  const totalRentPaid = Number(rentAggregation._sum.paidAmount ?? 0);
  const totalRentDue = Number(rentAggregation._sum.dueAmount ?? 0);
  const rentCollectionRate = totalRentBilled > 0 ? (totalRentPaid / totalRentBilled) * 100 : 0;

  const pagination = buildPagination(records, total, { page, pageSize });

  return {
    ...pagination,
    summary: {
      totalExpectedRent: totalRentBilled,
      totalCollectedRent: totalRentPaid,
      totalOutstandingRent: totalRentDue,
      totalCashInflow: totalRentPaid,
      collectionRate: rentCollectionRate,
    },
  };
}

export async function getRentRecord(id: string) {
  const record = await prisma.rentRecord.findUnique({ where: { id }, include: rentInclude });
  if (!record) throw new NotFoundError("Rent record not found");
  return record;
}

export async function createRentRecord(input: RentRecordInput, req: Request, actorId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId } });
  if (!tenant) throw new NotFoundError("Tenant not found");
  const property = await prisma.property.findUnique({ where: { id: input.propertyId } });
  if (!property) throw new NotFoundError("Property not found");

  const existing = await prisma.rentRecord.findUnique({
    where: { tenantId_billingMonth: { tenantId: input.tenantId, billingMonth: input.billingMonth } },
  });
  if (existing) throw new ConflictError(`Rent record already exists for ${input.billingMonth}`);

  const previous = await prisma.rentRecord.findFirst({
    where: { tenantId: input.tenantId },
    orderBy: { billingMonth: "desc" },
  });
  const previousBalance = previous ? previous.outstanding : zero();
  const rent = toDecimal(input.rent);
  const additional = toDecimal(input.additionalCharges ?? 0);
  const total = add(add(previousBalance, rent), additional);
  const status = computeStatus(0, 0, input.dueDate, total);

  const record = await prisma.rentRecord.create({
    data: {
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      billingMonth: input.billingMonth,
      dueDate: input.dueDate,
      rent,
      additionalCharges: additional,
      previousBalance,
      paidAmount: zero(),
      outstanding: total,
      status,
    },
  });

  await writeAuditLog(req, {
    action: "rent.created",
    entityType: "rent_record",
    entityId: record.id,
    metadata: { tenantId: input.tenantId, billingMonth: input.billingMonth },
  }, actorId);

  return record;
}

export async function updateRentRecord(
  id: string,
  input: Partial<{ dueDate?: Date; additionalCharges?: number; status?: RentStatus }>,
  req: Request,
  actorId: string,
) {
  const record = await prisma.rentRecord.findUnique({ where: { id } });
  if (!record) throw new NotFoundError("Rent record not found");

  let additional = record.additionalCharges;
  if (input.additionalCharges !== undefined) {
    additional = toDecimal(input.additionalCharges);
  }

  const outstanding = computeOutstanding(
    record.previousBalance,
    record.rent,
    additional,
    record.paidAmount,
  );
  const status = input.status ?? computeStatus(
    record.paidAmount,
    add(add(record.previousBalance, record.rent), additional),
    input.dueDate ?? record.dueDate,
    outstanding,
  );

  const updated = await prisma.rentRecord.update({
    where: { id },
    data: {
      dueDate: input.dueDate,
      additionalCharges: additional,
      outstanding,
      status,
    },
  });

  await writeAuditLog(req, {
    action: "rent.updated",
    entityType: "rent_record",
    entityId: id,
  }, actorId);
  return updated;
}

export async function addRentAdjustment(
  rentRecordId: string,
  data: { type: "CHARGE" | "DISCOUNT"; amount: number; reason: string },
  req: Request,
  actorId: string,
) {
  const record = await prisma.rentRecord.findUnique({ where: { id: rentRecordId } });
  if (!record) throw new NotFoundError("Rent record not found");

  const amount = toDecimal(data.amount);
  const signed = data.type === "CHARGE" ? amount : amount.negated();

  const updated = await prisma.$transaction(async (tx) => {
    await tx.rentAdjustment.create({
      data: {
        rentRecordId,
        type: data.type,
        amount,
        reason: data.reason,
        adjustedById: actorId,
      },
    });
    const outstanding = add(record.outstanding, signed);
    const status = computeStatus(record.paidAmount, 0, record.dueDate, outstanding);
    return tx.rentRecord.update({
      where: { id: rentRecordId },
      data: { outstanding, status },
    });
  });

  await writeAuditLog(req, {
    action: "rent.adjustment",
    entityType: "rent_record",
    entityId: rentRecordId,
    metadata: { type: data.type, amount: data.amount, reason: data.reason },
  }, actorId);
  return updated;
}

/** Applied inside a payment transaction. Returns updated record. */
export async function applyPaymentToRent(
  tx: Prisma.TransactionClient,
  rentRecordId: string,
  amount: Prisma.Decimal,
) {
  const record = await tx.rentRecord.findUnique({ where: { id: rentRecordId } });
  if (!record) throw new NotFoundError("Rent record not found");

  const paidAmount = add(record.paidAmount, amount);
  const outstanding = computeOutstanding(
    record.previousBalance,
    record.rent,
    record.additionalCharges,
    paidAmount,
  );
  const total = add(add(record.previousBalance, record.rent), record.additionalCharges);
  const status = computeStatus(paidAmount, total, record.dueDate, outstanding);

  return tx.rentRecord.update({
    where: { id: rentRecordId },
    data: { paidAmount, outstanding, status },
  });
}

export async function deleteRentRecord(id: string, req: Request, actorId: string) {
  const record = await prisma.rentRecord.findUnique({ where: { id } });
  if (!record) throw new NotFoundError("Rent record not found");
  if (record.status !== "WAIVED") {
    throw new ConflictError("Only cancelled or waived rent records can be deleted");
  }

  await prisma.rentRecord.delete({ where: { id } });

  await writeAuditLog(req, {
    action: "rent.deleted",
    entityType: "rent_record",
    entityId: id,
    metadata: { billingMonth: record.billingMonth },
  }, actorId);
  return { message: "Rent record deleted permanently" };
}
