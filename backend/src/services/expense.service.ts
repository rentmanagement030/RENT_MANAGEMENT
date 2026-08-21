import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { buildPagination, parsePagination } from "../utils/pagination";
import { toDecimal } from "../utils/money";
import { writeAuditLog } from "../utils/audit";
import { normalizeExpenseCategory, computeExpenseBreakdown } from "../financial/expense.engine";
import type { Request } from "express";

export async function listExpenses(query: Record<string, unknown>) {
  const { page, pageSize } = parsePagination(query);
  const from = query.from ? new Date(String(query.from)) : undefined;
  const to = query.to ? new Date(String(query.to)) : undefined;
  const propertyId = query.propertyId ? String(query.propertyId) : undefined;
  const category = query.category ? String(query.category) : undefined;

  const where: Prisma.ExpenseWhereInput = {
    ...(from || to ? { expenseDate: { gte: from, lte: to } } : {}),
    ...(propertyId ? { propertyId } : {}),
    ...(category ? { category: { contains: category, mode: "insensitive" } } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      include: {
        property: { select: { id: true, name: true } },
        recordedBy: { select: { id: true, name: true } },
        vendor: { select: { id: true, name: true, service: true } },
        staff: { select: { id: true, name: true, role: true } },
        maintenance: { select: { id: true, description: true, status: true } },
      },
      orderBy: { expenseDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const normalizedItems = items.map((item) => ({
    ...item,
    category: normalizeExpenseCategory(item.category),
  }));

  const breakdown = await computeExpenseBreakdown({ from, to, propertyId });
  const pagination = buildPagination(normalizedItems, total, { page, pageSize });

  return {
    ...pagination,
    summary: breakdown,
  };
}

export async function createExpense(
  data: {
    propertyId?: string;
    category: string;
    description: string;
    amount: number;
    expenseDate?: Date;
    vendorId?: string;
    staffId?: string;
    maintenanceId?: string;
  },
  req: Request,
  actorId: string,
) {
  const normalizedCat = normalizeExpenseCategory(data.category);
  const expense = await prisma.expense.create({
    data: {
      propertyId: data.propertyId || null,
      category: normalizedCat,
      description: data.description,
      amount: toDecimal(data.amount),
      expenseDate: data.expenseDate ?? new Date(),
      recordedById: actorId,
      vendorId: data.vendorId || null,
      staffId: data.staffId || null,
    },
  });

  if (data.maintenanceId) {
    await prisma.maintenanceRequest.update({
      where: { id: data.maintenanceId },
      data: { expenseId: expense.id },
    }).catch(() => null);
  }

  // Synchronize with Tax Payment if applicable
  if (data.propertyId && (normalizedCat === "PROPERTY_TAX" || normalizedCat === "WATER_TAX")) {
    const taxRecord = await prisma.taxRecord.findFirst({
      where: { propertyId: data.propertyId, taxType: normalizedCat },
    });
    if (taxRecord) {
      const receiptNumber = `${normalizedCat === "WATER_TAX" ? "WT" : "PT"}-EXP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await prisma.taxPaymentRecord.create({
        data: {
          taxRecordId: taxRecord.id,
          taxType: normalizedCat,
          propertyId: data.propertyId,
          amount: expense.amount,
          paymentDate: expense.expenseDate,
          receiptNumber,
          taxPeriod: taxRecord.currentTaxPeriod,
          expenseId: expense.id,
          recordedById: actorId,
        }
      });
      
      const currentOutstanding = Number(taxRecord.outstandingAmount);
      const newOutstanding = Math.max(0, currentOutstanding - data.amount);
      await prisma.taxRecord.update({
        where: { id: taxRecord.id },
        data: { outstandingAmount: newOutstanding, lastPaidDate: expense.expenseDate },
      });
    }
  }

  await writeAuditLog(req, {
    action: "expense.created",
    entityType: "expense",
    entityId: expense.id,
    metadata: { category: data.category, amount: data.amount, maintenanceId: data.maintenanceId },
  }, actorId);

  return expense;
}
