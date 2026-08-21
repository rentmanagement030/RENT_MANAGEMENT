import { Prisma, PaymentMethod, PaymentStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { NotFoundError, ConflictError, ValidationError } from "../utils/http";
import { buildPagination, parsePagination } from "../utils/pagination";
import { add, toDecimal, zero, gt, numberMoney, sub } from "../utils/money";
import { applyPaymentToBill, ensureRentBill, recalculateBill } from "./bill.service";
import { getPeriodFinancialSummary } from "./financial.service";
import { enqueueNotification } from "./notification.service";
import { nanoid } from "nanoid";
import type { Request } from "express";

const paymentInclude = {
  tenant: { select: { id: true, name: true, phone: true } },
  property: { select: { id: true, name: true, number: true, type: true } },
  rentRecord: { select: { id: true, billingMonth: true, dueDate: true } },
  createdBy: { select: { id: true, name: true } },
  verifiedBy: { select: { id: true, name: true } },
} satisfies Prisma.PaymentInclude;

export interface RecordPaymentInput {
  tenantId: string;
  rentRecordId?: string;
  amount: number;
  paymentDate: Date;
  method: PaymentMethod;
  notes?: string;
  bankName?: string;
  bankReferenceNumber?: string;
  ddNumber?: string;
  ddDate?: Date;
  cashAmount?: number;
  upiAmount?: number;
  upiApp?: string;
  waivePenalty?: boolean;
  allocations?: { billId?: string; rentRecordId?: string; amount: number }[];
}

export function generateReceiptNumber(): string {
  const d = new Date();
  const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `REC-${ym}-${nanoid(6).toUpperCase()}`;
}

async function validateRentForPayment(rentRecordId: string, amount: Prisma.Decimal, tenantId: string) {
  const record = await prisma.rentRecord.findUnique({ where: { id: rentRecordId } });
  if (!record) throw new NotFoundError("Rent record not found");
  if (record.tenantId !== tenantId) throw new ConflictError("Rent record does not belong to this tenant");
  if (record.status === "WAIVED") throw new ConflictError("Rent record is waived");
  if (gt(amount, record.outstanding)) {
    throw new ValidationError([
      { path: "amount", message: "Amount exceeds the outstanding balance for this rent record" },
    ]);
  }
  return record;
}

export async function listPayments(query: Record<string, unknown>) {
  const { page, pageSize } = parsePagination(query);
  const tenantId = query.tenantId ? String(query.tenantId) : undefined;
  const propertyId = query.propertyId ? String(query.propertyId) : undefined;
  const method = query.method ? String(query.method) : undefined;
  const status = query.status ? String(query.status) : undefined;
  const search = query.search ? String(query.search).trim() : undefined;
  const period = query.period ? String(query.period).trim() : undefined;

  let from = query.from ? new Date(String(query.from)) : undefined;
  let to = query.to ? new Date(String(query.to)) : undefined;

  // Resolve period filter if provided (e.g. "2026-08", "CURRENT", "PREVIOUS", "ALL")
  if (period && period !== "ALL") {
    let targetYear = 0;
    let targetMonth = 0; // 1-indexed

    if (period === "CURRENT") {
      const now = new Date();
      targetYear = now.getFullYear();
      targetMonth = now.getMonth() + 1;
    } else if (period === "PREVIOUS") {
      const now = new Date();
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      targetYear = prev.getFullYear();
      targetMonth = prev.getMonth() + 1;
    } else if (period.match(/^\d{4}-\d{2}$/)) {
      const [y, m] = period.split("-").map(Number);
      targetYear = y;
      targetMonth = m;
    }

    if (targetYear > 0 && targetMonth > 0) {
      from = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0, 0));
      to = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999));
    }
  }

  const where: Prisma.PaymentWhereInput = {
    ...(tenantId ? { tenantId } : {}),
    ...(propertyId ? { propertyId } : {}),
    ...(method ? { paymentMethod: method as PaymentMethod } : {}),
    ...(status ? { paymentStatus: status as PaymentStatus } : {}),
    ...(from || to ? { paymentDate: { gte: from, lte: to } } : {}),
    ...(search
      ? {
          OR: [
            { receiptNumber: { contains: search, mode: "insensitive" } },
            { bankReferenceNumber: { contains: search, mode: "insensitive" } },
            { tenant: { name: { contains: search, mode: "insensitive" } } },
            { tenant: { phone: { contains: search, mode: "insensitive" } } },
            { property: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, payments, summaryAgg, pendingAgg, methodGroups] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      include: paymentInclude,
      orderBy: { paymentDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.payment.aggregate({
      where: {
        ...where,
        paymentStatus: { in: ["SUCCESS", "VERIFIED"] },
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.payment.aggregate({
      where: {
        ...where,
        paymentStatus: { in: ["PENDING", "PENDING_VERIFICATION"] },
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.payment.groupBy({
      by: ["paymentMethod"],
      where: {
        ...where,
        paymentStatus: { in: ["SUCCESS", "VERIFIED"] },
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
  ]);

  const totalCollected = numberMoney(summaryAgg._sum?.amount ?? zero());
  const pendingAmount = numberMoney(pendingAgg._sum?.amount ?? zero());
  const pendingCount = pendingAgg._count?.id ?? 0;

  const methodTotals = methodGroups.map((g) => ({
    method: g.paymentMethod,
    total: numberMoney(g._sum?.amount ?? zero()),
    count: g._count?.id ?? 0,
  }));

  const pagination = buildPagination(payments, total, { page, pageSize });

  const finSummary = await getPeriodFinancialSummary({
    billingMonth: period && period.match(/^\d{4}-\d{2}$/) ? period : undefined,
    propertyId,
  });

  return {
    ...pagination,
    summary: {
      totalCollected,
      totalCount: total,
      pendingCount,
      pendingAmount,
      methodTotals,
      grossBilled: finSummary.netBilled,
      billedCollections: finSummary.collected,
      totalCashInflow: finSummary.totalPaymentsReceived,
      totalOutstanding: finSummary.allTimeOutstanding ?? finSummary.outstanding,
    },
  };
}

export async function getPayment(id: string) {
  const payment = await prisma.payment.findUnique({ where: { id }, include: paymentInclude });
  if (!payment) throw new NotFoundError("Payment not found");
  return payment;
}

// ---------------------------------------------------------------------------
// Bill allocations (multi-bill payments)
// ---------------------------------------------------------------------------

/**
 * Resolve allocation targets for a payment. If explicit allocations are given
 * they must sum to the payment amount. Otherwise, falls back to the rent
 * record's RENT bill so the legacy single-target flow stays in sync.
 */
async function resolveAllocations(
  tx: Prisma.TransactionClient,
  tenantId: string,
  amount: Prisma.Decimal,
  allocations?: { billId?: string; rentRecordId?: string; amount: number }[],
  rentRecordId?: string,
): Promise<{ billId: string; amount: Prisma.Decimal }[]> {
  if (allocations && allocations.length) {
    const resolvedAllocations: { billId: string; amount: number }[] = [];
    for (const a of allocations) {
      if (a.billId) {
        resolvedAllocations.push({ billId: a.billId, amount: a.amount });
      } else if (a.rentRecordId) {
        const rentBill = await ensureRentBill(tx, a.rentRecordId);
        resolvedAllocations.push({ billId: rentBill.id, amount: a.amount });
      }
    }

    const sum = resolvedAllocations.reduce((s, a) => add(s, toDecimal(a.amount)), zero());
    if (!sum.equals(amount)) {
      throw new ValidationError([
        { path: "allocations", message: "Allocated amounts must add up to the payment amount" },
      ]);
    }
    const targets: { billId: string; amount: Prisma.Decimal }[] = [];
    for (const a of resolvedAllocations) {
      const bill = await tx.bill.findUnique({ where: { id: a.billId } });
      if (!bill) throw new NotFoundError("Bill not found");
      if (bill.tenantId !== tenantId) {
        throw new ConflictError("Allocated bill does not belong to this tenant");
      }
      if (gt(toDecimal(a.amount), bill.outstanding)) {
        throw new ValidationError([
          { path: "allocations", message: `Allocated amount exceeds outstanding on bill ${bill.billNumber}` },
        ]);
      }
      targets.push({ billId: a.billId, amount: toDecimal(a.amount) });
    }
    return targets;
  }

  if (!rentRecordId) {
    throw new ValidationError([{ path: "allocations", message: "Provide bill allocations or a rent record to pay" }]);
  }
  const bill = await ensureRentBill(tx, rentRecordId);
  return [{ billId: bill.id, amount }];
}

async function applyAllocations(
  tx: Prisma.TransactionClient,
  paymentId: string,
  targets: { billId: string; amount: Prisma.Decimal }[],
) {
  for (const target of targets) {
    await applyPaymentToBill(tx, target.billId, target.amount);
    await tx.paymentAllocation.create({
      data: { paymentId, billId: target.billId, amount: target.amount },
    });
  }
}

export async function recordManualPayment(input: RecordPaymentInput, req: Request, actorId: string) {
  const amount = toDecimal(input.amount);
  const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId } });
  if (!tenant) throw new NotFoundError("Tenant not found");
  if (input.rentRecordId && (!input.allocations || !input.allocations.length)) {
    await validateRentForPayment(input.rentRecordId, amount, input.tenantId);
  }

  const receiptNumber = generateReceiptNumber();
  const paymentStatus: PaymentStatus =
    input.method === "BANK_TRANSFER_DD" ? "PENDING_VERIFICATION" : "SUCCESS";

  const payment = await prisma.$transaction(async (tx) => {
    const targets = await resolveAllocations(tx, input.tenantId, amount, input.allocations, input.rentRecordId);
    const firstBill = await tx.bill.findUnique({ where: { id: targets[0].billId } });
    const propertyId = tenant.propertyId ?? firstBill?.propertyId ?? "";

    if (input.waivePenalty) {
      for (const target of targets) {
        const b = await tx.bill.findUnique({ where: { id: target.billId } });
        if (b && b.billType === "RENT") {
          await tx.penalty.updateMany({
            where: { billId: b.id, status: "ACTIVE" },
            data: { status: "WAIVED" },
          });
          const outstanding = gt(b.paidAmount, b.amount) ? zero() : sub(b.amount, b.paidAmount);
          await tx.bill.update({
            where: { id: b.id },
            data: { penaltyAmount: zero(), outstanding },
          });
        }
      }
    }

    const cAmt = input.cashAmount != null ? toDecimal(input.cashAmount) : null;
    const uAmt = input.upiAmount != null ? toDecimal(input.upiAmount) : null;
    let finalMethod = input.method;
    if (cAmt && gt(cAmt, 0) && uAmt && gt(uAmt, 0)) {
      finalMethod = "MIXED";
    }

    const created = await tx.payment.create({
      data: {
        tenantId: input.tenantId,
        propertyId,
        rentRecordId: input.rentRecordId ?? null,
        amount,
        currency: "INR",
        paymentMethod: finalMethod,
        paymentStatus,
        paymentDate: input.paymentDate,
        cashAmount: cAmt,
        upiAmount: uAmt,
        upiApp: input.upiApp ?? null,
        bankName: input.bankName ?? null,
        bankReferenceNumber: input.bankReferenceNumber ?? null,
        ddNumber: input.ddNumber ?? null,
        ddDate: input.ddDate ?? null,
        receiptNumber,
        notes: input.notes ?? null,
        createdById: actorId,
        ...(paymentStatus === "SUCCESS" ? { verifiedById: actorId, verifiedAt: new Date() } : {}),
      },
    });

    // Only SUCCESS payments reduce outstanding.
    if (paymentStatus === "SUCCESS") {
      await applyAllocations(tx, created.id, targets);
      await enqueueNotification(input.tenantId, {
        type: "PAYMENT_CONFIRMATION",
        amount,
        receiptNumber,
        method: input.method,
      });
    }

    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: "payment.created",
        entityType: "payment",
        entityId: created.id,
        metadata: {
          method: input.method,
          amount: input.amount,
          status: paymentStatus,
          bills: targets.map((t) => t.billId),
        },
        ip: req.ip,
        userAgent: req.get("user-agent"),
      },
    });

    return created;
  });

  return payment;
}

export async function verifyBankPayment(
  paymentId: string,
  status: "VERIFIED" | "REJECTED",
  req: Request,
  actorId: string,
) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new NotFoundError("Payment not found");
  if (payment.paymentMethod !== "BANK_TRANSFER_DD") {
    throw new ConflictError("Only bank transfer / DD payments can be verified");
  }
  if (payment.paymentStatus !== "PENDING_VERIFICATION") {
    throw new ConflictError("Payment is not pending verification");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.payment.update({
      where: { id: paymentId },
      data: {
        paymentStatus: status,
        verifiedById: actorId,
        verifiedAt: new Date(),
      },
    });
    if (status === "VERIFIED") {
      const targets = await resolveAllocations(tx, payment.tenantId, payment.amount, undefined, payment.rentRecordId ?? undefined);
      await applyAllocations(tx, paymentId, targets);
      await enqueueNotification(payment.tenantId, {
        type: "PAYMENT_CONFIRMATION",
        amount: payment.amount,
        receiptNumber: payment.receiptNumber ?? "",
        method: "BANK_TRANSFER_DD",
      });
    }
    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: status === "VERIFIED" ? "payment.verified" : "payment.rejected",
        entityType: "payment",
        entityId: paymentId,
        metadata: { status },
        ip: req.ip,
        userAgent: req.get("user-agent"),
      },
    });
    return result;
  });

  return updated;
}

