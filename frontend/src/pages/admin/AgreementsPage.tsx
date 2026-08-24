import { useEffect, useState, useMemo, useRef, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  Search,
  Plus,
  FileCheck,
  FileText,
  Filter,
  Clock,
  Send,
  Eye,
  CheckCircle2,
  Lock,
  MoreVertical,
  Pencil,
  Copy,
  Download,
  Trash2,
  RefreshCw,
  X,
  AlertTriangle,
  RotateCcw,
  Ban,
  ChevronRight,
  Share2,
  Calendar,
  Building2,
  ShieldCheck,
  ExternalLink,
  User,
  Link2,
} from "lucide-react";
import { api, downloadUrl } from "@/lib/api";
import { formatINR, formatDate, formatPropertyType } from "@/lib/format";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePageResetOnFilter } from "@/hooks/usePageResetOnFilter";
import { useAuth } from "@/auth/AuthContext";
import { PERMISSIONS } from "@/lib/permissions";
import {
  Button,
  Card,
  CardContent,
  FilterSelect,
  Input,
  Label,
  PageLoader,
  Select,
} from "@/components/ui/primitives";
import { EmptyState, Pagination } from "@/components/ui/data";
import { ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import FileViewer from "@/components/FileViewer";
import type { Agreement, Property, Tenant } from "@/types";

// -----------------------------------------------------------------------------
// Official WhatsApp SVG Logo Icon
// -----------------------------------------------------------------------------
function WhatsAppIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function calculateDurationMonths(startDateStr: string, endDateStr: string): string {
  if (!startDateStr || !endDateStr) return "";
  const s = new Date(startDateStr);
  const e = new Date(endDateStr);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return "";
  const diffMs = e.getTime() - s.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const months = Math.round(diffDays / 30.4375);
  if (months <= 0) return "1 month";
  return `${months} months`;
}

function toDateInput(d?: string | Date | null): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(0, 10);
}

function formatAgreementNo(agreementNumber?: string | null, id?: string): string {
  if (!agreementNumber) return id ? `AGR-${id.slice(-6).toUpperCase()}` : "AGR-—";
  if (agreementNumber.startsWith("AGR-")) return agreementNumber;
  return `AGR-${agreementNumber}`;
}

