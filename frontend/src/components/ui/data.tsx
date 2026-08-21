import type { ReactNode } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Clock, Inbox, ShieldAlert, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from "./primitives";

// ---------- Page header ----------
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-2">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-xs sm:text-sm font-semibold text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

// ---------- Stat card ----------
export function StatCard({
  label,
  value,
  sub,
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("relative overflow-hidden border-slate-200/90 bg-white hover:border-slate-300 shadow-sm shadow-slate-200/50 transition-all", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-extrabold uppercase tracking-wider text-slate-500">{label}</CardTitle>
        {icon && <div className="text-slate-400">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{value}</div>
        {sub && <div className="mt-1.5 text-xs font-semibold text-slate-500">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-28" />
        <Skeleton className="mt-2 h-3 w-16" />
      </CardContent>
    </Card>
  );
}

// ---------- Status badge mapping ----------
const STATUS_TONE: Record<string, "success" | "warning" | "destructive" | "info" | "muted" | "secondary" | "outline" | "default"> = {
  SUCCESS: "success",
  VERIFIED: "success",
  REFUNDED: "info",
  PAID: "success",
  ACTIVE: "success",
  AVAILABLE: "success",
  OCCUPIED: "info",
  PENDING: "warning",
  PARTIAL: "warning",
  PENDING_VERIFICATION: "warning",
  OVERDUE: "destructive",
  FAILED: "destructive",
  REJECTED: "destructive",
  CANCELLED: "muted",
  PROCESSED: "success",
  EXPIRED: "muted",
  TERMINATED: "muted",
  FORMER: "muted",
  INACTIVE: "muted",
  MAINTENANCE: "warning",
  LOCKED: "destructive",
  RESOLVED: "success",
  IN_PROGRESS: "info",
  OPEN: "warning",
  SENT: "success",
  DONE: "success",
  RENEWED: "info",
  WAIVED: "muted",
  HOUSE: "info",
  PG: "secondary",
  SKIPPED: "muted",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "muted";
  return <Badge variant={tone}>{status.replace(/_/g, " ")}</Badge>;
}

// ---------- KYC status badge (tenant-level and document-level) ----------
type KycTone = "emerald" | "teal" | "amber" | "blue" | "rose" | "slate";

const KYC_TONE_BG: Record<KycTone, string> = {
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  teal: "bg-teal-50 text-teal-700 border-teal-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
};

const KYC_TONE_ICON: Record<KycTone, string> = {
  emerald: "text-emerald-600",
  teal: "text-teal-600",
  amber: "text-amber-600",
  blue: "text-blue-600",
  rose: "text-rose-600",
  slate: "text-slate-500",
};

export function KycStatusBadge({ status }: { status?: string }) {
  let Icon = Circle;
  let tone: KycTone = "slate";
  let label = "NOT STARTED";

  switch (status) {
    case "VERIFIED":
      Icon = CheckCircle2;
      tone = "emerald";
      label = "VERIFIED";
      break;
    case "AUTO_VERIFIED":
      Icon = CheckCircle2;
      tone = "teal";
      label = "AUTO VERIFIED";
      break;
    case "PARTIALLY_VERIFIED":
      Icon = ShieldAlert;
      tone = "blue";
      label = "PARTIALLY VERIFIED";
      break;
    case "DOCUMENTS_PENDING":
      Icon = Clock;
      tone = "blue";
      label = "DOCUMENTS PENDING";
      break;
    case "MANUAL_REVIEW":
      Icon = Clock;
      tone = "amber";
      label = "MANUAL REVIEW";
      break;
    case "PENDING":
      Icon = Clock;
      tone = "amber";
      label = "PENDING";
      break;
    case "REJECTED":
      Icon = XCircle;
      tone = "rose";
      label = "REJECTED";
      break;
    default:
      break;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold border ${KYC_TONE_BG[tone]}`}>
      <Icon className={`size-3.5 ${KYC_TONE_ICON[tone]}`} />
      {label}
    </span>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize = 10,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}) {
  const safeTotalPages = Math.max(totalPages, 1);
  const startItem = total !== undefined && total > 0 ? (page - 1) * pageSize + 1 : 0;
  const endItem = total !== undefined ? Math.min(page * pageSize, total) : 0;

  // Generate intelligent page numbers with ellipses
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (safeTotalPages <= 7) {
      for (let i = 1; i <= safeTotalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("...");
      const start = Math.max(2, page - 1);
      const end = Math.min(safeTotalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < safeTotalPages - 2) pages.push("...");
      pages.push(safeTotalPages);
    }
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 sm:px-6 border-t border-slate-200/80">
      <div className="text-xs font-semibold text-slate-500 text-center sm:text-left">
        {total !== undefined && total > 0 ? (
          <>
            Showing <span className="font-extrabold text-slate-900">{startItem}–{endItem}</span> of{" "}
            <span className="font-extrabold text-slate-900">{total}</span> records
          </>
        ) : (
          <>
            Page <span className="font-black text-blue-600">{page}</span> of {safeTotalPages}
          </>
        )}
      </div>

      <div className="flex items-center flex-wrap justify-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="min-h-[36px] px-2.5 font-bold text-xs rounded-lg border-slate-300 text-slate-700"
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
          <span className="hidden sm:inline ml-1">Previous</span>
        </Button>

        {pageNumbers.map((p, idx) => {
          if (p === "...") {
            return (
              <span key={`ellipsis-${idx}`} className="px-2 text-xs font-bold text-slate-400 select-none">
                ...
              </span>
            );
          }
          const num = p as number;
          const isActive = num === page;
          return (
            <button
              key={num}
              onClick={() => onPageChange(num)}
              className={`size-9 rounded-lg text-xs font-extrabold transition-all min-w-[36px] flex items-center justify-center ${
                isActive
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
              }`}
              aria-label={`Page ${num}`}
              aria-current={isActive ? "page" : undefined}
            >
              {num}
            </button>
          );
        })}

        <Button
          variant="outline"
          size="sm"
          disabled={page >= safeTotalPages || safeTotalPages === 0}
          onClick={() => onPageChange(page + 1)}
          className="min-h-[36px] px-2.5 font-bold text-xs rounded-lg border-slate-300 text-slate-700"
          aria-label="Next page"
        >
          <span className="hidden sm:inline mr-1">Next</span>
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

// ---------- Empty state ----------
export function EmptyState({ title, description, icon, action }: { title: string; description?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3.5 py-16 px-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-blue-600 shadow-xs">
        {icon ?? <Inbox className="size-7" />}
      </div>
      <div>
        <p className="text-base font-extrabold text-slate-900">{title}</p>
        {description && <p className="mt-1 max-w-sm text-xs font-semibold text-slate-500">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ---------- Table footer summary ----------
export function TableSummary({ items, keyOf, render }: { items: unknown[]; keyOf: string; render: (v: string) => ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-slate-200/80 px-4 py-3 text-xs text-slate-500 font-semibold">
      <span className="font-extrabold text-slate-900">Total:</span>
      {items.map((i) => {
        const v = String((i as Record<string, unknown>)[keyOf] ?? "");
        return (
          <Badge key={v} variant="secondary">
            {v}: {render(v)}
          </Badge>
        );
      })}
    </div>
  );
}

