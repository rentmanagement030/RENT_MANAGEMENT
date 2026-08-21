import { Prisma, RentStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { NotFoundError, ConflictError } from "../utils/http";
import { buildPagination, parsePagination } from "../utils/pagination";
import { add, sub, zero, toDecimal } from "../utils/money";
import { writeAuditLog } from "../utils/audit";
import { getPeriodFinancialSummary } from "./financial.service";
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

export async function listRentRecords(query: Record<string, unknown>) {
  const { page, pageSize } = parsePagination(query);
  const tenantId = query.tenantId ? String(query.tenantId) : undefined;
  const propertyId = query.propertyId ? String(query.propertyId) : undefined;
  const status = query.status ? String(query.status) : undefined;
  const billingMonth = query.billingMonth ? String(query.billingMonth) : undefined;

  const summary = await getPeriodFinancialSummary({ billingMonth, propertyId });

  const where: Prisma.RentRecordWhereInput = {
    ...(tenantId ? { tenantId } : {}),
    ...(propertyId ? { propertyId } : {}),
    ...(status ? { status: status as RentStatus } : {}),
    ...(billingMonth ? { billingMonth } : {}),
  };

  const [total, records] = await Promise.all([
    prisma.rentRecord.count({ where }),
    prisma.rentRecord.findMany({
      where,
      include: rentInclude,
      orderBy: [{ billingMonth: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const pagination = buildPagination(records, total, { page, pageSize });

  return {
    ...pagination,
    summary: {
      totalExpectedRent: summary.totalBilled,
      totalCollectedRent: summary.collected,
      totalOutstandingRent: summary.allTimeOutstanding ?? summary.outstanding,
      totalCashInflow: summary.totalPaymentsReceived,
      collectionRate: summary.collectionRate,
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
