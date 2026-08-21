import { formatINR } from "@/lib/format";
import { Card } from "@/components/ui/primitives";
import { Banknote, FileText, Wallet, AlertTriangle } from "lucide-react";

export interface UnifiedFinancialSummaryProps {
  grossBilled: number;
  billedCollections: number;
  totalCashInflow: number;
  totalOutstanding: number;
  billingMonthLabel?: string;
}

export function FinancialSummaryBanner({
  grossBilled,
  billedCollections,
  totalCashInflow,
  totalOutstanding,
  billingMonthLabel,
}: UnifiedFinancialSummaryProps) {
  const periodText = billingMonthLabel || "Selected Period";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
      {/* 1. Gross Billed */}
      <Card className="border border-slate-200 bg-white p-3.5 sm:p-4 rounded-2xl shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-700">Gross Billed</span>
          <div className="size-7 sm:size-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200">
            <FileText className="size-3.5 sm:size-4" />
          </div>
        </div>
        <div className="mt-2">
          <p className="text-lg sm:text-2xl font-black text-slate-900">{formatINR(grossBilled)}</p>
          <p className="text-[10px] sm:text-xs font-semibold text-slate-500 mt-0.5">{periodText} Invoiced</p>
        </div>
      </Card>

      {/* 2. Billed Collections */}
      <Card className="border border-slate-200 bg-white p-3.5 sm:p-4 rounded-2xl shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-emerald-700">Billed Collections</span>
          <div className="size-7 sm:size-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <Wallet className="size-3.5 sm:size-4" />
          </div>
        </div>
        <div className="mt-2">
          <p className="text-lg sm:text-2xl font-black text-emerald-600">{formatINR(billedCollections)}</p>
          <p className="text-[10px] sm:text-xs font-semibold text-emerald-700 mt-0.5">Allocated to {periodText}</p>
        </div>
      </Card>

      {/* 3. Cash Inflow */}
      <Card className="border border-slate-200 bg-white p-3.5 sm:p-4 rounded-2xl shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-blue-700">Cash Inflow</span>
          <div className="size-7 sm:size-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <Banknote className="size-3.5 sm:size-4" />
          </div>
        </div>
        <div className="mt-2">
          <p className="text-lg sm:text-2xl font-black text-blue-600">{formatINR(totalCashInflow)}</p>
          <p className="text-[10px] sm:text-xs font-semibold text-blue-700 mt-0.5">Received in {periodText}</p>
        </div>
      </Card>

      {/* 4. Total Outstanding */}
      <Card className="border border-slate-200 bg-white p-3.5 sm:p-4 rounded-2xl shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-rose-700">Total Outstanding</span>
          <div className="size-7 sm:size-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
            <AlertTriangle className="size-3.5 sm:size-4" />
          </div>
        </div>
        <div className="mt-2">
          <p className="text-lg sm:text-2xl font-black text-rose-600">{formatINR(totalOutstanding)}</p>
          <p className="text-[10px] sm:text-xs font-semibold text-rose-700 mt-0.5">All Unpaid Dues Balance</p>
        </div>
      </Card>
    </div>
  );
}
