import { computePropertyProfitability } from "./profitability.engine";
import { getPeriodFinancialSummaryEngine } from "./financial.engine";

async function run() {
  const p = await computePropertyProfitability({ billingMonth: "2026-08" });
  console.log("Profitability summary:", p.summary);
  const s = await getPeriodFinancialSummaryEngine({ billingMonth: "2026-08" });
  console.log("Financial summary expenses:", s.periodOperatingExpenses);
}
run();
