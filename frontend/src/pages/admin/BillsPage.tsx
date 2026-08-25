import { useEffect, useState, useMemo, useRef, useLayoutEffect, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  FileText,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Ban,
  CreditCard,
  MoreVertical,
  Eye,
  Plus,
  Layers,
  RefreshCw,
  X,
  Trash2,
  Sparkles,
  HandCoins,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Filter,
  Zap,
  Droplets,
  Wrench,
  Tag,
  Activity,
} from "lucide-react";
import { api } from "@/lib/api";
import { currentMonth, formatDate, formatINR } from "@/lib/format";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePageResetOnFilter } from "@/hooks/usePageResetOnFilter";
import { useAuth } from "@/auth/AuthContext";
import { PERMISSIONS } from "@/lib/permissions";
import { FinancialSummaryBanner } from "@/components/ui/FinancialSummaryBanner";
import { cn } from "@/lib/utils";
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  PageLoader,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { EmptyState, Pagination } from "@/components/ui/data";
import { ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import type { Bill, BillType } from "@/types";

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

const BILL_TYPE_LABEL: Record<string, string> = {
  RENT: "Rent",
  EB: "Electricity (EB)",
  MAINTENANCE: "Maintenance",
  WATER: "Water",
  LATE_FEE: "Late Fee",
  PROPERTY_TAX: "Property Tax",
  OTHER: "Other",
};

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

function getDueDateStatus(dueDateStr: string, isPaid: boolean): { text: string; isOverdue: boolean } {
  if (isPaid) return { text: "Paid", isOverdue: false };
  if (!dueDateStr) return { text: "—", isOverdue: false };
  const due = new Date(dueDateStr);
  const now = new Date();
  const diffTime = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    return { text: `Overdue by ${absDays} day${absDays === 1 ? "" : "s"}`, isOverdue: true };
  }
  if (diffDays === 0) return { text: "Due today", isOverdue: false };
  return { text: `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`, isOverdue: false };
}

// -----------------------------------------------------------------------------
// Custom RentOk Professional Combobox Dropdown Component (Overflow-Safe)
// -----------------------------------------------------------------------------
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

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-xl border bg-white px-3.5 text-xs font-bold transition-all shadow-2xs hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20",
          value ? "border-blue-500/40 bg-blue-50/20 text-blue-950" : "border-slate-300 text-slate-800"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <HeaderIcon className={cn("size-4 shrink-0", value ? "text-blue-600" : "text-slate-400")} />
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

