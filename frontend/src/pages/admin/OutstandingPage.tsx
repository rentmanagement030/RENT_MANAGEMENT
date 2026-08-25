import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Banknote,
  Building2,
  CheckCircle2,
  Clock,
  Filter,
  MessageCircle,
  Phone,
  Search,
  UserRound,
} from "lucide-react";
import { api, flattenOutstanding } from "@/lib/api";
import { formatINR } from "@/lib/format";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAuth } from "@/auth/AuthContext";
import { PERMISSIONS } from "@/lib/permissions";
import { Button, Card, CardContent, Input, PageLoader } from "@/components/ui/primitives";
import { EmptyState, PageHeader } from "@/components/ui/data";

/** Professional Status Badge with CSS indicator dot */
function LedgerStatusBadge({ status }: { status: string }) {
  const norm = (status || "").toUpperCase();
  switch (norm) {
    case "OVERDUE":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
          <span className="size-1.5 rounded-full bg-rose-600"></span> OVERDUE
        </span>
      );
    case "PENDING":
    case "PARTIAL":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="size-1.5 rounded-full bg-amber-500"></span> PENDING
        </span>
      );
    case "PAID":
    case "VERIFIED":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="size-1.5 rounded-full bg-emerald-600"></span> PAID
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
          <span className="size-1.5 rounded-full bg-slate-400"></span> {norm}
        </span>
      );
  }
}