/**
 * Record a verified Razorpay payment (from webhook).
 * Must be idempotent: a razorpay_payment_id can only ever create one payment.
 */
export async function recordRazorpayPayment(data: {
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
  razorpayWebhookEventId: string;
  amount: Prisma.Decimal;
  currency: string;
  tenantId: string;
  rentRecordId?: string;
  billId?: string;
  paymentDate: Date;
  notes?: string;
}, _req: Request) {
  const existing = await prisma.payment.findUnique({
    where: { razorpayPaymentId: data.razorpayPaymentId },
  });
  if (existing) return { payment: existing, created: false };

  const receiptNumber = generateReceiptNumber();
  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        tenantId: data.tenantId,
        propertyId: (await tx.tenant.findUnique({ where: { id: data.tenantId } }))!.propertyId!,
        rentRecordId: data.rentRecordId,
        amount: data.amount,
        currency: data.currency,
        paymentMethod: "RAZORPAY_UPI",
        paymentStatus: "SUCCESS",
        paymentDate: data.paymentDate,
        razorpayPaymentId: data.razorpayPaymentId,
        razorpayOrderId: data.razorpayOrderId,
        razorpaySignature: data.razorpaySignature,
        razorpayWebhookEventId: data.razorpayWebhookEventId,
        receiptNumber,
        notes: data.notes ?? null,
        verifiedAt: new Date(),
      },
    });

    const targets = data.billId
      ? [{ billId: data.billId, amount: data.amount }]
      : await resolveAllocations(tx, data.tenantId, data.amount, undefined, data.rentRecordId);
    await applyAllocations(tx, created.id, targets);
    await enqueueNotification(data.tenantId, {
      type: "PAYMENT_CONFIRMATION",
      amount: data.amount,
      receiptNumber,
      method: "RAZORPAY_UPI",
    });

    await tx.auditLog.create({
      data: {
        action: "payment.razorpay_recorded",
        entityType: "payment",
        entityId: created.id,
        metadata: {
          razorpayPaymentId: data.razorpayPaymentId,
          razorpayOrderId: data.razorpayOrderId,
          amount: numberMoney(data.amount),
          webhookEventId: data.razorpayWebhookEventId,
        },
      },
    });

    await tx.paymentLink.updateMany({
      where: { razorpayOrderId: data.razorpayOrderId },
      data: { status: "PAID", paidAt: new Date() },
    });

    return created;
  });

  return { payment, created: true };
}

