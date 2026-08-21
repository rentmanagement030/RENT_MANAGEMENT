import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { numberMoney, zero } from "../utils/money";
import { PeriodFilter } from "./types";
import { parsePeriodDates } from "./period.engine";

export interface TaxAndUtilityFinancialSummary {
  propertyTaxDue: number;
  waterTaxDue: number;
  totalTaxDue: number;
  dueSoonCount: number;
  overdueCount: number;
  taxPaidInPeriod: number;
  ownerUtilityExpense: number;
  tenantUtilityRecovery: number;
}

export async function computeTaxAndUtilityFinancials(filter: PeriodFilter = {}): Promise<TaxAndUtilityFinancialSummary> {
  const { billingMonth, fromDate, toDate } = parsePeriodDates(filter);
  const now = new Date();

  // Build authoritative TaxRecord where clause identical to listTaxRecords
  const taxWhere: Prisma.TaxRecordWhereInput = {};

  if (filter.propertyId) {
    taxWhere.propertyId = filter.propertyId;
  }
  if (filter.homeId) {
    taxWhere.homeId = filter.homeId;
  }
  if (filter.taxType) {
    taxWhere.taxType = filter.taxType as any;
  }
  if (filter.status) {
    taxWhere.status = filter.status as any;
  }
  if (filter.search) {
    const term = filter.search.trim();
    taxWhere.OR = [
      { assessmentNumber: { contains: term, mode: "insensitive" } },
      { consumerNumber: { contains: term, mode: "insensitive" } },
      { billNumber: { contains: term, mode: "insensitive" } },
      { assesseeName: { contains: term, mode: "insensitive" } },
      { property: { name: { contains: term, mode: "insensitive" } } },
      { home: { homeNumber: { contains: term, mode: "insensitive" } } },
    ];
  }

  const propertyFilter = filter.propertyId ? { propertyId: filter.propertyId } : {};

  const [taxRecords, taxPaymentsAgg, ownerUtilityAgg, tenantUtilityBillTypeGroups] = await Promise.all([
    prisma.taxRecord.findMany({
      where: taxWhere,
    }),
    prisma.taxPaymentRecord.aggregate({
      where: {
        paymentDate: { gte: fromDate, lte: toDate },
        ...propertyFilter,
      },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: {
        expenseDate: { gte: fromDate, lte: toDate },
        OR: [
          { category: { contains: "UTILITY", mode: "insensitive" } },
          { category: { contains: "EB", mode: "insensitive" } },
          { category: { contains: "WATER", mode: "insensitive" } },
          { category: { contains: "ELECTRIC", mode: "insensitive" } },
        ],
        ...propertyFilter,
      },
      _sum: { amount: true },
    }),
    prisma.bill.groupBy({
      by: ["billType"],
      where: {
        status: { not: "CANCELLED" },
        billingMonth,
        billType: { in: ["EB", "WATER"] },
        ...propertyFilter,
      },
      _sum: { paidAmount: true },
    }),
  ]);

  let totalPropertyTaxDue = 0;
  let totalWaterTaxDue = 0;
  let dueSoonCount = 0;
  let overdueCount = 0;

  for (const r of taxRecords) {
    const out = numberMoney(r.outstandingAmount);
    if (r.taxType === "PROPERTY_TAX") {
      totalPropertyTaxDue += out;
    } else if (r.taxType === "WATER_TAX") {
      totalWaterTaxDue += out;
    }

    if (r.status === "OVERDUE" || (r.nextDueDate && r.nextDueDate < now && out > 0)) {
      overdueCount++;
    } else if (r.nextDueDate && r.nextDueDate >= now && r.nextDueDate <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) && out > 0) {
      dueSoonCount++;
    }
  }

  let tenantUtilityRecovery = 0;
  for (const g of tenantUtilityBillTypeGroups) {
    tenantUtilityRecovery += numberMoney(g._sum.paidAmount ?? zero());
  }

  const taxPaidInPeriod = numberMoney(taxPaymentsAgg._sum.amount ?? zero());
  const ownerUtilityExpense = numberMoney(ownerUtilityAgg._sum.amount ?? zero());

  return {
    propertyTaxDue: totalPropertyTaxDue,
    waterTaxDue: totalWaterTaxDue,
    totalTaxDue: totalPropertyTaxDue + totalWaterTaxDue,
    dueSoonCount,
    overdueCount,
    taxPaidInPeriod,
    ownerUtilityExpense,
    tenantUtilityRecovery,
  };
}