/** Get tenant initials for avatar */
function getInitials(name?: string): string {
  if (!name) return "TN";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/** Format month string e.g. "2026-08" -> "Aug 2026" */
function formatMonthYear(monthStr?: string): string {
  if (!monthStr) return "";
  const [y, m] = monthStr.split("-").map(Number);
  if (!y || !m) return monthStr;
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** Format date string e.g. "2026-08-04" -> "04 Aug 2026" */
function formatDueDateStr(dueStr?: string): string {
  if (!dueStr) return "";
  const d = new Date(dueStr);
  if (isNaN(d.getTime())) return dueStr.slice(0, 10);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Calculate overdue days count from due date */
function getOverdueDays(dueStr?: string): number {
  if (!dueStr) return 0;
  const d = new Date(dueStr);
  if (isNaN(d.getTime())) return 0;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export default function OutstandingPage() {
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const debouncedSearch = useDebouncedValue(search);

  const { data, isLoading } = useQuery({
    queryKey: ["outstanding", debouncedSearch, overdueOnly],
    queryFn: () => api.outstanding({ search: debouncedSearch || undefined, overdue: overdueOnly || undefined, pageSize: 200 }),
  });

  const rows = flattenOutstanding(data?.items ?? []);

  const filteredRows = useMemo(() => {
    let list = rows;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter((r) =>
        (r.tenantName && r.tenantName.toLowerCase().includes(q)) ||
        (r.propertyName && r.propertyName.toLowerCase().includes(q)) ||
        (r.billingMonth && r.billingMonth.toLowerCase().includes(q)) ||
        (r.label && r.label.toLowerCase().includes(q)) ||
        (r.phone && r.phone.includes(q))
      );
    }
    if (overdueOnly) {
      list = list.filter((r) => (r.status || "").toUpperCase() === "OVERDUE");
    }
    return list;
  }, [rows, debouncedSearch, overdueOnly]);

  // Compute KPI Financial Summary from existing rows
  const kpiSummary = useMemo(() => {
    let totalOutstanding = 0;
    let overdueTotal = 0;
    let pendingTotal = 0;
    const tenantIdSet = new Set<string>();

    filteredRows.forEach((r) => {
      const amt = Number(r.outstanding) || 0;
      totalOutstanding += amt;
      if (r.tenantId) tenantIdSet.add(r.tenantId);
      if ((r.status || "").toUpperCase() === "OVERDUE") {
        overdueTotal += amt;
      } else {
        pendingTotal += amt;
      }
    });

    return {
      totalOutstanding,
      overdueTotal,
      pendingTotal,
      tenantCount: tenantIdSet.size,
      recordCount: filteredRows.length,
    };
  }, [filteredRows]);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* 1. Page Header */}
      <PageHeader
        title="Outstanding Dues & Overdue Balances"
        description="Track unpaid rent, utilities, maintenance charges and overdue tenant balances in one place."
        actions={
          can(PERMISSIONS.PAYMENTS_CREATE) ? (
            <Link to="/admin/payments">
              <Button className="h-10.5 px-4 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-2xs">
                <Banknote className="size-4 mr-1.5" /> Record Cash Payment
              </Button>
            </Link>
          ) : undefined
        }
      />

      {/* 2. Financial Summary Row (2x2 Grid on Mobile, 4-col on Desktop) */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 lg:grid-cols-4">
        {/* TOTAL OUTSTANDING */}
        <div className="bg-white rounded-2xl p-3 sm:p-5 border border-slate-200/90 shadow-2xs space-y-1 flex flex-col justify-between">
          <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-500 block truncate">TOTAL OUTSTANDING</span>
          <div className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 truncate">{formatINR(kpiSummary.totalOutstanding)}</div>
          <span className="text-[11px] sm:text-xs font-semibold text-slate-500 block truncate">Across open dues</span>
        </div>

        {/* OVERDUE BALANCES */}
        <div className="bg-white rounded-2xl p-3 sm:p-5 border border-slate-200/90 shadow-2xs space-y-1 flex flex-col justify-between">
          <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-rose-700 block truncate">OVERDUE BALANCES</span>
          <div className="text-xl sm:text-2xl lg:text-3xl font-black text-rose-600 truncate">{formatINR(kpiSummary.overdueTotal)}</div>
          <span className="text-[11px] sm:text-xs font-semibold text-rose-700/80 block truncate">Passed due date</span>
        </div>

        {/* PENDING BALANCES */}
        <div className="bg-white rounded-2xl p-3 sm:p-5 border border-slate-200/90 shadow-2xs space-y-1 flex flex-col justify-between">
          <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-amber-700 block truncate">PENDING BALANCES</span>
          <div className="text-xl sm:text-2xl lg:text-3xl font-black text-amber-600 truncate">{formatINR(kpiSummary.pendingTotal)}</div>
          <span className="text-[11px] sm:text-xs font-semibold text-amber-700/80 block truncate">Upcoming cycle</span>
        </div>

        {/* TENANTS WITH DUES */}
        <div className="bg-white rounded-2xl p-3 sm:p-5 border border-slate-200/90 shadow-2xs space-y-1 flex flex-col justify-between">
          <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-blue-700 block truncate">TENANTS WITH DUES</span>
          <div className="text-xl sm:text-2xl lg:text-3xl font-black text-blue-600 truncate">{kpiSummary.tenantCount} Residents</div>
          <span className="text-[11px] sm:text-xs font-semibold text-slate-500 block truncate">{kpiSummary.recordCount} unpaid records</span>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <Card className="border border-slate-200 bg-white shadow-2xs rounded-2xl">
        <CardContent className="p-3.5 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-0 md:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search tenant, property or invoice…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10.5 text-xs font-semibold border-slate-200 rounded-xl w-full bg-slate-50/50 focus:bg-white"
            />
          </div>

          {/* Overdue Filter & Total Outstanding Accent */}
          <div className="flex items-center gap-4 flex-wrap justify-between md:justify-end shrink-0">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={overdueOnly}
                onChange={(e) => setOverdueOnly(e.target.checked)}
                className="size-4 rounded border-slate-300 text-blue-600 accent-blue-600 cursor-pointer"
              />
              Show Overdue Only
            </label>

            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-1.5 text-xs font-medium text-slate-600">
              TOTAL OUTSTANDING: <span className="font-bold text-rose-600 text-sm ml-1">{formatINR(kpiSummary.totalOutstanding)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Enterprise Ledger Table */}
      <Card className="border border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-xl w-full"></div>
              ))}
            </div>
          ) : filteredRows.length === 0 ? (
            <EmptyState
              icon={<AlertTriangle className="size-6 text-slate-400" />}
              title="Nothing outstanding"
              description="All rent statements and utility bills are 100% paid up."
            />
          ) : (
            <>
              {/* Mobile View (< 1024px) */}
              <div className="lg:hidden divide-y divide-slate-100">
                {filteredRows.map((r) => {
                  const whatsappMsg = encodeURIComponent(
                    `Hi ${r.tenantName}, pending balance of ${formatINR(r.outstanding)} for ${r.propertyName} (${r.billingMonth}) is due on ${r.dueDate.slice(0, 10)}. Kindly complete payment.`
                  );
                  const itemLabel = r.kind === "bill" ? (r.label || "Bill") : "Rent";
                  const overdueDays = getOverdueDays(r.dueDate);

                  return (
                    <div key={r.rentRecordId ?? r.billId} className="p-4 space-y-3 bg-white">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="size-9 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center border border-slate-200 shrink-0">
                            {getInitials(r.tenantName)}
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-900 text-sm block truncate">{r.tenantName}</span>
                            <span className="text-xs text-slate-500 block truncate">{r.phone || "No Phone"}</span>
                          </div>
                        </div>
                        <LedgerStatusBadge status={r.status} />
                      </div>

                      <div className="rounded-xl bg-slate-50/80 p-3 border border-slate-200/70 grid grid-cols-2 gap-2 text-xs font-semibold">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Property</span>
                          <span className="font-bold text-slate-800 truncate block">{r.propertyName || "Property"}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Item & Month</span>
                          <span className="font-bold text-slate-800">{itemLabel} · {formatMonthYear(r.billingMonth)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Due Date</span>
                          <span className="font-medium text-slate-700">{formatDueDateStr(r.dueDate)}</span>
                          {overdueDays > 0 && (
                            <span className="text-[10px] text-rose-600 block font-bold">Overdue by {overdueDays} days</span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Outstanding</span>
                          <span className="font-bold text-rose-600 text-sm">{formatINR(r.outstanding)}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        {r.phone && (
                          <a
                            href={`https://wa.me/91${r.phone.replace(/\D/g, "")}?text=${whatsappMsg}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 active:scale-95 transition-all text-xs"
                            title="Remind on WhatsApp"
                          >
                            <MessageCircle className="size-4 text-emerald-600" />
                          </a>
                        )}
                        {can(PERMISSIONS.PAYMENTS_CREATE) && (
                          <Link to={`/admin/payments?action=new&tenantId=${r.tenantId}`}>
                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 font-bold text-xs rounded-xl shadow-2xs">
                              Pay Dues
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Fixed Ledger Table (>= 1024px) */}
              <div className="hidden lg:block w-full max-w-full overflow-hidden">
                <table className="w-full text-left border-collapse table-fixed text-xs">
                  <colgroup>
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "21%" }} />
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "6%" }} />
                  </colgroup>
                  <thead className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3.5 py-3.5">TENANT</th>
                      <th className="px-3.5 py-3.5">PROPERTY</th>
                      <th className="px-3.5 py-3.5">ITEM & MONTH</th>
                      <th className="px-3.5 py-3.5">DUE DATE</th>
                      <th className="px-3.5 py-3.5">OUTSTANDING</th>
                      <th className="px-3.5 py-3.5">STATUS</th>
                      <th className="px-3.5 py-3.5 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-medium">
                    {filteredRows.map((r) => {
                      const itemLabel = r.kind === "bill" ? (r.label || "Bill") : "Rent";
                      const overdueDays = getOverdueDays(r.dueDate);
                      const isOverdue = (r.status || "").toUpperCase() === "OVERDUE";

                      return (
                        <tr key={r.rentRecordId ?? r.billId} className="hover:bg-slate-50/70 transition-colors h-16">
                          {/* TENANT */}
                          <td className="px-3.5 py-3.5 min-w-0">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="size-8 rounded-full bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center justify-center border border-slate-200 shrink-0">
                                {getInitials(r.tenantName)}
                              </div>
                              <div className="min-w-0">
                                <span className="font-semibold text-slate-900 text-xs block truncate" title={r.tenantName}>
                                  {r.tenantName}
                                </span>
                                <span className="text-[11px] text-slate-500 block truncate">{r.phone || "No phone"}</span>
                              </div>
                            </div>
                          </td>

                          {/* PROPERTY */}
                          <td className="px-3.5 py-3.5 min-w-0">
                            <div className="min-w-0 pr-1">
                              <span className="font-semibold text-slate-900 text-xs block truncate" title={r.propertyName}>
                                {r.propertyName}
                              </span>
                            </div>
                          </td>

                          {/* ITEM & MONTH */}
                          <td className="px-3.5 py-3.5 min-w-0">
                            <div className="min-w-0 pr-1">
                              <span className="font-semibold text-slate-800 text-xs block truncate">
                                {itemLabel}
                              </span>
                              <span className="text-[11px] text-slate-500 block truncate">
                                {formatMonthYear(r.billingMonth)}
                              </span>
                            </div>
                          </td>

                          {/* DUE DATE */}
                          <td className="px-3.5 py-3.5 min-w-0">
                            <div className="min-w-0 pr-1">
                              <span className="font-semibold text-slate-800 text-xs block truncate">
                                {formatDueDateStr(r.dueDate)}
                              </span>
                              {overdueDays > 0 && (
                                <span className="text-[11px] font-semibold text-rose-600 block truncate">
                                  Overdue by {overdueDays} days
                                </span>
                              )}
                            </div>
                          </td>

                          {/* OUTSTANDING */}
                          <td className="px-3.5 py-3.5 min-w-0">
                            <div className="min-w-0 pr-1">
                              <span className={`font-semibold text-sm block truncate ${isOverdue ? "text-rose-600" : "text-amber-600"}`}>
                                {formatINR(r.outstanding)}
                              </span>
                            </div>
                          </td>

                          {/* STATUS */}
                          <td className="px-3.5 py-3.5 whitespace-nowrap">
                            <LedgerStatusBadge status={r.status} />
                          </td>

                          {/* ACTION */}
                          <td className="px-3.5 py-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {r.phone && (
                                <a
                                  href={`https://wa.me/91${r.phone.replace(/\D/g, "")}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all shrink-0"
                                  title="Contact Resident"
                                >
                                  <MessageCircle className="size-3.5" />
                                </a>
                              )}
                              {can(PERMISSIONS.PAYMENTS_CREATE) && (
                                <Link to={`/admin/payments?action=new&tenantId=${r.tenantId}`}>
                                  <Button variant="outline" size="sm" className="h-8 px-2.5 rounded-lg font-bold text-xs border-slate-200 bg-slate-50 text-slate-700 hover:bg-blue-50 hover:text-blue-600 shrink-0">
                                    Pay
                                  </Button>
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Numbered Footer Info */}
              <div className="border-t border-slate-200 bg-slate-50/50 p-4 flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>{kpiSummary.recordCount} outstanding statement{kpiSummary.recordCount !== 1 ? "s" : ""}</span>
                <span>Total: <strong className="text-slate-900 ml-1">{formatINR(kpiSummary.totalOutstanding)}</strong></span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
