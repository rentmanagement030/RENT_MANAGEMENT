import { prisma } from "../config/prisma";
import { numberMoney, zero } from "../utils/money";
import { ExpenseBreakdown, PeriodFilter } from "./types";
import { parsePeriodDates } from "./period.engine";

export function normalizeExpenseCategory(category: string): string {
  if (!category) return "Other Operating";
  const cat = category.trim().toUpperCase().replace(/[-_]/g, " ");

  if (cat.includes("TAX") || cat.includes("PROPERTY TAX")) return "Property Tax";
  if (cat.includes("UTILITY") || cat.includes("EB") || cat.includes("WATER") || cat.includes("ELECTRIC")) return "Utilities (EB/Water)";
  if (cat.includes("MAINTENANCE")) return "Maintenance";
  if (cat.includes("REPAIR")) return "Repairs";
  if (cat.includes("STAFF") || cat.includes("SALARY")) return "Staff & Salary";
  if (cat.includes("VENDOR")) return "Vendor Services";
  if (cat.includes("CLEANING")) return "Cleaning & Housekeeping";
  if (cat.includes("SECURITY")) return "Security";
  if (cat.includes("INSURANCE")) return "Insurance";
  if (cat.includes("ADMIN")) return "Administrative";
  if (cat.includes("SOFTWARE") || cat.includes("TECH")) return "Software & Tech";
  if (cat.includes("MARKETING")) return "Marketing & Advertising";
  if (cat.includes("CAPITAL") || cat.includes("RENOVATION") || cat.includes("STRUCTURAL")) return "Capital Expenses";

  return category.trim();
}

export async function computeExpenseBreakdown(filter: PeriodFilter = {}): Promise<ExpenseBreakdown> {
  const { fromDate, toDate } = parsePeriodDates(filter);
  const propertyFilter = filter.propertyId ? { propertyId: filter.propertyId } : {};

  // 1. Fetch tax payment records in period (authoritative source for Tax Payments)
  const taxPaymentsAgg = await prisma.taxPaymentRecord.aggregate({
    where: {
      paymentDate: { gte: fromDate, lte: toDate },
      ...propertyFilter,
    },
    _sum: { amount: true },
  });
  const propertyTaxFromPayments = numberMoney(taxPaymentsAgg._sum.amount ?? zero());

  // 2. Fetch linked expense IDs to prevent double counting
  const linkedTaxPayments = await prisma.taxPaymentRecord.findMany({
    where: {
      expenseId: { not: null },
    },
    select: { expenseId: true },
  });
  const linkedExpenseIds = linkedTaxPayments.map((p) => p.expenseId!).filter(Boolean);

  // 3. Fetch all expenses in period excluding linked tax expenses
  const expenseGroups = await prisma.expense.groupBy({
    by: ["category"],
    where: {
      id: { notIn: linkedExpenseIds.length > 0 ? linkedExpenseIds : ["__dummy_none__"] },
      expenseDate: { gte: fromDate, lte: toDate },
      ...propertyFilter,
    },
    _sum: { amount: true },
  });

  let maintenance = 0;
  let repairs = 0;
  let utilitiesPaidByOwner = 0;
  let propertyTaxFromExpenses = 0;
  let staffCost = 0;
  let vendorCost = 0;
  let cleaning = 0;
  let security = 0;
  let insurance = 0;
  let administrative = 0;
  let software = 0;
  let marketing = 0;
  let otherOperating = 0;
  let capitalExpenses = 0;

  for (const g of expenseGroups) {
    const amt = numberMoney(g._sum.amount ?? zero());
    const cat = normalizeExpenseCategory(g.category).toUpperCase();

    if (cat.includes("CAPITAL") || cat.includes("RENOVATION") || cat.includes("STRUCTURAL")) {
      capitalExpenses += amt;
    } else if (cat.includes("MAINTENANCE")) {
      maintenance += amt;
    } else if (cat.includes("REPAIR")) {
      repairs += amt;
    } else if (cat.includes("UTILITY") || cat.includes("EB") || cat.includes("WATER") || cat.includes("ELECTRIC")) {
      utilitiesPaidByOwner += amt;
    } else if (cat.includes("TAX")) {
      propertyTaxFromExpenses += amt;
    } else if (cat.includes("STAFF") || cat.includes("SALARY")) {
      staffCost += amt;
    } else if (cat.includes("VENDOR")) {
      vendorCost += amt;
    } else if (cat.includes("CLEANING")) {
      cleaning += amt;
    } else if (cat.includes("SECURITY")) {
      security += amt;
    } else if (cat.includes("INSURANCE")) {
      insurance += amt;
    } else if (cat.includes("ADMIN")) {
      administrative += amt;
    } else if (cat.includes("SOFTWARE")) {
      software += amt;
    } else if (cat.includes("MARKETING")) {
      marketing += amt;
    } else {
      otherOperating += amt;
    }
  }

  const propertyTax = propertyTaxFromPayments + propertyTaxFromExpenses;

  const totalOperatingExpenses =
    maintenance +
    repairs +
    utilitiesPaidByOwner +
    propertyTax +
    staffCost +
    vendorCost +
    cleaning +
    security +
    insurance +
    administrative +
    software +
    marketing +
    otherOperating;

  return {
    maintenance,
    repairs,
    utilitiesPaidByOwner,
    propertyTax,
    staffCost,
    vendorCost,
    cleaning,
    security,
    insurance,
    administrative,
    software,
    marketing,
    otherOperating,
    capitalExpenses,
    totalOperatingExpenses,
    totalExpenses: totalOperatingExpenses,
  };
}
