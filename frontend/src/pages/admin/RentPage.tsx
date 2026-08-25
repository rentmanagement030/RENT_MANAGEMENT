import { useEffect, useState, useRef, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  Calendar,
  Wallet,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  Receipt,
  UserRound,
  Building2,
  Filter,
  BedDouble,
  Search,
  SlidersHorizontal,
  Download,
  MoreVertical,
  MessageCircle,
  Phone,
  FileText,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  X,
  Trash2,
  IndianRupee,
  Eye,
  Ban,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatINR, formatDate, currentMonth } from "@/lib/format";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePageResetOnFilter } from "@/hooks/usePageResetOnFilter";
import { useAuth } from "@/auth/AuthContext";
import { PERMISSIONS } from "@/lib/permissions";
import {
  Badge,
  Button,
  Card,
  CardContent,
  FilterSelect,
  Input,
  Label,
  PageLoader,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { EmptyState, Pagination } from "@/components/ui/data";
import { ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { FinancialSummaryBanner } from "@/components/ui/FinancialSummaryBanner";
import type { RentRecord } from "@/types";

// Official WhatsApp SVG Logo Icon
function WhatsAppIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function getInitials(name: string): string {
  if (!name) return "T";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatMonthLabel(mStr: string) {
  if (!mStr) return "All Months";
  const [y, m] = mStr.split("-").map(Number);
  if (!y || !m) return mStr;
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatShortMonth(mStr: string) {
  if (!mStr) return mStr;
  const [y, m] = mStr.split("-").map(Number);
  if (!y || !m) return mStr;
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default function RentPage() {
  const { can } = useAuth();
  const { success, error: toastError } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();

  // Page Filters & Navigation
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState(() => currentMonth());

  const debouncedSearch = useDebouncedValue(search);
  usePageResetOnFilter(setPage, search, statusFilter, propertyFilter, monthFilter);

  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [adjusting, setAdjusting] = useState<RentRecord | null>(null);
  const [deleting, setDeleting] = useState<RentRecord | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Fetch Properties for Filter Dropdown
  const { data: propertiesData } = useQuery({
    queryKey: ["properties-filter-list"],
    queryFn: () => api.listProperties({ pageSize: 500 }),
    staleTime: 30000,
  });

  // Fetch Rent Records
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["rent", page, statusFilter, monthFilter],
    queryFn: () =>
      api.listRent({
        page,
        pageSize: 15,
        status: statusFilter || undefined,
        billingMonth: monthFilter || undefined,
      }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["rent"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const generateMutation = useMutation({
    mutationFn: () => api.generateMonth({ month: monthFilter || currentMonth() }),
    onSuccess: (r) => {
      success(
        "Monthly rent generated",
        `${r.created} statement(s) created, ${r.skipped} existing statements preserved.`
      );
      setConfirmGenerate(false);
      invalidate();
    },
    onError: (e) => toastError("Generation failed", e instanceof Error ? e.message : undefined),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteRent(id),
    onSuccess: () => {
      success("Rent statement deleted");
      setDeleting(null);
      invalidate();
    },
    onError: (e) => toastError("Delete failed", e instanceof Error ? e.message : undefined),
  });

  const propertyOptions = propertiesData?.items ?? [];

  const statuses = [
    { label: "All Statuses", value: "" },
    { label: "Pending", value: "PENDING" },
    { label: "Partial", value: "PARTIAL" },
    { label: "Paid", value: "PAID" },
    { label: "Overdue", value: "OVERDUE" },
    { label: "Waived", value: "WAIVED" },
  ];

  // Month Navigation Helper
  const changeMonth = (delta: number) => {
    const current = monthFilter || currentMonth();
    const [y, m] = current.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const nextY = d.getFullYear();
    const nextM = String(d.getMonth() + 1).padStart(2, "0");
    setMonthFilter(`${nextY}-${nextM}`);
  };

  const rawItems = data?.items ?? [];

  // Filter & Search Client Calculations
  const itemsToDisplay = rawItems.filter((r) => {
    const rec = r as any;
    if (propertyFilter) {
      const pId = rec.tenant?.propertyId || rec.propertyId;
      if (pId !== propertyFilter) return false;
    }
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      const tName = rec.tenant?.name?.toLowerCase() || "";
      const tPhone = rec.tenant?.phone?.toLowerCase() || "";
      const pName = rec.tenant?.property?.name?.toLowerCase() || rec.property?.name?.toLowerCase() || "";
      const rNum = rec.room?.roomNumber?.toString() || "";
      const bNum = rec.bed?.bedNumber?.toString() || "";
      return tName.includes(q) || tPhone.includes(q) || pName.includes(q) || rNum.includes(q) || bNum.includes(q);
    }
    return true;
  });

  // Authoritative Financial Summary from Central Financial Engine DTO
  const summary = (data as any)?.summary;
  const totalExpected = summary?.totalExpectedRent ?? 0;
  const totalPaid = summary?.totalCollectedRent ?? 0;
  const totalOutstanding = summary?.totalOutstandingRent ?? 0;
  const collectionRate = summary?.collectionRate ?? 0;

  const hasActiveFilters = !!(search || statusFilter || propertyFilter || monthFilter !== currentMonth());

  const clearAllFilters = () => {
    setSearch("");
    setStatusFilter("");
    setPropertyFilter("");
    setMonthFilter(currentMonth());
  };

  return (
    <div className="space-y-5 sm:space-y-6 pb-12">
      {/* 1. Page Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Receipt className="size-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">Rent Records</h1>
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-500 pl-0.5">
            Monthly rent collection, dues tracking and tenant ledger.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Billing Period Month Navigator */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-2xs">
            <button
              onClick={() => changeMonth(-1)}
              className="flex size-8 items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 active:scale-95 transition-all"
              title="Previous Month"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="px-3 text-xs font-black text-slate-900 whitespace-nowrap">
              {formatMonthLabel(monthFilter)}
            </span>
            <button
              onClick={() => changeMonth(1)}
              className="flex size-8 items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 active:scale-95 transition-all"
              title="Next Month"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {can(PERMISSIONS.RENT_MANAGE) && (
            <Button
              onClick={() => setConfirmGenerate(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-black h-10 px-4 rounded-xl shadow-xs active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Calendar className="size-4" /> Generate Rent
            </Button>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <Card className="border border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 items-center">
            {/* Search Box */}
            <div className="relative lg:col-span-6">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search tenant, phone, property or room..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-11 text-slate-900 border-slate-300 font-bold rounded-xl text-sm"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {/* Property Filter Dropdown */}
            <div className="lg:col-span-3">
              <FilterSelect
                icon={Building2}
                value={propertyFilter}
                onChange={(e) => setPropertyFilter(e.target.value)}
              >
                <option value="">All Properties</option>
                {propertyOptions.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </FilterSelect>
            </div>

            {/* Status Filter Dropdown */}
            <div className="lg:col-span-3">
              <FilterSelect
                icon={Filter}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {statuses.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </FilterSelect>
            </div>
          </div>

          {/* Active Filters Row */}
          {hasActiveFilters && (
            <div className="flex items-center flex-wrap gap-2 pt-2 border-t border-slate-100 text-xs">
              <span className="text-[11px] font-bold text-slate-500">Active Filters:</span>
              {monthFilter !== currentMonth() && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                  Month: {formatShortMonth(monthFilter)}
                </span>
              )}
              {search && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-bold">
                  Search: "{search}"
                </span>
              )}
              {propertyFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold">
                  Property Selected
                </span>
              )}
              {statusFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                  Status: {statusFilter}
                </span>
              )}

              <button
                onClick={clearAllFilters}
                className="text-xs font-extrabold text-blue-600 hover:text-blue-800 hover:underline ml-auto"
              >
                Clear Filters
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Primary Rent Ledger Workspace */}
      <Card className="border border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <PageLoader />
          ) : isError ? (
            <div className="p-8 text-center space-y-3">
              <AlertCircle className="size-10 text-rose-500 mx-auto" />
              <h3 className="text-base font-black text-slate-900">Unable to load rent records</h3>
              <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
                We couldn't retrieve the ledger for {formatMonthLabel(monthFilter)}.
              </p>
              <Button onClick={() => refetch()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 px-4 rounded-xl">
                <RefreshCw className="size-3.5 mr-1.5" /> Retry
              </Button>
            </div>
          ) : !itemsToDisplay.length ? (
            <EmptyState
              icon={<Receipt className="size-8 text-slate-400" />}
              title={`No rent records for ${formatMonthLabel(monthFilter)}`}
              description="Generate monthly statements to begin tracking collection for this period."
              action={
                can(PERMISSIONS.RENT_MANAGE) ? (
                  <Button onClick={() => setConfirmGenerate(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl">
                    <Calendar className="size-4 mr-1.5" /> Generate Rent
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              {/* Mobile Rent Cards View (< 1024px) */}
              <ul className="divide-y divide-slate-100 lg:hidden">
                {itemsToDisplay.map((r) => {
                  const whatsappMsg = encodeURIComponent(
                    `Hi ${r.tenant?.name ?? "Tenant"}, your rent statement for ${formatShortMonth(r.billingMonth)} is ${formatINR(r.rent)}. Outstanding balance: ${formatINR(r.outstanding)}. Due date: ${formatDate(r.dueDate)}. Please pay at your earliest convenience.`
                  );
                  const cleanPhone = (r.tenant?.phone ?? "").replace(/\D/g, "");
                  const waUrl = cleanPhone ? `https://wa.me/91${cleanPhone}?text=${whatsappMsg}` : null;
                  const isPastDue = new Date(r.dueDate) < new Date() && Number(r.outstanding) > 0;

                  return (
                    <li key={r.id} className="p-4 space-y-3 bg-white">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 font-black text-xs border border-blue-100">
                            {getInitials(r.tenant?.name || "")}
                          </div>
                          <div className="min-w-0">
                            <Link to={`/admin/tenants/${r.tenantId}`} className="font-black text-sm text-slate-900 hover:text-blue-600 truncate block">
                              {r.tenant?.name || r.tenant?.phone || "Unassigned"}
                            </Link>
                            <span className="text-xs font-semibold text-slate-500 block truncate">{r.tenant?.phone || "No Phone"}</span>
                          </div>
                        </div>
                        <RentStatusBadge status={r.status} />
                      </div>

                      {/* Property & Rent Breakdown Box */}
                      <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 space-y-2 text-xs">
                        <div className="flex justify-between items-center border-b border-slate-200/60 pb-1.5">
                          <span className="font-bold text-slate-900 truncate">
                            {(r as any).tenant?.property?.name || (r as any).property?.name || "Unassigned"}
                            {(r as any).room ? ` · Rm ${(r as any).room.roomNumber}` : ""}
                            {(r as any).bed ? ` (Bed ${(r as any).bed.bedNumber})` : ""}
                          </span>
                          <span className="text-[10px] font-extrabold text-slate-500 font-mono">
                            {formatShortMonth(r.billingMonth)}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="text-slate-400 block text-[9px] uppercase font-extrabold">Monthly Rent</span>
                            <span className="font-extrabold text-slate-900">{formatINR(r.rent)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[9px] uppercase font-extrabold">Amount Paid</span>
                            <span className="font-extrabold text-emerald-600">{formatINR(r.paidAmount)}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-400 block text-[9px] uppercase font-extrabold">Outstanding</span>
                            <span className={`font-black text-sm ${Number(r.outstanding) > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                              {formatINR(r.outstanding)}
                            </span>
                          </div>
                        </div>

                        {isPastDue && (
                          <div className="text-[11px] font-bold text-rose-600 bg-rose-50 p-1.5 rounded-lg border border-rose-200 flex items-center gap-1">
                            <Clock className="size-3" /> Due {formatDate(r.dueDate)} (Overdue)
                          </div>
                        )}
                      </div>

                      {/* Action Row */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-2">
                          {can(PERMISSIONS.PAYMENTS_CREATE) && Number(r.outstanding) > 0 && (
                            <Link to={`/admin/payments?action=new&tenantId=${r.tenantId}&rentRecordId=${r.id}`}>
                              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 font-extrabold rounded-xl px-3.5">
                                Pay Statement
                              </Button>
                            </Link>
                          )}
                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all text-xs"
                              title="Send Reminder via WhatsApp"
                            >
                              <WhatsAppIcon className="size-4" />
                            </a>
                          )}
                        </div>

                        <RentActionMenu
                          record={r}
                          canManage={can(PERMISSIONS.RENT_MANAGE)}
                          menuOpen={openMenuId === r.id}
                          onMenuOpenChange={(open) => setOpenMenuId(open ? r.id : null)}
                          onAdjust={() => setAdjusting(r)}
                          onDelete={() => setDeleting(r)}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Desktop Ledger Table View (Fixed Layout >= 1024px, NO HORIZONTAL SCROLL) */}
              <div className="hidden lg:block w-full max-w-full overflow-hidden">
                <table className="w-full text-left text-xs table-fixed border-collapse">
                  <colgroup>
                    <col style={{ width: "18%" }} />
                    <col style={{ width: "17%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "6%" }} />
                  </colgroup>
                  <thead className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-black uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-3.5">TENANT</th>
                      <th className="px-3 py-3.5">PROPERTY / UNIT</th>
                      <th className="px-3 py-3.5">PERIOD</th>
                      <th className="px-3 py-3.5">DUE DATE</th>
                      <th className="px-3 py-3.5">RENT</th>
                      <th className="px-3 py-3.5">PAID</th>
                      <th className="px-3 py-3.5">OUTSTANDING</th>
                      <th className="px-3 py-3.5">STATUS</th>
                      <th className="px-3 py-3.5 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-medium">
                    {itemsToDisplay.map((r) => {
                      const cleanPhone = (r.tenant?.phone ?? "").replace(/\D/g, "");
                      const whatsappMsg = encodeURIComponent(
                        `Hi ${r.tenant?.name ?? "Tenant"}, your rent statement for ${formatShortMonth(r.billingMonth)} is ${formatINR(r.rent)}. Outstanding balance: ${formatINR(r.outstanding)}. Due date: ${formatDate(r.dueDate)}. Please pay at your earliest convenience.`
                      );
                      const waUrl = cleanPhone ? `https://wa.me/91${cleanPhone}?text=${whatsappMsg}` : null;
                      const isPastDue = new Date(r.dueDate) < new Date() && Number(r.outstanding) > 0;

                      return (
                        <tr key={r.id} className="hover:bg-slate-50/70 transition-colors h-16">
                          {/* TENANT */}
                          <td className="px-3 py-3.5 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 font-black text-xs border border-blue-100">
                                {getInitials(r.tenant?.name || "")}
                              </div>
                              <div className="min-w-0 flex-1">
                                <Link
                                  to={`/admin/tenants/${r.tenantId}`}
                                  className="font-black text-slate-900 hover:text-blue-600 text-xs truncate block"
                                  title={r.tenant?.name || r.tenant?.phone || "Unassigned"}
                                >
                                  {r.tenant?.name || r.tenant?.phone || "Unassigned"}
                                </Link>
                                <div className="flex items-center gap-1 text-[11px] text-slate-500 font-semibold truncate">
                                  <span className="truncate">{r.tenant?.phone || "No Phone"}</span>
                                  {waUrl && (
                                    <a href={waUrl} target="_blank" rel="noreferrer" className="text-emerald-600 hover:text-emerald-700 shrink-0" title="WhatsApp Chat">
                                      <WhatsAppIcon className="size-3" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* PROPERTY / UNIT */}
                          <td className="px-3 py-3.5 min-w-0">
                            <div className="space-y-0.5 min-w-0">
                              <span
                                className="font-bold text-slate-900 text-xs truncate block"
                                title={(r as any).tenant?.property?.name || (r as any).property?.name || "Unassigned"}
                              >
                                {(r as any).tenant?.property?.name || (r as any).property?.name || "Unassigned"}
                              </span>
                              {((r as any).room || (r as any).bed) && (
                                <span className="text-[11px] font-semibold text-slate-500 block truncate">
                                  {(r as any).room ? `Room ${(r as any).room.roomNumber}` : ""}
                                  {(r as any).bed ? ` · Bed ${(r as any).bed.bedNumber}` : ""}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* BILLING PERIOD */}
                          <td className="px-3 py-3.5 font-bold text-slate-800 text-xs truncate">
                            {formatShortMonth(r.billingMonth)}
                          </td>

                          {/* DUE DATE */}
                          <td className="px-3 py-3.5 text-xs">
                            <span className="font-semibold text-slate-700 block truncate">{formatDate(r.dueDate)}</span>
                            {isPastDue && (
                              <span className="text-[10px] font-extrabold text-rose-600 block">Overdue</span>
                            )}
                          </td>

                          {/* RENT */}
                          <td className="px-3 py-3.5 font-black text-slate-900 text-xs truncate">
                            {formatINR(r.rent)}
                          </td>

                          {/* PAID */}
                          <td className="px-3 py-3.5 font-bold text-emerald-600 text-xs truncate">
                            {formatINR(r.paidAmount)}
                          </td>

                          {/* OUTSTANDING */}
                          <td className="px-3 py-3.5 font-black text-xs truncate">
                            <span className={Number(r.outstanding) > 0 ? "text-rose-600" : "text-emerald-600"}>
                              {formatINR(r.outstanding)}
                            </span>
                          </td>

                          {/* STATUS */}
                          <td className="px-3 py-3.5 whitespace-nowrap">
                            <RentStatusBadge status={r.status} />
                          </td>

                          {/* ACTIONS */}
                          <td className="px-3 py-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end">
                              <RentActionMenu
                                record={r}
                                canManage={can(PERMISSIONS.RENT_MANAGE)}
                                menuOpen={openMenuId === r.id}
                                onMenuOpenChange={(open) => setOpenMenuId(open ? r.id : null)}
                                onAdjust={() => setAdjusting(r)}
                                onDelete={() => setDeleting(r)}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Numbered Pagination Footer */}
              <div className="border-t border-slate-200 bg-slate-50/50">
                <Pagination
                  page={data?.page ?? 1}
                  totalPages={data?.totalPages ?? 1}
                  total={data?.total ?? 0}
                  pageSize={15}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 5. MODALS & DIALOG OVERLAYS */}
      {/* CONFIRM MONTH GENERATION DIALOG */}
      <ConfirmDialog
        open={confirmGenerate}
        onOpenChange={(o) => !o && setConfirmGenerate(false)}
        title={`Generate Rent Statements for ${formatMonthLabel(monthFilter)}?`}
        description={`This will generate monthly rent statements for all active eligible tenants for ${formatMonthLabel(monthFilter)}. Existing statements will not be duplicated.`}
        confirmLabel="Generate Rent Statements"
        loading={generateMutation.isPending}
        onConfirm={() => generateMutation.mutate()}
      />

      {/* ADJUSTMENT DIALOG */}
      {adjusting && (
        <AdjustDialog
          record={adjusting}
          open={!!adjusting}
          onClose={() => setAdjusting(null)}
          onSaved={() => {
            setAdjusting(null);
            invalidate();
          }}
        />
      )}

      {/* DELETE STATEMENT CONFIRMATION DIALOG */}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete Rent Statement?"
        description={
          deleting
            ? `Are you sure you want to delete the ${formatShortMonth(deleting.billingMonth)} statement for "${deleting.tenant?.name || "this tenant"}"? This action cannot be undone.`
            : undefined
        }
        confirmLabel="Delete Statement"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// SUB-COMPONENTS
// -----------------------------------------------------------------------------

function RentStatusBadge({ status }: { status?: string }) {
  switch (status) {
    case "PAID":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="size-1.5 rounded-full bg-emerald-500"></span> PAID
        </span>
      );
    case "PARTIAL":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
          <span className="size-1.5 rounded-full bg-blue-500"></span> PARTIAL
        </span>
      );
    case "OVERDUE":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
          <span className="size-1.5 rounded-full bg-rose-500"></span> OVERDUE
        </span>
      );
    case "WAIVED":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
          <span className="size-1.5 rounded-full bg-slate-400"></span> WAIVED
        </span>
      );
    case "PENDING":
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="size-1.5 rounded-full bg-amber-500"></span> PENDING
        </span>
      );
  }
}

function RentActionMenu({
  record,
  canManage,
  menuOpen,
  onMenuOpenChange,
  onAdjust,
  onDelete,
}: {
  record: RentRecord;
  canManage: boolean;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onAdjust: () => void;
  onDelete: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  const MENU_WIDTH = 210;

  const computePosition = useCallback(() => {
    if (!buttonRef.current) return null;
    const rect = buttonRef.current.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    let top = rect.bottom + 6;
    if (vh - rect.bottom < 240) {
      top = rect.top - 240;
    }
    top = Math.max(12, Math.min(top, vh - 250));

    let left = rect.right - MENU_WIDTH;
    left = Math.max(12, Math.min(left, vw - MENU_WIDTH - 12));

    return { top, left };
  }, []);

  useLayoutEffect(() => {
    if (!menuOpen) {
      setPos(null);
      setVisible(false);
      return;
    }
    const btn = buttonRef.current;
    const isVis = !!btn && btn.getBoundingClientRect().width > 0 && btn.getBoundingClientRect().height > 0;
    setVisible(isVis);
    if (isVis) {
      setPos(computePosition());
    }
  }, [menuOpen, computePosition]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      onMenuOpenChange(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onMenuOpenChange(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen, onMenuOpenChange]);

  const close = () => onMenuOpenChange(false);

  const handleAction = (e: React.MouseEvent, actionFn: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    onMenuOpenChange(false);
    setTimeout(() => {
      actionFn();
    }, 10);
  };

  const cleanPhone = (record.tenant?.phone ?? "").replace(/\D/g, "");
  const whatsappMsg = encodeURIComponent(
    `Hi ${record.tenant?.name ?? "Tenant"}, regarding your rent statement for ${formatShortMonth(record.billingMonth)} (Outstanding: ${formatINR(record.outstanding)})...`
  );
  const waUrl = cleanPhone ? `https://wa.me/91${cleanPhone}?text=${whatsappMsg}` : null;

  return (
    <>
      <button
        ref={buttonRef}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onMenuOpenChange(!menuOpen);
        }}
        className="inline-flex size-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 active:scale-95 transition-all shadow-2xs shrink-0"
        title="More Actions"
      >
        <MoreVertical className="size-3.5" />
      </button>

      {menuOpen && pos && visible && createPortal(
        <div
          ref={menuRef}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            top: `${pos.top}px`,
            left: `${pos.left}px`,
            zIndex: 9999,
            width: `${MENU_WIDTH}px`,
          }}
          className="rounded-xl border border-slate-200/90 bg-white py-1.5 text-slate-700 shadow-xl ring-1 ring-black/5 text-xs font-bold"
        >
          <div className="py-1">
            {Number(record.outstanding) > 0 && (
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => handleAction(e, () => navigate(`/admin/payments?action=new&tenantId=${record.tenantId}&rentRecordId=${record.id}`))}
                className="flex w-full items-center gap-2.5 px-3 min-h-[36px] font-bold text-blue-700 hover:bg-blue-50 transition-colors text-left"
              >
                <CreditCard className="size-4 text-blue-600 shrink-0" /> Record Payment
              </button>
            )}

            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noreferrer"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => close()}
                className="flex w-full items-center gap-2.5 px-3 min-h-[36px] font-bold text-emerald-700 hover:bg-emerald-50 transition-colors text-left"
              >
                <WhatsAppIcon className="size-4 text-emerald-600 shrink-0" /> Send Reminder
              </a>
            )}

            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => handleAction(e, () => navigate(`/admin/tenants/${record.tenantId}`))}
              className="flex w-full items-center gap-2.5 px-3 min-h-[36px] font-bold text-slate-700 hover:bg-slate-100 transition-colors text-left"
            >
              <UserRound className="size-4 text-slate-400 shrink-0" /> View Tenant Profile
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => handleAction(e, () => navigate(`/admin/agreements?tenantId=${record.tenantId}`))}
              className="flex w-full items-center gap-2.5 px-3 min-h-[36px] font-bold text-slate-700 hover:bg-slate-100 transition-colors text-left"
            >
              <FileText className="size-4 text-slate-400 shrink-0" /> View Agreement
            </button>
          </div>

          {canManage && (
            <div className="my-1 border-t border-slate-100 pt-1">
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => handleAction(e, onAdjust)}
                className="flex w-full items-center gap-2.5 px-3 min-h-[36px] font-bold text-slate-700 hover:bg-slate-100 transition-colors text-left"
              >
                <SlidersHorizontal className="size-4 text-slate-400 shrink-0" /> Adjust Rent
              </button>

              {(record.status === "WAIVED" || (record as any).status === "CANCELLED") && (
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => handleAction(e, onDelete)}
                  className="flex w-full items-center gap-2.5 px-3 min-h-[36px] font-bold text-rose-700 hover:bg-rose-50 transition-colors text-left"
                >
                  <Trash2 className="size-4 text-rose-600 shrink-0" /> Delete Statement
                </button>
              )}
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

function AdjustDialog({
  record,
  open,
  onClose,
  onSaved,
}: {
  record: RentRecord;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState({ type: "DISCOUNT", amount: "", reason: "" });

  const currentRent = Number(record.rent || 0);
  const adjAmt = Number(form.amount || 0);
  const finalRent = form.type === "DISCOUNT" ? Math.max(0, currentRent - adjAmt) : currentRent + adjAmt;

  const mutation = useMutation({
    mutationFn: () =>
      api.adjustRent(record.id, {
        type: form.type as "CHARGE" | "DISCOUNT",
        amount: Number(form.amount),
        reason: form.reason,
      }),
    onSuccess: () => {
      success("Rent statement adjusted successfully");
      onSaved();
    },
    onError: (e) => toastError("Adjustment failed", e instanceof Error ? e.message : undefined),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-black text-slate-900">
            Adjust Rent Statement — {formatShortMonth(record.billingMonth)}
          </DialogTitle>
          <DialogDescription className="text-xs font-semibold text-slate-500">
            {record.tenant?.name} · Current Rent {formatINR(record.rent)} · Outstanding {formatINR(record.outstanding)}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4 pt-2 text-xs"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Adjustment Type *</Label>
              <Select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="h-10 rounded-xl border-slate-300 font-bold"
              >
                <option value="DISCOUNT">Discount / Waiver (-)</option>
                <option value="CHARGE">Additional Charge (+)</option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Amount (₹) *</Label>
              <Input
                required
                type="number"
                min={1}
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="h-10 rounded-xl border-slate-300 font-extrabold text-blue-600"
                placeholder="e.g. 500"
              />
            </div>
          </div>

          {/* Adjustment Preview Box */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1 font-semibold">
            <div className="flex justify-between text-slate-500">
              <span>Original Rent:</span>
              <span className="font-bold text-slate-800">{formatINR(currentRent)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Adjustment:</span>
              <span className={form.type === "DISCOUNT" ? "font-bold text-emerald-600" : "font-bold text-blue-600"}>
                {form.type === "DISCOUNT" ? `- ${formatINR(adjAmt)}` : `+ ${formatINR(adjAmt)}`}
              </span>
            </div>
            <div className="flex justify-between text-slate-900 border-t border-slate-200 pt-1 font-black">
              <span>Final Statement Rent:</span>
              <span className="text-blue-700">{formatINR(finalRent)}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Reason for Adjustment *</Label>
            <Input
              required
              minLength={3}
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="e.g. Goodwill discount, water damage compensation, late fee"
              className="h-10 rounded-xl border-slate-300 font-medium"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl font-bold">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!form.amount || Number(form.amount) <= 0 || !form.reason.trim()}
              loading={mutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl"
            >
              Apply Adjustment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