export default function AgreementsPage() {
  const { can } = useAuth();
  const { success, error: toastError } = useToast();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filters & State
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const tenantIdParam = searchParams.get("tenantId") ?? "";

  usePageResetOnFilter(setPage, search, statusFilter, propertyFilter, tenantIdParam);

  // 1. Fetch Paginated Agreements List
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["agreements", page, debouncedSearch, statusFilter, propertyFilter, tenantIdParam],
    queryFn: () =>
      api.listAgreements({
        page,
        pageSize: 10,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        propertyId: propertyFilter || undefined,
        tenantId: tenantIdParam || undefined,
      }),
  });

  // 2. Fetch Aggregation Statistics (5 Core KPI Metrics + Dropdown Counts)
  const { data: statsData, isLoading: isStatsLoading } = useQuery({
    queryKey: ["agreements-stats", propertyFilter, tenantIdParam],
    queryFn: () => api.getAgreementStats({ propertyId: propertyFilter || undefined, tenantId: tenantIdParam || undefined }),
    staleTime: 10000,
  });

  // 3. Load Tenant Details for Filter Indicator
  const { data: filterTenant } = useQuery({
    queryKey: ["tenant", tenantIdParam],
    queryFn: () => api.getTenant(tenantIdParam),
    enabled: !!tenantIdParam,
    staleTime: 30000,
  });

  // 4. Fetch Properties for Filter Dropdown
  const { data: propertiesData } = useQuery({
    queryKey: ["properties-filter-list"],
    queryFn: () => api.listProperties({ pageSize: 500 }),
    staleTime: 30000,
  });

  const properties = propertiesData?.items ?? [];

  // Compute 5 Core KPI Metrics (ALL EXCLUDES CANCELLED)
  const kpiStats = useMemo(() => {
    return {
      all: statsData?.all ?? 0,
      active: statsData?.active ?? 0,
      signed: statsData?.signed ?? 0,
      expired: statsData?.expired ?? 0,
      terminated: statsData?.terminated ?? 0,
      cancelled: statsData?.cancelled ?? 0,
      notSigned: statsData?.notSigned ?? 0,
    };
  }, [statsData]);

  // Dialog & Modal States
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Agreement | null>(null);
  const [deleting, setDeleting] = useState<Agreement | null>(null);
  const [cancelModal, setCancelModal] = useState<Agreement | null>(null);
  const [viewer, setViewer] = useState<{ url: string; name: string } | null>(null);
  const [signLinkModal, setSignLinkModal] = useState<{ agreement: Agreement; url: string } | null>(null);
  const [detailModal, setDetailModal] = useState<Agreement | null>(null);
  const [shareModal, setShareModal] = useState<Agreement | null>(null);
  const [statusChangeModal, setStatusChangeModal] = useState<{ agreement: Agreement; targetStatus: string } | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["agreements"] });
    qc.invalidateQueries({ queryKey: ["agreements-stats"] });
  };

  const sendSigningMutation = useMutation({
    mutationFn: (agreementId: string) => api.sendAgreementForSigning(agreementId),
    onSuccess: (res) => {
      const fullUrl = `${window.location.origin}/agreements/sign/${res.token}`;
      setSignLinkModal({ agreement: res.agreement, url: fullUrl });
      success("Digital signing link generated!");
      invalidate();
    },
    onError: (err) => toastError("Could not generate signing link", err instanceof Error ? err.message : undefined),
  });

  const statusChangeMutation = useMutation({
    mutationFn: ({ agreementId, status, reason }: { agreementId: string; status: string; reason?: string }) =>
      api.updateAgreement(agreementId, { status: status as any, notes: reason ? `Reason: ${reason}` : undefined }),
    onSuccess: () => {
      success("Agreement status updated");
      setStatusChangeModal(null);
      invalidate();
    },
    onError: (e) => toastError("Status change failed", e instanceof Error ? e.message : undefined),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteAgreement(deleting!.id),
    onSuccess: () => {
      success("Agreement deleted");
      setDeleting(null);
      invalidate();
    },
    onError: (e) => toastError("Delete failed", e instanceof Error ? e.message : undefined),
  });

  const clearAllFilters = () => {
    setSearch("");
    setStatusFilter("");
    setPropertyFilter("");
    if (tenantIdParam) clearTenantFilter();
  };

  const clearTenantFilter = () => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("tenantId");
    setSearchParams(sp, { replace: true });
  };

  const hasActiveFilters = !!(search || statusFilter || propertyFilter || tenantIdParam);

  // Status Filter Options (EXACTLY 7 REQUIRED CATEGORIES)
  const statuses = [
    { label: `All Agreements (${statsData?.all ?? 0})`, value: "" },
    { label: `Active (${statsData?.active ?? 0})`, value: "ACTIVE" },
    { label: `Signed (${statsData?.signed ?? 0})`, value: "SIGNED" },
    { label: `Not Signed (${statsData?.notSigned ?? 0})`, value: "NOT_SIGNED" },
    { label: `Expired (${statsData?.expired ?? 0})`, value: "EXPIRED" },
    { label: `Terminated (${statsData?.terminated ?? 0})`, value: "TERMINATED" },
    { label: `Cancelled (${statsData?.cancelled ?? 0})`, value: "CANCELLED" },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Page Header (Clean, non-card header) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Agreements</h1>
          <p className="text-sm font-medium text-slate-500">
            Create, send, sign and manage rental agreements.
          </p>
        </div>

        {can(PERMISSIONS.AGREEMENTS_MANAGE) && (
          <Button
            onClick={() => setCreating(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 px-5 rounded-[10px] shadow-xs active:scale-95 transition-all w-full sm:w-auto flex items-center justify-center gap-2 text-sm"
          >
            <Plus className="size-4 stroke-[2.5]" /> Create Agreement
          </Button>
        )}
      </div>

      {/* 2. Dynamic Summary Cards — EXACTLY 5 CARDS */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-5">
        {/* 1. ALL AGREEMENTS */}
        <div className="bg-white rounded-[14px] p-5 border border-slate-200/90 shadow-2xs space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">All Agreements</span>
          {isStatsLoading ? (
            <div className="h-8 w-16 bg-slate-100 animate-pulse rounded-lg"></div>
          ) : (
            <div className="text-2xl sm:text-3xl font-black text-slate-900">{kpiStats.all}</div>
          )}
          <span className="text-xs font-medium text-slate-500 block">Total agreements</span>
        </div>

        {/* 2. ACTIVE */}
        <div className="bg-white rounded-[14px] p-5 border border-slate-200/90 shadow-2xs space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">Active</span>
          {isStatsLoading ? (
            <div className="h-8 w-16 bg-slate-100 animate-pulse rounded-lg"></div>
          ) : (
            <div className="text-2xl sm:text-3xl font-black text-emerald-600">{kpiStats.active}</div>
          )}
          <span className="text-xs font-medium text-slate-500 block">Currently active</span>
        </div>

        {/* 3. SIGNED */}
        <div className="bg-white rounded-[14px] p-5 border border-slate-200/90 shadow-2xs space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 block">Signed</span>
          {isStatsLoading ? (
            <div className="h-8 w-16 bg-slate-100 animate-pulse rounded-lg"></div>
          ) : (
            <div className="text-2xl sm:text-3xl font-black text-teal-600">{kpiStats.signed}</div>
          )}
          <span className="text-xs font-medium text-slate-500 block">Digitally signed</span>
        </div>

        {/* 4. EXPIRED */}
        <div className="bg-white rounded-[14px] p-5 border border-slate-200/90 shadow-2xs space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block">Expired</span>
          {isStatsLoading ? (
            <div className="h-8 w-16 bg-slate-100 animate-pulse rounded-lg"></div>
          ) : (
            <div className="text-2xl sm:text-3xl font-black text-amber-600">{kpiStats.expired}</div>
          )}
          <span className="text-xs font-medium text-slate-500 block">Past agreement term</span>
        </div>

        {/* 5. TERMINATED (100% on mobile, 20% on desktop) */}
        <div className="bg-white rounded-[14px] p-5 border border-slate-200/90 shadow-2xs space-y-1.5 col-span-2 lg:col-span-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 block">Terminated</span>
          {isStatsLoading ? (
            <div className="h-8 w-16 bg-slate-100 animate-pulse rounded-lg"></div>
          ) : (
            <div className="text-2xl sm:text-3xl font-black text-rose-600">{kpiStats.terminated}</div>
          )}
          <span className="text-xs font-medium text-slate-500 block">Contract terminated</span>
        </div>
      </div>

      {/* 3. Search & Clean Filter Toolbar */}
      <Card className="border border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-3">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 items-center">
            {/* Search Input */}
            <div className="relative lg:col-span-6">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search tenant, property, agreement ID..."
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

            {/* Property Filter */}
            <div className="lg:col-span-3">
              <FilterSelect
                icon={Building2}
                value={propertyFilter}
                onChange={(e) => setPropertyFilter(e.target.value)}
              >
                <option value="">All Properties</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.type === "HOUSE" ? "House" : "PG"})
                  </option>
                ))}
              </FilterSelect>
            </div>

            {/* Status Filter */}
            <div className="lg:col-span-3">
              <FilterSelect
                icon={Filter}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {statuses.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </FilterSelect>
            </div>
          </div>

          {/* Active Filter Indicators */}
          {hasActiveFilters && (
            <div className="flex items-center flex-wrap gap-2 pt-2 border-t border-slate-100 text-xs">
              <span className="text-[11px] font-bold text-slate-500">Filtered by:</span>
              {search && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                  "{search}"
                  <button onClick={() => setSearch("")} className="hover:text-slate-900"><X className="size-3" /></button>
                </span>
              )}
              {propertyFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                  {properties.find((p) => p.id === propertyFilter)?.name ?? "Property"}
                  <button onClick={() => setPropertyFilter("")} className="hover:text-slate-900"><X className="size-3" /></button>
                </span>
              )}
              {statusFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                  {statusFilter === "NOT_SIGNED" ? "Not Signed" : statusFilter}
                  <button onClick={() => setStatusFilter("")} className="hover:text-slate-900"><X className="size-3" /></button>
                </span>
              )}
              {tenantIdParam && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                  Tenant: {filterTenant?.name ?? "Selected"}
                  <button onClick={clearTenantFilter} className="hover:text-slate-900"><X className="size-3" /></button>
                </span>
              )}

              <button
                onClick={clearAllFilters}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline ml-auto"
              >
                Clear all
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Main Directory List */}
      <Card className="border border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton />
          ) : isError ? (
            <div className="p-8 text-center space-y-3">
              <AlertTriangle className="size-10 text-rose-500 mx-auto" />
              <h3 className="text-base font-black text-slate-900">Unable to load agreements</h3>
              <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
                Something went wrong while loading rental agreements. Please check your connection and retry.
              </p>
              <Button onClick={() => refetch()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 px-4 rounded-xl">
                <RefreshCw className="size-3.5 mr-1.5" /> Retry
              </Button>
            </div>
          ) : !data?.items.length ? (
            <EmptyState
              icon={<FileText className="size-8 text-slate-400" />}
              title="No agreements found"
              description={
                hasActiveFilters
                  ? "There are no agreements matching your current filters."
                  : "Create your first rental agreement to get started."
              }
              action={
                hasActiveFilters ? (
                  <Button onClick={clearAllFilters} variant="outline" className="font-bold border-slate-300 text-slate-700 rounded-xl">
                    Clear Filters
                  </Button>
                ) : (
                  can(PERMISSIONS.AGREEMENTS_MANAGE) && (
                    <Button onClick={() => setCreating(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl">
                      <Plus className="size-4 mr-1.5" /> Create Agreement
                    </Button>
                  )
                )
              }
            />
          ) : (
            <>
              {/* MOBILE DIRECTORY VIEW (< 1024px) */}
              <div className="lg:hidden divide-y divide-slate-100">
                {data.items.map((ag) => (
                  <AgreementMobileCard
                    key={ag.id}
                    agreement={ag}
                    canManage={can(PERMISSIONS.AGREEMENTS_MANAGE)}
                    activeMenuId={activeMenuId}
                    setActiveMenuId={setActiveMenuId}
                    onViewDetail={() => setDetailModal(ag)}
                    onViewDoc={(url, name) => setViewer({ url, name })}
                    onSendSign={() => sendSigningMutation.mutate(ag.id)}
                    onEdit={() => setEditing(ag)}
                    onShare={() => setShareModal(ag)}
                    onStatusChange={(targetStatus) => setStatusChangeModal({ agreement: ag, targetStatus })}
                    onCancel={() => setCancelModal(ag)}
                    onDelete={() => setDeleting(ag)}
                  />
                ))}
              </div>

              {/* DESKTOP SAAS DATA TABLE (>= 1024px) — STRICT 100% FIXED TABLE, ZERO OVERFLOW */}
              <div className="hidden lg:block w-full max-w-full overflow-hidden">
                <table className="w-full text-left border-collapse table-fixed text-xs">
                  <colgroup>
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "18%" }} />
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "17%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "8%" }} />
                  </colgroup>
                  <thead className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3.5 py-3.5">AGREEMENT</th>
                      <th className="px-3.5 py-3.5">TENANT</th>
                      <th className="px-3.5 py-3.5">PROPERTY</th>
                      <th className="px-3.5 py-3.5">TERM</th>
                      <th className="px-3.5 py-3.5">FINANCIAL</th>
                      <th className="px-3.5 py-3.5">STATUS</th>
                      <th className="px-3.5 py-3.5 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-medium">
                    {data.items.map((ag) => {
                      const isSigned = ag.isLocked || ag.status === "SIGNED" || ag.status === "COMPLETED";
                      const docUrl = downloadUrl(
                        isSigned
                          ? (ag.signedPdf?.url || `/rent/agreements/${ag.id}/signed-document`)
                          : (ag.document?.url || `/rent/agreements/${ag.id}/document`)
                      );

                      const tenantPhone = ag.tenant?.phone ?? "";
                      const cleanPhone = tenantPhone.replace(/\D/g, "");
                      const durationStr = calculateDurationMonths(toDateInput(ag.startDate), toDateInput(ag.endDate));
                      const agrNo = formatAgreementNo(ag.agreementNumber, ag.id);

                      return (
                        <tr key={ag.id} className="hover:bg-slate-50/70 transition-colors h-16">
                          {/* AGREEMENT */}
                          <td className="px-3.5 py-3.5 min-w-0">
                            <div className="min-w-0">
                              <button
                                onClick={() => setDetailModal(ag)}
                                className="font-semibold text-slate-900 hover:text-blue-600 text-xs block text-left font-mono truncate max-w-full"
                                title={agrNo}
                              >
                                {agrNo}
                              </button>
                              <span className="text-[11px] text-slate-500 block mt-0.5 truncate">
                                Created {formatDate(ag.createdAt)}
                              </span>
                            </div>
                          </td>

                          {/* TENANT */}
                          <td className="px-3.5 py-3.5 min-w-0">
                            <div className="min-w-0 pr-1">
                              {ag.tenant ? (
                                <Link
                                  to={`/admin/tenants/${ag.tenant.id}`}
                                  className="font-semibold text-slate-900 hover:text-blue-600 text-xs block truncate"
                                  title={ag.tenant.name}
                                >
                                  {ag.tenant.name}
                                </Link>
                              ) : (
                                <span className="text-slate-400 font-bold text-xs">—</span>
                              )}
                              <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-500 font-medium">
                                <span className="truncate">{tenantPhone ? (tenantPhone.startsWith("+") ? tenantPhone : `+91 ${tenantPhone}`) : "No Phone"}</span>
                                {cleanPhone && (
                                  <a
                                    href={`https://wa.me/${cleanPhone.length === 10 ? "91" + cleanPhone : cleanPhone}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-emerald-600 hover:text-emerald-700 shrink-0"
                                    title="Send WhatsApp"
                                  >
                                    <WhatsAppIcon className="size-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* PROPERTY */}
                          <td className="px-3.5 py-3.5 min-w-0">
                            <div className="min-w-0 pr-1 space-y-0.5">
                              <span className="font-semibold text-slate-900 text-xs block truncate" title={ag.property?.name ?? "—"}>
                                {ag.property?.name ?? "—"}
                              </span>
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded inline-block">
                                {ag.property?.type === "HOUSE" ? "HOUSE" : "PG"}
                              </span>
                            </div>
                          </td>

                          {/* TERM */}
                          <td className="px-3.5 py-3.5 min-w-0">
                            <div className="min-w-0 pr-1">
                              <span className="text-xs font-semibold text-slate-800 block truncate">
                                {formatDate(ag.startDate)}
                              </span>
                              <span className="text-xs font-semibold text-slate-800 block truncate">
                                — {formatDate(ag.endDate)}
                              </span>
                              {durationStr && (
                                <span className="text-[11px] font-medium text-slate-500 block truncate">
                                  {durationStr}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* FINANCIAL */}
                          <td className="px-3.5 py-3.5 min-w-0">
                            <div className="min-w-0 pr-1">
                              <span className="text-xs font-bold text-slate-900 block truncate">
                                {formatINR(ag.rent)} <span className="text-[11px] font-normal text-slate-500">/ month</span>
                              </span>
                              <span className="text-[11px] font-medium text-slate-500 block truncate mt-0.5">
                                Advance {formatINR(ag.advance)} · Deposit {formatINR(ag.deposit)}
                              </span>
                            </div>
                          </td>

                          {/* STATUS */}
                          <td className="px-3.5 py-3.5 whitespace-nowrap">
                            <AgreementStatusBadge status={ag.status} isLocked={isSigned} />
                          </td>

                          {/* ACTIONS */}
                          <td className="px-3.5 py-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDetailModal(ag)}
                                className="h-8 px-2.5 rounded-lg font-semibold text-xs border-slate-200 bg-slate-50 text-slate-700 hover:bg-blue-50 hover:text-blue-600 shrink-0"
                              >
                                View
                              </Button>

                              <AgreementActionMenu
                                agreement={ag}
                                canManage={can(PERMISSIONS.AGREEMENTS_MANAGE)}
                                menuOpen={activeMenuId === ag.id}
                                onMenuOpenChange={(open) => setActiveMenuId(open ? ag.id : null)}
                                onViewDetail={() => setDetailModal(ag)}
                                onViewDoc={(url, name) => setViewer({ url, name })}
                                onSendSign={() => sendSigningMutation.mutate(ag.id)}
                                onEdit={() => setEditing(ag)}
                                onShare={() => setShareModal(ag)}
                                onStatusChange={(targetStatus) => setStatusChangeModal({ agreement: ag, targetStatus })}
                                onCancel={() => setCancelModal(ag)}
                                onDelete={() => setDeleting(ag)}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* 5. Numbered Pagination Footer */}
          {!!data?.items.length && (
            <div className="border-t border-slate-200 bg-slate-50/50">
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                onPageChange={(p) => setPage(p)}
                total={data.total}
                pageSize={10}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 6. MODALS & DIALOG OVERLAYS */}
      {/* CREATE / EDIT AGREEMENT FORM MODAL */}
      {(creating || editing) && (
        <AgreementFormModal
          open={creating || !!editing}
          editingAgreement={editing}
          properties={properties}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); invalidate(); }}
        />
      )}

      {/* CANCEL AGREEMENT CONFIRMATION DIALOG */}
      <CancelAgreementModal
        agreement={cancelModal}
        open={!!cancelModal}
        onClose={() => setCancelModal(null)}
        onSuccess={invalidate}
      />

      {/* SHARE / SEND FOR SIGNATURE MODAL */}
      <ShareAgreementModal
        agreement={shareModal}
        open={!!shareModal}
        onClose={() => setShareModal(null)}
      />

      {/* DETAIL MODAL */}
      <AgreementDetailModal
        agreement={detailModal}
        open={!!detailModal}
        onClose={() => setDetailModal(null)}
        onViewDoc={(url, name) => setViewer({ url, name })}
      />

      {/* SIGNING LINK GENERATED MODAL */}
      {signLinkModal && (
        <Dialog open={!!signLinkModal} onOpenChange={() => setSignLinkModal(null)}>
          <DialogContent className="rounded-2xl max-w-md p-5 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Send className="size-4 text-blue-600" /> Digital Signing Link Generated
              </DialogTitle>
              <DialogDescription className="text-xs font-semibold text-slate-600">
                Send this secure signing link to <strong>{signLinkModal.agreement.tenant?.name ?? "Resident"}</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2 w-full min-w-0">
              <Input value={signLinkModal.url} readOnly className="font-mono text-xs border-slate-300 rounded-xl bg-slate-50 select-all w-full min-w-0 truncate" />
              <DialogFooter className="pt-2">
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(signLinkModal.url);
                    success("Link copied!");
                    setSignLinkModal(null);
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl h-11 text-xs"
                >
                  Copy Link & Close
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* STATUS CHANGE CONFIRMATION DIALOG (RENEW / TERMINATE) */}
      {statusChangeModal && (
        <ConfirmDialog
          open={!!statusChangeModal}
          onOpenChange={(o) => !o && setStatusChangeModal(null)}
          title={
            statusChangeModal.targetStatus === "RENEWED"
              ? "Renew Rental Agreement?"
              : statusChangeModal.targetStatus === "TERMINATED"
              ? "Terminate Rental Agreement?"
              : `Update Status to ${statusChangeModal.targetStatus}?`
          }
          description={`Are you sure you want to set the status of agreement "${formatAgreementNo(statusChangeModal.agreement.agreementNumber, statusChangeModal.agreement.id)}" for "${statusChangeModal.agreement.tenant?.name || "Resident"}" to ${statusChangeModal.targetStatus}?`}
          confirmLabel={
            statusChangeModal.targetStatus === "RENEWED"
              ? "Renew Agreement"
              : statusChangeModal.targetStatus === "TERMINATED"
              ? "Terminate Agreement"
              : "Confirm Status Change"
          }
          destructive={statusChangeModal.targetStatus === "TERMINATED"}
          loading={statusChangeMutation.isPending}
          onConfirm={() =>
            statusChangeMutation.mutate({
              agreementId: statusChangeModal.agreement.id,
              status: statusChangeModal.targetStatus,
            })
          }
        />
      )}

      {/* FILE VIEWER OVERLAY */}
      {viewer && (
        <FileViewer
          open={!!viewer}
          url={viewer.url}
          name={viewer.name}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// HELPER COMPONENTS & BADGES
// -----------------------------------------------------------------------------

function AgreementStatusBadge({ status, isLocked }: { status: string; isLocked?: boolean }) {
  if (isLocked || status === "SIGNED" || status === "COMPLETED") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
        <ShieldCheck className="size-3.5 text-emerald-600 shrink-0" /> SIGNED
      </span>
    );
  }

  switch (status) {
    case "ACTIVE":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" /> ACTIVE
        </span>
      );
    case "EXPIRED":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="size-3.5 text-amber-600 shrink-0" /> EXPIRED
        </span>
      );
    case "TERMINATED":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <Ban className="size-3.5 text-rose-600 shrink-0" /> TERMINATED
        </span>
      );
    case "CANCELLED":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
          <Ban className="size-3.5 text-slate-500 shrink-0" /> CANCELLED
        </span>
      );
    case "DRAFT":
    case "SENT":
    case "VIEWED":
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
          <Clock className="size-3.5 text-slate-500 shrink-0" /> NOT SIGNED
        </span>
      );
  }
}

function AgreementActionMenu({
  agreement,
  canManage,
  menuOpen,
  onMenuOpenChange,
  onViewDetail,
  onViewDoc,
  onSendSign,
  onEdit,
  onShare,
  onStatusChange,
  onCancel,
  onDelete,
}: {
  agreement: Agreement;
  canManage: boolean;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onViewDetail: () => void;
  onViewDoc: (url: string, name: string) => void;
  onSendSign: () => void;
  onEdit: () => void;
  onShare: () => void;
  onStatusChange: (targetStatus: string) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [visible, setVisible] = useState(false);

  const status = agreement.status;
  const isSigned = agreement.isLocked || status === "SIGNED" || status === "COMPLETED";
  const docUrl = downloadUrl(
    isSigned
      ? (agreement.signedPdf?.url || `/rent/agreements/${agreement.id}/signed-document`)
      : (agreement.document?.url || `/rent/agreements/${agreement.id}/document`)
  );

  const agrNo = formatAgreementNo(agreement.agreementNumber, agreement.id);

  const MENU_WIDTH = 215;
  const MENU_MARGIN = 12;

  const computePosition = useCallback((menuHeight: number) => {
    const button = buttonRef.current;
    if (!button) return null;
    const rect = button.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;

    let top: number;
    if (spaceBelow >= menuHeight + 8 || spaceBelow >= spaceAbove) {
      top = rect.bottom + 6;
    } else {
      top = rect.top - menuHeight - 6;
    }
    top = Math.max(MENU_MARGIN, Math.min(top, vh - menuHeight - MENU_MARGIN));

    let left = rect.right - MENU_WIDTH;
    left = Math.max(MENU_MARGIN, Math.min(left, vw - MENU_WIDTH - MENU_MARGIN));

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
      let estimatedHeight = 130; // Base: View Details, View Document, Download PDF + padding
      if (!isSigned && status !== "CANCELLED") {
        estimatedHeight += canManage ? 108 : 72;
      }
      if (isSigned) {
        estimatedHeight += 36;
      }
      if (status !== "CANCELLED") {
        estimatedHeight += 8; // separator
        if (canManage) estimatedHeight += 36; // Terminate/Renew/Cancel
      }
      if (canManage) {
        estimatedHeight += 44; // separator + Delete
      }
      setPos(computePosition(estimatedHeight));
    }
  }, [menuOpen, computePosition, isSigned, status, canManage]);

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
            {/* VIEW DETAILS */}
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => handleAction(e, onViewDetail)}
              className="flex w-full items-center gap-2.5 px-3 min-h-[36px] font-bold text-slate-700 hover:bg-slate-100 transition-colors text-left"
            >
              <Eye className="size-4 text-slate-400 shrink-0" /> View Details
            </button>

            {/* VIEW DOCUMENT */}
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => handleAction(e, () => onViewDoc(docUrl, `Agreement-${agrNo}.pdf`))}
              className="flex w-full items-center gap-2.5 px-3 min-h-[36px] font-bold text-slate-700 hover:bg-slate-100 transition-colors text-left"
            >
              <FileText className="size-4 text-slate-400 shrink-0" /> {isSigned ? "View Signed Document" : "View Document PDF"}
            </button>

            {/* DOWNLOAD PDF */}
            <a
              href={docUrl}
              download={`Agreement-${agrNo}.pdf`}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => close()}
              className="flex w-full items-center gap-2.5 px-3 min-h-[36px] font-bold text-slate-700 hover:bg-slate-100 transition-colors text-left"
            >
              <Download className="size-4 text-slate-400 shrink-0" /> Download {isSigned ? "Signed PDF" : "PDF"}
            </a>

            {/* NOT SIGNED SPECIFIC ACTIONS */}
            {!isSigned && status !== "CANCELLED" && (
              <>
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => handleAction(e, onSendSign)}
                  className="flex w-full items-center gap-2.5 px-3 min-h-[36px] font-bold text-blue-700 hover:bg-blue-50 transition-colors text-left"
                >
                  <Send className="size-4 text-blue-600 shrink-0" /> Send for Signature
                </button>

                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => handleAction(e, onShare)}
                  className="flex w-full items-center gap-2.5 px-3 min-h-[36px] font-bold text-slate-700 hover:bg-slate-100 transition-colors text-left"
                >
                  <Share2 className="size-4 text-slate-400 shrink-0" /> Share for Signature
                </button>

                {canManage && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => handleAction(e, onEdit)}
                    className="flex w-full items-center gap-2.5 px-3 min-h-[36px] font-bold text-slate-700 hover:bg-slate-100 transition-colors text-left"
                  >
                    <Pencil className="size-4 text-slate-400 shrink-0" /> Edit Agreement
                  </button>
                )}
              </>
            )}

            {/* SIGNED SPECIFIC ACTIONS */}
            {isSigned && (
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => handleAction(e, onShare)}
                className="flex w-full items-center gap-2.5 px-3 min-h-[36px] font-bold text-slate-700 hover:bg-slate-100 transition-colors text-left"
              >
                <Link2 className="size-4 text-slate-400 shrink-0" /> Copy Document Link
              </button>
            )}
          </div>

          {/* RENEW & CANCEL ACTIONS */}
          {status !== "CANCELLED" && (
            <div className="my-1 border-t border-slate-100 pt-1">
              {["ACTIVE", "SIGNED", "COMPLETED", "EXPIRED", "TERMINATED"].includes(status) && canManage && (
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => handleAction(e, () => onStatusChange("RENEWED"))}
                  className="flex w-full items-center gap-2.5 px-3 min-h-[36px] font-bold text-indigo-700 hover:bg-indigo-50 transition-colors text-left"
                >
                  <RotateCcw className="size-4 text-indigo-600 shrink-0" /> Renew Agreement
                </button>
              )}

              {["ACTIVE", "SIGNED", "COMPLETED"].includes(status) && canManage && (
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => handleAction(e, () => onStatusChange("TERMINATED"))}
                  className="flex w-full items-center gap-2.5 px-3 min-h-[36px] font-bold text-rose-700 hover:bg-rose-50 transition-colors text-left"
                >
                  <Ban className="size-4 text-rose-600 shrink-0" /> Terminate Agreement
                </button>
              )}

              {!isSigned && canManage && (
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => handleAction(e, onCancel)}
                  className="flex w-full items-center gap-2.5 px-3 min-h-[36px] font-bold text-rose-700 hover:bg-rose-50 transition-colors text-left"
                >
                  <Ban className="size-4 text-rose-600 shrink-0" /> Cancel Agreement
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

function AgreementMobileCard({
  agreement,
  canManage,
  activeMenuId,
  setActiveMenuId,
  onViewDetail,
  onViewDoc,
  onSendSign,
  onEdit,
  onShare,
  onStatusChange,
  onCancel,
  onDelete,
}: {
  agreement: Agreement;
  canManage: boolean;
  activeMenuId: string | null;
  setActiveMenuId: (id: string | null) => void;
  onViewDetail: () => void;
  onViewDoc: (url: string, name: string) => void;
  onSendSign: () => void;
  onEdit: () => void;
  onShare: () => void;
  onStatusChange: (targetStatus: string) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const isSigned = agreement.isLocked || agreement.status === "SIGNED" || agreement.status === "COMPLETED";

  return (
    <div className="p-4 space-y-3 bg-white border-b border-slate-100 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <div>
          <button onClick={onViewDetail} className="font-bold text-sm text-slate-900 hover:text-blue-600 font-mono text-left block">
            {formatAgreementNo(agreement.agreementNumber, agreement.id)}
          </button>
          <span className="text-xs font-semibold text-slate-600 block mt-0.5">
            {agreement.tenant?.name ?? "—"} ({agreement.tenant?.phone ?? "—"})
          </span>
        </div>
        <AgreementStatusBadge status={agreement.status} isLocked={isSigned} />
      </div>

      <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/80 space-y-2 text-xs">
        <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
          <span className="font-bold text-slate-900 truncate">
            {agreement.property?.name ?? "—"}
          </span>
          <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
            {agreement.property?.type === "HOUSE" ? "HOUSE" : "PG"}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1 text-center pt-0.5">
          <div>
            <span className="text-[9px] uppercase font-bold text-slate-400 block">RENT</span>
            <span className="font-bold text-slate-900 text-xs">{formatINR(agreement.rent)}/mo</span>
          </div>
          <div>
            <span className="text-[9px] uppercase font-bold text-slate-400 block">ADVANCE</span>
            <span className="font-bold text-slate-800 text-xs">{formatINR(agreement.advance)}</span>
          </div>
          <div>
            <span className="text-[9px] uppercase font-black text-slate-400 block">DEPOSIT</span>
            <span className="font-bold text-slate-800 text-xs">{formatINR(agreement.deposit)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 text-xs">
        <div className="text-slate-500 font-medium text-[11px]">
          <span>{formatDate(agreement.startDate)} – {formatDate(agreement.endDate)}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={onViewDetail}
            className="h-8 px-3 rounded-lg font-bold text-xs border-slate-200 bg-slate-50 text-slate-700 hover:bg-blue-50 hover:text-blue-600"
          >
            View
          </Button>

          <AgreementActionMenu
            agreement={agreement}
            canManage={canManage}
            menuOpen={activeMenuId === agreement.id}
            onMenuOpenChange={(open) => setActiveMenuId(open ? agreement.id : null)}
            onViewDetail={onViewDetail}
            onViewDoc={onViewDoc}
            onSendSign={onSendSign}
            onEdit={onEdit}
            onShare={onShare}
            onStatusChange={onStatusChange}
            onCancel={onCancel}
            onDelete={onDelete}
          />
        </div>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="p-4 space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-xl w-full"></div>
      ))}
    </div>
  );
}

function AgreementDetailModal({
  agreement,
  open,
  onClose,
  onViewDoc,
}: {
  agreement: Agreement | null;
  open: boolean;
  onClose: () => void;
  onViewDoc: (url: string, name: string) => void;
}) {
  if (!agreement) return null;

  const isSigned = agreement.isLocked || agreement.status === "SIGNED" || agreement.status === "COMPLETED";
  const docUrl = downloadUrl(
    isSigned
      ? (agreement.signedPdf?.url || `/rent/agreements/${agreement.id}/signed-document`)
      : (agreement.document?.url || `/rent/agreements/${agreement.id}/document`)
  );

  const tenantName = agreement.tenant?.name ?? "Resident";
  const propertyName = agreement.property?.name ?? "Property";
  const agrNo = formatAgreementNo(agreement.agreementNumber, agreement.id);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl max-w-lg p-6">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">C2D RENTALS</span>
            <AgreementStatusBadge status={agreement.status} isLocked={isSigned} />
          </div>
          <DialogTitle className="text-lg font-bold text-slate-900 mt-1">
            Rental Agreement — {agrNo}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 font-medium">
            Commercial Rental Contract Record
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-3 text-xs">
          {/* Document Summary Section */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 font-medium">
            <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
              <span className="text-slate-500">Agreement Reference</span>
              <span className="font-mono font-bold text-slate-900">{agrNo}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
              <span className="text-slate-500">Tenant / Resident</span>
              <span className="font-semibold text-slate-900">{tenantName} ({agreement.tenant?.phone ?? "N/A"})</span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
              <span className="text-slate-500">Property Unit</span>
              <span className="font-semibold text-slate-900">{propertyName}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
              <span className="text-slate-500">Rental Term</span>
              <span className="font-semibold text-slate-900">{formatDate(agreement.startDate)} to {formatDate(agreement.endDate)}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
              <span className="text-slate-500">Monthly Rent</span>
              <span className="font-bold text-slate-900">{formatINR(agreement.rent)} / month</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Advance & Security Deposit</span>
              <span className="font-semibold text-slate-900">{formatINR(agreement.advance)} / {formatINR(agreement.deposit)}</span>
            </div>
          </div>

          {/* ELECTRONIC SIGNATURE RECORD (FOR SIGNED) */}
          {isSigned && (
            <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-800 font-bold border-b border-emerald-200/80 pb-2">
                <ShieldCheck className="size-4 text-emerald-600" />
                <span>ELECTRONIC SIGNATURE RECORD</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 font-medium text-slate-700">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Landlord / Management</span>
                  <span className="font-semibold text-slate-900">C2D Rentals</span>
                  <span className="text-[11px] text-emerald-700 font-bold block">● SIGNED</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Tenant Resident</span>
                  <span className="font-semibold text-slate-900">{tenantName}</span>
                  <span className="text-[11px] text-emerald-700 font-bold block">● SIGNED</span>
                </div>
              </div>
              {agreement.signedAt && (
                <div className="text-[11px] text-slate-500 pt-1 font-medium border-t border-emerald-200/60">
                  Signed on: {formatDate(agreement.signedAt)} · Electronic signature recorded
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2.5 pt-2">
            <Button
              type="button"
              onClick={() => { onClose(); onViewDoc(docUrl, `Agreement-${agrNo}.pdf`); }}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs h-11 rounded-xl shadow-xs"
            >
              View Document PDF
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl border-slate-300 font-bold h-11 px-4">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShareAgreementModal({
  agreement,
  open,
  onClose,
}: {
  agreement: Agreement | null;
  open: boolean;
  onClose: () => void;
}) {
  const { success, error: toastError } = useToast();
  const [activeToken, setActiveToken] = useState<string>(agreement?.token || "");
  const [loadingToken, setLoadingToken] = useState(false);

  useEffect(() => {
    if (agreement && !agreement.token && open) {
      setLoadingToken(true);
      api.sendAgreementForSigning(agreement.id)
        .then((res) => {
          if (res.token) setActiveToken(res.token);
        })
        .catch((e) => {
          toastError("Could not generate signing link", e instanceof Error ? e.message : undefined);
        })
        .finally(() => setLoadingToken(false));
    } else if (agreement?.token) {
      setActiveToken(agreement.token);
    }
  }, [agreement, open]);

  if (!agreement) return null;

  const canonicalUrl = activeToken ? `${window.location.origin}/agreements/sign/${activeToken}` : "";

  const rawPhone = agreement.tenant?.phone ?? "";
  const cleanPhone = rawPhone.replace(/\D/g, "");
  const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;

  const tenantName = agreement.tenant?.name ?? "Resident";
  const propertyName = agreement.property?.name ?? "Property";
  const agrNo = formatAgreementNo(agreement.agreementNumber, agreement.id);
  const isSigned = agreement.isLocked || agreement.status === "SIGNED" || agreement.status === "COMPLETED";

  const messageText = isSigned
    ? `Hello ${tenantName},\n\nYour executed rental agreement for ${propertyName} is available for review.\n\nAgreement: ${agrNo}\nRental Period: ${formatDate(agreement.startDate)} – ${formatDate(agreement.endDate)}\nMonthly Rent: ${formatINR(agreement.rent)}\n\nView agreement:\n${canonicalUrl}\n\nThank you,\nC2D Rentals`
    : `Hello ${tenantName},\n\nYour rental agreement for ${propertyName} is ready for signing.\n\nAgreement: ${agrNo}\nRental Period: ${formatDate(agreement.startDate)} – ${formatDate(agreement.endDate)}\nMonthly Rent: ${formatINR(agreement.rent)}\n\nPlease review and sign your agreement using the secure link below:\n${canonicalUrl}\n\nThank you,\nC2D Rentals`;

  const waUrl = cleanPhone && canonicalUrl ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(messageText)}` : null;

  const copyLink = () => {
    if (canonicalUrl) {
      navigator.clipboard.writeText(canonicalUrl);
      success("Signing link copied to clipboard.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl max-w-md p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Share2 className="size-4 text-blue-600" /> {isSigned ? "Share Agreement" : "SEND AGREEMENT FOR SIGNATURE"}
          </DialogTitle>
          <DialogDescription className="text-xs font-medium text-slate-500">
            Share secure link with <strong>{tenantName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2 text-xs">
          {/* Agreement Context Box */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 font-medium">
            <div className="flex justify-between border-b border-slate-200/60 pb-1">
              <span className="text-slate-500">Tenant</span>
              <span className="font-semibold text-slate-900">{tenantName}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-1">
              <span className="text-slate-500">Property</span>
              <span className="font-semibold text-slate-900">{propertyName}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-1">
              <span className="text-slate-500">Agreement ID</span>
              <span className="font-mono font-bold text-slate-900">{agrNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Period & Rent</span>
              <span className="font-bold text-slate-900">{formatDate(agreement.startDate)} – {formatDate(agreement.endDate)} · {formatINR(agreement.rent)}/mo</span>
            </div>
          </div>

          {/* Link Section */}
          <div className="space-y-1.5 w-full min-w-0">
            <Label className="text-xs font-bold text-slate-700">Signing Link</Label>
            {canonicalUrl ? (
              <div className="flex gap-2 w-full min-w-0 items-center">
                <Input value={canonicalUrl} readOnly className="font-mono text-xs border-slate-300 rounded-xl bg-slate-50 select-all min-w-0 flex-1 truncate" />
                <Button onClick={copyLink} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3.5 rounded-xl shrink-0">
                  <Copy className="size-3.5 mr-1" /> Copy Link
                </Button>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-bold">
                Signing link is not available.
              </div>
            )}
          </div>

          {/* Message Preview */}
          <div className="space-y-1 w-full min-w-0">
            <Label className="text-[11px] font-bold uppercase text-slate-500">Message Preview</Label>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-mono text-[11px] whitespace-pre-wrap break-all leading-relaxed max-w-full overflow-hidden">
              {messageText}
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-xl border-slate-300 font-bold h-11">
              Cancel
            </Button>

            {waUrl ? (
              <a
                href={waUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs transition-all"
              >
                <WhatsAppIcon className="size-4" /> Send via WhatsApp
              </a>
            ) : (
              <Button disabled className="flex-1 h-11 font-extrabold text-xs rounded-xl">
                <WhatsAppIcon className="size-4" /> Send via WhatsApp
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CancelAgreementModal({
  agreement,
  open,
  onClose,
  onSuccess,
}: {
  agreement: Agreement | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { success, error: toastError } = useToast();
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const cancelMutation = useMutation({
    mutationFn: (agreementId: string) => api.cancelAgreement(agreementId, reason.trim()),
    onSuccess: () => {
      success("Agreement cancelled successfully");
      onSuccess();
      onClose();
    },
    onError: (err) => {
      toastError("Cancellation failed", err instanceof Error ? err.message : "Could not cancel agreement");
    },
  });

  if (!agreement) return null;

  const tenantName = agreement.tenant?.name ?? "Resident";
  const propertyName = agreement.property?.name ?? "Property";
  const agrNo = formatAgreementNo(agreement.agreementNumber, agreement.id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toastError("Action Required", "Please enter a cancellation reason.");
      return;
    }
    cancelMutation.mutate(agreement.id);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl max-w-md p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-rose-700 flex items-center gap-2">
            <Ban className="size-4 text-rose-600" /> Cancel Agreement
          </DialogTitle>
          <DialogDescription className="text-xs font-medium text-slate-600">
            Are you sure you want to cancel agreement <strong>{agrNo}</strong>?
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs font-medium">
            <div className="flex justify-between border-b border-slate-200/60 pb-1">
              <span className="text-slate-500">Agreement</span>
              <span className="font-mono font-bold text-slate-900">{agrNo}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-1">
              <span className="text-slate-500">Tenant</span>
              <span className="font-semibold text-slate-900">{tenantName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Property</span>
              <span className="font-semibold text-slate-900">{propertyName}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-800 block">
              Cancellation Reason *
            </Label>
            <textarea
              required
              rows={3}
              placeholder="Enter reason for cancellation..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-3 text-xs font-medium border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none text-slate-900"
            />
          </div>

          <DialogFooter className="grid grid-cols-2 gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-11 rounded-xl border-slate-300 font-bold text-xs"
            >
              Keep Agreement
            </Button>
            <Button
              type="submit"
              disabled={!reason.trim() || cancelMutation.isPending}
              className="h-11 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Ban className="size-4" /> {cancelMutation.isPending ? "Cancelling…" : "Cancel Agreement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AgreementFormModal({
  open,
  editingAgreement,
  properties,
  onClose,
  onSaved,
}: {
  open: boolean;
  editingAgreement: Agreement | null;
  properties: Property[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState({
    tenantId: "",
    propertyId: "",
    startDate: toDateInput(new Date()),
    endDate: toDateInput(new Date(Date.now() + 334 * 86400000)),
    rent: "",
    advance: "",
    deposit: "",
    notes: "",
  });

  const { data: tenantsData } = useQuery({
    queryKey: ["tenants-list-form"],
    queryFn: () => api.listTenants({ pageSize: 500 }),
    enabled: open,
    staleTime: 30000,
  });

  const tenants = tenantsData?.items ?? [];

  useEffect(() => {
    if (editingAgreement) {
      setForm({
        tenantId: editingAgreement.tenantId || "",
        propertyId: editingAgreement.propertyId || "",
        startDate: toDateInput(editingAgreement.startDate),
        endDate: toDateInput(editingAgreement.endDate),
        rent: String(editingAgreement.rent || ""),
        advance: String(editingAgreement.advance || ""),
        deposit: String(editingAgreement.deposit || ""),
        notes: (editingAgreement as any).notes || "",
      });
    } else {
      setForm({
        tenantId: "",
        propertyId: "",
        startDate: toDateInput(new Date()),
        endDate: toDateInput(new Date(Date.now() + 334 * 86400000)),
        rent: "",
        advance: "",
        deposit: "",
        notes: "",
      });
    }
  }, [editingAgreement]);
  const handleTenantChange = (tenantId: string) => {
    const selectedTenant = tenants.find((t) => t.id === tenantId);
    setForm((f) => {
      const updated = { ...f, tenantId };
      if (selectedTenant) {
        if (selectedTenant.propertyId) updated.propertyId = selectedTenant.propertyId;
        if (selectedTenant.joiningDate) {
          updated.startDate = toDateInput(selectedTenant.joiningDate);
          const start = new Date(selectedTenant.joiningDate);
          const end = new Date(start);
          end.setMonth(end.getMonth() + 11);
          updated.endDate = toDateInput(end);
        }
        if (selectedTenant.rent) updated.rent = String(selectedTenant.rent);
        if (selectedTenant.deposit) updated.deposit = String(selectedTenant.deposit);
        if (selectedTenant.advance) updated.advance = String(selectedTenant.advance);
      }
      return updated;
    });
  };

  const handlePropertyChange = (propertyId: string) => {
    const selectedProperty = properties.find((p) => p.id === propertyId);
    setForm((f) => {
      const updated = { ...f, propertyId };
      if (selectedProperty) {
        if (selectedProperty.rent && !f.rent) updated.rent = String(selectedProperty.rent);
        if (selectedProperty.deposit && !f.deposit) updated.deposit = String(selectedProperty.deposit);
      }
      return updated;
    });
  };

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        tenantId: form.tenantId,
        propertyId: form.propertyId,
        startDate: form.startDate,
        endDate: form.endDate,
        rent: Number(form.rent),
        advance: Number(form.advance),
        deposit: Number(form.deposit),
        notes: form.notes || undefined,
      };
      if (editingAgreement) {
        return api.updateAgreement(editingAgreement.id, payload as any);
      }
      return api.createAgreement(payload as any);
    },
    onSuccess: () => {
      success(editingAgreement ? "Agreement updated successfully" : "Agreement created successfully");
      onSaved();
    },
    onError: (e) => toastError("Save failed", e instanceof Error ? e.message : undefined),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl max-w-lg p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900">
            {editingAgreement ? "Edit Agreement" : "Create New Agreement"}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 font-medium">
            Fill in agreement details below.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-3.5 pt-2 text-xs"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Tenant Resident *</Label>
              <Select
                required
                value={form.tenantId}
                onChange={(e) => handleTenantChange(e.target.value)}
                className="h-10 rounded-xl border-slate-300 font-medium"
              >
                <option value="">Select Tenant</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} · {t.phone}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Property Unit *</Label>
              <Select
                required
                value={form.propertyId}
                onChange={(e) => handlePropertyChange(e.target.value)}
                className="h-10 rounded-xl border-slate-300 font-medium"
              >
                <option value="">Select Property</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({formatPropertyType(p.type)}){p.city ? ` · ${p.city}` : ""}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Start Date *</Label>
              <Input
                required
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                className="h-10 rounded-xl border-slate-300 font-medium"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">End Date *</Label>
              <Input
                required
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                className="h-10 rounded-xl border-slate-300 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Monthly Rent (₹) *</Label>
              <Input
                required
                type="number"
                min={0}
                value={form.rent}
                onChange={(e) => setForm((f) => ({ ...f, rent: e.target.value }))}
                className="h-10 rounded-xl border-slate-300 font-bold text-slate-900"
                placeholder="8500"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Security Deposit (₹)</Label>
              <Input
                type="number"
                min={0}
                value={form.deposit}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm((f) => ({ ...f, deposit: val }));
                }}
                className="h-10 rounded-xl border-slate-300 font-medium"
                placeholder="10000"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl font-bold">
              Cancel
            </Button>
            <Button
              type="submit"
              loading={mutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl"
            >
              {editingAgreement ? "Save Changes" : "Create Agreement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
