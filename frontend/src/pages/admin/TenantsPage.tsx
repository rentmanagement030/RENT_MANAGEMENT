import { useCallback, useEffect, useState, useMemo, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Search,
  Plus,
  Users,
  Building2,
  Phone,
  FileText,
  CreditCard,
  ArrowRightLeft,
  MoreVertical,
  Pencil,
  UserCheck,
  UserX,
  Clock,
  AlertTriangle,
  RefreshCw,
  X,
  Eye,
  ChevronDown,
  Check,
  Home,
  SlidersHorizontal,
  ChevronUp,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatINR, formatDate } from "@/lib/format";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePageResetOnFilter } from "@/hooks/usePageResetOnFilter";
import { useAuth } from "@/auth/AuthContext";
import { PERMISSIONS } from "@/lib/permissions";
import { Button, Card, CardContent, Input, Label } from "@/components/ui/primitives";
import { EmptyState, Pagination, StatusBadge } from "@/components/ui/data";
import { ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { TransferTenantModal } from "./TenantDetailPage";
import { validateName, validatePhone, validateEmail, validateAadhaar, formatAadhaarInput } from "@/lib/validation";
import type { Property, Tenant } from "@/types";

// Official WhatsApp SVG Logo Icon & Normalizer
function WhatsAppIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function getWhatsAppUrl(phoneStr?: string | null): string | null {
  if (!phoneStr) return null;
  const digits = phoneStr.replace(/\D/g, "");
  if (!digits) return null;
  let clean = digits;
  if (clean.length === 10) clean = "91" + clean;
  else if (clean.length === 12 && clean.startsWith("91")) clean = clean;
  else if (clean.length === 11 && clean.startsWith("0")) clean = "91" + clean.slice(1);
  if (clean.length !== 12 || !clean.startsWith("91")) return null;
  return `https://wa.me/${clean}`;
}

function getInitials(name: string): string {
  if (!name) return "T";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const MENU_WIDTH = 224;
const MENU_MARGIN = 10;

function getRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const diffMonths = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (diffMonths <= 0) return "This month";
  if (diffMonths === 1) return "1 mo ago";
  if (diffMonths < 12) return `${diffMonths} mos ago`;
  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} ${diffYears === 1 ? "yr" : "yrs"} ago`;
}

// -----------------------------------------------------------------------------
// PORTAL-BASED CUSTOM FILTER DROPDOWN COMPONENTS (NO CLIPPING!)
// -----------------------------------------------------------------------------

function FilterPropertyCombobox({
  properties,
  value,
  onChange,
}: {
  properties: Property[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const selectedProp = properties.find((p) => p.id === value);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 6,
      left: rect.left,
      width: Math.max(rect.width, 240),
    });
  }, []);

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handleScrollResize = () => updatePosition();
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("scroll", handleScrollResize, true);
    window.addEventListener("resize", handleScrollResize);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("scroll", handleScrollResize, true);
      window.removeEventListener("resize", handleScrollResize);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, updatePosition]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return properties;
    return properties.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.city?.toLowerCase().includes(q) ||
        p.area?.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q)
    );
  }, [properties, query]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "h-11 w-full px-3.5 rounded-xl border bg-white flex items-center justify-between transition-all text-xs font-bold text-slate-800 shadow-2xs cursor-pointer",
          isOpen ? "border-blue-500 ring-2 ring-blue-500/20" : "border-slate-300 hover:border-slate-400",
          value && "border-blue-300 bg-blue-50/20 text-blue-900"
        )}
      >
        <span className="truncate flex items-center gap-2">
          <Building2 className="size-4 text-blue-600 shrink-0" />
          {selectedProp ? selectedProp.name : "All Properties"}
        </span>
        <ChevronDown className={cn("size-4 text-slate-400 transition-transform duration-150 shrink-0 ml-1", isOpen && "rotate-180")} />
      </button>

      {isOpen &&
        pos &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: pos.width,
              zIndex: 9999,
            }}
            className="rounded-xl border border-slate-200 bg-white shadow-xl max-h-[320px] overflow-y-auto p-1.5 text-xs animate-in fade-in duration-100 ring-1 ring-black/5"
          >
            <div className="p-1 mb-1 border-b border-slate-100">
              <div className="relative">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search properties..."
                  className="w-full h-8 pl-8 pr-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900"
                />
              </div>
            </div>

            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between p-2.5 rounded-lg text-left transition-colors cursor-pointer font-bold",
                  !value ? "bg-blue-50 text-blue-900" : "text-slate-700 hover:bg-slate-50"
                )}
              >
                <span>All Properties</span>
                {!value && <Check className="size-4 text-blue-600 shrink-0" />}
              </button>

              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onChange(p.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between p-2.5 rounded-lg text-left transition-colors cursor-pointer",
                    p.id === value ? "bg-blue-50 text-blue-900 font-extrabold" : "text-slate-700 hover:bg-slate-50 font-semibold"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-slate-900 truncate">{p.name}</p>
                    <p className="text-[11px] font-medium text-slate-400 truncate">
                      {p.type === "HOUSE" ? "House" : p.type === "PG" ? "PG" : "Multi-Unit"}
                    </p>
                  </div>
                  {p.id === value && <Check className="size-4 text-blue-600 shrink-0 ml-2" />}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function FilterStatusCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (status: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const STATUS_OPTIONS = [
    { key: "", label: "All Statuses" },
    { key: "ACTIVE", label: "Active" },
    { key: "PENDING", label: "Pending" },
    { key: "INACTIVE", label: "Inactive" },
  ];

  const selectedOpt = STATUS_OPTIONS.find((s) => s.key === value) || STATUS_OPTIONS[0];

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 6,
      left: rect.left,
      width: Math.max(rect.width, 180),
    });
  }, []);

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handleScrollResize = () => updatePosition();
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("scroll", handleScrollResize, true);
    window.addEventListener("resize", handleScrollResize);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("scroll", handleScrollResize, true);
      window.removeEventListener("resize", handleScrollResize);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, updatePosition]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "h-11 w-full px-3.5 rounded-xl border bg-white flex items-center justify-between transition-all text-xs font-bold text-slate-800 shadow-2xs cursor-pointer",
          isOpen ? "border-blue-500 ring-2 ring-blue-500/20" : "border-slate-300 hover:border-slate-400",
          value && "border-blue-300 bg-blue-50/20 text-blue-900"
        )}
      >
        <span className="truncate">{selectedOpt.label}</span>
        <ChevronDown className={cn("size-4 text-slate-400 transition-transform duration-150 shrink-0 ml-1", isOpen && "rotate-180")} />
      </button>

      {isOpen &&
        pos &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: pos.width,
              zIndex: 9999,
            }}
            className="rounded-xl border border-slate-200 bg-white shadow-xl p-1.5 text-xs animate-in fade-in duration-100 space-y-0.5 ring-1 ring-black/5"
          >
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  onChange(opt.key);
                  setIsOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between p-2.5 rounded-lg text-left transition-colors cursor-pointer font-bold",
                  opt.key === value ? "bg-blue-50 text-blue-900" : "text-slate-700 hover:bg-slate-50"
                )}
              >
                <span>{opt.label}</span>
                {opt.key === value && <Check className="size-4 text-blue-600 shrink-0 ml-2" />}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}

export default function TenantsPage() {
  const { can } = useAuth();
  const { success, error: toastError } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filters & State
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search);

  useEffect(() => {
    setOpenMenuId(null);
  }, [location]);

  usePageResetOnFilter(setPage, search, statusFilter, propertyFilter);

  // 1. Fetch Paginated Tenants List
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["tenants", page, debouncedSearch, statusFilter, propertyFilter],
    queryFn: () =>
      api.listTenants({
        page,
        pageSize: 10,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        propertyId: propertyFilter || undefined,
      }),
  });

  // 2. Fetch Real KPI Aggregated Stats
  const {
    data: statsData,
    isLoading: isStatsLoading,
    isError: isStatsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ["tenants-stats", propertyFilter],
    queryFn: () => api.getTenantStats({ propertyId: propertyFilter || undefined }),
    staleTime: 10000,
  });

  // 3. Fetch Properties for Filter Dropdown
  const { data: propertiesData } = useQuery({
    queryKey: ["properties-filter-list"],
    queryFn: () => api.listProperties({ pageSize: 500 }),
    staleTime: 30000,
  });

  const properties = propertiesData?.items ?? [];

  // Compute Percentages for KPI Summary (Pending -> Active -> Inactive)
  const kpiStats = useMemo(() => {
    const total = statsData?.total ?? 0;
    const calcPct = (cnt: number) => (total > 0 ? ((cnt / total) * 100).toFixed(1) + "%" : "0%");

    return {
      total,
      active: statsData?.active ?? 0,
      activePct: calcPct(statsData?.active ?? 0),
      pending: statsData?.pending ?? 0,
      pendingPct: calcPct(statsData?.pending ?? 0),
      inactive: statsData?.inactive ?? 0,
      inactivePct: calcPct(statsData?.inactive ?? 0),
    };
  }, [statsData]);

  // Dialog & Modal States
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [markInactiveTarget, setMarkInactiveTarget] = useState<Tenant | null>(null);
  const [transferTarget, setTransferTarget] = useState<Tenant | null>(null);
  const [deletingTarget, setDeletingTarget] = useState<Tenant | null>(null);
  const [capacityAlertProperty, setCapacityAlertProperty] = useState<Property | null>(null);

  useEffect(() => {
    const propId = searchParams.get("propertyId");
    if (propId) {
      setPropertyFilter(propId);
    }
    if (searchParams.get("action") === "new") {
      setCreating(true);
    }
  }, [searchParams]);

  const markInactiveMutation = useMutation({
    mutationFn: (id: string) => api.markFormer(id),
    onSuccess: () => {
      success("Tenant marked as Inactive & unit released");
      setMarkInactiveTarget(null);
      qc.invalidateQueries({ queryKey: ["tenants"] });
      qc.invalidateQueries({ queryKey: ["tenants-stats"] });
      qc.invalidateQueries({ queryKey: ["properties"] });
    },
    onError: (e) => toastError("Could not update status", e instanceof Error ? e.message : undefined),
  });

  const deleteTenantMutation = useMutation({
    mutationFn: (id: string) => api.deleteTenant(id),
    onSuccess: () => {
      success("Tenant deleted successfully");
      setDeletingTarget(null);
      qc.invalidateQueries({ queryKey: ["tenants"] });
      qc.invalidateQueries({ queryKey: ["tenants-stats"] });
      qc.invalidateQueries({ queryKey: ["properties"] });
    },
    onError: (e) => toastError("Delete failed", e instanceof Error ? e.message : undefined),
  });

  const clearAllFilters = () => {
    setSearch("");
    setStatusFilter("");
    setPropertyFilter("");
  };

  const hasActiveFilters = !!(search || statusFilter || propertyFilter);

  return (
    <div className="space-y-5 sm:space-y-6 pb-12">
      {/* 1. Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Users className="size-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">TENANTS DIRECTORY</h1>
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-500 pl-0.5">
            Manage tenants, property assignments, rent and tenant lifecycle.
          </p>
        </div>

        {can(PERMISSIONS.TENANTS_MANAGE) && (
          <Button
            onClick={() => setCreating(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-black h-11 px-5 rounded-xl shadow-xs active:scale-95 transition-all w-full sm:w-auto flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="size-4 stroke-[3]" /> Add Tenant
          </Button>
        )}
      </div>

      {/* 2. Dynamic KPI Summary Cards (4 Cards: Total, Active, Pending, Inactive) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-between space-y-2 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Total Tenants</span>
            <div className="size-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
              <Users className="size-4" />
            </div>
          </div>
          <div>
            {isStatsLoading ? (
              <div className="h-8 w-16 bg-slate-100 animate-pulse rounded-lg"></div>
            ) : isStatsError ? (
              <span className="text-xs font-bold text-rose-500 flex items-center gap-1">
                <AlertTriangle className="size-3.5" /> Error loading
              </span>
            ) : (
              <div className="text-2xl sm:text-3xl font-black text-slate-900">{kpiStats.total}</div>
            )}
            <span className="text-[11px] font-bold text-slate-400">All registered residents</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">Active</span>
            <div className="size-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
              <UserCheck className="size-4" />
            </div>
          </div>
          <div>
            {isStatsLoading ? (
              <div className="h-8 w-16 bg-slate-100 animate-pulse rounded-lg"></div>
            ) : isStatsError ? (
              <span className="text-xs font-bold text-rose-500">—</span>
            ) : (
              <div className="text-2xl sm:text-3xl font-black text-emerald-600">{kpiStats.active}</div>
            )}
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 inline-block mt-0.5">
              {kpiStats.activePct} of total
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-amber-700">Pending</span>
            <div className="size-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center">
              <Clock className="size-4" />
            </div>
          </div>
          <div>
            {isStatsLoading ? (
              <div className="h-8 w-16 bg-slate-100 animate-pulse rounded-lg"></div>
            ) : isStatsError ? (
              <span className="text-xs font-bold text-rose-500">—</span>
            ) : (
              <div className="text-2xl sm:text-3xl font-black text-amber-600">{kpiStats.pending}</div>
            )}
            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 inline-block mt-0.5">
              {kpiStats.pendingPct} of total
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600">Inactive</span>
            <div className="size-8 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center">
              <UserX className="size-4" />
            </div>
          </div>
          <div>
            {isStatsLoading ? (
              <div className="h-8 w-16 bg-slate-100 animate-pulse rounded-lg"></div>
            ) : isStatsError ? (
              <span className="text-xs font-bold text-rose-500">—</span>
            ) : (
              <div className="text-2xl sm:text-3xl font-black text-slate-700">{kpiStats.inactive}</div>
            )}
            <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 inline-block mt-0.5">
              {kpiStats.inactivePct} of total
            </span>
          </div>
        </div>
      </div>

      {/* 3. Compact Filter Bar (Portal-Based Dropdowns, 58-60% Search Width) */}
      <Card className="border border-slate-200 bg-white shadow-2xs rounded-2xl overflow-visible">
        <CardContent className="p-3 sm:p-4 space-y-2.5">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Search Input (58-60% width on desktop) */}
            <div className="relative w-full sm:w-[58%]">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search by name, phone, email or property..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-9 h-11 text-slate-900 border-slate-300 font-bold rounded-xl text-xs sm:text-sm bg-white focus:ring-blue-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {/* Custom Property Filter Combobox (20-22% width on desktop) */}
            <div className="w-full sm:w-[22%]">
              <FilterPropertyCombobox
                properties={properties}
                value={propertyFilter}
                onChange={setPropertyFilter}
              />
            </div>

            {/* Custom Tenant Status Filter Dropdown (18-20% width on desktop) */}
            <div className="w-full sm:w-[20%]">
              <FilterStatusCombobox
                value={statusFilter}
                onChange={setStatusFilter}
              />
            </div>
          </div>

          {/* Clear Filters Bar */}
          {hasActiveFilters && (
            <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
              <span className="font-bold text-slate-500">Active filters applied</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-7 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 rounded-lg cursor-pointer"
              >
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Main Directory Content */}
      <Card className="border border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton />
          ) : isError ? (
            <div className="p-8 text-center space-y-3">
              <AlertTriangle className="size-10 text-rose-500 mx-auto" />
              <h3 className="text-base font-black text-slate-900">Unable to load tenants</h3>
              <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
                Something went wrong while fetching tenant records. Please check your network and retry.
              </p>
              <Button onClick={() => refetch()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 px-4 rounded-xl">
                <RefreshCw className="size-3.5 mr-1.5" /> Retry
              </Button>
            </div>
          ) : !data?.items.length ? (
            <EmptyState
              icon={<Users className="size-8 text-slate-400" />}
              title="No tenants found"
              description={
                hasActiveFilters
                  ? "No resident records match your current search or filters."
                  : "Add your first tenant to start managing leases, rent, and tenant documents."
              }
              action={
                hasActiveFilters ? (
                  <Button onClick={clearAllFilters} variant="outline" className="font-bold border-slate-300 text-slate-700 rounded-xl">
                    Clear Filters
                  </Button>
                ) : (
                  can(PERMISSIONS.TENANTS_MANAGE) && (
                    <Button onClick={() => setCreating(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl">
                      <Plus className="size-4 mr-1.5" /> Add Tenant
                    </Button>
                  )
                )
              }
            />
          ) : (
            <>
              {/* MOBILE CARD DIRECTORY VIEW */}
              <div className="lg:hidden p-4 space-y-4">
                {data.items.map((tenant) => (
                  <TenantMobileCard
                    key={tenant.id}
                    tenant={tenant}
                    canManage={can(PERMISSIONS.TENANTS_MANAGE)}
                    menuOpen={openMenuId === tenant.id}
                    onMenuOpenChange={(open) => setOpenMenuId(open ? tenant.id : null)}
                    onEdit={() => setEditing(tenant)}
                    onTransfer={() => setTransferTarget(tenant)}
                    onMarkInactive={() => setMarkInactiveTarget(tenant)}
                    onDelete={() => setDeletingTarget(tenant)}
                  />
                ))}
              </div>

              {/* DESKTOP SAAS DATA TABLE (Scrollable Container, Actions Column Fixed & Never Clipped) */}
              <div className="hidden lg:block w-full overflow-x-auto">
                <table className="w-full text-left border-collapse table-fixed min-w-[860px]">
                  <colgroup>
                    <col style={{ width: "23%" }} />
                    <col style={{ width: "27%" }} />
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "12%", minWidth: "140px" }} />
                  </colgroup>
                  <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-black uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-4">TENANT</th>
                      <th className="px-4 py-4">PROPERTY / HOME</th>
                      <th className="px-4 py-4">RENT</th>
                      <th className="px-4 py-4">JOINING DATE</th>
                      <th className="px-4 py-4">STATUS</th>
                      <th className="px-4 py-4 text-right pr-4">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-medium text-xs sm:text-sm">
                    {data.items.map((tenant) => {
                      const waUrl = getWhatsAppUrl(tenant.phone);
                      const relativeTime = getRelativeTime(tenant.joiningDate);

                      return (
                        <tr key={tenant.id} className="hover:bg-slate-50/60 transition-colors">
                          {/* TENANT */}
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              {(tenant as any).photographStorageKey ? (
                                <img
                                  src={`/api/files/${(tenant as any).photographStorageKey}`}
                                  alt={tenant.name}
                                  className="size-10 rounded-full object-cover border border-slate-200 shrink-0"
                                />
                              ) : (
                                <div className="flex size-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-black text-xs shrink-0 border border-blue-200">
                                  {getInitials(tenant.name)}
                                </div>
                              )}
                              <div className="min-w-0 space-y-0.5">
                                <Link
                                  to={`/admin/tenants/${tenant.id}`}
                                  className="font-black text-slate-900 hover:text-blue-600 text-sm truncate block"
                                  title={tenant.name}
                                >
                                  {tenant.name}
                                </Link>
                                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                                  <span className="truncate">{tenant.phone}</span>
                                  {waUrl && (
                                    <a
                                      href={waUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      title="Open WhatsApp chat"
                                      className="inline-flex items-center justify-center text-emerald-600 hover:text-emerald-700 shrink-0"
                                    >
                                      <WhatsAppIcon className="size-3.5" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* PROPERTY / HOME */}
                          <td className="px-4 py-4 text-slate-800">
                            {tenant.property ? (
                              <div className="space-y-1">
                                <span className="font-bold text-slate-900 text-xs truncate flex items-center gap-1" title={tenant.property.name}>
                                  <Building2 className="size-3.5 text-blue-600 shrink-0" />
                                  <span className="truncate">{tenant.property.name}</span>
                                </span>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80">
                                    {tenant.property.type === "HOUSE" ? "House" : "PG"}
                                  </span>
                                  {(tenant.room || tenant.bed || (tenant as any).home) && (
                                    <span className="text-[10px] font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 truncate">
                                      {(tenant as any).home ? `${(tenant as any).home.floor || ""} ${(tenant as any).home.homeNumber}` : ""}
                                      {tenant.room ? `Room ${tenant.room.roomNumber}` : ""}
                                      {tenant.bed ? ` · Bed ${tenant.bed.bedNumber}` : ""}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs font-semibold">Unassigned</span>
                            )}
                          </td>

                          {/* RENT */}
                          <td className="px-4 py-4">
                            <div className="font-black text-slate-900 text-sm">
                              {formatINR(tenant.rent)}
                              <span className="text-[11px] font-semibold text-slate-400 block">/ month</span>
                            </div>
                          </td>

                          {/* JOINING DATE */}
                          <td className="px-4 py-4">
                            <div className="text-xs font-bold text-slate-800 whitespace-nowrap">
                              {tenant.joiningDate ? formatDate(tenant.joiningDate) : "—"}
                              {relativeTime && (
                                <span className="text-[10px] font-extrabold text-slate-400 block font-normal">
                                  {relativeTime}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* STATUS */}
                          <td className="px-4 py-4">
                            <StatusBadge status={tenant.status === "FORMER" ? "INACTIVE" : tenant.status} />
                          </td>

                          {/* ACTIONS (Min Width 140px, Never Clipped) */}
                          <td className="px-4 py-4 text-right pr-4 whitespace-nowrap min-w-[140px]">
                            <div className="flex items-center justify-end gap-1.5">
                              {waUrl && (
                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="WhatsApp"
                                  className="inline-flex size-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/80 hover:bg-emerald-100 active:scale-95 transition-all"
                                >
                                  <WhatsAppIcon className="size-4" />
                                </a>
                              )}

                              <Link
                                to={`/admin/tenants/${tenant.id}?tab=kyc`}
                                title="Documents"
                                className="inline-flex size-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 border border-slate-200/80 hover:bg-slate-200 active:scale-95 transition-all"
                              >
                                <FileText className="size-4" />
                              </Link>

                              <TenantActionMenu
                                tenant={tenant}
                                canManage={can(PERMISSIONS.TENANTS_MANAGE)}
                                menuOpen={openMenuId === tenant.id}
                                onMenuOpenChange={(open) => setOpenMenuId(open ? tenant.id : null)}
                                onEdit={() => setEditing(tenant)}
                                onTransfer={() => setTransferTarget(tenant)}
                                onMarkInactive={() => setMarkInactiveTarget(tenant)}
                                onDelete={() => setDeletingTarget(tenant)}
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
        </CardContent>
      </Card>

      {/* Pagination Footer */}
      {data && data.totalPages > 1 && (
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          onPageChange={setPage}
          total={data.total}
          pageSize={data.pageSize}
        />
      )}

      {/* Tenant Add/Edit Modal */}
      {(creating || editing) && (
        <TenantFormDialog
          tenant={editing}
          defaultPropertyId={searchParams.get("propertyId") || propertyFilter || undefined}
          defaultHomeId={searchParams.get("homeId") || undefined}
          defaultRoomId={searchParams.get("roomId") || undefined}
          defaultBedId={searchParams.get("bedId") || undefined}
          open={creating || !!editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
            if (searchParams.has("action")) {
              const next = new URLSearchParams(searchParams);
              next.delete("action");
              setSearchParams(next, { replace: true });
            }
          }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["tenants"] });
            qc.invalidateQueries({ queryKey: ["tenants-stats"] });
          }}
          onCapacityFull={(prop) => {
            setCapacityAlertProperty(prop);
          }}
        />
      )}

      {/* Confirm Move Out / Mark Inactive Dialog */}
      <ConfirmDialog
        open={!!markInactiveTarget}
        onOpenChange={(o) => !o && setMarkInactiveTarget(null)}
        title="Move Out Tenant / Mark as Inactive?"
        description={
          markInactiveTarget
            ? `Are you sure you want to mark ${markInactiveTarget.name} as Inactive? Room/unit allocation will be released back to Available.`
            : undefined
        }
        loading={markInactiveMutation.isPending}
        onConfirm={() => markInactiveTarget && markInactiveMutation.mutate(markInactiveTarget.id)}
      />

      {/* Full Safe Delete Tenant Modal */}
      <Dialog open={!!deletingTarget} onOpenChange={(o) => !o && setDeletingTarget(null)}>
        <DialogContent className="rounded-2xl max-w-md p-5 bg-white border border-slate-200 shadow-xl">
          <DialogHeader className="pb-3 border-b border-slate-100">
            <DialogTitle className="text-base font-black text-rose-900 flex items-center gap-2">
              <Trash2 className="size-5 text-rose-600 shrink-0" /> Delete Tenant?
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold text-slate-500 pt-1">
              You are about to permanently delete this tenant. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deletingTarget && (
            <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200/80 space-y-1.5 text-xs my-3">
              <span className="text-[10px] uppercase font-black tracking-wider text-rose-700 block">Tenant Confirmation</span>
              <p className="font-extrabold text-slate-900 text-sm">{deletingTarget.name}</p>
              <p className="font-semibold text-slate-600">
                {deletingTarget.property?.name ?? "Unassigned Property"}
                {deletingTarget.room ? ` · Room ${deletingTarget.room.roomNumber}` : ""}
              </p>
            </div>
          )}

          <DialogFooter className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingTarget(null)}
              className="rounded-xl border-slate-300 font-bold text-xs h-9 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              loading={deleteTenantMutation.isPending}
              onClick={() => deletingTarget && deleteTenantMutation.mutate(deletingTarget.id)}
              className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl text-xs h-9 px-5 shadow-xs cursor-pointer"
            >
              Delete Tenant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Capacity Full Alert Modal */}
      {capacityAlertProperty && (
        <Dialog open={!!capacityAlertProperty} onOpenChange={(o) => !o && setCapacityAlertProperty(null)}>
          <DialogContent className="rounded-2xl max-w-md p-5 border border-slate-200">
            <DialogHeader>
              <DialogTitle className="text-base font-black text-rose-900 flex items-center gap-2">
                <AlertTriangle className="size-5 text-rose-600" /> Property Capacity Reached
              </DialogTitle>
              <DialogDescription className="text-xs font-semibold text-slate-600 pt-1">
                <strong>{capacityAlertProperty.name}</strong> is currently at 100% tenant capacity.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="pt-3 border-t border-slate-100">
              <Button onClick={() => setCapacityAlertProperty(null)} className="bg-blue-600 text-white font-extrabold text-xs h-9 rounded-xl">
                I Understand
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Tenant Transfer / Shifting Modal */}
      {transferTarget && (
        <TransferTenantModal
          tenant={transferTarget}
          open={!!transferTarget}
          onClose={() => setTransferTarget(null)}
          onTransferred={() => {
            qc.invalidateQueries({ queryKey: ["tenants"] });
            qc.invalidateQueries({ queryKey: ["tenants-stats"] });
          }}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// TENANT ACTION MENU
// -----------------------------------------------------------------------------

function TenantActionMenu({
  tenant,
  canManage,
  menuOpen,
  onMenuOpenChange,
  onEdit,
  onTransfer,
  onMarkInactive,
  onDelete,
}: {
  tenant: Tenant;
  canManage: boolean;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onTransfer: () => void;
  onMarkInactive: () => void;
  onDelete: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [visible, setVisible] = useState(false);
  const waUrl = getWhatsAppUrl(tenant.phone);
  const isActive = tenant.status === "ACTIVE";

  const computePosition = useCallback((menuHeight: number) => {
    const button = buttonRef.current;
    if (!button) return null;
    const rect = button.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const offscreen = rect.bottom < 0 || rect.top > vh || rect.right < 0 || rect.left > vw;
    if (offscreen) return null;

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
    const isVisible = !!btn && btn.getBoundingClientRect().width > 0 && btn.getBoundingClientRect().height > 0;
    setVisible(isVisible);
    if (isVisible) {
      setPos(computePosition(320));
    } else {
      setPos(null);
    }
  }, [menuOpen, computePosition]);

  useLayoutEffect(() => {
    if (!menuOpen || !pos) return;
    const menu = menuRef.current;
    if (!menu) return;
    const h = menu.offsetHeight;
    if (h <= 0) return;
    const p = computePosition(h);
    if (p && (Math.abs(p.top - pos.top) > 1 || Math.abs(p.left - pos.left) > 1)) {
      setPos(p);
    }
  }, [menuOpen, pos, computePosition]);

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
    const handleScrollResize = () => {
      const btn = buttonRef.current;
      const isVisible = !!btn && btn.getBoundingClientRect().width > 0 && btn.getBoundingClientRect().height > 0;
      if (!isVisible) {
        onMenuOpenChange(false);
        return;
      }
      const menu = menuRef.current;
      const h = menu?.offsetHeight || 320;
      const p = computePosition(h);
      if (!p) {
        onMenuOpenChange(false);
      } else {
        setPos(p);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleScrollResize, true);
    window.addEventListener("resize", handleScrollResize);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleScrollResize, true);
      window.removeEventListener("resize", handleScrollResize);
    };
  }, [menuOpen, computePosition, onMenuOpenChange]);

  const navigate = useNavigate();
  const itemClass =
    "flex w-full items-center gap-2.5 px-3 min-h-[40px] text-[13px] font-bold rounded-lg transition-colors cursor-pointer text-left";
  const iconClass = "size-4 shrink-0";
  const close = () => onMenuOpenChange(false);

  const handleNav = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    e.stopPropagation();
    onMenuOpenChange(false);
    navigate(path);
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
        className="inline-flex size-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 active:scale-95 transition-all shadow-2xs cursor-pointer"
        title="More Actions"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <MoreVertical className="size-4" />
      </button>

      {menuOpen &&
        pos &&
        visible &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              zIndex: 9999,
              width: MENU_WIDTH,
              maxWidth: `calc(100vw - ${MENU_MARGIN * 2}px)`,
            }}
            className="rounded-xl border border-slate-200/90 bg-white py-1.5 text-slate-700 shadow-xl shadow-slate-900/10 ring-1 ring-black/5"
          >
            <div className="pt-1">
              <button
                type="button"
                role="menuitem"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => handleNav(e, `/admin/tenants/${tenant.id}`)}
                className={`${itemClass} hover:bg-slate-100 hover:text-slate-900`}
              >
                <Eye className={`${iconClass} text-slate-400`} /> View Profile
              </button>
              {isActive && (
                <button
                  type="button"
                  role="menuitem"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => handleNav(e, `/admin/payments?tenantId=${tenant.id}&action=new`)}
                  className={`${itemClass} hover:bg-slate-100 hover:text-slate-900`}
                >
                  <CreditCard className={`${iconClass} text-slate-400`} /> Record Payment
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => handleNav(e, `/admin/agreements?tenantId=${tenant.id}`)}
                className={`${itemClass} hover:bg-slate-100 hover:text-slate-900`}
              >
                <FileText className={`${iconClass} text-slate-400`} /> View Agreement
              </button>
              <button
                type="button"
                role="menuitem"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => handleNav(e, `/admin/tenants/${tenant.id}?tab=kyc`)}
                className={`${itemClass} hover:bg-slate-100 hover:text-slate-900`}
              >
                <FileText className={`${iconClass} text-slate-400`} /> Documents
              </button>
            </div>

            {canManage && (
              <div className="my-1.5 border-t border-slate-100 pt-1.5">
                {isActive && (
                  <button
                    type="button"
                    role="menuitem"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); close(); onTransfer(); }}
                    className={`${itemClass} hover:bg-slate-100 hover:text-slate-900`}
                  >
                    <ArrowRightLeft className={`${iconClass} text-slate-400`} /> Transfer Tenant
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); close(); onEdit(); }}
                  className={`${itemClass} hover:bg-slate-100 hover:text-slate-900`}
                >
                  <Pencil className={`${iconClass} text-slate-400`} /> Edit Tenant
                </button>
              </div>
            )}

            <div className="my-1.5 border-t border-slate-100 pt-1.5">
              {waUrl && (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noreferrer"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); close(); }}
                  role="menuitem"
                  className={`${itemClass} text-emerald-700 hover:bg-emerald-50`}
                >
                  <WhatsAppIcon className={`${iconClass} text-emerald-600`} /> WhatsApp
                </a>
              )}
              <a
                href={`tel:${tenant.phone}`}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); close(); }}
                role="menuitem"
                className={`${itemClass} hover:bg-slate-100 hover:text-slate-900`}
              >
                <Phone className={`${iconClass} text-slate-400`} /> Call
              </a>
            </div>

            {canManage && (
              <div className="my-1.5 border-t border-slate-100 pt-1.5">
                {isActive ? (
                  <button
                    type="button"
                    role="menuitem"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); close(); onMarkInactive(); }}
                    className={`${itemClass} text-amber-700 hover:bg-amber-50`}
                  >
                    <UserX className={`${iconClass} text-amber-600`} /> Move Out / Mark Inactive
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); close(); onEdit(); }}
                      className={`${itemClass} text-emerald-700 hover:bg-emerald-50`}
                    >
                      <UserCheck className={`${iconClass} text-emerald-600`} /> Reactivate Tenant
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); close(); onDelete(); }}
                      className={`${itemClass} text-rose-600 hover:bg-rose-50`}
                    >
                      <Trash2 className={`${iconClass} text-rose-600`} /> Delete Tenant
                    </button>
                  </>
                )}
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

function TenantMobileCard({
  tenant,
  canManage,
  menuOpen,
  onMenuOpenChange,
  onEdit,
  onTransfer,
  onMarkInactive,
  onDelete,
}: {
  tenant: Tenant;
  canManage: boolean;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onTransfer: () => void;
  onMarkInactive: () => void;
  onDelete: () => void;
}) {
  const waUrl = getWhatsAppUrl(tenant.phone);

  return (
    <div className="p-4 space-y-3 bg-white border border-slate-200 rounded-2xl shadow-2xs">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {(tenant as any).photographStorageKey ? (
            <img
              src={`/api/files/${(tenant as any).photographStorageKey}`}
              alt={tenant.name}
              className="size-11 rounded-full object-cover border border-slate-200 shrink-0"
            />
          ) : (
            <div className="flex size-11 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-black text-sm shrink-0 border border-blue-200">
              {getInitials(tenant.name)}
            </div>
          )}
          <div className="min-w-0">
            <Link to={`/admin/tenants/${tenant.id}`} className="font-black text-base text-slate-900 hover:text-blue-600 truncate block">
              {tenant.name}
            </Link>
            <span className="text-xs font-bold text-slate-500 block truncate">{tenant.phone}</span>
          </div>
        </div>

        <StatusBadge status={tenant.status === "FORMER" ? "INACTIVE" : tenant.status} />
      </div>

      <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/80 space-y-2 text-xs">
        <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
          <span className="font-bold text-slate-900 truncate flex items-center gap-1">
            <Building2 className="size-3.5 text-blue-600 shrink-0" />
            <span className="truncate">{tenant.property?.name ?? "Unassigned"}</span>
            {(tenant.room || tenant.bed) ? ` · Room ${tenant.room?.roomNumber || ""}` : ""}
            {tenant.bed ? ` · Bed ${tenant.bed.bedNumber}` : ""}
          </span>
          <span className="text-[10px] font-extrabold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md shrink-0">
            {tenant.property?.type === "HOUSE" ? "House" : "PG"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Monthly Rent</span>
            <span className="font-black text-slate-900">{formatINR(tenant.rent)}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Joined</span>
            <span className="font-bold text-slate-800">{tenant.joiningDate ? formatDate(tenant.joiningDate) : "—"}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-slate-100 min-h-[44px]">
        <span className="text-[11px] font-bold text-slate-500">
          Joined {tenant.joiningDate ? formatDate(tenant.joiningDate) : "—"}
        </span>

        <div className="flex items-center gap-2">
          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noreferrer"
              title="WhatsApp"
              className="inline-flex h-10 px-3 items-center justify-center gap-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs hover:bg-emerald-100 active:scale-95 transition-all"
            >
              <WhatsAppIcon className="size-4" /> WhatsApp
            </a>
          )}

          <Link
            to={`/admin/tenants/${tenant.id}?tab=kyc`}
            className="inline-flex h-10 px-3 items-center justify-center gap-1.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs hover:bg-slate-200 active:scale-95 transition-all"
          >
            <FileText className="size-4" /> Docs
          </Link>

          <TenantActionMenu
            tenant={tenant}
            canManage={canManage}
            menuOpen={menuOpen}
            onMenuOpenChange={onMenuOpenChange}
            onEdit={onEdit}
            onTransfer={onTransfer}
            onMarkInactive={onMarkInactive}
            onDelete={onDelete}
          />
        </div>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-xl w-full"></div>
        ))}
      </div>
    </div>
  );
}

function SearchablePropertyCombobox({
  properties,
  value,
  onChange,
}: {
  properties: Property[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedProp = properties.find((p) => p.id === value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return properties;
    return properties.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.city?.toLowerCase().includes(q) ||
        p.area?.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q)
    );
  }, [properties, query]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        className="min-h-[42px] px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white flex items-center justify-between cursor-pointer hover:border-blue-400 transition-all text-xs font-semibold shadow-2xs"
      >
        {selectedProp ? (
          <div className="flex items-center gap-2 truncate min-w-0">
            <Building2 className="size-4 text-blue-600 shrink-0" />
            <span className="font-extrabold text-slate-900 truncate">{selectedProp.name}</span>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded truncate shrink-0">
              {selectedProp.type === "HOUSE" ? "Single House" : selectedProp.type === "PG" ? "PG / Hostel" : "Multi-Home"}
            </span>
            {selectedProp.city && <span className="text-[11px] font-semibold text-slate-500 truncate hidden sm:inline">· {selectedProp.city}</span>}
          </div>
        ) : (
          <span className="text-slate-400 font-medium">Search & select property...</span>
        )}
        <ChevronDown className={cn("size-4 text-slate-400 transition-transform duration-150 shrink-0 ml-1", isOpen && "rotate-180")} />
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-slate-200 bg-white shadow-xl max-h-60 overflow-y-auto p-1.5 text-xs animate-in fade-in duration-100">
          <div className="p-1 mb-1 border-b border-slate-100">
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search properties by name, area, city..."
                className="w-full h-8 pl-8 pr-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-0.5">
            {filtered.length === 0 ? (
              <p className="p-3 text-center text-slate-400 font-medium italic">No matching properties found</p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onChange(p.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between p-2.5 rounded-lg text-left transition-colors cursor-pointer",
                    p.id === value ? "bg-blue-50 text-blue-900 font-extrabold" : "text-slate-700 hover:bg-slate-50 font-semibold"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{p.name}</span>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                        {p.type === "HOUSE" ? "House" : p.type === "PG" ? "PG" : "Multi-Unit"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                      {p.area ? `${p.area}, ` : ""}{p.city}
                    </p>
                  </div>
                  {p.id === value && <Check className="size-4 text-blue-600 shrink-0 ml-2" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SearchableHomeCombobox({
  homes,
  value,
  onChange,
}: {
  homes: any[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedHome = homes.find((h) => h.id === value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return homes;
    return homes.filter(
      (h) =>
        (h.homeNumber || "").toLowerCase().includes(q) ||
        (h.floor || "").toLowerCase().includes(q) ||
        (h.homeType || "").toLowerCase().includes(q)
    );
  }, [homes, query]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        className="min-h-[42px] px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white flex items-center justify-between cursor-pointer hover:border-blue-400 transition-all text-xs font-semibold shadow-2xs"
      >
        {selectedHome ? (
          <div className="flex items-center gap-2 truncate min-w-0">
            <Home className="size-4 text-blue-600 shrink-0" />
            <span className="font-extrabold text-slate-900 truncate">
              {selectedHome.floor || "Ground Floor"} · {selectedHome.homeNumber} ({selectedHome.homeType})
            </span>
          </div>
        ) : (
          <span className="text-slate-400 font-medium">Select Available Home / Unit...</span>
        )}
        <ChevronDown className={cn("size-4 text-slate-400 transition-transform duration-150 shrink-0 ml-1", isOpen && "rotate-180")} />
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-slate-200 bg-white shadow-xl max-h-60 overflow-y-auto p-1.5 text-xs animate-in fade-in duration-100">
          <div className="p-1 mb-1 border-b border-slate-100">
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search unit by number (e.g. G-01, F-01)..."
                className="w-full h-8 pl-8 pr-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-0.5">
            {filtered.length === 0 ? (
              <p className="p-3 text-center text-slate-400 font-medium italic">No available units found</p>
            ) : (
              filtered.map((h) => {
                const isOccupied = h.status === "OCCUPIED" && h.id !== value;
                return (
                  <button
                    key={h.id}
                    type="button"
                    disabled={isOccupied}
                    onClick={() => {
                      if (!isOccupied) {
                        onChange(h.id);
                        setIsOpen(false);
                      }
                    }}
                    className={cn(
                      "flex w-full items-center justify-between p-2.5 rounded-lg text-left transition-colors cursor-pointer",
                      isOccupied && "opacity-50 cursor-not-allowed bg-slate-50",
                      h.id === value ? "bg-blue-50 text-blue-900 font-extrabold" : !isOccupied && "text-slate-700 hover:bg-slate-50 font-semibold"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900">{h.homeNumber}</span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {h.homeType}
                        </span>
                        <span className="text-[11px] font-bold text-blue-700">
                          {formatINR(h.rent)}/mo
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                        {h.floor || "Ground Floor"} · Deposit {formatINR(h.deposit)}
                      </p>
                    </div>

                    {isOccupied ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-100 shrink-0">
                        Occupied
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0">
                        Available
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TenantFormDialog({
  tenant,
  defaultPropertyId,
  defaultHomeId,
  defaultRoomId,
  defaultBedId,
  open,
  onClose,
  onSaved,
  onCapacityFull,
}: {
  tenant: Tenant | null;
  defaultPropertyId?: string;
  defaultHomeId?: string;
  defaultRoomId?: string;
  defaultBedId?: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  onCapacityFull?: (property: Property) => void;
}) {
  const { success, error: toastError } = useToast();
  const [showAdditional, setShowAdditional] = useState(false);
  const [unitDupError, setUnitDupError] = useState<string | null>(null);

  // Fetch properties list
  const { data: propertiesData } = useQuery({
    queryKey: ["properties", "all"],
    queryFn: () => api.listProperties({ pageSize: 200 }),
  });
  const properties = propertiesData?.items ?? [];

  const [form, setForm] = useState(() => ({
    name: tenant?.name ?? "",
    phone: tenant?.phone ?? "",
    email: tenant?.email ?? "",
    propertyId: tenant?.propertyId ?? defaultPropertyId ?? "",
    homeId: (tenant as any)?.homeId ?? defaultHomeId ?? "",
    roomId: tenant?.roomId ?? defaultRoomId ?? "",
    bedId: tenant?.bed?.id ?? defaultBedId ?? "",
    rent: tenant ? Number(tenant.rent).toString() : "",
    deposit: tenant ? Number(tenant.deposit).toString() : "0",
    joiningDate: tenant?.joiningDate
      ? new Date(tenant.joiningDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    dueDay: (tenant as any)?.dueDay ? String((tenant as any).dueDay) : "5",
    aadhaarNumber: tenant?.aadhaarNumber ?? "",
    emergencyName: tenant?.emergencyName ?? "",
    emergencyPhone: tenant?.emergencyPhone ?? "",
    notes: tenant?.notes ?? "",
  }));

  // Fetch selected property detail with full homes list
  const { data: selectedPropertyDetail } = useQuery({
    queryKey: ["property", form.propertyId],
    queryFn: () => api.getProperty(form.propertyId!),
    enabled: !!form.propertyId,
  });

  const selectedProperty = selectedPropertyDetail || properties.find((p) => p.id === form.propertyId);

  // Homes list for multi-unit property
  const homesList = selectedProperty?.homes || [];
  const selectedHome = homesList.find((h) => h.id === form.homeId);

  // Fetch PG rooms if property is PG
  const { data: rooms = [] } = useQuery({
    queryKey: ["rooms", form.propertyId],
    queryFn: () => (form.propertyId ? api.listRooms(form.propertyId) : Promise.resolve([])),
    enabled: !!form.propertyId && selectedProperty?.type === "PG",
  });

  const selectedRoom = rooms.find((r) => r.id === form.roomId);
  const beds = selectedRoom?.beds ?? [];

  // Auto-populate property, unit, room, bed details (rent, deposit, dueDay) when prefilled or selected
  useEffect(() => {
    if (tenant) return;
    if (!selectedProperty) return;

    setForm((f) => {
      let updatedRent = f.rent;
      let updatedDeposit = f.deposit;
      let updatedDueDay = f.dueDay;
      const updatedHomeId = f.homeId || defaultHomeId || "";
      const updatedRoomId = f.roomId || defaultRoomId || "";
      const updatedBedId = f.bedId || defaultBedId || "";

      if (!updatedRent && selectedProperty.rent) {
        updatedRent = String(selectedProperty.rent);
      }
      if ((!updatedDeposit || updatedDeposit === "0") && selectedProperty.deposit) {
        updatedDeposit = String(selectedProperty.deposit);
      }

      if (updatedHomeId && homesList.length > 0) {
        const h = homesList.find((item) => item.id === updatedHomeId);
        if (h) {
          if (h.rent) updatedRent = String(h.rent);
          if (h.deposit) updatedDeposit = String(h.deposit);
          if (h.dueDay) updatedDueDay = String(h.dueDay);
        }
      }

      if (updatedRoomId && rooms.length > 0) {
        const r = rooms.find((item) => item.id === updatedRoomId);
        if (r) {
          if (r.rent) updatedRent = String(r.rent);
          if (r.deposit) updatedDeposit = String(r.deposit);
        }
      }

      if (
        updatedRent === f.rent &&
        updatedDeposit === f.deposit &&
        updatedDueDay === f.dueDay &&
        updatedHomeId === f.homeId &&
        updatedRoomId === f.roomId &&
        updatedBedId === f.bedId
      ) {
        return f;
      }

      return {
        ...f,
        rent: updatedRent,
        deposit: updatedDeposit,
        dueDay: updatedDueDay,
        homeId: updatedHomeId,
        roomId: updatedRoomId,
        bedId: updatedBedId,
      };
    });
  }, [tenant, selectedProperty, homesList, rooms, defaultHomeId, defaultRoomId, defaultBedId]);

  // When Property changes
  const handlePropertySelect = (pid: string) => {
    const p = properties.find((item) => item.id === pid);
    if (p && p.type === "HOUSE") {
      const activeCount = (p as any).tenantsCount ?? (p as any).activeTenantsCount ?? 0;
      const capacity = (p as any).maxCapacity ?? (p as any).capacity ?? 1;
      if (activeCount >= capacity && (!tenant || tenant.propertyId !== pid)) {
        onCapacityFull?.(p);
        return;
      }
    }
    setForm((f) => ({
      ...f,
      propertyId: pid,
      homeId: "",
      roomId: "",
      bedId: "",
      rent: p?.rent ? String(p.rent) : "",
      deposit: p?.deposit ? String(p.deposit) : "0",
    }));
    setUnitDupError(null);
  };

  // When Home changes
  const handleHomeSelect = (hid: string) => {
    const h = homesList.find((item) => item.id === hid);
    if (h) {
      if (h.status === "OCCUPIED" && (!tenant || (tenant as any).homeId !== hid)) {
        setUnitDupError(`Home ${h.homeNumber} is currently occupied.`);
        return;
      }
      setUnitDupError(null);
      setForm((f) => ({
        ...f,
        homeId: hid,
        rent: String(h.rent || f.rent),
        deposit: String(h.deposit || f.deposit),
        dueDay: String(h.dueDay || 5),
      }));
    }
  };

  // When PG Room changes
  const handleRoomSelect = (rid: string) => {
    const r = rooms.find((item) => item.id === rid);
    setForm((f) => ({
      ...f,
      roomId: rid,
      bedId: "",
      rent: r?.rent ? String(r.rent) : f.rent,
      deposit: r?.deposit ? String(r.deposit) : f.deposit,
    }));
  };

  // When PG Bed changes
  const handleBedChange = (bid: string) => {
    const b = beds.find((item) => item.id === bid);
    setForm((f) => ({
      ...f,
      bedId: bid,
      rent: b?.rent ? String(b.rent) : f.rent,
      deposit: b?.deposit ? String(b.deposit) : f.deposit,
    }));
  };

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};
    const nameErr = validateName(form.name, true, "Full Name");
    if (nameErr) errs.name = nameErr;

    const phoneErr = validatePhone(form.phone, true, "Phone Number");
    if (phoneErr) errs.phone = phoneErr;

    if (form.email) {
      const emailErr = validateEmail(form.email, false, "Email Address");
      if (emailErr) errs.email = emailErr;
    }

    if (form.aadhaarNumber) {
      const aadhaarErr = validateAadhaar(form.aadhaarNumber, false, "Aadhaar Number");
      if (aadhaarErr) errs.aadhaarNumber = aadhaarErr;
    }

    if (form.emergencyName) {
      const emNameErr = validateName(form.emergencyName, false, "Emergency Contact Name");
      if (emNameErr) errs.emergencyName = emNameErr;
    }

    if (form.emergencyPhone) {
      const emPhoneErr = validatePhone(form.emergencyPhone, false, "Emergency Phone");
      if (emPhoneErr) errs.emergencyPhone = emPhoneErr;
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        propertyId: form.propertyId || undefined,
        homeId: form.homeId || undefined,
        roomId: form.roomId || undefined,
        bedId: form.bedId || undefined,
        rent: Number(form.rent || 0),
        advance: Number(form.deposit || 0),
        deposit: Number(form.deposit || 0),
        joiningDate: form.joiningDate ? new Date(form.joiningDate) : undefined,
        dueDay: Number(form.dueDay || 5),
        status: "ACTIVE",
        aadhaarNumber: form.aadhaarNumber || undefined,
        emergencyName: form.emergencyName || undefined,
        emergencyPhone: form.emergencyPhone || undefined,
        notes: form.notes || undefined,
      };
      return tenant ? api.updateTenant(tenant.id, body) : api.createTenant(body);
    },
    onSuccess: () => {
      success(tenant ? "Tenant profile updated." : "Tenant added & unit allocated successfully.");
      onSaved();
      onClose();
    },
    onError: (e) => toastError("Save failed", e instanceof Error ? e.message : undefined),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col rounded-2xl p-5 border border-slate-200 shadow-xl bg-white overflow-hidden">
        {/* Fixed Header */}
        <DialogHeader className="pb-3 border-b border-slate-100 shrink-0">
          <DialogTitle className="text-lg font-black text-slate-900">
            {tenant ? "Edit Tenant Profile" : "Add New Tenant"}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 font-medium">
            Add a tenant and assign them to an available home unit.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Form */}
        <form
          className="space-y-5 pt-3 overflow-y-auto max-h-[calc(90vh-130px)] pr-1.5 scrollbar-thin"
          onSubmit={(e) => {
            e.preventDefault();
            if (validateForm() && !unitDupError) {
              mutation.mutate();
            }
          }}
        >
          {/* Unit Duplicate / Occupied Error */}
          {unitDupError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
              {unitDupError}
            </div>
          )}

          {/* SECTION 1 — TENANT DETAILS */}
          <div className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-700">
              1. Tenant Details
            </h3>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Full Name *</Label>
              <Input
                required
                value={form.name}
                onChange={(e) => {
                  setForm((f) => ({ ...f, name: e.target.value }));
                  if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: "" }));
                }}
                placeholder="e.g. Santhosh M"
                className={cn("h-10 text-xs font-bold text-slate-900 bg-white", fieldErrors.name && "border-rose-500 focus-visible:ring-rose-500")}
              />
              {fieldErrors.name && (
                <p className="text-[11px] font-bold text-rose-600 animate-in fade-in">{fieldErrors.name}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Phone Number *</Label>
                <Input
                  required
                  value={form.phone}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, phone: e.target.value }));
                    if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: "" }));
                  }}
                  placeholder="+91 90000 00000"
                  className={cn("h-10 text-xs font-bold bg-white", fieldErrors.phone && "border-rose-500 focus-visible:ring-rose-500")}
                />
                {fieldErrors.phone ? (
                  <p className="text-[11px] font-bold text-rose-600 animate-in fade-in">{fieldErrors.phone}</p>
                ) : (
                  <p className="text-[10px] text-slate-500 font-medium pt-0.5">
                    Used for payment receipts & automated WhatsApp rent reminders.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Email Address</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, email: e.target.value }));
                    if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: "" }));
                  }}
                  placeholder="e.g. tenant@example.com"
                  className={cn("h-10 text-xs font-semibold bg-white", fieldErrors.email && "border-rose-500 focus-visible:ring-rose-500")}
                />
                {fieldErrors.email && (
                  <p className="text-[11px] font-bold text-rose-600 animate-in fade-in">{fieldErrors.email}</p>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 2 — ASSIGN HOME */}
          <div className="space-y-3 rounded-xl border border-blue-200/80 bg-blue-50/30 p-3.5">
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-900">
                2. Assign Home
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Select the property and home where this tenant will stay.
              </p>
            </div>

            {/* Property Search Combobox */}
            <div className="space-y-1 relative z-30">
              <Label className="text-xs font-bold text-slate-700">Property *</Label>
              <SearchablePropertyCombobox
                properties={properties.filter(p => p.status === "AVAILABLE" || p.id === form.propertyId)}
                value={form.propertyId}
                onChange={handlePropertySelect}
              />
            </div>

            {/* Home / Unit Combobox for Multi-Unit Properties */}
            {selectedProperty && homesList.length > 0 && (
              <div className="space-y-1 relative z-20">
                <Label className="text-xs font-bold text-slate-700">Home / Unit *</Label>
                <SearchableHomeCombobox
                  homes={homesList}
                  value={form.homeId}
                  onChange={handleHomeSelect}
                />
              </div>
            )}

            {/* Selected Home / Unit Compact Summary Box */}
            {selectedProperty && (selectedHome || selectedProperty.type === "HOUSE") && (
              <div className="rounded-xl border border-blue-200 bg-white p-3.5 space-y-2 text-xs shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Building2 className="size-4 text-blue-600 shrink-0" />
                    <span className="font-black text-slate-900 text-sm truncate">{selectedProperty.name}</span>
                  </div>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                    Available
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Allocated Unit</span>
                    <span className="font-extrabold text-slate-900">
                      {selectedHome ? `${selectedHome.floor} · ${selectedHome.homeNumber} (${selectedHome.homeType})` : `${selectedProperty.address}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Financial Terms</span>
                    <span className="font-black text-blue-700">
                      {formatINR(form.rent)}/mo
                      {form.deposit && Number(form.deposit) > 0 && (
                        <span className="text-[11px] font-semibold text-slate-500 ml-1.5">
                          (Deposit {formatINR(form.deposit)})
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Rent & Deposit Inputs */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Agreed Monthly Rent (₹) *</Label>
                <Input
                  required
                  type="number"
                  min={0}
                  value={form.rent}
                  onChange={(e) => setForm((f) => ({ ...f, rent: e.target.value }))}
                  className="h-10 text-xs font-black text-blue-700 bg-white"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Security Deposit (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.deposit}
                  onChange={(e) => setForm((f) => ({ ...f, deposit: e.target.value }))}
                  className="h-10 text-xs font-semibold bg-white"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3 — TENANCY DETAILS */}
          <div className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-700">
              3. Tenancy Details
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Joining Date *</Label>
                <Input
                  required
                  type="date"
                  value={form.joiningDate}
                  onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
                  onChange={(e) => setForm((f) => ({ ...f, joiningDate: e.target.value }))}
                  className="h-10 text-xs font-bold bg-white cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Rent Due Day of Month</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={form.dueDay}
                  onChange={(e) => setForm((f) => ({ ...f, dueDay: e.target.value }))}
                  placeholder="5"
                  className="h-10 text-xs font-semibold bg-white"
                />
              </div>
            </div>

            {/* Collapsible Additional Details */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowAdditional((s) => !s)}
                className="text-xs font-bold text-slate-600 hover:text-blue-600 flex items-center gap-1.5 transition-colors py-1 cursor-pointer"
              >
                <SlidersHorizontal className="size-3.5" />
                {showAdditional ? "Hide Additional Details" : "Additional Details (Aadhaar, Emergency Contact & Notes)"}
                {showAdditional ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              </button>
            </div>

            {showAdditional && (
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3 text-xs animate-in fade-in duration-150">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-slate-700">Aadhaar / KYC Number</Label>
                  <Input
                    value={form.aadhaarNumber}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, aadhaarNumber: formatAadhaarInput(e.target.value) }));
                      if (fieldErrors.aadhaarNumber) setFieldErrors((prev) => ({ ...prev, aadhaarNumber: "" }));
                    }}
                    placeholder="e.g. 1234 5678 9012"
                    className={cn("h-9 text-xs font-semibold bg-slate-50", fieldErrors.aadhaarNumber && "border-rose-500")}
                  />
                  {fieldErrors.aadhaarNumber && (
                    <p className="text-[10px] font-bold text-rose-600 animate-in fade-in">{fieldErrors.aadhaarNumber}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">Emergency Contact Name</Label>
                    <Input
                      value={form.emergencyName}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, emergencyName: e.target.value }));
                        if (fieldErrors.emergencyName) setFieldErrors((prev) => ({ ...prev, emergencyName: "" }));
                      }}
                      placeholder="e.g. Parent / Spouse Name"
                      className={cn("h-9 text-xs bg-slate-50", fieldErrors.emergencyName && "border-rose-500")}
                    />
                    {fieldErrors.emergencyName && (
                      <p className="text-[10px] font-bold text-rose-600 animate-in fade-in">{fieldErrors.emergencyName}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">Emergency Phone</Label>
                    <Input
                      value={form.emergencyPhone}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, emergencyPhone: e.target.value }));
                        if (fieldErrors.emergencyPhone) setFieldErrors((prev) => ({ ...prev, emergencyPhone: "" }));
                      }}
                      placeholder="+91 90000 00000"
                      className={cn("h-9 text-xs bg-slate-50", fieldErrors.emergencyPhone && "border-rose-500")}
                    />
                    {fieldErrors.emergencyPhone && (
                      <p className="text-[10px] font-bold text-rose-600 animate-in fade-in">{fieldErrors.emergencyPhone}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1 border-t border-slate-100 pt-2">
                  <Label className="text-[11px] font-bold text-slate-700">Notes & Internal Remarks</Label>
                  <Input
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Workplace, vehicle details, gate pass notes..."
                    className="h-9 text-xs bg-slate-50"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Fixed Action Footer */}
          <DialogFooter className="pt-2 shrink-0 flex items-center justify-end gap-2 border-t border-slate-100 mt-2">
            <Button type="button" variant="outline" onClick={onClose} className="h-9 text-xs font-bold rounded-xl border-slate-300 cursor-pointer">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!!unitDupError}
              loading={mutation.isPending}
              className="h-9 text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs px-5 cursor-pointer"
            >
              {tenant ? "Save Changes" : "Add Tenant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
