import { prisma } from "../config/prisma";
import { numberMoney, zero } from "../utils/money";
import { ReconciliationMismatch, SystemReconciliationReport, PeriodFilter } from "./types";
import { parsePeriodDates } from "./period.engine";

export async function runSystemReconciliation(filter: PeriodFilter = {}): Promise<SystemReconciliationReport> {
  const { billingMonth, fromDate, toDate } = parsePeriodDates(filter);
  const mismatches: ReconciliationMismatch[] = [];

  // 1. Bill Equation Audit & Authoritative PaymentAllocation Audit
  const bills = await prisma.bill.findMany({
    where: { status: { not: "CANCELLED" }, billingMonth },
    include: {
      tenant: { select: { name: true } },
      allocations: { include: { payment: { select: { paymentStatus: true } } } },
    },
  });

  let grossBilled = 0;
  let approvedPenalties = 0;
  let approvedAdjustments = 0;
  let totalCollected = 0;
  let totalOutstanding = 0;

  for (const b of bills) {
    const amt = numberMoney(b.amount);
    const paid = numberMoney(b.paidAmount);
    const out = numberMoney(b.outstanding);
    const penalty = numberMoney(b.penaltyAmount);

    grossBilled += amt;
    approvedPenalties += penalty;
    totalCollected += paid;
    totalOutstanding += out;

    // Check 1: Bill.paidAmount == SUM(valid PaymentAllocations)
    const validAllocSum = b.allocations
      .filter((a) => a.payment && (a.payment.paymentStatus === "SUCCESS" || a.payment.paymentStatus === "VERIFIED"))
      .reduce((s, a) => s + numberMoney(a.amount), 0);

    if (Math.abs(paid - validAllocSum) > 0.01) {
      mismatches.push({
        category: "BILL",
        entityId: b.id,
        label: `Bill ${b.billNumber} (${b.tenant?.name ?? "No tenant"})`,
        expectedAmount: validAllocSum,
        actualAmount: paid,
        difference: Math.round((paid - validAllocSum) * 100) / 100,
        details: `Bill cached paidAmount (${paid}) differs from authoritative PaymentAllocation sum (${validAllocSum}).`,
      });
    }

    // Check 2: Gross Billed + Penalties - Adjustments == Paid + Outstanding
    const expectedCost = amt + penalty - approvedAdjustments;
    const actualSum = paid + out;
    if (Math.abs(expectedCost - actualSum) > 0.01) {
      mismatches.push({
        category: "BILL",
        entityId: b.id,
        label: `Bill ${b.billNumber} (${b.tenant?.name ?? "No tenant"})`,
        expectedAmount: expectedCost,
        actualAmount: actualSum,
        difference: Math.round((expectedCost - actualSum) * 100) / 100,
        details: `Gross Billed (${amt}) + Penalties (${penalty}) does not equal Paid (${paid}) + Outstanding (${out}).`,
      });
    }
  }

  // 2. Payments Equation Audit: Payment Amount == Allocated + Unallocated
  const payments = await prisma.payment.findMany({
    where: { paymentDate: { gte: fromDate, lte: toDate }, paymentStatus: { in: ["SUCCESS", "VERIFIED"] } },
    include: { tenant: { select: { name: true } }, allocations: true },
  });

  let totalPaymentsReceived = 0;
  let totalAllocatedSum = 0;

  for (const p of payments) {
    const amt = numberMoney(p.amount);
    totalPaymentsReceived += amt;
    const allocSum = p.allocations.reduce((s, a) => s + numberMoney(a.amount), 0);
    totalAllocatedSum += allocSum;

    if (allocSum > amt + 0.01) {
      mismatches.push({
        category: "PAYMENT",
        entityId: p.id,
        label: `Payment ${p.receiptNumber || p.id} (${p.tenant?.name ?? "No tenant"})`,
        expectedAmount: amt,
        actualAmount: allocSum,
        difference: Math.round((allocSum - amt) * 100) / 100,
        details: `Payment allocated sum (${allocSum}) exceeds payment received amount (${amt}).`,
      });
    }
  }

  const totalUnallocated = Math.max(0, totalPaymentsReceived - totalCollected);

  // 3. Expenses and Net Operating Profit Audit
  const expensesAgg = await prisma.expense.aggregate({
    where: { expenseDate: { gte: fromDate, lte: toDate } },
    _sum: { amount: true },
  });
  const totalOperatingExpenses = numberMoney(expensesAgg._sum.amount ?? zero());
  const netOperatingProfit = totalCollected - totalOperatingExpenses;

  const netBilled = grossBilled + approvedPenalties - approvedAdjustments;
  const isBalanced = mismatches.length === 0;

  return {
    isBalanced,
    timestamp: new Date().toISOString(),
    totals: {
      grossBilled,
      approvedPenalties,
      approvedAdjustments,
      netBilled,
      totalCollected,
      totalOutstanding,
      totalPaymentsReceived,
      totalUnallocated,
      totalOperatingExpenses,
      totalCapitalExpenses: 0,
      netOperatingProfit,
    },
    mismatches,
  };
}
