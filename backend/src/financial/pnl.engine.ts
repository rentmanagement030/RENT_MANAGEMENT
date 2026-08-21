import { prisma } from "../config/prisma";
import { numberMoney, zero } from "../utils/money";
import { AccountingPnLSummary, PeriodFilter } from "./types";
import { parsePeriodDates } from "./period.engine";
import { computeExpenseBreakdown } from "./expense.engine";
import { getPeriodFinancialSummaryEngine } from "./financial.engine";

export async function computeAccountingPnL(filter: PeriodFilter = {}): Promise<AccountingPnLSummary> {
  const { billingMonth, fromDate, toDate } = parsePeriodDates(filter);
  const propertyFilter = filter.propertyId ? { propertyId: filter.propertyId } : {};

  // A. Revenue Collections by Bill Type for non-cancelled bills in period
  const billTypeGroups = await prisma.bill.groupBy({
    by: ["billType"],
    where: {
      status: { not: "CANCELLED" },
      billingMonth,
      ...propertyFilter,
    },
    _sum: { paidAmount: true },
  });

  let rentIncome = 0;
  let utilityIncome = 0;
  let maintenanceIncome = 0;
  let penaltyIncome = 0;
  let otherIncome = 0;

  for (const g of billTypeGroups) {
    const paid = numberMoney(g._sum.paidAmount ?? zero());
    const bt = g.billType;

    if (bt === "RENT") {
      rentIncome += paid;
    } else if (bt === "EB" || bt === "WATER") {
      utilityIncome += paid;
    } else if (bt === "MAINTENANCE") {
      maintenanceIncome += paid;
    } else if (bt === "LATE_FEE") {
      penaltyIncome += paid;
    } else {
      otherIncome += paid;
    }
  }

  const totalRevenue = rentIncome + utilityIncome + maintenanceIncome + penaltyIncome + otherIncome;

  // B. Operating Expenses Breakdown
  const expenses = await computeExpenseBreakdown(filter);

  // C. Central Engine Validation (Enforce Source of Truth)
  const financialSummary = await getPeriodFinancialSummaryEngine(filter);

  return {
    billingMonth,
    fromDate,
    toDate,
    revenue: {
      rentIncome,
      utilityIncome,
      maintenanceIncome,
      penaltyIncome,
      otherIncome,
      totalRevenue: financialSummary.totalPaymentsReceived, // Enforce cash-basis total from central engine
    },
    expenses: {
      ...expenses,
      totalOperatingExpenses: financialSummary.periodOperatingExpenses,
      totalExpenses: financialSummary.periodOperatingExpenses,
    },
    netOperatingProfit: financialSummary.netOperatingProfit, // Align directly with central engine
    profitMarginPercent: financialSummary.totalPaymentsReceived > 0 
      ? Math.round((financialSummary.netOperatingProfit / financialSummary.totalPaymentsReceived) * 1000) / 10 
      : 0,
  };
}
