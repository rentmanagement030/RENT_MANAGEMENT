import {
  getPeriodFinancialSummaryEngine,
  computeAccountingPnL,
  computePropertyProfitability,
  computeTenantLedger,
  runSystemReconciliation,
} from "../financial/financial.engine";
import {
  PeriodFilter,
  PeriodFinancialSummary,
  AccountingPnLSummary,
  PropertyProfitabilitySummary,
  TenantLedgerSummary,
  SystemReconciliationReport,
} from "../financial/types";

export type PeriodFinancialFilter = PeriodFilter;

export async function getPeriodFinancialSummary(filter: PeriodFinancialFilter = {}): Promise<PeriodFinancialSummary & { totalBilled: number }> {
  const summary = await getPeriodFinancialSummaryEngine(filter);
  return {
    ...summary,
    totalBilled: summary.netBilled,
  };
}

export async function getAccountingPnL(filter: PeriodFinancialFilter = {}): Promise<AccountingPnLSummary> {
  const pnl = await computeAccountingPnL(filter);
  return {
    billingMonth: pnl.billingMonth,
    fromDate: pnl.fromDate,
    toDate: pnl.toDate,
    revenue: pnl.revenue,
    expenses: pnl.expenses,
    netOperatingProfit: pnl.netOperatingProfit,
    profitMarginPercent: pnl.profitMarginPercent,
  };
}

export async function getPropertyProfitabilityEngine(filter: PeriodFinancialFilter = {}): Promise<PropertyProfitabilitySummary> {
  return computePropertyProfitability(filter);
}

export async function getTenantLedger(tenantId: string): Promise<TenantLedgerSummary> {
  return computeTenantLedger(tenantId);
}

export async function reconcileFinancialData(filter: PeriodFinancialFilter = {}): Promise<SystemReconciliationReport> {
  return runSystemReconciliation(filter);
}
