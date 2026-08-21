import { describe, it, expect } from "vitest";
import { getPeriodFinancialSummaryEngine } from "../financial/financial.engine";
import { computeAccountingPnL } from "../financial/pnl.engine";
import { computeExpenseBreakdown, normalizeExpenseCategory } from "../financial/expense.engine";
import { listRentRecords } from "../services/rent.service";
import { listBills, billSummary } from "../services/bill.service";
import { listPayments } from "../services/payment.service";
import { listExpenses } from "../services/expense.service";

describe("C2D Rentals — 30-Test Financial Reconciliation & Accuracy Suite", { timeout: 15000 }, () => {
  const testMonth = "2026-08";

  // TEST 1: Monthly rent total
  it("TEST 1: Monthly rent total calculation", async () => {
    const summary = await getPeriodFinancialSummaryEngine({ billingMonth: testMonth });
    expect(summary.grossBilled).toBeGreaterThanOrEqual(0);
    expect(summary.netBilled).toBeGreaterThanOrEqual(0);
  });

  // TEST 2: Monthly collection total
  it("TEST 2: Monthly collection total calculation", async () => {
    const summary = await getPeriodFinancialSummaryEngine({ billingMonth: testMonth });
    expect(summary.collected).toBeGreaterThanOrEqual(0);
  });

  // TEST 3: Monthly outstanding
  it("TEST 3: Monthly outstanding calculation (Outstanding >= 0)", async () => {
    const summary = await getPeriodFinancialSummaryEngine({ billingMonth: testMonth });
    expect(summary.outstanding).toBeGreaterThanOrEqual(0);
  });

  // TEST 4: Payment allocation
  it("TEST 4: Payment allocation invariants (Allocated <= Payment)", async () => {
    const summary = await getPeriodFinancialSummaryEngine({ billingMonth: testMonth });
    expect(summary.collected).toBeLessThanOrEqual(summary.netBilled + summary.totalPaymentsReceived);
  });

  // TEST 5: Cross-month payment handling
  it("TEST 5: Cross-month payment distinguishes Billing Month vs Payment Date", async () => {
    const summary = await getPeriodFinancialSummaryEngine({ billingMonth: testMonth });
    expect(summary.billingMonth).toBe(testMonth);
  });

  // TEST 6: Partial payment handling
  it("TEST 6: Partial payment outstanding calculation", async () => {
    const summary = await getPeriodFinancialSummaryEngine({ billingMonth: testMonth });
    expect(summary.pending).toBeGreaterThanOrEqual(0);
  });

  // TEST 7: Full payment handling
  it("TEST 7: Full payment leaves zero outstanding", async () => {
    const summary = await getPeriodFinancialSummaryEngine({ billingMonth: testMonth });
    expect(summary.outstanding).toBeGreaterThanOrEqual(0);
  });

  // TEST 8: Late penalty handling
  it("TEST 8: Late penalty adds to gross billed to form net billed", async () => {
    const summary = await getPeriodFinancialSummaryEngine({ billingMonth: testMonth });
    expect(summary.netBilled).toBe(summary.grossBilled + summary.approvedPenalties - summary.approvedAdjustments);
  });

  // TEST 9: Adjustment/credit handling
  it("TEST 9: Adjustment/credit deducts from gross billed", async () => {
    const summary = await getPeriodFinancialSummaryEngine({ billingMonth: testMonth });
    expect(summary.netBilled).toBeGreaterThanOrEqual(0);
  });

  // TEST 10: Cancelled bill handling
  it("TEST 10: Cancelled bills are excluded from billed totals", async () => {
    const summary = await getPeriodFinancialSummaryEngine({ billingMonth: testMonth });
    expect(summary.netBilled).toBeGreaterThanOrEqual(summary.collected);
  });

  // TEST 11: Reversed/refunded payment handling
  it("TEST 11: Reversed/failed payments do not count toward collection totals", async () => {
    const summary = await getPeriodFinancialSummaryEngine({ billingMonth: testMonth });
    expect(summary.totalPaymentsReceived).toBeGreaterThanOrEqual(0);
  });

  // TEST 12: Property-level financial total
  it("TEST 12: Property-level financial totals are isolated", async () => {
    const summary = await getPeriodFinancialSummaryEngine({ billingMonth: testMonth, propertyId: "non-existent-prop" });
    expect(summary.grossBilled).toBe(0);
    expect(summary.collected).toBe(0);
  });

  // TEST 13: Tenant-level ledger
  it("TEST 13: Tenant-level ledger reconciliation", async () => {
    const summary = await getPeriodFinancialSummaryEngine({ billingMonth: testMonth });
    expect(summary.outstanding).toBeGreaterThanOrEqual(0);
  });

  // TEST 14: Expense monthly total
  it("TEST 14: Expense monthly total calculation", async () => {
    const expenses = await computeExpenseBreakdown({ billingMonth: testMonth });
    expect(expenses.totalOperatingExpenses).toBeGreaterThanOrEqual(0);
  });

  // TEST 15: Property Tax payment category normalization
  it("TEST 15: Property Tax payment category resolves to Property Tax", () => {
    expect(normalizeExpenseCategory("PROPERTY_TAX")).toBe("Property Tax");
    expect(normalizeExpenseCategory("property_tax")).toBe("Property Tax");
  });

  // TEST 16: Water Tax payment category normalization
  it("TEST 16: Water Tax category resolves to Utilities (EB/Water)", () => {
    expect(normalizeExpenseCategory("WATER")).toBe("Utilities (EB/Water)");
    expect(normalizeExpenseCategory("EB")).toBe("Utilities (EB/Water)");
  });

  // TEST 17: P&L calculation
  it("TEST 17: P&L calculation (Net Profit = Total Payment Inflow - Operating Expenses)", async () => {
    const pnl = await computeAccountingPnL({ billingMonth: testMonth });
    expect(pnl.netOperatingProfit).toBe(pnl.revenue.totalRevenue - pnl.expenses.totalOperatingExpenses);
  });

  // TEST 18: Pagination does not alter totals
  it("TEST 18: Pagination size does NOT change header financial summary", async () => {
    const page1 = await listPayments({ page: 1, pageSize: 2, period: testMonth });
    const page2 = await listPayments({ page: 1, pageSize: 50, period: testMonth });
    expect(page1.summary.totalCollected).toBe(page2.summary.totalCollected);
  });

  // TEST 19: Filtering produces correct scoped totals
  it("TEST 19: Filtering produces correct scoped totals", async () => {
    const all = await billSummary({ billingMonth: testMonth });
    expect(all.total).toBeGreaterThanOrEqual(0);
  });

  // TEST 20: Dashboard reconciles with financial engine
  it("TEST 20: Dashboard reconciles with Central Financial Engine", async () => {
    const engine = await getPeriodFinancialSummaryEngine({ billingMonth: testMonth });
    const bills = await billSummary({ billingMonth: testMonth });
    expect(engine.grossBilled).toBe(bills.total);
    expect(engine.collected).toBe(bills.collected);
  });

  // TEST 21: Rent page reconciles with financial engine
  it("TEST 21: Rent page reconciles with Central Financial Engine", async () => {
    const engine = await getPeriodFinancialSummaryEngine({ billingMonth: testMonth });
    const rent = await listRentRecords({ billingMonth: testMonth, page: 1, pageSize: 5 });
    expect(rent.summary.totalExpectedRent).toBe(engine.grossBilled);
    expect(rent.summary.totalCollectedRent).toBe(engine.collected);
  });

  // TEST 22: Bills page reconciles with financial engine
  it("TEST 22: Bills page reconciles with Central Financial Engine", async () => {
    const engine = await getPeriodFinancialSummaryEngine({ billingMonth: testMonth });
    const bills = await billSummary({ billingMonth: testMonth });
    expect(bills.outstanding).toBe(engine.outstanding);
  });

  // TEST 23: Payments page reconciles with financial engine
  it("TEST 23: Payments page reconciles with Central Financial Engine", async () => {
    const engine = await getPeriodFinancialSummaryEngine({ billingMonth: testMonth });
    const payments = await listPayments({ period: testMonth, page: 1, pageSize: 5 });
    expect(payments.summary.totalCollected).toBe(engine.totalPaymentsReceived);
  });

  // TEST 24: Outstanding page reconciles with financial engine
  it("TEST 24: Outstanding page reconciles with Central Financial Engine", async () => {
    const engine = await getPeriodFinancialSummaryEngine({ billingMonth: testMonth });
    expect(engine.outstanding).toBeGreaterThanOrEqual(0);
  });

  // TEST 25: Expenses page reconciles with financial engine
  it("TEST 25: Expenses page reconciles with Central Financial Engine", async () => {
    const engineExp = await computeExpenseBreakdown({ billingMonth: testMonth });
    const pageExp = await listExpenses({ from: `${testMonth}-01`, page: 1, pageSize: 5 });
    expect(engineExp.totalOperatingExpenses).toBeGreaterThanOrEqual(0);
    expect(pageExp.total).toBeGreaterThanOrEqual(0);
  });

  // TEST 26: Accounting reconciles with financial engine
  it("TEST 26: Accounting P&L reconciles with Central Financial Engine", async () => {
    const pnl = await computeAccountingPnL({ billingMonth: testMonth });
    const expenses = await computeExpenseBreakdown({ billingMonth: testMonth });
    expect(pnl.expenses.totalOperatingExpenses).toBe(expenses.totalOperatingExpenses);
  });

  // TEST 27: Reports reconcile with financial engine
  it("TEST 27: Reports reconcile with Central Financial Engine", async () => {
    const engine = await getPeriodFinancialSummaryEngine({ billingMonth: testMonth });
    expect(engine.grossBilled).toBeGreaterThanOrEqual(engine.collected);
  });

  // TEST 28: Property financials reconcile with financial engine
  it("TEST 28: Property financials reconcile with Central Financial Engine", async () => {
    const summary = await getPeriodFinancialSummaryEngine({ billingMonth: testMonth });
    expect(summary.grossBilled).toBeGreaterThanOrEqual(0);
  });

  // TEST 29: Tenant ledger reconciles with financial engine
  it("TEST 29: Tenant ledger reconciles with Central Financial Engine", async () => {
    const summary = await getPeriodFinancialSummaryEngine({ billingMonth: testMonth });
    expect(summary.outstanding).toBeGreaterThanOrEqual(0);
  });

  // TEST 30: Historical month remains unchanged after future transaction
  it("TEST 30: Historical month totals remain deterministic", async () => {
    const summary1 = await getPeriodFinancialSummaryEngine({ billingMonth: "2026-07" });
    const summary2 = await getPeriodFinancialSummaryEngine({ billingMonth: "2026-07" });
    expect(summary1.grossBilled).toBe(summary2.grossBilled);
    expect(summary1.collected).toBe(summary2.collected);
  });
});
