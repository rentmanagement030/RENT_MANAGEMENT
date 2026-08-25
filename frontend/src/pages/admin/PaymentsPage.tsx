import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Banknote,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  Landmark,
  Link2,
  MoreVertical,
  Receipt,
  Search,
  X,
  XCircle,
  Filter,
  Activity,
  Layers,
  CreditCard,
  Clock,
  Copy,
} from "lucide-react";
import { api, downloadBlobFile, downloadUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatDateTime, formatDate, formatINR, currentMonth } from "@/lib/format";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePageResetOnFilter } from "@/hooks/usePageResetOnFilter";
import { useAuth } from "@/auth/AuthContext";
import { PERMISSIONS } from "@/lib/permissions";
import { Button, Card, CardContent, Input, Label, PageLoader, Select } from "@/components/ui/primitives";
import { EmptyState, PageHeader, Pagination } from "@/components/ui/data";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlay";
import FileViewer from "@/components/FileViewer";
import { useToast } from "@/components/ui/toast";
import { FinancialSummaryBanner } from "@/components/ui/FinancialSummaryBanner";
import type { Payment, Tenant } from "@/types";

const METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  UPI: "UPI",
  MIXED: "Cash + UPI (Mixed)",
  BANK_TRANSFER_DD: "Bank Transfer / DD",
  RAZORPAY_UPI: "Razorpay / UPI",
};

interface SelectableUnpaidItem {
  id: string;
  kind: "bill" | "rent";
  billType: string;
  billNumber?: string;
  billingMonth: string;
  dueDate: string;
  outstanding: number;
  originalOutstanding: number;
  penaltyAmount: number;
  waivePenalty?: boolean;
  allocatedAmount: number;
  selected: boolean;
  billId?: string;
  rentRecordId?: string;
}

function formatBillTypeLabel(type?: string): string {
  if (!type) return "Bill";
  const normalized = type.trim().toUpperCase();
  switch (normalized) {
    case "RENT":
    case "RENT_RECORD":
      return "Rent";
    case "EB":
    case "EB_BILL":
    case "ELECTRICITY":
      return "EB Bill";
    case "MAINTENANCE":
      return "Maintenance";
    case "WATER":
    case "WATER_BILL":
      return "Water Bill";
    case "LATE_FEE":
    case "LATE_FEE_BILL":
      return "Late Fee";
    case "OTHER":
      return "Other";
    case "GAS":
    case "GAS_BILL":
      return "Gas Bill";
    case "PARKING":
      return "Parking";
    case "WASTE":
      return "Waste Management";
    default:
      return normalized
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (l) => l.toUpperCase());
  }
}

/** Professional Status Badge with CSS indicator dot */
function PaymentStatusBadge({ status }: { status: string }) {
  const norm = (status || "").toUpperCase();
  switch (norm) {
    case "SUCCESS":
    case "VERIFIED":
    case "COMPLETED":
    case "PAID":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="size-1.5 rounded-full bg-emerald-600"></span> SUCCESS
        </span>
      );
    case "PENDING_VERIFICATION":
    case "PENDING":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="size-1.5 rounded-full bg-amber-500 animate-pulse"></span> PENDING VERIFICATION
        </span>
      );
    case "REJECTED":
    case "FAILED":
    case "CANCELLED":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
          <span className="size-1.5 rounded-full bg-rose-600"></span> REJECTED
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

/** Action Dropdown Menu for Payment Row */
function PaymentActionMenu({
  payment,
  canVerify,
  canReadReceipt,
  onReceipt,
  onVerify,
  onReject,
  activeMenuId,
  setActiveMenuId,
}: {
  payment: Payment;
  canVerify: boolean;
  canReadReceipt: boolean;
  onReceipt: () => void;
  onVerify: () => void;
  onReject: () => void;
  activeMenuId: string | null;
  setActiveMenuId: (id: string | null) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [visible, setVisible] = useState(false);

  const menuOpen = activeMenuId === payment.id;
  const MENU_WIDTH = 210;

  const computePosition = useCallback(() => {
    if (!buttonRef.current) return null;
    const rect = buttonRef.current.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    let top = rect.bottom + 6;
    if (vh - rect.bottom < 220) {
      top = rect.top - 220;
    }
    top = Math.max(12, Math.min(top, vh - 230));

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
      setActiveMenuId(null);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveMenuId(null);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen, setActiveMenuId]);

  const handleAction = (e: React.MouseEvent, actionFn: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveMenuId(null);
    setTimeout(() => {
      actionFn();
    }, 10);
  };

  const rawPhone = payment.tenant?.phone ?? "";
  const cleanPhone = rawPhone.replace(/\D/g, "");
  const receiptText = encodeURIComponent(
    `Hi ${payment.tenant?.name ?? "Tenant"}, thank you for your payment of ${formatINR(payment.amount)} received on ${formatDateTime(payment.paymentDate)}. Receipt No: ${payment.receiptNumber ?? payment.id}.`
  );
  const waUrl = cleanPhone ? `https://wa.me/91${cleanPhone}?text=${receiptText}` : null;

  return (
    <>
      <button
        ref={buttonRef}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setActiveMenuId(menuOpen ? null : payment.id);
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
            {canReadReceipt && payment.paymentStatus !== "REJECTED" && payment.paymentStatus !== "FAILED" && (
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => handleAction(e, onReceipt)}
                className="flex w-full items-center gap-2.5 px-3 min-h-[36px] font-bold text-slate-700 hover:bg-slate-100 transition-colors text-left"
              >
                <Receipt className="size-4 text-slate-400 shrink-0" /> View Receipt PDF
              </button>
            )}

            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noreferrer"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => setActiveMenuId(null)}
                className="flex w-full items-center gap-2.5 px-3 min-h-[36px] font-bold text-emerald-700 hover:bg-emerald-50 transition-colors text-left"
              >
                <Receipt className="size-4 text-emerald-600 shrink-0" /> Send Receipt WhatsApp
              </a>
            )}
          </div>

          {canVerify && payment.paymentMethod === "BANK_TRANSFER_DD" && payment.paymentStatus === "PENDING_VERIFICATION" && (
            <div className="my-1 border-t border-slate-100 pt-1">
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => handleAction(e, onVerify)}
                className="flex w-full items-center gap-2.5 px-3 min-h-[36px] font-bold text-emerald-700 hover:bg-emerald-50 transition-colors text-left"
              >
                <CheckCircle2 className="size-4 text-emerald-600 shrink-0" /> Verify Payment
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => handleAction(e, onReject)}
                className="flex w-full items-center gap-2.5 px-3 min-h-[36px] font-bold text-rose-700 hover:bg-rose-50 transition-colors text-left"
              >
                <XCircle className="size-4 text-rose-600 shrink-0" /> Reject Payment
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

interface FilterOption {
  label: string;
  value: string;
  icon?: ReactNode;
}

