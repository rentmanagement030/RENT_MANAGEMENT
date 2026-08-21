import { prisma } from "../config/prisma";
import { numberMoney, zero } from "../utils/money";
import { PortfolioProfitabilitySummary, PropertyProfitabilityRow, PeriodFilter } from "./types";
import { parsePeriodDates } from "./period.engine";
import { computeExpenseBreakdown } from "./expense.engine";

export async function computePropertyProfitability(filter: PeriodFilter = {}): Promise<PortfolioProfitabilitySummary> {
  const { billingMonth, fromDate, toDate } = parsePeriodDates(filter);
  const propertyFilter = filter.propertyId ? { id: filter.propertyId } : {};

  const properties = await prisma.property.findMany({
    where: propertyFilter,
    include: {
      rooms: { include: { beds: { where: { archived: false } } } },
      tenants: { where: { status: "ACTIVE" } },
    },
    orderBy: { name: "asc" },
  });

  const propertyIds = properties.map((p) => p.id);

  // Fetch linked expense IDs to avoid double-counting
  const linkedTaxPayments = await prisma.taxPaymentRecord.findMany({
    where: { expenseId: { not: null } },
    select: { expenseId: true },
  });
  const linkedExpenseIds = linkedTaxPayments.map((p) => p.expenseId!).filter(Boolean);

  // Batch query bills, general expenses, and tax payments by property
  const [billGroups, expenseGroups, taxPaymentGroups] = await Promise.all([
    prisma.bill.groupBy({
      by: ["propertyId"],
      where: {
        propertyId: { in: propertyIds },
        status: { not: "CANCELLED" },
        ...(billingMonth ? { billingMonth } : {}),
      },
      _sum: { amount: true, paidAmount: true, outstanding: true },
    }),
    prisma.expense.groupBy({
      by: ["propertyId"],
      where: {
        id: { notIn: linkedExpenseIds.length > 0 ? linkedExpenseIds : ["__dummy_none__"] },
        propertyId: { in: propertyIds },
        expenseDate: { gte: fromDate, lte: toDate },
      },
      _sum: { amount: true },
    }),
    prisma.taxPaymentRecord.groupBy({
      by: ["propertyId"],
      where: {
        expenseId: null,
        propertyId: { in: propertyIds },
        paymentDate: { gte: fromDate, lte: toDate },
      },
      _sum: { amount: true },
    }),
  ]);

  const billMap = new Map<string, { amount: number; paid: number; outstanding: number }>();
  for (const bg of billGroups) {
    if (bg.propertyId) {
      billMap.set(bg.propertyId, {
        amount: numberMoney(bg._sum.amount ?? zero()),
        paid: numberMoney(bg._sum.paidAmount ?? zero()),
        outstanding: numberMoney(bg._sum.outstanding ?? zero()),
      });
    }
  }

  const expenseMap = new Map<string, number>();
  for (const eg of expenseGroups) {
    if (eg.propertyId) {
      expenseMap.set(eg.propertyId, (expenseMap.get(eg.propertyId) || 0) + numberMoney(eg._sum.amount ?? zero()));
    }
  }
  for (const tg of taxPaymentGroups) {
    if (tg.propertyId) {
      expenseMap.set(tg.propertyId, (expenseMap.get(tg.propertyId) || 0) + numberMoney(tg._sum.amount ?? zero()));
    }
  }

  // Fetch complete expense breakdown for exact matching
  const expenseBreakdown = await computeExpenseBreakdown(filter);
  const unallocatedExpenses = expenseBreakdown.totalOperatingExpenses - Array.from(expenseMap.values()).reduce((a, b) => a + b, 0);

  const rows: PropertyProfitabilityRow[] = properties.map((p) => {
    const bStats = billMap.get(p.id) || { amount: 0, paid: 0, outstanding: 0 };
    const propExpenses = expenseMap.get(p.id) || 0;

    const expectedIncome = bStats.amount;
    const collectedIncome = bStats.paid;
    const totalOutstanding = bStats.outstanding;
    const netIncome = collectedIncome - propExpenses;

    const collectionRate = expectedIncome > 0 ? Math.round((collectedIncome / expectedIncome) * 100) : 0;
    const expenseRatio = collectedIncome > 0 ? Math.round((propExpenses / collectedIncome) * 100) : 0;

    const allBeds = p.rooms.flatMap((r) => r.beds);
    const totalBeds = allBeds.length;
    const occupiedBeds = allBeds.filter((b) => b.status === "OCCUPIED" || b.tenantId).length;
    const availableBeds = Math.max(0, totalBeds - occupiedBeds);
    const occupancyPercent = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : (p.status === "OCCUPIED" ? 100 : 0);

    return {
      propertyId: p.id,
      propertyName: p.name,
      propertyType: p.type,
      city: p.city,
      expectedIncome,
      collectedIncome,
      totalOutstanding,
      operatingExpenses: propExpenses,
      capitalExpenses: 0,
      netIncome,
      collectionRate,
      expenseRatio,
      occupancyPercent,
      totalBeds,
      occupiedBeds,
      availableBeds,
      archived: p.archived,
    };
  }).filter((r) => !r.archived || r.expectedIncome > 0 || r.operatingExpenses > 0);

  const aggregateExpected = rows.reduce((s, r) => s + r.expectedIncome, 0);
  const aggregateCollected = rows.reduce((s, r) => s + r.collectedIncome, 0);
  const aggregateExpenses = rows.reduce((s, r) => s + r.operatingExpenses, 0) + unallocatedExpenses;
  const aggregateOutstanding = rows.reduce((s, r) => s + r.totalOutstanding, 0);
  const aggregateNet = aggregateCollected - aggregateExpenses;

  return {
    properties: rows,
    summary: {
      expectedIncome: aggregateExpected,
      collectedIncome: aggregateCollected,
      operatingExpenses: aggregateExpenses,
      totalExpenses: aggregateExpenses,
      capitalExpenses: 0,
      totalOutstanding: aggregateOutstanding,
      netIncome: aggregateNet,
      collectionRate: aggregateExpected > 0 ? Math.round((aggregateCollected / aggregateExpected) * 100) : 0,
      expenseRatio: aggregateCollected > 0 ? Math.round((aggregateExpenses / aggregateCollected) * 100) : 0,
    },
  };
}