// ---------------------------------------------------------------------------
// Outstanding / reconciliation
// ---------------------------------------------------------------------------

export async function listOutstanding(query: Record<string, unknown>) {
  const { page, pageSize } = parsePagination(query);
  const search = String(query.search ?? "").trim();
  const onlyOverdue = query.overdue === "true";

  const openBillWhere: Prisma.BillWhereInput = {
    status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
    outstanding: { gt: 0 },
  };

  const tenantWhere: Prisma.TenantWhereInput = {
    status: { in: ["ACTIVE", "PENDING"] },
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
          ],
        }
      : {}),
    ...(onlyOverdue
      ? {
          OR: [
            { rentRecords: { some: { status: "OVERDUE" } } },
            { bills: { some: { ...openBillWhere, status: "OVERDUE" } } },
          ],
        }
      : {}),
  };

  const [total, tenants] = await Promise.all([
    prisma.tenant.count({ where: tenantWhere }),
    prisma.tenant.findMany({
      where: tenantWhere,
      include: {
        property: { select: { id: true, name: true, number: true } },
        rentRecords: { select: { id: true, billingMonth: true, outstanding: true, status: true, dueDate: true } },
        bills: { where: openBillWhere, select: { id: true, billNumber: true, billType: true, billingMonth: true, outstanding: true, status: true, dueDate: true }, orderBy: { billingMonth: "desc" } },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const items = tenants.map((t) => {
    const unbilledRentRecords = t.rentRecords.filter((r) => gt(r.outstanding, 0) && !t.bills.some((b) => b.billingMonth === r.billingMonth && b.billType === "RENT"));

    const rentOutstanding = unbilledRentRecords.reduce((sum, r) => add(sum, r.outstanding), zero());
    const billOutstanding = t.bills.reduce((sum, b) => add(sum, b.outstanding), zero());
    const totalOutstanding = add(rentOutstanding, billOutstanding);
    const rentOverdue = unbilledRentRecords.some((r) => r.status === "OVERDUE");
    const billOverdue = t.bills.some((b) => b.status === "OVERDUE");
    
    const records = [
      ...unbilledRentRecords.map((r) => ({
          id: r.id,
          rentRecordId: r.id,
          billId: null as string | null,
          kind: "rent" as const,
          billingMonth: r.billingMonth,
          outstanding: numberMoney(r.outstanding),
          status: r.status,
          dueDate: r.dueDate,
        })),
      ...t.bills.map((b) => ({
        id: b.id,
        rentRecordId: null as string | null,
        billId: b.id,
        kind: "bill" as const,
        billingMonth: b.billingMonth,
        outstanding: numberMoney(b.outstanding),
        status: b.status,
        dueDate: b.dueDate,
        label: `${b.billType} bill`,
      })),
    ].sort((a, b) => b.billingMonth.localeCompare(a.billingMonth));

    return {
      tenantId: t.id,
      name: t.name,
      phone: t.phone,
      property: t.property,
      totalOutstanding: numberMoney(totalOutstanding),
      overdue: rentOverdue || billOverdue,
      records: records.slice(0, 12),
    };
  });

  return buildPagination(items, total, { page, pageSize });
}

export async function reconcileRazorpay() {
  const payments = await prisma.payment.findMany({
    where: { paymentMethod: "RAZORPAY_UPI", paymentStatus: "SUCCESS" },
    select: {
      id: true,
      razorpayPaymentId: true,
      amount: true,
      paymentDate: true,
      receiptNumber: true,
    },
    orderBy: { paymentDate: "desc" },
    take: 500,
  });
  const paidLinks = await prisma.paymentLink.findMany({ where: { status: "PAID" } });
  return {
    appPayments: payments,
    matchedLinks: paidLinks.length,
    unmatched: payments.filter((p) => !p.razorpayPaymentId).length,
  };
}

export async function getPaymentMethodsTotals(from?: Date, to?: Date) {
  const where: Prisma.PaymentWhereInput = {
    paymentStatus: { in: ["SUCCESS", "VERIFIED"] },
    ...(from || to ? { paymentDate: { gte: from, lte: to } } : {}),
  };
  const groups = await prisma.payment.groupBy({
    by: ["paymentMethod"],
    where,
    _sum: { amount: true },
  });
  return groups.map((g) => ({ method: g.paymentMethod, total: numberMoney(g._sum.amount ?? zero()) }));
}

export async function reconcileUnallocatedPayments() {
  const payments = await prisma.payment.findMany({
    where: { paymentStatus: { in: ["SUCCESS", "VERIFIED"] } },
    include: {
      tenant: {
        include: {
          bills: {
            where: { status: { in: ["PENDING", "PARTIAL", "OVERDUE"] }, outstanding: { gt: 0 } },
            orderBy: { billingMonth: "asc" },
          },
        },
      },
      allocations: true,
    },
    orderBy: { paymentDate: "asc" },
  });

  let reconciledCount = 0;
  let reconciledAmount = zero();

  for (const p of payments) {
    const pAmt = p.amount;
    const currentAllocated = p.allocations.reduce((sum, a) => add(sum, a.amount), zero());
    let unallocated = sub(pAmt, currentAllocated);

    if (gt(unallocated, 0)) {
      if (p.rentRecordId) {
        const rentBill = await prisma.bill.findFirst({
          where: { rentRecordId: p.rentRecordId, status: { in: ["PENDING", "PARTIAL", "OVERDUE"] }, outstanding: { gt: 0 } },
        });
        if (rentBill) {
          const allocAmount = unallocated.greaterThan(rentBill.outstanding) ? rentBill.outstanding : unallocated;
          if (gt(allocAmount, 0)) {
            await prisma.paymentAllocation.create({
              data: { paymentId: p.id, billId: rentBill.id, amount: allocAmount },
            });
            await recalculateBill(prisma, rentBill.id);
            unallocated = sub(unallocated, allocAmount);
            reconciledCount++;
            reconciledAmount = add(reconciledAmount, allocAmount);
          }
        }
      }

      if (gt(unallocated, 0) && p.tenant) {
        for (const bill of p.tenant.bills) {
          if (!gt(unallocated, 0)) break;
          const freshBill = await prisma.bill.findUnique({ where: { id: bill.id } });
          if (!freshBill || !gt(freshBill.outstanding, 0)) continue;

          const allocAmount = unallocated.greaterThan(freshBill.outstanding) ? freshBill.outstanding : unallocated;
          if (gt(allocAmount, 0)) {
            await prisma.paymentAllocation.create({
              data: { paymentId: p.id, billId: freshBill.id, amount: allocAmount },
            });
            await recalculateBill(prisma, freshBill.id);
            unallocated = sub(unallocated, allocAmount);
            reconciledCount++;
            reconciledAmount = add(reconciledAmount, allocAmount);
          }
        }
      }
    }
  }

  return { reconciledCount, reconciledAmount: numberMoney(reconciledAmount) };
}