function RentOkFilterDropdown({
  label,
  value,
  options,
  onChange,
  placeholder = "Select...",
  icon: HeaderIcon = Filter,
}: {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (val: string) => void;
  placeholder?: string;
  icon?: any;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const selectedOption = useMemo(() => options.find((o) => o.value === value) || options[0], [options, value]);

  const updatePos = () => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const vh = window.innerHeight;
    const spaceBelow = vh - rect.bottom;
    const estimatedHeight = Math.min(240, 20 + options.length * 40);

    let top = rect.bottom + 6;
    if (spaceBelow < estimatedHeight && rect.top > estimatedHeight) {
      top = rect.top - estimatedHeight - 6;
    }
    setPos({
      top: Math.max(8, top),
      left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
      width: Math.min(rect.width, window.innerWidth - 16),
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open, options.length]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const isFiltered = value && value !== "CURRENT" && value !== "ALL";

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-xl border bg-white px-3.5 text-xs font-bold transition-all shadow-2xs hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20",
          isFiltered ? "border-blue-500/40 bg-blue-50/20 text-blue-950" : "border-slate-300 text-slate-800"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <HeaderIcon className={cn("size-4 shrink-0", isFiltered ? "text-blue-600" : "text-slate-400")} />
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </div>
        <ChevronDown className={cn("size-4 shrink-0 text-slate-400 transition-transform duration-200", open && "rotate-180")} />
      </button>

      {open && pos && createPortal(
        <div
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: pos.width,
            zIndex: 99999,
          }}
          className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl ring-1 ring-black/5 animate-in fade-in-50 zoom-in-95"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-xs font-bold transition-colors text-left",
                  isSelected
                    ? "bg-blue-50 text-blue-700 font-extrabold"
                    : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {opt.icon && <span className={isSelected ? "text-blue-600" : "text-slate-400"}>{opt.icon}</span>}
                  <span className="truncate">{opt.label}</span>
                </div>
                {isSelected && <Check className="size-4 shrink-0 text-blue-600" />}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

function getPeriodLabel(periodVal: string): string {
  if (!periodVal || periodVal === "CURRENT") return "Current Month";
  if (periodVal === "PREVIOUS") return "Previous Month";
  if (periodVal === "ALL") return "All Time";
  if (periodVal.match(/^\d{4}-\d{2}$/)) {
    const [y, m] = periodVal.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
  return periodVal;
}

function generatePeriodOptions(): FilterOption[] {
  const options: FilterOption[] = [
    { label: "Current Month", value: "CURRENT", icon: <Calendar className="size-4 text-blue-500" /> },
    { label: "Previous Month", value: "PREVIOUS", icon: <Calendar className="size-4 text-amber-500" /> },
    { label: "All Time", value: "ALL", icon: <Layers className="size-4 text-purple-500" /> },
  ];

  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (!options.some((o) => o.value === ym)) {
      options.push({ label, value: ym, icon: <Calendar className="size-4 text-slate-400" /> });
    }
  }
  return options;
}

export default function PaymentsPage() {
  const { can } = useAuth();
  const { success, error: toastError } = useToast();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [periodFilter, setPeriodFilter] = useState("CURRENT");
  const [methodFilter, setMethodFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery);

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const [cashOpen, setCashOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [razorpayOpen, setRazorpayOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [receipt, setReceipt] = useState<{ url: string; name: string } | null>(null);

  const actionParam = searchParams.get("action");
  const defaultTenantId = searchParams.get("tenantId") || "";
  const defaultRentRecordId = searchParams.get("rentRecordId") || "";

  usePageResetOnFilter(setPage, debouncedSearch, periodFilter, methodFilter, statusFilter);

  useEffect(() => {
    if (actionParam === "new" && defaultTenantId && can(PERMISSIONS.PAYMENTS_CREATE)) {
      setCashOpen(true);
    }
  }, [actionParam, defaultTenantId, can]);

  const clearQueryParams = () => {
    if (actionParam === "new") {
      searchParams.delete("action");
      searchParams.delete("tenantId");
      searchParams.delete("rentRecordId");
      setSearchParams(searchParams, { replace: true });
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["payments", page, debouncedSearch, periodFilter, methodFilter, statusFilter],
    queryFn: () =>
      api.listPayments({
        page,
        pageSize: 10,
        search: debouncedSearch || undefined,
        period: periodFilter || undefined,
        method: methodFilter || undefined,
        status: statusFilter || undefined,
      }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["payments"] });
    qc.invalidateQueries({ queryKey: ["rent"] });
    qc.invalidateQueries({ queryKey: ["bills"] });
    qc.invalidateQueries({ queryKey: ["tenants"] });
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      await downloadBlobFile("/ops/reports/collection/export", "collections.xlsx");
      success("Export Downloaded", "Collections Excel report downloaded successfully.");
    } catch (e) {
      toastError("Export failed", e instanceof Error ? e.message : undefined);
    } finally {
      setExporting(false);
    }
  };

  const kpiStats = useMemo(() => {
    const summary = data?.summary;
    return {
      totalCollected: summary?.totalCollected ?? 0,
      totalCount: summary?.totalCount ?? data?.total ?? 0,
      pendingCount: summary?.pendingCount ?? 0,
      pendingAmount: summary?.pendingAmount ?? 0,
      methodTotals: summary?.methodTotals ?? [],
    };
  }, [data]);

  const periodOptions = useMemo(() => generatePeriodOptions(), []);

  const methodOptions: FilterOption[] = [
    { label: "All Methods", value: "", icon: <CreditCard className="size-4" /> },
    { label: "Cash", value: "CASH", icon: <Banknote className="size-4 text-emerald-500" /> },
    { label: "Cash + UPI (Mixed)", value: "MIXED", icon: <Banknote className="size-4 text-blue-500" /> },
    { label: "Bank Transfer / DD", value: "BANK_TRANSFER_DD", icon: <Landmark className="size-4 text-purple-500" /> },
    { label: "Razorpay / UPI", value: "RAZORPAY_UPI", icon: <Link2 className="size-4 text-cyan-500" /> },
  ];

  const statusOptions: FilterOption[] = [
    { label: "All Statuses", value: "", icon: <Activity className="size-4" /> },
    { label: "Verified / Success", value: "VERIFIED", icon: <CheckCircle2 className="size-4 text-emerald-500" /> },
    { label: "Pending Verification", value: "PENDING_VERIFICATION", icon: <Clock className="size-4 text-amber-500" /> },
    { label: "Rejected / Failed", value: "REJECTED", icon: <XCircle className="size-4 text-rose-500" /> },
  ];

  const hasActiveFilters = !!(debouncedSearch || periodFilter !== "CURRENT" || methodFilter || statusFilter);

  const clearAllFilters = () => {
    setSearchQuery("");
    setPeriodFilter("CURRENT");
    setMethodFilter("");
    setStatusFilter("");
  };

  const items = data?.items ?? [];

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Payment Records & Collections"
        description="Record and manage tenant payments, verify transfers, and maintain accurate collection records."
        actions={
          <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:flex-wrap sm:items-center sm:gap-2">
            <Button
              variant="outline"
              onClick={handleExportExcel}
              loading={exporting}
              className="h-10 px-2 sm:px-3.5 rounded-xl font-bold text-[11px] sm:text-xs border-slate-300 text-slate-700 hover:bg-slate-50 shadow-2xs flex items-center justify-center truncate w-full"
            >
              <Download className="size-3.5 sm:size-4 mr-1 sm:mr-1.5 text-slate-500 shrink-0" />
              <span className="truncate">Export Report</span>
            </Button>
            {can(PERMISSIONS.PAYMENTS_CREATE) && (
              <>
                <Button
                  onClick={() => setCashOpen(true)}
                  className="h-10 px-2 sm:px-4 rounded-xl font-bold text-[11px] sm:text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-2xs cursor-pointer flex items-center justify-center truncate w-full"
                >
                  <Banknote className="size-3.5 sm:size-4 mr-1 sm:mr-1.5 shrink-0" />
                  <span className="truncate">Record Payment</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setBankOpen(true)}
                  className="h-10 px-2 sm:px-3.5 rounded-xl font-bold text-[11px] sm:text-xs border-slate-300 text-slate-700 hover:bg-slate-50 shadow-2xs flex items-center justify-center truncate w-full"
                >
                  <Landmark className="size-3.5 sm:size-4 mr-1 sm:mr-1.5 text-slate-500 shrink-0" />
                  <span className="truncate">Record Bank / DD</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setRazorpayOpen(true)}
                  className="h-10 px-2 sm:px-3.5 rounded-xl font-bold text-[11px] sm:text-xs border-slate-300 text-slate-700 hover:bg-slate-50 shadow-2xs flex items-center justify-center truncate w-full"
                >
                  <Link2 className="size-3.5 sm:size-4 mr-1 sm:mr-1.5 text-slate-500 shrink-0" />
                  <span className="truncate">Send Payment Link</span>
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Financial Summary Banner (Unified Cross-Page Financial Banner) */}
      <FinancialSummaryBanner
        grossBilled={(data as any)?.summary?.grossBilled ?? 0}
        billedCollections={(data as any)?.summary?.billedCollections ?? 0}
        totalCashInflow={(data as any)?.summary?.totalCashInflow ?? kpiStats.totalCollected}
        totalOutstanding={(data as any)?.summary?.totalOutstanding ?? 0}
        billingMonthLabel={getPeriodLabel(periodFilter)}
      />

      {/* RentOk Professional Single Toolbar */}
      <Card className="border border-slate-200 bg-white shadow-2xs rounded-2xl overflow-visible relative z-30">
        <CardContent className="p-4 sm:p-5 space-y-3 overflow-visible relative z-30">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 items-center">
            {/* Search Input (lg:col-span-5) */}
            <div className="relative lg:col-span-5">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search resident, property, receipt or reference..."
                className="pl-10 h-11 text-xs font-bold border-slate-300 rounded-xl w-full bg-white text-slate-900"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {/* Period Filter (lg:col-span-3) */}
            <div className="lg:col-span-3">
              <RentOkFilterDropdown
                label="Period"
                value={periodFilter}
                options={periodOptions}
                onChange={(val) => setPeriodFilter(val)}
                placeholder="Current Month"
                icon={Calendar}
              />
            </div>

            {/* Method Filter (lg:col-span-2) */}
            <div className="lg:col-span-2">
              <RentOkFilterDropdown
                label="Method"
                value={methodFilter}
                options={methodOptions}
                onChange={(val) => setMethodFilter(val)}
                placeholder="All Methods"
                icon={CreditCard}
              />
            </div>

            {/* Status Filter (lg:col-span-2) */}
            <div className="lg:col-span-2">
              <RentOkFilterDropdown
                label="Status"
                value={statusFilter}
                options={statusOptions}
                onChange={(val) => setStatusFilter(val)}
                placeholder="All Statuses"
                icon={Activity}
              />
            </div>
          </div>

          {/* Active Filter Indicators */}
          {hasActiveFilters && (
            <div className="flex items-center flex-wrap gap-2 pt-2 border-t border-slate-100 text-xs">
              <span className="text-[11px] font-bold text-slate-500">Active Filters:</span>
              {periodFilter !== "CURRENT" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                  Period: {getPeriodLabel(periodFilter)}
                </span>
              )}
              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                  "{searchQuery}"
                </span>
              )}
              {methodFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
                  Method: {METHOD_LABEL[methodFilter] ?? methodFilter}
                </span>
              )}
              {statusFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                  Status: {statusFilter}
                </span>
              )}

              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline ml-auto"
              >
                Clear Filters
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-xl w-full"></div>
              ))}
            </div>
          ) : !items.length ? (
            <EmptyState
              icon={<Banknote className="size-6 text-slate-400" />}
              title="No payment records found"
              description="No transaction statements match your current search query or method filter."
              action={
                hasActiveFilters ? (
                  <Button onClick={clearAllFilters} variant="outline" className="font-bold border-slate-300 text-slate-700 rounded-xl">
                    Clear Filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="lg:hidden divide-y divide-slate-100">
                {items.map((p) => {
                  const purposeBadge = p.notes && p.notes.includes("Purpose:") ? p.notes.split("|")[0].replace("Purpose:", "").trim() : "Payment";
                  return (
                    <div key={p.id} className="p-4 space-y-3 bg-white">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="size-9 rounded-full bg-slate-100 text-slate-700 font-extrabold text-xs flex items-center justify-center border border-slate-200 shrink-0">
                            {getInitials(p.tenant?.name)}
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-900 text-sm block truncate">{p.tenant?.name ?? "—"}</span>
                            <span className="text-xs text-slate-500 block truncate">{p.tenant?.phone || "No Phone"} · {p.property?.name ?? "No Property"}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0 space-y-1">
                          <PaymentStatusBadge status={p.paymentStatus} />
                        </div>
                      </div>
                      <div className="rounded-xl bg-slate-50/80 p-3 border border-slate-200/70 grid grid-cols-2 gap-2 text-xs font-semibold">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Purpose</span>
                          <span className="font-bold text-slate-800">{purposeBadge}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Amount</span>
                          <span className="font-semibold text-emerald-700 text-sm">{formatINR(p.amount)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Method</span>
                          <span className="font-bold text-slate-700">{METHOD_LABEL[p.paymentMethod] ?? p.paymentMethod}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Date</span>
                          <span className="font-medium text-slate-700">{formatDate(p.paymentDate)}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1.5">
                          <PaymentActionMenu
                            payment={p}
                            canVerify={can(PERMISSIONS.PAYMENTS_VERIFY)}
                            canReadReceipt={can(PERMISSIONS.RECEIPTS_READ)}
                            onReceipt={() => setReceipt({ url: `/payments/${p.id}/receipt`, name: `Receipt-${p.receiptNumber ?? p.id}.pdf` })}
                            onVerify={() => api.verifyBank(p.id, { status: "VERIFIED" }).then(() => { success("Payment verified"); invalidate(); })}
                            onReject={() => api.verifyBank(p.id, { status: "REJECTED" }).then(() => { success("Payment rejected"); invalidate(); })}
                            activeMenuId={activeMenuId}
                            setActiveMenuId={setActiveMenuId}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden lg:block w-full max-w-full overflow-hidden">
                <table className="w-full text-left border-collapse table-fixed text-xs">
                  <colgroup>
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "6%" }} />
                  </colgroup>
                  <thead className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3.5 py-3.5">TENANT</th>
                      <th className="px-3.5 py-3.5">PAYMENT PURPOSE</th>
                      <th className="px-3.5 py-3.5">AMOUNT</th>
                      <th className="px-3.5 py-3.5">METHOD</th>
                      <th className="px-3.5 py-3.5">DATE</th>
                      <th className="px-3.5 py-3.5">RECEIPT / REF</th>
                      <th className="px-3.5 py-3.5">STATUS</th>
                      <th className="px-3.5 py-3.5 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-medium">
                    {items.map((p) => {
                      const purposeBadge = p.notes && p.notes.includes("Purpose:") ? p.notes.split("|")[0].replace("Purpose:", "").trim() : "Payment";
                      const dateStr = formatDate(p.paymentDate);
                      const timeStr = formatDateTime(p.paymentDate).split(",")[1]?.trim() || "";
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/70 transition-colors h-16">
                          <td className="px-3.5 py-3.5 min-w-0">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="size-8 rounded-full bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center justify-center border border-slate-200 shrink-0">
                                {getInitials(p.tenant?.name)}
                              </div>
                              <div className="min-w-0">
                                <span className="font-semibold text-slate-900 text-xs block truncate" title={p.tenant?.name}>{p.tenant?.name ?? "—"}</span>
                                <span className="text-[11px] text-slate-500 block truncate">{p.tenant?.phone || "No phone"} {p.property ? `· ${p.property.name}` : ""}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-3.5 py-3.5 min-w-0"><span className="font-medium text-slate-800 text-xs block truncate" title={purposeBadge}>{purposeBadge}</span></td>
                          <td className="px-3.5 py-3.5 min-w-0"><span className="font-semibold text-emerald-700 text-sm block truncate">{formatINR(p.amount)}</span></td>
                          <td className="px-3.5 py-3.5 min-w-0">
                            <span className="font-semibold text-slate-800 text-xs block truncate">{METHOD_LABEL[p.paymentMethod] ?? p.paymentMethod}</span>
                            {(p.cashAmount != null || p.upiAmount != null) && (Number(p.cashAmount) > 0 || Number(p.upiAmount) > 0) && (
                              <span className="text-[10px] font-bold text-blue-700 block truncate" title={`Cash: ${formatINR(p.cashAmount ?? 0)} · UPI: ${formatINR(p.upiAmount ?? 0)}`}>
                                {Number(p.cashAmount) > 0 ? `Cash ${formatINR(p.cashAmount!)}` : ""}
                                {Number(p.cashAmount) > 0 && Number(p.upiAmount) > 0 ? " · " : ""}
                                {Number(p.upiAmount) > 0 ? `UPI (${p.upiApp || "UPI"}) ${formatINR(p.upiAmount!)}` : ""}
                              </span>
                            )}
                          </td>
                          <td className="px-3.5 py-3.5 min-w-0">
                            <span className="font-semibold text-slate-800 text-xs block truncate">{dateStr}</span>
                            {timeStr && <span className="text-[11px] text-slate-400 block truncate font-medium">{timeStr}</span>}
                          </td>
                          <td className="px-3.5 py-3.5 min-w-0 font-mono text-xs text-slate-700">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="block truncate" title={p.receiptNumber || p.bankReferenceNumber || "—"}>
                                {p.receiptNumber || p.bankReferenceNumber || "—"}
                              </span>
                              {(p.receiptNumber || p.bankReferenceNumber) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(p.receiptNumber || p.bankReferenceNumber || "");
                                    success("Copied to Clipboard", `Copied ID ${p.receiptNumber || p.bankReferenceNumber}`);
                                  }}
                                  className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors shrink-0"
                                  title="Copy Receipt / Reference ID"
                                >
                                  <Copy className="size-3" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-3.5 py-3.5 whitespace-nowrap"><PaymentStatusBadge status={p.paymentStatus} /></td>
                          <td className="px-3.5 py-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <PaymentActionMenu
                                payment={p}
                                canVerify={can(PERMISSIONS.PAYMENTS_VERIFY)}
                                canReadReceipt={can(PERMISSIONS.RECEIPTS_READ)}
                                onReceipt={() => setReceipt({ url: `/payments/${p.id}/receipt`, name: `Receipt-${p.receiptNumber ?? p.id}.pdf` })}
                                onVerify={() => api.verifyBank(p.id, { status: "VERIFIED" }).then(() => { success("Payment verified"); invalidate(); })}
                                onReject={() => api.verifyBank(p.id, { status: "REJECTED" }).then(() => { success("Payment rejected"); invalidate(); })}
                                activeMenuId={activeMenuId}
                                setActiveMenuId={setActiveMenuId}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-slate-200 bg-slate-50/50">
                <Pagination page={data?.page ?? 1} totalPages={data?.totalPages ?? 1} total={data?.total ?? 0} onPageChange={setPage} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {cashOpen && (
        <PaymentDialog
          method="cash"
          defaultTenantId={defaultTenantId}
          defaultRentRecordId={defaultRentRecordId}
          open={cashOpen}
          onClose={() => { setCashOpen(false); clearQueryParams(); }}
          onSaved={() => { setCashOpen(false); clearQueryParams(); invalidate(); }}
        />
      )}
      {bankOpen && (
        <PaymentDialog
          method="bank"
          defaultTenantId={defaultTenantId}
          defaultRentRecordId={defaultRentRecordId}
          open={bankOpen}
          onClose={() => setBankOpen(false)}
          onSaved={() => { setBankOpen(false); invalidate(); }}
        />
      )}
      {razorpayOpen && (
        <RazorpayDialog
          open={razorpayOpen}
          onClose={() => setRazorpayOpen(false)}
          onSaved={() => { setRazorpayOpen(false); invalidate(); }}
        />
      )}
      {receipt && <FileViewer open name={receipt.name} url={receipt.url} onClose={() => setReceipt(null)} />}
    </div>
  );
}

function VerifyActions({ payment, onChanged }: { payment: Payment; onChanged: () => void }) {
  const { success, error: toastError } = useToast();
  const mutation = useMutation({
    mutationFn: (status: "VERIFIED" | "REJECTED") => api.verifyBank(payment.id, { status }),
    onSuccess: () => { success("Payment updated"); onChanged(); },
    onError: (e) => toastError("Failed", e instanceof Error ? e.message : undefined),
  });
  return (
    <div className="flex items-center gap-1 shrink-0">
      <Button variant="outline" size="sm" className="h-8 px-2 rounded-lg font-bold text-xs text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100" onClick={() => mutation.mutate("VERIFIED")} loading={mutation.isPending && mutation.variables === "VERIFIED"}>Verify</Button>
      <Button variant="outline" size="sm" className="h-8 px-2 rounded-lg font-bold text-xs text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100" onClick={() => mutation.mutate("REJECTED")} loading={mutation.isPending && mutation.variables === "REJECTED"}>Reject</Button>
    </div>
  );
}

function SearchableResidentCombobox({
  tenants,
  value,
  onChange,
}: {
  tenants: Tenant[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedTenant = tenants.find((t) => t.id === value);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return tenants;
    return tenants.filter((t) => {
      const nameMatch = t.name.toLowerCase().includes(q);
      const phoneMatch = t.phone.includes(q);
      const emailMatch = t.email?.toLowerCase().includes(q) ?? false;
      const propMatch = t.property?.name.toLowerCase().includes(q) ?? false;
      return nameMatch || phoneMatch || emailMatch || propMatch;
    });
  }, [tenants, query]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (filtered.length ? (prev + 1) % filtered.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (filtered.length ? (prev - 1 + filtered.length) % filtered.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlightedIndex]) {
        handleSelect(filtered[highlightedIndex].id);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 10);
        }}
        className={cn(
          "w-full px-3.5 py-2.5 rounded-xl border bg-white flex items-center justify-between transition-all shadow-2xs cursor-text min-h-[50px]",
          isOpen ? "border-blue-500 ring-2 ring-blue-500/20" : "border-slate-300 hover:border-slate-400",
          value && !isOpen && "border-blue-200 bg-blue-50/10"
        )}
      >
        <div className="min-w-0 flex-1 pr-2">
          {isOpen ? (
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selectedTenant ? `${selectedTenant.name} (${selectedTenant.phone})` : "Type tenant name, phone, or property..."}
              className="w-full bg-transparent text-xs sm:text-sm font-bold text-slate-900 focus:outline-none placeholder:text-slate-400"
            />
          ) : selectedTenant ? (
            <div>
              <span className="font-extrabold text-slate-900 text-xs sm:text-sm block truncate">
                {selectedTenant.name}
              </span>
              <span className="text-[11px] font-semibold text-slate-500 block truncate">
                {selectedTenant.phone} {selectedTenant.property ? `· ${selectedTenant.property.name}` : ""}
              </span>
            </div>
          ) : (
            <span className="text-slate-400 font-semibold text-xs">Search or select resident...</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1.5">
          {selectedTenant && !isOpen && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
                setQuery("");
                setIsOpen(true);
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              title="Clear selection"
            >
              <X className="size-4" />
            </button>
          )}
          <ChevronDown className={cn("size-4 text-slate-400 transition-transform duration-150", isOpen && "rotate-180")} />
        </div>
      </div>

      {isOpen && (
        <div
          className="absolute top-full left-0 right-0 mt-1.5 rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden p-1.5 text-xs animate-in fade-in duration-100 z-50 ring-1 ring-black/5"
        >
          <div className="space-y-0.5 max-h-[220px] overflow-y-auto overscroll-contain pr-1">
            {filtered.length === 0 ? (
              <div className="p-4 text-center space-y-1">
                <p className="text-xs font-bold text-slate-700">No residents found</p>
                <p className="text-[11px] text-slate-400 font-medium">Try another name or phone number.</p>
              </div>
            ) : (
              filtered.map((t, idx) => (
                <div
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(t.id);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between p-2.5 rounded-lg text-left transition-colors cursor-pointer select-none",
                    t.id === value
                      ? "bg-blue-50 text-blue-900 font-extrabold"
                      : idx === highlightedIndex
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <div className="min-w-0 flex-1 pr-2 pointer-events-none">
                    <p className="font-extrabold text-slate-900 text-xs truncate">{t.name}</p>
                    <p className="text-[11px] font-semibold text-slate-500 truncate">
                      {t.phone} {t.property ? `· ${t.property.name}` : ""}
                    </p>
                  </div>
                  {t.id === value && <Check className="size-4 text-blue-600 shrink-0 ml-2 pointer-events-none" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SelectUpiAppCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const UPI_APPS = ["Google Pay", "PhonePe", "Paytm", "Other UPI"];

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="h-10 w-full px-3.5 rounded-xl border border-slate-300 bg-white flex items-center justify-between transition-all text-xs font-bold text-slate-800 shadow-2xs cursor-pointer hover:border-slate-400"
      >
        <span className="truncate">{value || "Select UPI App..."}</span>
        <ChevronDown className={cn("size-4 text-slate-400 transition-transform duration-150 shrink-0 ml-1", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 rounded-xl border border-slate-200 bg-white shadow-2xl p-1.5 text-xs animate-in fade-in duration-100 space-y-0.5 z-50 ring-1 ring-black/5">
          {UPI_APPS.map((app) => (
            <button
              key={app}
              type="button"
              onClick={() => {
                onChange(app);
                setIsOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between p-2.5 rounded-lg text-left transition-colors cursor-pointer font-bold select-none",
                app === value ? "bg-blue-50 text-blue-900" : "text-slate-700 hover:bg-slate-50"
              )}
            >
              <span>{app}</span>
              {app === value && <Check className="size-4 text-blue-600 shrink-0 ml-2" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DatePickerInput({
  label,
  value,
  onChange,
  required,
  placeholder = "dd-mm-yyyy",
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleIconClick = () => {
    if (inputRef.current) {
      if (typeof (inputRef.current as any).showPicker === "function") {
        try {
          (inputRef.current as any).showPicker();
        } catch {
          inputRef.current.focus();
        }
      } else {
        inputRef.current.focus();
      }
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className="font-bold text-slate-700 text-xs">{label}</Label>
      <div className="relative">
        <Input
          ref={inputRef}
          type="date"
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-10 pr-9 font-bold text-slate-900 border-slate-300 rounded-xl bg-white cursor-pointer w-full text-xs"
        />
        <button
          type="button"
          onClick={handleIconClick}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-blue-600 p-1 cursor-pointer"
          title="Open calendar"
        >
          <Calendar className="size-4" />
        </button>
      </div>
    </div>
  );
}

function PaymentDialog({
  method: initialMethod,
  defaultTenantId,
  defaultRentRecordId,
  open,
  onClose,
  onSaved,
}: {
  method: "cash" | "bank";
  defaultTenantId?: string;
  defaultRentRecordId?: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { success, error: toastError } = useToast();
  const { data: tenantsData } = useQuery({
    queryKey: ["tenants", "all"],
    queryFn: () => api.listTenants({ pageSize: 200 }),
  });
  const [method, setMethod] = useState<"cash" | "bank">(initialMethod);
  const [tenantId, setTenantId] = useState(defaultTenantId ?? "");
  const [propertyName, setPropertyName] = useState("");
  const [targetRentRecord, setTargetRentRecord] = useState<any | null>(null);
  const [items, setItems] = useState<SelectableUnpaidItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankRef, setBankRef] = useState("");
  const [ddNumber, setDdNumber] = useState("");
  const [ddDate, setDdDate] = useState("");

  const [cashAmountInput, setCashAmountInput] = useState<string>("");
  const [upiAmountInput, setUpiAmountInput] = useState<string>("");
  const [upiApp, setUpiApp] = useState<string>("Google Pay");
  const [userCustomizedSplit, setUserCustomizedSplit] = useState(false);

  const tenants = tenantsData?.items ?? [];
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    setMethod(initialMethod);
  }, [initialMethod]);

  const loadTenantDues = useCallback(
    async (id: string, targetRentRecId?: string) => {
      if (!id) {
        setPropertyName("");
        setItems([]);
        setTargetRentRecord(null);
        return;
      }
      setLoadingItems(true);
      try {
        const [billsRes, rentRes] = await Promise.all([
          api.listBills({ tenantId: id, pageSize: 200 }),
          api.listRent({ tenantId: id, pageSize: 200 }),
        ]);
        const openBills = (billsRes.items ?? []).filter(
          (b) => Number(b.outstanding) > 0 && b.status !== "CANCELLED" && b.status !== "WAIVED"
        );
        const openRentRecords = (rentRes.items ?? []).filter(
          (r) => Number(r.outstanding) > 0 && r.status !== "CANCELLED" && r.status !== "WAIVED"
        );
        const targetRec = (rentRes.items ?? []).find((r) => r.id === (targetRentRecId || defaultRentRecordId));
        if (targetRec) setTargetRentRecord(targetRec);
        const reqId = targetRentRecId || defaultRentRecordId;
        const selectableList: SelectableUnpaidItem[] = [];
        openBills.forEach((b) => {
          const penAmt = b.billType === "RENT" ? Number(b.penaltyAmount || 0) : 0;
          const totalOut = Number(b.outstanding);
          selectableList.push({
            id: b.id,
            kind: "bill",
            billType: b.billType,
            billNumber: b.billNumber,
            billingMonth: b.billingMonth,
            dueDate: b.dueDate,
            outstanding: totalOut,
            originalOutstanding: totalOut,
            penaltyAmount: penAmt,
            waivePenalty: false,
            allocatedAmount: totalOut,
            selected: false,
            billId: b.id,
            rentRecordId: b.rentRecordId ?? undefined,
          });
        });
        openRentRecords.forEach((r) => {
          const hasMatchingRentBill = openBills.some(
            (b) => b.billType === "RENT" && (b.rentRecordId === r.id || b.billingMonth === r.billingMonth)
          );
          if (!hasMatchingRentBill) {
            const penAmt = Number(r.penaltyAmount || 0);
            const totalOut = Number(r.outstanding);
            selectableList.push({
              id: r.id,
              kind: "rent",
              billType: "RENT",
              billingMonth: r.billingMonth,
              dueDate: r.dueDate,
              outstanding: totalOut,
              originalOutstanding: totalOut,
              penaltyAmount: penAmt,
              waivePenalty: false,
              allocatedAmount: totalOut,
              selected: false,
              rentRecordId: r.id,
            });
          }
        });
        selectableList.sort((a, b) => {
          if (a.billType === "RENT" && b.billType !== "RENT") return -1;
          if (a.billType !== "RENT" && b.billType === "RENT") return 1;
          return b.billingMonth.localeCompare(a.billingMonth);
        });
        const hasReqMatch = reqId
          ? selectableList.some((i) => i.rentRecordId === reqId || i.billId === reqId || i.id === reqId)
          : false;
        setItems(
          selectableList.map((item) => {
            const isMatch = hasReqMatch ? item.rentRecordId === reqId || item.billId === reqId || item.id === reqId : true;
            return { ...item, selected: isMatch, allocatedAmount: isMatch ? item.outstanding : 0 };
          })
        );
      } catch (err) {
        toastError("Failed to fetch tenant dues", err instanceof Error ? err.message : undefined);
      } finally {
        setLoadingItems(false);
      }
    },
    [defaultRentRecordId, toastError]
  );

  useEffect(() => {
    if (!tenantId) {
      setPropertyName("");
      return;
    }
    const tenant = tenants.find((t) => t.id === tenantId);
    if (tenant?.property) {
      setPropertyName(`${tenant.property.name} (${tenant.property.city})`);
    } else {
      setPropertyName("No Assigned Property");
    }
  }, [tenantId, tenants]);

  const handleSelectTenant = (id: string, targetRentRecId?: string) => {
    setTenantId(id);
    fetchedRef.current = id;
    setUserCustomizedSplit(false);
    setItems([]);
    setTargetRentRecord(null);
    loadTenantDues(id, targetRentRecId);
  };

  useEffect(() => {
    if (open) {
      const targetId = defaultTenantId || tenantId;
      const key = `${targetId}-${defaultRentRecordId ?? ""}`;
      if (targetId && fetchedRef.current !== key) {
        fetchedRef.current = key;
        if (defaultTenantId && tenantId !== defaultTenantId) {
          setTenantId(defaultTenantId);
        }
        loadTenantDues(targetId, defaultRentRecordId);
      }
    } else {
      fetchedRef.current = null;
      setUserCustomizedSplit(false);
    }
  }, [open, defaultTenantId, defaultRentRecordId, tenantId, loadTenantDues]);

  const toggleItemSelection = (itemId: string, selected: boolean) => {
    setUserCustomizedSplit(false);
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, selected, allocatedAmount: selected ? item.outstanding : 0 } : item))
    );
  };

  const updateItemAllocation = (itemId: string, amount: number) => {
    setUserCustomizedSplit(false);
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, allocatedAmount: Math.min(item.outstanding, Math.max(0, amount)) } : item
      )
    );
  };

  const toggleWaivePenalty = (itemId: string, waive: boolean) => {
    setUserCustomizedSplit(false);
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const newOutstanding = waive
          ? Math.max(0, item.originalOutstanding - item.penaltyAmount)
          : item.originalOutstanding;
        return {
          ...item,
          waivePenalty: waive,
          outstanding: newOutstanding,
          allocatedAmount: item.selected ? newOutstanding : 0,
        };
      })
    );
  };

  const selectedItems = items.filter((i) => i.selected && i.allocatedAmount > 0);
  const selectedTypes: string[] = [];
  selectedItems.forEach((i) => {
    const label = formatBillTypeLabel(i.billType);
    if (!selectedTypes.includes(label)) selectedTypes.push(label);
  });
  const dynamicPurpose = selectedTypes.join(" + ");
  const totalPayable = selectedItems.reduce((sum, i) => sum + (Number(i.allocatedAmount) || 0), 0);

  useEffect(() => {
    if (!userCustomizedSplit) {
      setCashAmountInput(totalPayable > 0 ? String(totalPayable) : "");
      setUpiAmountInput("0");
    }
  }, [totalPayable, userCustomizedSplit]);

  const cashVal = method === "cash" ? Number(cashAmountInput) || 0 : 0;
  const upiVal = method === "cash" ? Number(upiAmountInput) || 0 : 0;
  const totalReceived = method === "cash" ? cashVal + upiVal : totalPayable;
  const remainingBalance = Math.max(0, totalPayable - totalReceived);
  const isOverpaid = method === "cash" && totalReceived > totalPayable;
  const isUpiAppMissing = method === "cash" && upiVal > 0 && !upiApp;

  const mutation = useMutation({
    mutationFn: () => {
      if (!selectedItems.length) throw new Error("Please select at least one item to pay.");
      if (method === "cash") {
        if (totalReceived <= 0) throw new Error("Please enter a valid received amount (Cash or UPI).");
        if (isOverpaid) {
          throw new Error(`Total Received (${formatINR(totalReceived)}) cannot exceed Selected Due Amount (${formatINR(totalPayable)}).`);
        }
        if (isUpiAppMissing) {
          throw new Error("Please select the UPI App used for the online portion.");
        }
      }

      const allocations = selectedItems
        .filter((item) => Number(item.allocatedAmount) > 0)
        .map((item) => ({
          billId: item.billId || undefined,
          rentRecordId: item.rentRecordId || undefined,
          amount: Number(item.allocatedAmount),
        }));
      const firstRentItem = selectedItems.find((i) => i.rentRecordId);
      const hasWaivedPenalty = selectedItems.some((i) => i.waivePenalty);

      const base = {
        tenantId,
        amount: method === "cash" ? totalReceived : totalPayable,
        paymentDate: paymentDate || undefined,
        notes: notes ? `Purpose: ${dynamicPurpose} | ${notes}` : `Purpose: ${dynamicPurpose}`,
        rentRecordId: firstRentItem?.rentRecordId || undefined,
        waivePenalty: hasWaivedPenalty,
        allocations: allocations.length > 0 ? allocations : undefined,
      };

      if (method === "cash") {
        return api.recordCash({
          ...base,
          cashAmount: cashVal,
          upiAmount: upiVal,
          upiApp: upiVal > 0 ? upiApp : undefined,
        });
      }

      return api.recordBank({
        ...base,
        bankName,
        bankReferenceNumber: bankRef || undefined,
        ddNumber: ddNumber || undefined,
        ddDate: ddDate || undefined,
      });
    },
    onSuccess: (p) => {
      const methodLbl = p.paymentMethod === "MIXED" ? "Cash + UPI (Mixed)" : METHOD_LABEL[p.paymentMethod] || p.paymentMethod;
      success("Payment recorded", `${formatINR(p.amount)} ${methodLbl}`);
      onSaved();
    },
    onError: (e) => toastError("Record failed", e instanceof Error ? e.message : undefined),
  });

  const selectedTenantObj = tenants.find((t) => t.id === tenantId);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-5 sm:p-6 overflow-x-hidden">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <DialogTitle className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Banknote className="size-4 text-blue-600" />
              {defaultRentRecordId || targetRentRecord ? "Record Rent Payment" : "Record Payment"}
            </DialogTitle>
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold border border-slate-200 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setMethod("cash")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  method === "cash" ? "bg-white text-blue-700 shadow-2xs font-extrabold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Cash / UPI
              </button>
              <button
                type="button"
                onClick={() => setMethod("bank")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  method === "bank" ? "bg-white text-blue-700 shadow-2xs font-extrabold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Bank / DD
              </button>
            </div>
          </div>
          <DialogDescription className="text-slate-500 font-medium text-xs pt-1">
            {defaultRentRecordId
              ? "Collect payment for the selected resident and billing statement."
              : "Select resident to load outstanding dues and record cash, UPI, or bank payment."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4 pt-2 text-xs"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          {tenantId && selectedTenantObj && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-2 font-medium">
              <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                    TENANT DETAILS
                  </span>
                  <span className="font-semibold text-slate-900">{selectedTenantObj.name}</span>
                  <p className="text-[11px] text-slate-500">{selectedTenantObj.phone}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                    PROPERTY &amp; HOME
                  </span>
                  <span className="font-semibold text-slate-900 block">
                    {selectedTenantObj.property ? selectedTenantObj.property.name : propertyName}
                  </span>
                  {selectedTenantObj.room && (
                    <p className="text-[11px] text-slate-500">
                      Room {selectedTenantObj.room.roomNumber}
                      {selectedTenantObj.bed ? ` · Bed ${selectedTenantObj.bed.bedNumber}` : ""}
                    </p>
                  )}
                </div>
              </div>
              {targetRentRecord && (
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/80 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Statement Month</span>
                    <span className="font-semibold text-slate-800">{targetRentRecord.billingMonth}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Rent</span>
                    <span className="font-semibold text-slate-800">{formatINR(targetRentRecord.rent)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Outstanding Dues</span>
                    <span className="font-bold text-rose-600">{formatINR(targetRentRecord.outstanding)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {!defaultRentRecordId && (
            <div className="space-y-1.5">
              <Label className="font-bold text-slate-700 text-xs">Select Resident *</Label>
              <SearchableResidentCombobox
                tenants={tenants}
                value={tenantId}
                onChange={(id) => handleSelectTenant(id)}
              />
            </div>
          )}

          {tenantId && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className="font-bold text-slate-800 text-xs">What are you paying for? (Select Applicable Dues)</Label>
                {items.length > 0 && (
                  <span className="text-xs font-bold text-slate-500">
                    {items.length} Outstanding Record{items.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {loadingItems ? (
                <div className="p-6 text-center text-xs font-semibold text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                  Loading outstanding bills...
                </div>
              ) : items.length === 0 ? (
                <div className="p-4 text-center text-xs font-semibold text-emerald-700 bg-emerald-50/70 rounded-xl border border-emerald-200">
                  No outstanding bills for this tenant.
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border transition-all ${
                        item.selected ? "bg-blue-50/60 border-blue-300" : "bg-slate-50/50 border-slate-200 hover:bg-slate-100/50"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <label className="flex items-start gap-2.5 cursor-pointer flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={(e) => toggleItemSelection(item.id, e.target.checked)}
                            className="size-4 mt-0.5 rounded border-slate-300 text-blue-600 accent-blue-600 cursor-pointer shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-xs text-slate-900">{formatBillTypeLabel(item.billType)} Statement</span>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200">
                                {formatBillTypeLabel(item.billType)}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Month: <span className="font-semibold text-slate-700">{item.billingMonth}</span> · Due: {item.dueDate?.slice(0, 10)}{" "}
                              {item.billNumber ? `· Ref: ${item.billNumber}` : ""}
                            </p>
                          </div>
                        </label>
                        <div className="text-left sm:text-right shrink-0">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Due Amount</span>
                          <span className="font-bold text-rose-600 text-xs">{formatINR(item.outstanding)}</span>
                        </div>
                      </div>
                      {item.selected && (
                        <div className="mt-2.5 pt-2 border-t border-blue-200/60 space-y-2.5">
                          {item.billType === "RENT" && item.penaltyAmount > 0 && (
                            <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-200 text-xs space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-extrabold text-amber-950 flex items-center gap-1.5 text-xs">
                                  <AlertTriangle className="size-4 text-amber-600 shrink-0" /> Overdue Rent Penalty: {formatINR(item.penaltyAmount)}
                                </span>
                                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider bg-amber-100 px-2 py-0.5 rounded-full">Rent Only</span>
                              </div>
                              
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-0.5">
                                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                                  <input
                                    type="radio"
                                    name={`penalty-${item.id}`}
                                    checked={!item.waivePenalty}
                                    onChange={() => toggleWaivePenalty(item.id, false)}
                                    className="size-3.5 text-blue-600 accent-blue-600 cursor-pointer"
                                  />
                                  <span>Collect Penalty ({formatINR(item.penaltyAmount)})</span>
                                </label>
                                
                                <label className="flex items-center gap-2 cursor-pointer font-extrabold text-emerald-900 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-300 shadow-2xs">
                                  <input
                                    type="radio"
                                    name={`penalty-${item.id}`}
                                    checked={!!item.waivePenalty}
                                    onChange={() => toggleWaivePenalty(item.id, true)}
                                    className="size-3.5 text-emerald-600 accent-emerald-600 cursor-pointer"
                                  />
                                  <span>Waive / Neglect Penalty (₹0 - Valid Reason)</span>
                                </label>
                              </div>
                            </div>
                          )}

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-slate-700">Amount to Pay (₹):</span>
                            <Input
                              type="number"
                              step="any"
                              min={0.01}
                              max={item.outstanding}
                              value={item.allocatedAmount}
                              onChange={(e) => updateItemAllocation(item.id, Number(e.target.value))}
                              className="w-full sm:w-36 h-8 font-bold text-slate-900 text-xs bg-white border-slate-300 rounded-lg text-left sm:text-right"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {method === "cash" && tenantId && selectedItems.length > 0 && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-blue-200/60 pb-2">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                    <Banknote className="size-4 text-blue-600" /> Payment Breakdown (Cash + UPI)
                  </h4>
                  <p className="text-[11px] font-medium text-slate-500 pt-0.5">
                    Specify the exact cash &amp; UPI amounts received from the tenant.
                  </p>
                </div>
                {userCustomizedSplit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setUserCustomizedSplit(false);
                      setCashAmountInput(String(totalPayable));
                      setUpiAmountInput("0");
                    }}
                    className="h-6 text-[10px] font-bold text-blue-600 hover:bg-blue-100 px-2 rounded-lg cursor-pointer"
                  >
                    Reset Split
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Cash Amount (₹)</Label>
                  <Input
                    type="number"
                    step="any"
                    min={0}
                    value={cashAmountInput}
                    onChange={(e) => {
                      setUserCustomizedSplit(true);
                      setCashAmountInput(e.target.value);
                    }}
                    placeholder="0"
                    className="h-10 text-xs font-bold text-slate-900 bg-white border-slate-300 rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">UPI Amount (₹)</Label>
                  <Input
                    type="number"
                    step="any"
                    min={0}
                    value={upiAmountInput}
                    onChange={(e) => {
                      setUserCustomizedSplit(true);
                      setUpiAmountInput(e.target.value);
                    }}
                    placeholder="0"
                    className="h-10 text-xs font-bold text-slate-900 bg-white border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              {upiVal > 0 && (
                <div className="space-y-1 animate-in fade-in duration-150 pt-1">
                  <Label className="text-xs font-bold text-slate-700">UPI App Used *</Label>
                  <SelectUpiAppCombobox
                    value={upiApp}
                    onChange={(val) => setUpiApp(val)}
                  />
                </div>
              )}

              <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 space-y-2 text-xs shadow-2xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="font-semibold">Cash Amount</span>
                  <span className="font-bold text-slate-900">{formatINR(cashVal)}</span>
                </div>
                {upiVal > 0 && (
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="font-semibold">UPI Amount ({upiApp})</span>
                    <span className="font-bold text-blue-700">{formatINR(upiVal)}</span>
                  </div>
                )}

                <div className="border-t border-slate-100 pt-2 flex items-center justify-between font-black text-sm">
                  <span className="text-slate-900">Total Received</span>
                  <span className={cn(isOverpaid ? "text-rose-600" : "text-emerald-600")}>
                    {formatINR(totalReceived)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs font-semibold pt-1 border-t border-slate-100">
                  <span className="text-slate-500">Selected Due Amount</span>
                  <span className="text-slate-800">{formatINR(totalPayable)}</span>
                </div>

                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-500">Remaining Balance</span>
                  <span className={cn(remainingBalance > 0 ? "text-amber-600 font-extrabold" : "text-slate-700")}>
                    {formatINR(remainingBalance)}
                  </span>
                </div>

                {isOverpaid && (
                  <p className="text-[11px] font-bold text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-200 mt-1">
                    Total Received ({formatINR(totalReceived)}) cannot exceed Selected Due Amount ({formatINR(totalPayable)}).
                  </p>
                )}
              </div>
            </div>
          )}

          {tenantId && items.length > 0 && method === "bank" && (
            <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-1.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Selected Purpose</span>
                  <span className="font-semibold text-white truncate block">{dynamicPurpose || "None Selected"}</span>
                </div>
                <div className="text-left sm:text-right shrink-0">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 block">Total Amount Payable</span>
                  <span className="font-bold text-base text-emerald-400">{formatINR(totalPayable)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DatePickerInput
              label="Payment Date"
              value={paymentDate}
              onChange={(val) => setPaymentDate(val)}
            />
            {method === "bank" && (
              <div className="space-y-1.5">
                <Label className="font-bold text-slate-700 text-xs">Bank Name *</Label>
                <Input
                  required
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. HDFC Bank"
                  className="h-10 font-bold text-slate-900 border-slate-300 rounded-xl text-xs"
                />
              </div>
            )}
          </div>

          {method === "bank" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="font-bold text-slate-700 text-xs">UTR / Ref Number</Label>
                <Input
                  value={bankRef}
                  onChange={(e) => setBankRef(e.target.value)}
                  placeholder="UTR Number"
                  className="h-10 font-bold text-slate-900 border-slate-300 rounded-xl text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold text-slate-700 text-xs">DD Number</Label>
                <Input
                  value={ddNumber}
                  onChange={(e) => setDdNumber(e.target.value)}
                  placeholder="Demand Draft No."
                  className="h-10 font-bold text-slate-900 border-slate-300 rounded-xl text-xs"
                />
              </div>
              <DatePickerInput
                label="DD Date"
                value={ddDate}
                onChange={(val) => setDdDate(val)}
                placeholder="dd-mm-yyyy"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="font-bold text-slate-700 text-xs">Notes &amp; Remarks (Optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Handed over in person by tenant"
              className="h-10 text-slate-900 border-slate-300 rounded-xl text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl border-slate-300 font-bold cursor-pointer">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                !tenantId ||
                selectedItems.length === 0 ||
                totalReceived <= 0 ||
                isOverpaid ||
                (method === "cash" && upiVal > 0 && !upiApp)
              }
              loading={mutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 font-bold rounded-xl text-white shadow-2xs cursor-pointer"
            >
              Record {method === "cash" ? (upiVal > 0 && cashVal > 0 ? "Mixed (Cash + UPI)" : upiVal > 0 ? "UPI" : "Cash") : "Bank"}{" "}
              Payment ({formatINR(totalReceived)})
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RazorpayDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { success, error: toastError } = useToast();
  const { data: tenantsData } = useQuery({ queryKey: ["tenants", "all"], queryFn: () => api.listTenants({ pageSize: 200 }) });
  const { data: razorpayStatus } = useQuery({ queryKey: ["razorpay-status"], queryFn: () => api.razorpayStatus() });
  const [tenantId, setTenantId] = useState("");
  const [amount, setAmount] = useState("");
  const [creating, setCreating] = useState(false);
  const tenants = tenantsData?.items ?? [];
  const createOrder = async () => {
    if (!tenantId) return;
    setCreating(true);
    try {
      const order = await api.createRazorpayOrder({ tenantId, amount: amount ? Number(amount) : undefined });
      const sdk = await loadRazorpaySdk();
      const rzp = new sdk.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: order.tenantName ? `${order.tenantName}'s rent` : "Rent payment",
        description: `Rent · ${order.billingMonth ?? ""}`,
        order_id: order.orderId,
        handler: () => {
          success("Payment link created", "Payment is being verified via webhook.");
          onSaved();
        },
      });
      rzp.open();
    } catch (e) {
      toastError("Failed to create payment", e instanceof Error ? e.message : undefined);
    } finally {
      setCreating(false);
    }
  };
  if (razorpayStatus === false) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="rounded-2xl max-w-md p-5 sm:p-6 overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="font-bold text-slate-900 text-base">Razorpay Not Configured</DialogTitle>
            <DialogDescription className="text-xs text-slate-500 font-medium">Add Razorpay API keys to the backend environment file to enable online checkout links.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2"><Button variant="outline" onClick={onClose} className="rounded-xl border-slate-300 font-bold cursor-pointer">Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl max-w-md p-5 sm:p-6 overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="font-bold text-slate-900 text-base flex items-center gap-2"><Link2 className="size-4 text-blue-600" /> Send Payment Link</DialogTitle>
          <DialogDescription className="text-xs text-slate-500 font-medium">Creates a secure online checkout order for UPI, Cards, and Netbanking.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4 pt-2 text-xs" onSubmit={(e) => { e.preventDefault(); void createOrder(); }}>
          <div className="space-y-1.5 font-bold">
            <Label className="font-bold text-slate-700 text-xs">Select Resident *</Label>
            <SearchableResidentCombobox
              tenants={tenants}
              value={tenantId}
              onChange={(id) => setTenantId(id)}
            />
          </div>
          <div className="space-y-1.5"><Label className="font-bold text-slate-700 text-xs">Custom Amount (Optional)</Label><Input type="number" step="any" placeholder="Leave empty for full outstanding balance" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-10 border-slate-300 rounded-xl text-xs" /></div>
          <DialogFooter className="pt-2"><Button type="button" variant="outline" onClick={onClose} className="rounded-xl border-slate-300 font-bold cursor-pointer">Cancel</Button><Button type="submit" disabled={!tenantId || creating} loading={creating} className="bg-blue-600 hover:bg-blue-700 font-bold rounded-xl text-white cursor-pointer">Create Order Link</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function loadRazorpaySdk(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).Razorpay) { resolve((window as any).Razorpay); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve((window as any).Razorpay);
    script.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
    document.body.appendChild(script);
  });
}