// -----------------------------------------------------------------------------
// Status Badge Component (Zero Truncation)
// -----------------------------------------------------------------------------
export function BillStatusBadge({ status }: { status: string }) {
  let bg = "bg-slate-100 text-slate-700 border-slate-200";
  let icon = <Clock className="size-3 shrink-0" />;
  let label = status;

  switch (status) {
    case "PAID":
      bg = "bg-emerald-50 text-emerald-700 border-emerald-200";
      icon = <CheckCircle2 className="size-3 text-emerald-600 shrink-0" />;
      label = "PAID";
      break;
    case "PARTIAL":
      bg = "bg-blue-50 text-blue-700 border-blue-200";
      icon = <Clock className="size-3 text-blue-600 shrink-0" />;
      label = "PARTIAL";
      break;
    case "PENDING":
      bg = "bg-amber-50 text-amber-700 border-amber-200";
      icon = <Clock className="size-3 text-amber-600 shrink-0" />;
      label = "PENDING";
      break;
    case "OVERDUE":
      bg = "bg-rose-50 text-rose-700 border-rose-200";
      icon = <AlertCircle className="size-3 text-rose-600 shrink-0" />;
      label = "OVERDUE";
      break;
    case "CANCELLED":
      bg = "bg-slate-100 text-slate-600 border-slate-200";
      icon = <Ban className="size-3 text-slate-500 shrink-0" />;
      label = "CANCELLED";
      break;
    default:
      break;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wider border whitespace-nowrap uppercase ${bg}`}>
      {icon}
      {label}
    </span>
  );
}

// -----------------------------------------------------------------------------
// Smart Portal Action Menu (Zero Clipping, Auto-Flipping Up/Down)
// -----------------------------------------------------------------------------
function BillActionMenu({
  bill,
  canManage,
  onView,
  onPay,
  onPenalty,
  onWaivePenalty,
  onCancel,
  onDelete,
}: {
  bill: Bill;
  canManage: boolean;
  onView: () => void;
  onPay: () => void;
  onPenalty: () => void;
  onWaivePenalty?: () => void;
  onCancel: () => void;
  onDelete: () => void;
  menuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
}) {
  const status = bill.status;
  const rawPhone = bill.tenant?.phone ?? "";
  const cleanPhone = rawPhone.replace(/\D/g, "");
  const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;
  const reminderMsg = encodeURIComponent(
    `Hello ${bill.tenant?.name ?? "Resident"},\n\nThis is a reminder regarding your rental bill for ${bill.property?.name ?? "Property"}.\n\nInvoice: ${bill.billNumber}\nBilling Period: ${bill.billingMonth}\nAmount Due: ${formatINR(bill.outstanding)}\nDue Date: ${formatDate(bill.dueDate ?? "")}\n\nPlease complete payment at your earliest convenience.\n\nThank you,\nC2D Rentals`
  );
  const waUrl = cleanPhone ? `https://wa.me/${formattedPhone}?text=${reminderMsg}` : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 active:scale-95 transition-all shadow-2xs shrink-0 cursor-pointer focus:outline-none"
          title="More Actions"
        >
          <MoreVertical className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 rounded-xl border border-slate-200 bg-white p-1 text-slate-700 shadow-2xl z-50">
        <DropdownMenuItem
          onClick={onView}
          className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-lg"
        >
          <Eye className="size-4 text-slate-400 shrink-0" /> View Bill Details
        </DropdownMenuItem>

        {Number(bill.outstanding) > 0 && status !== "CANCELLED" && (
          <DropdownMenuItem
            onClick={onPay}
            className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 rounded-lg"
          >
            <CreditCard className="size-4 text-blue-600 shrink-0" /> Record Payment
          </DropdownMenuItem>
        )}

        {waUrl && Number(bill.outstanding) > 0 && status !== "CANCELLED" && (
          <DropdownMenuItem asChild>
            <a
              href={waUrl}
              target="_blank"
              rel="noreferrer"
              className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 rounded-lg"
            >
              <WhatsAppIcon className="size-4 text-emerald-600 shrink-0" /> Send Reminder
            </a>
          </DropdownMenuItem>
        )}

        {canManage && status !== "CANCELLED" && (
          <>
            <DropdownMenuSeparator className="my-1 bg-slate-100" />
            {bill.billType === "RENT" && (status === "OVERDUE" || status === "PENDING" || status === "PARTIAL") && (
              <DropdownMenuItem
                onClick={onPenalty}
                className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50 rounded-lg"
              >
                <HandCoins className="size-4 text-amber-600 shrink-0" /> Apply Late Penalty
              </DropdownMenuItem>
            )}

            {bill.billType === "RENT" && onWaivePenalty && Number(bill.penaltyAmount || 0) > 0 && (
              <DropdownMenuItem
                onClick={onWaivePenalty}
                className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 rounded-lg"
              >
                <Sparkles className="size-4 text-emerald-600 shrink-0" /> Waive Penalty
              </DropdownMenuItem>
            )}

            {status !== "PAID" && (
              <DropdownMenuItem
                onClick={onCancel}
                className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 rounded-lg"
              >
                <Ban className="size-4 text-rose-600 shrink-0" /> Cancel Bill
              </DropdownMenuItem>
            )}
          </>
        )}

        {canManage && status === "CANCELLED" && (
          <>
            <DropdownMenuSeparator className="my-1 bg-slate-100" />
            <DropdownMenuItem
              onClick={onDelete}
              className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 rounded-lg"
            >
              <Trash2 className="size-4 text-rose-600 shrink-0" /> Delete Permanently
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function BillsPage() {
  const { can } = useAuth();
  const { success, error: toastError } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // State & Filters
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [billType, setBillType] = useState("");
  const [status, setStatus] = useState("");
  const [billingMonth, setBillingMonth] = useState(currentMonth());
  const debouncedSearch = useDebouncedValue(search);

  usePageResetOnFilter(setPage, search, billType, status, billingMonth);

  // Dialog States
  const [createOpen, setCreateOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [autoGenOpen, setAutoGenOpen] = useState(false);
  const [detailBill, setDetailBill] = useState<Bill | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Bill | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Bill | null>(null);
  const [penaltyTarget, setPenaltyTarget] = useState<Bill | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("action") === "new" && can(PERMISSIONS.RENT_MANAGE)) {
      setCreateOpen(true);
      searchParams.delete("action");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, can]);

  // Fetch Bills List
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["bills", page, debouncedSearch, billType, status, billingMonth],
    queryFn: () =>
      api.listBills({
        page,
        pageSize: 10,
        search: debouncedSearch || undefined,
        billType: billType || undefined,
        status: status || undefined,
        billingMonth: billingMonth || undefined,
      }),
  });

  // Fetch Summary Stats
  const summary = useQuery({
    queryKey: ["bill-summary", billingMonth],
    queryFn: () => api.billSummary({ billingMonth }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["bills"] });
    qc.invalidateQueries({ queryKey: ["bill-summary"] });
  };

  const genMutation = useMutation({
    mutationFn: (m: string) => api.generateBillsForMonth({ billingMonth: m }),
    onSuccess: (r) => {
      success("Bills generated", `${r.created} created, ${r.skipped} skipped for ${r.billingMonth}.`);
      setAutoGenOpen(false);
      invalidate();
    },
    onError: (e) => toastError("Generation failed", e instanceof Error ? e.message : undefined),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.cancelBill(id),
    onSuccess: () => {
      success("Bill marked as cancelled");
      setCancelTarget(null);
      invalidate();
    },
    onError: (e) => toastError("Could not cancel", e instanceof Error ? e.message : undefined),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteBillPermanently(id),
    onSuccess: () => {
      success("Cancelled bill permanently deleted");
      setDeleteTarget(null);
      invalidate();
    },
    onError: (e) => toastError("Could not delete", e instanceof Error ? e.message : undefined),
  });

  const penaltyMutation = useMutation({
    mutationFn: (id: string) => api.applyPenalty(id),
    onSuccess: () => {
      success("Late penalty applied");
      setPenaltyTarget(null);
      invalidate();
    },
    onError: (e) => toastError("Penalty failed", e instanceof Error ? e.message : undefined),
  });

  const waiveMutation = useMutation({
    mutationFn: (id: string) => api.waivePenalty(id),
    onSuccess: () => {
      success("Overdue penalty waived");
      invalidate();
    },
    onError: (e) => toastError("Waive failed", e instanceof Error ? e.message : undefined),
  });

  const summaryData = summary.data;
  const totalBilled = summaryData?.total ?? 0;
  const totalCollected = summaryData?.collected ?? 0;
  const totalOutstanding = summaryData?.outstanding ?? 0;
  const collectionRate = summaryData?.collectionRate ?? (totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0);

  const changeMonth = (delta: number) => {
    const current = billingMonth || currentMonth();
    const [y, m] = current.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const nextY = d.getFullYear();
    const nextM = String(d.getMonth() + 1).padStart(2, "0");
    setBillingMonth(`${nextY}-${nextM}`);
  };

  const typesOptions: FilterOption[] = [
    { label: "All Types", value: "", icon: <Layers className="size-4" /> },
    { label: "Rent", value: "RENT", icon: <Tag className="size-4 text-blue-500" /> },
    { label: "Electricity", value: "EB", icon: <Zap className="size-4 text-amber-500" /> },
    { label: "Maintenance", value: "MAINTENANCE", icon: <Wrench className="size-4 text-rose-500" /> },
    { label: "Water", value: "WATER", icon: <Droplets className="size-4 text-cyan-500" /> },
    { label: "Other", value: "OTHER", icon: <FileText className="size-4 text-purple-500" /> },
  ];

  const statusOptions: FilterOption[] = [
    { label: "All Statuses", value: "", icon: <Activity className="size-4" /> },
    { label: "Pending", value: "PENDING", icon: <Clock className="size-4 text-amber-500" /> },
    { label: "Partial", value: "PARTIAL", icon: <Clock className="size-4 text-blue-500" /> },
    { label: "Paid", value: "PAID", icon: <CheckCircle2 className="size-4 text-emerald-500" /> },
    { label: "Overdue", value: "OVERDUE", icon: <AlertCircle className="size-4 text-rose-500" /> },
    { label: "Cancelled", value: "CANCELLED", icon: <Ban className="size-4 text-slate-400" /> },
  ];

  const hasActiveFilters = !!(search || billType || status || billingMonth !== currentMonth());

  const clearAllFilters = () => {
    setSearch("");
    setBillType("");
    setStatus("");
    setBillingMonth(currentMonth());
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Page Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Bills & Invoices</h1>
          <p className="text-sm font-medium text-slate-500">
            Manage recurring rent, utilities, maintenance charges and invoice collections.
          </p>
        </div>

        {can(PERMISSIONS.RENT_MANAGE) && (
          <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:flex-wrap sm:items-center sm:gap-2.5">
            <Button
              onClick={() => setCreateOpen(true)}
              className="col-span-1 bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 sm:h-11 px-3 sm:px-4 rounded-xl shadow-xs active:scale-95 transition-all text-xs flex items-center justify-center truncate w-full"
            >
              <Plus className="size-4 stroke-[2.5] shrink-0" />
              <span className="truncate ml-1">Create Bill</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => setBatchOpen(true)}
              className="col-span-1 font-bold text-xs rounded-xl h-10 sm:h-11 px-3 sm:px-4 border-slate-300 bg-white text-slate-700 hover:bg-slate-50 flex items-center justify-center truncate w-full"
            >
              <Layers className="size-4 text-slate-500 mr-1 shrink-0" />
              <span className="truncate">Batch Bills</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => setAutoGenOpen(true)}
              className="col-span-2 sm:col-span-1 font-bold text-xs rounded-xl h-10 sm:h-11 px-3 sm:px-4 border-slate-300 bg-white text-slate-700 hover:bg-slate-50 flex items-center justify-center truncate w-full"
            >
              <Sparkles className="size-4 text-slate-500 mr-1 shrink-0" />
              <span className="truncate">Auto Generate</span>
            </Button>
          </div>
        )}
      </div>

      {/* 2. Financial Summary Banner (Unified Cross-Page Financial Banner) */}
      <FinancialSummaryBanner
        grossBilled={totalBilled}
        billedCollections={totalCollected}
        totalCashInflow={summaryData?.totalPaymentsReceived ?? totalCollected}
        totalOutstanding={totalOutstanding}
        billingMonthLabel={billingMonth ? `Billing Month ${billingMonth}` : "All Time"}
      />

      {/* 3. RentOk Style Single Filter Toolbar (Overflow-Visible for Dropdown Overlay) */}
      <Card className="border border-slate-200 bg-white shadow-2xs rounded-2xl overflow-visible relative z-30">
        <CardContent className="p-4 sm:p-5 space-y-3 overflow-visible relative z-30">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 items-center">
            {/* Search Input (40% width / lg:col-span-5) */}
            <div className="relative lg:col-span-5">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search invoice, tenant, property..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-11 text-slate-900 border-slate-300 font-bold rounded-xl text-sm"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {/* Month Selector (lg:col-span-3) */}
            <div className="flex items-center rounded-xl border border-slate-300 bg-slate-50 p-1 lg:col-span-3 h-11 shadow-2xs">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                className="flex size-9 items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 active:scale-95 transition-all"
                title="Previous Month"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="flex-1 text-center text-xs font-bold text-slate-900 truncate">
                {formatMonthLabel(billingMonth)}
              </span>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                className="flex size-9 items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 active:scale-95 transition-all"
                title="Next Month"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            {/* Custom RentOk Bill Type Dropdown (lg:col-span-2) */}
            <div className="lg:col-span-2">
              <RentOkFilterDropdown
                label="Bill Type"
                value={billType}
                options={typesOptions}
                onChange={(val) => setBillType(val)}
                placeholder="All Types"
                icon={Filter}
              />
            </div>

            {/* Custom RentOk Status Dropdown (lg:col-span-2) */}
            <div className="lg:col-span-2">
              <RentOkFilterDropdown
                label="Status"
                value={status}
                options={statusOptions}
                onChange={(val) => setStatus(val)}
                placeholder="All Statuses"
                icon={Activity}
              />
            </div>
          </div>

          {/* Active Filter Indicators */}
          {hasActiveFilters && (
            <div className="flex items-center flex-wrap gap-2 pt-2 border-t border-slate-100 text-xs">
              <span className="text-[11px] font-bold text-slate-500">Active Filters:</span>
              {billingMonth !== currentMonth() && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                  Month: {formatShortMonth(billingMonth)}
                </span>
              )}
              {search && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                  "{search}"
                </span>
              )}
              {billType && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
                  Type: {BILL_TYPE_LABEL[billType as BillType] ?? billType}
                </span>
              )}
              {status && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                  Status: {status}
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

      {/* 4. Primary Bills & Invoices Table Workspace */}
      <Card className="border border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton />
          ) : isError ? (
            <div className="p-8 text-center space-y-3">
              <AlertCircle className="size-10 text-rose-500 mx-auto" />
              <h3 className="text-base font-black text-slate-900">Unable to load bills</h3>
              <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
                Something went wrong while fetching billing records. Please retry.
              </p>
              <Button onClick={() => refetch()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 px-4 rounded-xl">
                <RefreshCw className="size-3.5 mr-1.5" /> Retry
              </Button>
            </div>
          ) : !data?.items.length ? (
            <EmptyState
              icon={<FileText className="size-8 text-slate-400" />}
              title="No bills found"
              description={
                hasActiveFilters
                  ? "There are no bills matching your current filters."
                  : "Generate monthly statements or create a bill to get started."
              }
              action={
                hasActiveFilters ? (
                  <Button onClick={clearAllFilters} variant="outline" className="font-bold border-slate-300 text-slate-700 rounded-xl">
                    Clear Filters
                  </Button>
                ) : (
                  can(PERMISSIONS.RENT_MANAGE) && (
                    <Button onClick={() => setCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl">
                      <Plus className="size-4 mr-1.5" /> Create Bill
                    </Button>
                  )
                )
              }
            />
          ) : (
            <>
              {/* RENTOK MOBILE CARDS VIEW (< 1024px) */}
              <div className="lg:hidden space-y-3 p-3 sm:p-4 bg-slate-50/50">
                {data.items.map((b) => {
                  const dueInfo = getDueDateStatus(b.dueDate, b.status === "PAID");

                  return (
                    <div
                      key={b.id}
                      className="rounded-2xl border border-slate-200/90 bg-white p-4 space-y-3.5 shadow-2xs hover:shadow-xs transition-all"
                    >
                      {/* Top Header: Bill ID & Status Badge */}
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => setDetailBill(b)}
                            className="font-mono text-xs font-black tracking-tight text-slate-900 hover:text-blue-600 truncate text-left"
                          >
                            {b.billNumber}
                          </button>
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200">
                            {BILL_TYPE_LABEL[b.billType] ?? b.billType}
                          </span>
                        </div>
                        <BillStatusBadge status={b.status} />
                      </div>

                      {/* Tenant & Property Details */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-sm font-black text-slate-900 truncate">{b.tenant?.name ?? "Unassigned"}</h4>
                          <p className="text-xs font-semibold text-slate-500 truncate mt-0.5">
                            {b.property?.name ?? "Property Unit"} {b.tenant?.phone ? `· ${b.tenant.phone}` : ""}
                          </p>
                        </div>

                        {/* Quick WhatsApp Reminder Button */}
                        {b.tenant?.phone && Number(b.outstanding) > 0 && b.status !== "CANCELLED" && (
                          <a
                            href={`https://wa.me/${b.tenant.phone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-600 hover:text-white transition-colors"
                            title="Send WhatsApp Reminder"
                          >
                            <WhatsAppIcon className="size-4" />
                          </a>
                        )}
                      </div>

                      {/* Financial Metrics Grid */}
                      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 border border-slate-200/80 text-xs font-semibold">
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                            Billed Amount
                          </span>
                          <span className="text-sm font-black text-slate-900 block mt-0.5">
                            {formatINR(b.amount)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                            Outstanding Dues
                          </span>
                          <span className={cn("text-sm font-black block mt-0.5", Number(b.outstanding) > 0 ? "text-rose-600" : "text-emerald-600")}>
                            {Number(b.outstanding) > 0 ? formatINR(b.outstanding) : "Fully Paid"}
                          </span>
                        </div>
                        <div className="col-span-2 pt-1 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">Billing Period: <strong className="text-slate-700">{formatShortMonth(b.billingMonth)}</strong></span>
                          <span className={cn("font-bold", dueInfo.isOverdue ? "text-rose-600" : "text-slate-600")}>
                            {dueInfo.text}
                          </span>
                        </div>
                      </div>

                      {/* Mobile Action Bar */}
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDetailBill(b)}
                          className="h-9 px-3.5 text-xs font-bold text-slate-700 border-slate-300 rounded-xl bg-white hover:bg-slate-50"
                        >
                          <Eye className="size-3.5 mr-1.5 text-slate-500" /> Details
                        </Button>

                        {Number(b.outstanding) > 0 && b.status !== "CANCELLED" && (
                          <Button
                            size="sm"
                            onClick={() => navigate(`/admin/payments?action=new&tenantId=${b.tenantId}&billId=${b.id}`)}
                            className="h-9 px-3.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs"
                          >
                            <CreditCard className="size-3.5 mr-1.5" /> Pay Rent
                          </Button>
                        )}

                        <BillActionMenu
                          bill={b}
                          canManage={can(PERMISSIONS.RENT_MANAGE)}
                          menuOpen={activeMenuId === b.id}
                          onMenuOpenChange={(open) => setActiveMenuId(open ? b.id : null)}
                          onView={() => setDetailBill(b)}
                          onPay={() => navigate(`/admin/payments?action=new&tenantId=${b.tenantId}&billId=${b.id}`)}
                          onPenalty={() => setPenaltyTarget(b)}
                          onWaivePenalty={() => waiveMutation.mutate(b.id)}
                          onCancel={() => setCancelTarget(b)}
                          onDelete={() => setDeleteTarget(b)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP DATA TABLE (>= 1024px) */}
              <div className="hidden lg:block w-full max-w-full overflow-hidden">
                <table className="w-full text-left border-collapse table-fixed text-xs">
                  <colgroup>
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "23%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "6%" }} />
                  </colgroup>
                  <thead className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-bold">BILL</th>
                      <th className="px-4 py-3 font-bold">TENANT / PROPERTY</th>
                      <th className="px-4 py-3 font-bold">TYPE</th>
                      <th className="px-4 py-3 font-bold">DUE DATE</th>
                      <th className="px-4 py-3 font-bold">AMOUNT</th>
                      <th className="px-4 py-3 font-bold">OUTSTANDING</th>
                      <th className="px-4 py-3 font-bold">STATUS</th>
                      <th className="px-3 py-3 font-bold text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 font-medium text-slate-800 bg-white">
                    {data.items.map((b) => {
                      const dueInfo = getDueDateStatus(b.dueDate, b.status === "PAID");

                      return (
                        <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* BILL # */}
                          <td className="px-4 py-3.5 align-middle">
                            <button
                              type="button"
                              onClick={() => setDetailBill(b)}
                              className="font-mono font-bold text-slate-900 hover:text-blue-600 transition-colors block text-left truncate max-w-full"
                              title={b.billNumber}
                            >
                              {b.billNumber}
                            </button>
                            <span className="text-[10px] text-slate-400 font-medium block truncate">
                              {dueInfo.text}
                            </span>
                          </td>

                          {/* TENANT / PROPERTY */}
                          <td className="px-4 py-3.5 align-middle">
                            <div className="font-bold text-slate-900 truncate max-w-full" title={b.tenant?.name ?? "Unassigned"}>
                              {b.tenant?.name ?? "Unassigned"}
                            </div>
                            <div className="text-[11px] text-slate-500 font-medium truncate max-w-full" title={b.property?.name ?? ""}>
                              {b.property?.name ?? "—"} {b.tenant?.phone ? `· ${b.tenant.phone}` : ""}
                            </div>
                          </td>

                          {/* TYPE */}
                          <td className="px-4 py-3.5 align-middle">
                            <span className="font-semibold text-slate-800 block truncate">
                              {BILL_TYPE_LABEL[b.billType] ?? b.billType}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium block truncate">
                              {formatShortMonth(b.billingMonth)}
                            </span>
                          </td>

                          {/* DUE DATE */}
                          <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                            <div className="font-bold text-slate-900">{formatDate(b.dueDate)}</div>
                            <div className={`text-[10px] font-bold ${dueInfo.isOverdue ? "text-rose-600" : "text-slate-500"}`}>
                              {dueInfo.text}
                            </div>
                          </td>

                          {/* AMOUNT */}
                          <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                            <span className="font-black text-slate-900">{formatINR(b.amount)}</span>
                          </td>

                          {/* OUTSTANDING */}
                          <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                            <span className={`font-black ${Number(b.outstanding) > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                              {formatINR(b.outstanding)}
                            </span>
                          </td>

                          {/* STATUS (Zero Truncation) */}
                          <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                            <BillStatusBadge status={b.status} />
                          </td>

                          {/* ACTIONS */}
                          <td className="px-3 py-3.5 align-middle text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDetailBill(b)}
                                className="h-8 px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-lg"
                              >
                                View
                              </Button>
                              <BillActionMenu
                                bill={b}
                                canManage={can(PERMISSIONS.RENT_MANAGE)}
                                menuOpen={activeMenuId === b.id}
                                onMenuOpenChange={(open) => setActiveMenuId(open ? b.id : null)}
                                onView={() => setDetailBill(b)}
                                onPay={() => navigate(`/admin/payments?action=new&tenantId=${b.tenantId}&billId=${b.id}`)}
                                onPenalty={() => setPenaltyTarget(b)}
                                onWaivePenalty={() => waiveMutation.mutate(b.id)}
                                onCancel={() => setCancelTarget(b)}
                                onDelete={() => setDeleteTarget(b)}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION */}
              <div className="border-t border-slate-200 p-3 sm:p-4 bg-slate-50/50">
                <Pagination
                  page={page}
                  totalPages={data.totalPages}
                  total={data.total}
                  pageSize={10}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* DIALOGS */}
      <CreateBillDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={invalidate} />
      <BatchBillDialog open={batchOpen} onOpenChange={setBatchOpen} onCreated={invalidate} />
      <BillDetailDialog bill={detailBill} onClose={() => setDetailBill(null)} onWaive={async (bId) => { await waiveMutation.mutateAsync(bId); }} />

      {/* CONFIRM: AUTO GENERATE */}
      <ConfirmDialog
        open={autoGenOpen}
        onOpenChange={setAutoGenOpen}
        title={`Auto-generate bills for ${formatMonthLabel(billingMonth)}?`}
        description="This will automatically create rent statements for all active tenants who do not have a bill for this month."
        confirmLabel="Generate Bills"
        loading={genMutation.isPending}
        onConfirm={() => genMutation.mutate(billingMonth)}
      />

      {/* CONFIRM: CANCEL BILL */}
      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(o) => !o && setCancelTarget(null)}
        title="Mark Bill as Cancelled?"
        description={`Are you sure you want to cancel invoice ${cancelTarget?.billNumber}? Cancelled bills are excluded from financial totals.`}
        confirmLabel="Cancel Bill"
        destructive={true}
        loading={cancelMutation.isPending}
        onConfirm={() => cancelTarget && cancelMutation.mutate(cancelTarget.id)}
      />

      {/* CONFIRM: DELETE PERMANENTLY */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete Cancelled Bill Permanently?"
        description={`This action will permanently delete ${deleteTarget?.billNumber}. This cannot be undone.`}
        confirmLabel="Delete Permanently"
        destructive={true}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />

      {/* CONFIRM: APPLY LATE PENALTY */}
      <ConfirmDialog
        open={!!penaltyTarget}
        onOpenChange={(o) => !o && setPenaltyTarget(null)}
        title="Apply Late Penalty to Rent Bill?"
        description={`Calculate and add late fee penalty for invoice ${penaltyTarget?.billNumber}? Penalty rate is defined during property/home creation.`}
        confirmLabel="Apply Penalty"
        loading={penaltyMutation.isPending}
        onConfirm={() => penaltyTarget && penaltyMutation.mutate(penaltyTarget.id)}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Dialog Implementations
// -----------------------------------------------------------------------------
function TableSkeleton() {
  return (
    <div className="p-4 space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-xl w-full"></div>
      ))}
    </div>
  );
}

function CreateBillDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const { success, error: toastError } = useToast();
  const [tenantId, setTenantId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [billType, setBillType] = useState<BillType>("EB");
  const [billingMonth, setBillingMonth] = useState(currentMonth());
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const tenants = useQuery({ queryKey: ["tenants", "options"], queryFn: () => api.listTenants({ pageSize: 500, status: "ACTIVE" }) });
  const properties = useQuery({ queryKey: ["properties", "options"], queryFn: () => api.listProperties({ pageSize: 500 }) });

  const handleSelectTenant = (tid: string) => {
    setTenantId(tid);
    if (!tid) return;
    const t = tenants.data?.items.find((x) => x.id === tid);
    if (t?.property) setPropertyId(t.property.id);
  };

  const handleBillTypeChange = (bt: BillType) => {
    setBillType(bt);
    if (bt === "OTHER" && !notes) setNotes("");
  };

  const mutation = useMutation({
    mutationFn: () =>
      api.createBill({
        tenantId,
        propertyId,
        billType,
        billingMonth,
        amount: Number(amount),
        dueDate,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      success("Bill created successfully");
      onOpenChange(false);
      setTenantId("");
      setPropertyId("");
      setAmount("");
      setNotes("");
      onCreated();
    },
    onError: (e) => toastError("Could not create bill", e instanceof Error ? e.message : undefined),
  });

  const valid = tenantId && propertyId && billType && amount && Number(amount) > 0 && dueDate && (billType !== "OTHER" || notes.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900">Create New Bill / Invoice</DialogTitle>
          <DialogDescription className="text-xs text-slate-500 font-medium">
            Generate an individual rent or utility charge statement for a resident.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4 pt-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) mutation.mutate();
          }}
        >
          <div className="grid gap-1.5">
            <Label className="text-xs font-bold text-slate-700">Bill Type *</Label>
            <Select value={billType} onChange={(e) => handleBillTypeChange(e.target.value as BillType)} className="h-10 font-bold text-slate-900 border-slate-300 rounded-xl">
              <option value="EB">Electricity (EB)</option>
              <option value="RENT">Rent</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="WATER">Water</option>
              <option value="OTHER">Other (Additional Charge)</option>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs font-bold text-slate-700">Select Resident *</Label>
            <Select value={tenantId} onChange={(e) => handleSelectTenant(e.target.value)} className="h-10 font-bold text-slate-900 border-slate-300 rounded-xl">
              <option value="">Select resident…</option>
              {tenants.data?.items.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.phone})</option>
              ))}
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs font-bold text-slate-700">Property Unit *</Label>
            <Select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="h-10 font-bold text-slate-900 border-slate-300 rounded-xl">
              <option value="">Select property…</option>
              {properties.data?.items.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.type === "HOUSE" ? "House" : "PG"})</option>
              ))}
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs font-bold text-slate-700">Bill Amount (₹) *</Label>
            <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 1500" className="h-10 font-extrabold text-blue-600 border-slate-300 rounded-xl" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs font-bold text-slate-700">Billing Month *</Label>
              <Input type="month" value={billingMonth} onChange={(e) => setBillingMonth(e.target.value)} className="h-10 font-bold border-slate-300 rounded-xl" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-bold text-slate-700">Due Date *</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-10 font-bold border-slate-300 rounded-xl cursor-pointer" />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs font-bold text-slate-700">
              Purpose & Notes {billType === "OTHER" ? <span className="text-rose-600 font-bold">* (Required for OTHER bill type)</span> : "(Optional)"}
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={billType === "OTHER" ? "Enter specific purpose (e.g., Key Replacement, Damage Repair, Extra Maintenance)..." : "Optional notes or comments..."}
              className={`border-slate-300 rounded-xl text-xs ${billType === "OTHER" && !notes.trim() ? "border-amber-300 bg-amber-50/50" : ""}`}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl border-slate-300 font-bold">Cancel</Button>
            <Button type="submit" disabled={!valid || mutation.isPending} loading={mutation.isPending} className="bg-blue-600 hover:bg-blue-700 font-bold rounded-xl text-white">Create Bill</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BatchBillDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (created: number, skipped: number) => void }) {
  const { success, error: toastError } = useToast();
  const [billingMonth, setBillingMonth] = useState(currentMonth());
  const [rows, setRows] = useState<{ key: number; tenantId: string; billType: BillType; amount: string; dueDate: string }[]>([
    { key: 1, tenantId: "", billType: "EB", amount: "", dueDate: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10) },
  ]);

  const tenants = useQuery({ queryKey: ["tenants", "options"], queryFn: () => api.listTenants({ pageSize: 500, status: "ACTIVE" }) });
  const nextKey = useMemo(() => Math.max(0, ...rows.map((r) => r.key)) + 1, [rows]);

  const mutation = useMutation({
    mutationFn: () =>
      api.createBillsBatch({
        billingMonth,
        bills: rows.map((r) => ({
          tenantId: r.tenantId,
          billType: r.billType,
          amount: Number(r.amount),
          dueDate: r.dueDate,
        })),
      }),
    onSuccess: (r) => {
      success("Batch bills created", `${r.created} created, ${r.skipped} skipped for ${r.billingMonth}.`);
      onCreated(r.created, r.skipped);
      setRows([{ key: nextKey, tenantId: "", billType: "EB", amount: "", dueDate: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10) }]);
    },
    onError: (e) => toastError("Creation failed", e instanceof Error ? e.message : undefined),
  });

  const valid = billingMonth && rows.length > 0 && rows.every((r) => r.tenantId && r.amount && Number(r.amount) > 0 && r.dueDate);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl rounded-2xl p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900">Batch Create Utility Bills</DialogTitle>
          <DialogDescription className="text-xs text-slate-500 font-medium">
            Create multiple utility bills at once. Tenant properties are resolved automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2 text-xs">
          <div className="grid gap-1.5 max-w-xs">
            <Label className="text-xs font-bold text-slate-700">Billing Month</Label>
            <Input type="month" value={billingMonth} onChange={(e) => setBillingMonth(e.target.value)} className="h-10 font-bold border-slate-300 rounded-xl" />
          </div>

          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.key} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_7rem_7rem_9rem_2rem]">
                <div className="grid gap-1">
                  <Label className="text-[11px] font-bold text-slate-700">Tenant</Label>
                  <Select value={row.tenantId} onChange={(e) => setRows((rs) => rs.map((x) => (x.key === row.key ? { ...x, tenantId: e.target.value } : x)))} className="h-9 text-xs font-semibold rounded-lg border-slate-300">
                    <option value="">Select tenant…</option>
                    {tenants.data?.items.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.phone})</option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label className="text-[11px] font-bold text-slate-700">Type</Label>
                  <Select value={row.billType} onChange={(e) => setRows((rs) => rs.map((x) => (x.key === row.key ? { ...x, billType: e.target.value as BillType } : x)))} className="h-9 text-xs font-semibold rounded-lg border-slate-300">
                    <option value="EB">EB</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="WATER">Water</option>
                    <option value="OTHER">Other</option>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label className="text-[11px] font-bold text-slate-700">Amount (₹)</Label>
                  <Input type="number" min="0" step="0.01" value={row.amount} onChange={(e) => setRows((rs) => rs.map((x) => (x.key === row.key ? { ...x, amount: e.target.value } : x)))} placeholder="1500" className="h-9 text-xs font-bold rounded-lg border-slate-300" />
                </div>
                <div className="grid gap-1">
                  <Label className="text-[11px] font-bold text-slate-700">Due Date</Label>
                  <Input type="date" value={row.dueDate} onChange={(e) => setRows((rs) => rs.map((x) => (x.key === row.key ? { ...x, dueDate: e.target.value } : x)))} className="h-9 text-xs font-semibold rounded-lg border-slate-300 cursor-pointer" />
                </div>
                <div className="flex items-end pb-0.5">
                  <Button type="button" variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50 h-9 w-9 p-0" disabled={rows.length <= 1} onClick={() => setRows((rs) => rs.filter((x) => x.key !== row.key))}>
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, { key: nextKey, tenantId: "", billType: "EB", amount: "", dueDate: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10) }])} className="font-bold border-slate-300 rounded-xl h-9 text-xs">
            <Plus className="size-3.5 mr-1" /> Add Bill Line
          </Button>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl border-slate-300 font-bold">Cancel</Button>
          <Button disabled={!valid || mutation.isPending} loading={mutation.isPending} onClick={() => mutation.mutate()} className="bg-blue-600 hover:bg-blue-700 font-bold rounded-xl text-white">
            Create {rows.length} Bill{rows.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BillDetailDialog({ bill, onClose, onWaive }: { bill: Bill | null; onClose: () => void; onWaive: (billId: string) => Promise<void> }) {
  const { success, error: toastError } = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ["bill", bill?.id],
    queryFn: () => (bill ? api.getBill(bill.id) : Promise.resolve(null)),
    enabled: !!bill,
  });

  const b = data ?? bill;

  return (
    <Dialog open={!!bill} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg rounded-2xl p-5 sm:p-6">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-slate-500 uppercase">C2D RENTALS · INVOICE</span>
            <BillStatusBadge status={b?.status ?? "PENDING"} />
          </div>
          <DialogTitle className="text-lg font-bold text-slate-900 mt-1">Invoice {b?.billNumber}</DialogTitle>
          <DialogDescription className="text-xs font-semibold text-slate-500">
            {b?.billingMonth} · {BILL_TYPE_LABEL[b?.billType as BillType] ?? b?.billType}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <PageLoader />
        ) : b ? (
          <div className="space-y-4 text-xs pt-1">
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 font-medium">
              <div><Label className="text-slate-400 text-[10px] uppercase font-bold block">Tenant</Label><p className="font-bold text-slate-900">{b.tenant?.name}</p></div>
              <div><Label className="text-slate-400 text-[10px] uppercase font-bold block">Property</Label><p className="font-semibold text-slate-900">{b.property?.name}</p></div>
              <div><Label className="text-slate-400 text-[10px] uppercase font-bold block">Due Date</Label><p className="font-semibold text-slate-800">{formatDate(b.dueDate)}</p></div>
              <div><Label className="text-slate-400 text-[10px] uppercase font-bold block">Billing Period</Label><p className="font-semibold text-slate-800">{formatMonthLabel(b.billingMonth)}</p></div>
            </div>

            {b.items && b.items.length > 0 && (
              <div>
                <Label className="font-bold text-[10px] uppercase text-slate-400 block mb-1">Line Items</Label>
                <div className="divide-y rounded-xl border border-slate-200 bg-white overflow-hidden">
                  {b.items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between px-3 py-2 text-xs">
                      <span className="font-semibold text-slate-800">{it.description} <span className="text-slate-400">× {it.quantity}</span></span>
                      <span className="font-bold text-slate-900">{formatINR(it.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 font-medium">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal Amount:</span>
                <span className="font-bold text-slate-900">{formatINR(b.amount)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Late Penalty Fee:</span>
                <span className="font-bold text-amber-600">{formatINR(b.penaltyAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-900 border-t border-slate-200 pt-1.5 font-black text-sm">
                <span>Total Outstanding Dues:</span>
                <span className={Number(b.outstanding) > 0 ? "text-rose-600" : "text-emerald-600"}>{formatINR(b.outstanding)}</span>
              </div>
            </div>

            {(b.penalties ?? []).length > 0 && (
              <div>
                <Label className="font-bold text-[10px] uppercase text-slate-400 block mb-1">Penalties Breakdown</Label>
                <div className="divide-y rounded-xl border border-slate-200 overflow-hidden">
                  {b.penalties?.map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-3 py-2 text-xs">
                      <span className="font-semibold text-slate-800">{formatINR(p.amount)} · {p.daysOverdue} day{p.daysOverdue === 1 ? "" : "s"} overdue</span>
                      {p.status === "ACTIVE" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="font-bold text-xs text-rose-600 border-rose-200 hover:bg-rose-50 rounded-lg h-7"
                          onClick={async () => {
                            try {
                              await onWaive(b.id);
                              success("Penalty waived");
                            } catch (e) {
                              toastError("Failed to waive", e instanceof Error ? e.message : undefined);
                            }
                          }}
                        >
                          Waive
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {b.notes && <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">{b.notes}</p>}
          </div>
        ) : null}

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl border-slate-300 font-bold">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
