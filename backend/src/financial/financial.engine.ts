import { prisma } from "../config/prisma";
import { numberMoney, zero } from "../utils/money";
import { PeriodFilter, PeriodFinancialSummary } from "./types";
import { parsePeriodDates } from "./period.engine";
import { computeBillDetails } from "./billing.engine";
import { computePaymentDetails } from "./payment.engine";
import { computeExpenseBreakdown } from "./expense.engine";
import { computeTaxAndUtilityFinancials as computeTaxFinancials } from "./tax.engine";
import { computeTenantLedger } from "./ledger.engine";
import { computeAccountingPnL } from "./pnl.engine";
import { computePropertyProfitability } from "./profitability.engine";
import { runSystemReconciliation } from "./reconciliation.engine";

export async function getPeriodFinancialSummaryEngine(filter: PeriodFilter = {}): Promise<PeriodFinancialSummary> {
  const { billingMonth, fromDate, toDate } = parsePeriodDates(filter);
  const propertyFilter = filter.propertyId ? { propertyId: filter.propertyId } : {};

  // 1. Non-cancelled bills for filter scope
  const billedAgg = await prisma.bill.aggregate({
    where: {
      status: { not: "CANCELLED" },
      ...(billingMonth ? { billingMonth } : {}),
      ...propertyFilter,
    },
    _sum: { amount: true, paidAmount: true, outstanding: true, penaltyAmount: true },
  });

  const grossBilled = numberMoney(billedAgg._sum.amount ?? zero());
  const approvedPenalties = numberMoney(billedAgg._sum.penaltyAmount ?? zero());
  const approvedAdjustments = 0;
  const netBilled = grossBilled + approvedPenalties - approvedAdjustments;
  const collected = numberMoney(billedAgg._sum.paidAmount ?? zero());
  const periodOutstanding = numberMoney(billedAgg._sum.outstanding ?? zero());

  // 2. Cumulative All-Time Outstanding Dues (All unpaid bills across all months)
  const totalOutstandingAgg = await prisma.bill.aggregate({
    where: {
      status: { not: "CANCELLED" },
      outstanding: { gt: 0 },
      ...propertyFilter,
    },
    _sum: { outstanding: true },
  });
  const allTimeOutstanding = numberMoney(totalOutstandingAgg._sum.outstanding ?? zero());

  // 3. Pending & Overdue breakdowns + Tenants With Dues count
  const [pendingAgg, overdueAgg, tenantsWithDuesCount] = await Promise.all([
    prisma.bill.aggregate({
      where: {
        status: { in: ["PENDING", "PARTIAL"] },
        ...(billingMonth ? { billingMonth } : {}),
        outstanding: { gt: 0 },
        ...propertyFilter,
      },
      _sum: { outstanding: true },
    }),
    prisma.bill.aggregate({
      where: {
        status: "OVERDUE",
        ...(billingMonth ? { billingMonth } : {}),
        outstanding: { gt: 0 },
        ...propertyFilter,
      },
      _sum: { outstanding: true },
    }),
    prisma.bill.groupBy({
      by: ["tenantId"],
      where: {
        status: { not: "CANCELLED" },
        outstanding: { gt: 0 },
        ...propertyFilter,
      },
    }).then((g) => g.length),
  ]);

  const pending = numberMoney(pendingAgg._sum.outstanding ?? zero());
  const overdue = numberMoney(overdueAgg._sum.outstanding ?? zero());

  // 4. Payment Received Inflow
  const paymentsAgg = await prisma.payment.aggregate({
    where: {
      paymentDate: { gte: fromDate, lte: toDate },
      paymentStatus: { in: ["SUCCESS", "VERIFIED"] },
      ...propertyFilter,
    },
    _sum: { amount: true },
  });

  const totalPaymentsReceived = numberMoney(paymentsAgg._sum.amount ?? zero());
  const unallocated = Math.max(0, totalPaymentsReceived - collected);
  const collectionRate = netBilled > 0 ? Math.round((collected / netBilled) * 1000) / 10 : 0;

  // 5. Portfolio Potential Revenue & Capacity Occupancy Engine
  const propertiesAll = await prisma.property.findMany({
    where: { archived: false, ...(filter.propertyId ? { id: filter.propertyId } : {}) },
    include: {
      homes: { where: { archived: false } },
      rooms: { where: { archived: false }, include: { beds: { where: { archived: false } } } },
      tenants: { where: { status: "ACTIVE" } },
    },
  });

  let potentialRevenue = 0;
  let totalCapacity = 0;
  let occupiedCapacity = 0;

  for (const p of propertiesAll) {
    const activeTenantCount = p.tenants.length;

    if (p.type === "PG") {
      let pgBedsInProp = 0;
      let pgOccupiedInProp = 0;
      for (const r of p.rooms) {
        for (const b of r.beds) {
          pgBedsInProp += 1;
          const isBedOccupied = b.status === "OCCUPIED" || !!b.tenantId;
          if (isBedOccupied) pgOccupiedInProp += 1;
          potentialRevenue += numberMoney(b.rent ?? r.rent ?? p.rent ?? zero());
        }
      }
      if (pgBedsInProp === 0) {
        pgBedsInProp = p.maxCapacity || 1;
        pgOccupiedInProp = Math.min(activeTenantCount, pgBedsInProp);
        potentialRevenue += numberMoney(p.rent ?? zero());
      }
      totalCapacity += pgBedsInProp;
      occupiedCapacity += pgOccupiedInProp;
    } else if (p.homes && p.homes.length > 0) {
      let homesInProp = 0;
      let homesOccupiedInProp = 0;
      for (const h of p.homes) {
        homesInProp += 1;
        const isHomeOccupied = h.status === "OCCUPIED" || p.tenants.some((t) => t.homeId === h.id);
        if (isHomeOccupied) homesOccupiedInProp += 1;
        potentialRevenue += numberMoney(h.rent ?? p.rent ?? zero());
      }
      totalCapacity += homesInProp;
      occupiedCapacity += homesOccupiedInProp;
    } else {
      const cap = Math.max(1, p.maxCapacity || 1);
      const isOccupied = p.status === "OCCUPIED" || activeTenantCount > 0;
      const occ = isOccupied ? Math.min(cap, Math.max(1, activeTenantCount)) : 0;

      totalCapacity += cap;
      occupiedCapacity += occ;
      potentialRevenue += numberMoney(p.rent ?? zero());
    }
  }
  const vacantCapacity = Math.max(0, totalCapacity - occupiedCapacity);
  const occupancyRate = totalCapacity > 0 ? Math.round((occupiedCapacity / totalCapacity) * 100) : 0;

  // 6. Expense & Tax Breakdown Engine
  const [expenseBreakdown, allTimeExpensesAgg, expenseCountAgg, taxFinancials] = await Promise.all([
    computeExpenseBreakdown({ from: fromDate, to: toDate, propertyId: filter.propertyId }),
    prisma.expense.aggregate({
      where: propertyFilter,
      _sum: { amount: true },
    }),
    prisma.expense.count({
      where: {
        expenseDate: { gte: fromDate, lte: toDate },
        ...propertyFilter,
      },
    }),
    computeTaxFinancials({ propertyId: filter.propertyId }),
  ]);

  const periodOperatingExpenses = expenseBreakdown.totalOperatingExpenses;
  const taxPaid = taxFinancials?.taxPaidInPeriod ?? 0;
  const allTimeExpenses = numberMoney(allTimeExpensesAgg._sum.amount ?? zero()) + taxPaid;
  const averageExpense = expenseCountAgg > 0 ? Math.round(periodOperatingExpenses / expenseCountAgg) : 0;
  const netOperatingProfit = totalPaymentsReceived - periodOperatingExpenses;

  return {
    billingMonth: billingMonth || "",
    fromDate,
    toDate,

    // Billing & Collections
    grossBilled,
    expectedRevenue: netBilled,
    approvedPenalties,
    approvedAdjustments,
    netBilled,
    billedCollections: collected,
    collected,
    cashInflow: totalPaymentsReceived,
    paymentInflow: totalPaymentsReceived,
    totalPaymentsReceived,
    unallocated,
    tenantCreditBalance: unallocated,
    collectionRate,

    // Outstanding Dues
    outstanding: allTimeOutstanding,
    periodOutstanding,
    allTimeOutstanding,
    overdue,
    overdueBalances: overdue,
    pending,
    pendingBalances: pending,
    tenantsWithDuesCount,

    // Capacity & Occupancy
    potentialRevenue,
    totalCapacity,
    occupiedCapacity,
    vacantCapacity,
    occupancyRate,

    // Expenses & Taxes
    periodOperatingExpenses,
    allTimeExpenses,
    averageExpense,
    propertyTax: taxFinancials?.propertyTaxDue ?? 0,
    waterTax: taxFinancials?.waterTaxDue ?? 0,
    paidThisMonthTax: taxPaid,

    // P&L Metrics
    collectedRevenue: totalPaymentsReceived,
    totalCollected: totalPaymentsReceived,
    totalExpenses: periodOperatingExpenses,
    netOperatingProfit,
    netIncome: netOperatingProfit,

    // Bill Report Summary
    billReportSummary: {
      billedAmount: netBilled,
      collectedAmount: collected,
      penaltiesAmount: approvedPenalties,
      outstandingAmount: periodOutstanding,
    },
  };
}

export {
  parsePeriodDates,
  computeBillDetails,
  computePaymentDetails,
  computeExpenseBreakdown,
  computeTaxFinancials,
  computeTenantLedger,
  computeAccountingPnL,
  computePropertyProfitability,
  runSystemReconciliation,
};
