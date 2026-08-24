import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  Banknote,
  BedDouble,
  BellRing,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Home,
  IndianRupee,
  Plus,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Wrench,
  AlertTriangle,
  ChevronRight,
  ShieldAlert,
  ArrowUpRight,
  Check,
  Receipt,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/lib/api";
import { formatCompact, formatINR, formatDate } from "@/lib/format";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { StatCardSkeleton, StatusBadge, EmptyState } from "@/components/ui/data";
import { useToast } from "@/components/ui/toast";

// Official WhatsApp SVG Icon Component
function WhatsAppIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function DashboardPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { success, error: toastError } = useToast();
  const [chartTimeframe, setChartTimeframe] = useState<"6" | "12">("6");

  // Load Real Dashboard API Data
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => api.dashboard() });

  const triggerRemindersMutation = useMutation({
    mutationFn: () => api.triggerTestScheduler(),
    onSuccess: () => {
      success("Automated Reminders Sent", "Backend scheduler evaluated rent dues and dispatched WhatsApp reminders.");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toastError("Reminder trigger error", e instanceof Error ? e.message : undefined),
  });

  const currentDateLabel = useMemo(() => {
    return new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, []);

  const s = data?.summary;

  // Chart data series slice (6 or 12 months)
  const collectionSeries = useMemo(() => {
    if (!data?.charts?.monthlyCollection) return [];
    const raw = data.charts.monthlyCollection.map((m) => ({
      ...m,
      label: `${MONTH_SHORT[Number(m.month.slice(5)) - 1]} '${m.month.slice(2, 4)}`,
    }));
    const count = Number(chartTimeframe);
    return raw.slice(-count);
  }, [data, chartTimeframe]);

  // Calculations
  const expectedTotal = useMemo(() => {
    if (!s) return 0;
    return s.totalBilled ?? (s.monthlyCollection + s.pendingRent + s.overdue);
  }, [s]);

  const collectionProgress = useMemo(() => {
    if (!s || expectedTotal <= 0) return 100;
    return s.collectionRate ?? Math.min(Math.round((s.monthlyCollection / expectedTotal) * 100), 100);
  }, [s, expectedTotal]);

  // Actionable Issues List for ATTENTION REQUIRED Section
  const attentionItems = useMemo(() => {
    if (!data || !s) return [];
    const items: Array<{
      id: string;
      title: string;
      description: string;
      actionText: string;
      link: string;
      type: "danger" | "warning" | "info";
      badge: string;
    }> = [];

    // 1. Overdue Rent
    if (s.overdue > 0) {
      items.push({
        id: "overdue",
        title: `${formatINR(s.overdue)} Overdue Rent`,
        description: "Outstanding rent past due date requiring immediate collection.",
        actionText: "View Outstanding",
        link: "/admin/payments?tab=outstanding",
        type: "danger",
        badge: "OVERDUE",
      });
    }

    // 2. Pending Rent Dues
    if (s.pendingRent > 0) {
      items.push({
        id: "pending",
        title: `${formatINR(s.pendingRent)} Pending Dues`,
        description: "Rent records generated and pending upcoming payment due dates.",
        actionText: "View Rent Records",
        link: "/admin/rent",
        type: "warning",
        badge: "PENDING",
      });
    }

    // 3. Expiring Agreements
    const expiringCount = data.recentActivity.expiringAgreements?.length ?? 0;
    if (expiringCount > 0) {
      items.push({
        id: "agreements",
        title: `${expiringCount} Agreement${expiringCount > 1 ? "s" : ""} Expiring Soon`,
        description: "Tenant rental agreements expiring within the next 30 days.",
        actionText: "View Agreements",
        link: "/admin/agreements",
        type: "info",
        badge: "EXPIRING",
      });
    }

    // 4. Units under maintenance
    const maintenanceCount = data.charts.occupancyByType.houses.maintenance ?? 0;
    if (maintenanceCount > 0) {
      items.push({
        id: "maintenance",
        title: `${maintenanceCount} Property Unit${maintenanceCount > 1 ? "s" : ""} Under Maintenance`,
        description: "Units marked for repair or maintenance requiring resolution.",
        actionText: "View Maintenance",
        link: "/admin/maintenance",
        type: "warning",
        badge: "REPAIR",
      });
    }

    return items;
  }, [data, s]);

  if (isLoading || !data || !s) {
    return (
      <div className="space-y-6 pb-12">
        <div className="h-16 bg-slate-100 animate-pulse rounded-2xl w-full"></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-slate-100 animate-pulse rounded-2xl w-full"></div>
          ))}
        </div>
        <div className="h-44 bg-slate-100 animate-pulse rounded-2xl w-full"></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Occupancy metrics
  const totalBeds = data.occupancy?.totalPropertyHomes ?? 0;
  const occupiedBeds = data.occupancy?.occupiedPropertyHomes ?? 0;
  const availableBeds = totalBeds - occupiedBeds;
  const pgBedPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  const houseTotal = data.occupancy?.totalHouseCapacity ?? 0;
  const houseOccupied = data.occupancy?.occupiedHouseCapacity ?? 0;
  const houseAvailable = data.occupancy?.availableHouseCapacity ?? 0;
  const houseMaintenance = 0; // Not heavily used for this breakdown
  const housePct = houseTotal > 0 ? Math.round((houseOccupied / houseTotal) * 100) : 0;

  const totalAvailableUnits = houseAvailable + availableBeds;

  return (
    <div className="space-y-5 sm:space-y-6 pb-12">
      {/* ========================================================================= */}
      {/* 1. HEADER */}
      {/* ========================================================================= */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">Dashboard</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
              <Calendar className="size-3 text-blue-600 shrink-0" /> {currentDateLabel}
            </span>
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-500">
            Property performance, rent collection and tenant activity at a glance.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-10 font-bold border-slate-200 bg-slate-50 text-slate-700 hover:bg-blue-50 hover:text-blue-600 rounded-xl text-xs"
            loading={triggerRemindersMutation.isPending}
            onClick={() => triggerRemindersMutation.mutate()}
            title="Trigger automated WhatsApp reminders"
          >
            <BellRing className="size-4 text-blue-600 mr-1.5" /> Notifications
          </Button>
          <Button
            size="sm"
            className="h-10 font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs text-xs px-4"
            onClick={() => navigate("/admin/payments?action=new")}
          >
            <IndianRupee className="size-4 mr-1" /> Collect Rent
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. QUICK ACTIONS BAR */}
      {/* ========================================================================= */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">QUICK ACTIONS</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5">
          {/* Action 1: Record Rent */}
          <button
            onClick={() => navigate("/admin/payments?action=new")}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-emerald-300 hover:bg-emerald-50/50 hover:shadow-xs active:scale-95 shadow-2xs group"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <IndianRupee className="size-4 font-bold" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-900 group-hover:text-emerald-900 truncate">Record Rent</p>
              <p className="text-[10px] font-semibold text-slate-500 truncate">Cash / UPI / Bank</p>
            </div>
          </button>

          {/* Action 2: Add Tenant */}
          <button
            onClick={() => navigate("/admin/tenants?action=new")}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-xs active:scale-95 shadow-2xs group"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-200 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <UserPlus className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-900 group-hover:text-blue-900 truncate">Add Tenant</p>
              <p className="text-[10px] font-semibold text-slate-500 truncate">New Onboarding</p>
            </div>
          </button>

          {/* Action 3: Add Property */}
          <button
            onClick={() => navigate("/admin/properties?action=new")}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-purple-300 hover:bg-purple-50/50 hover:shadow-xs active:scale-95 shadow-2xs group"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600 border border-purple-200 group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <Building2 className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-900 group-hover:text-purple-900 truncate">Add Property</p>
              <p className="text-[10px] font-semibold text-slate-500 truncate">PG or House</p>
            </div>
          </button>

          {/* Action 4: Generate Bills */}
          <button
            onClick={() => navigate("/admin/bills")}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-amber-300 hover:bg-amber-50/50 hover:shadow-xs active:scale-95 shadow-2xs group"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-200 group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <FileText className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-900 group-hover:text-amber-900 truncate">Generate Bills</p>
              <p className="text-[10px] font-semibold text-slate-500 truncate">Monthly Utilities</p>
            </div>
          </button>

          {/* Action 5: Maintenance */}
          <button
            onClick={() => navigate("/admin/maintenance")}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-rose-300 hover:bg-rose-50/50 hover:shadow-xs active:scale-95 shadow-2xs group col-span-2 sm:col-span-1"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 border border-rose-200 group-hover:bg-rose-600 group-hover:text-white transition-colors">
              <Wrench className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-900 group-hover:text-rose-900 truncate">Maintenance</p>
              <p className="text-[10px] font-semibold text-slate-500 truncate">Log Repair Issue</p>
            </div>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. PRIMARY COMPACT FINANCIAL KPI GRID (6 COLUMNS ON DESKTOP) */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">Financial Overview & Key Metrics</span>
          <span className="text-[11px] font-bold text-slate-400">Period: {currentDateLabel}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Card 1: Expected Revenue */}
          <Card className="border border-slate-200 bg-white p-3.5 rounded-2xl shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase text-slate-500">Expected Revenue</span>
              <div className="size-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <IndianRupee className="size-3.5 font-bold" />
              </div>
            </div>
            <div className="mt-1.5">
              <p className="text-lg sm:text-xl font-black text-slate-900">{formatINR(expectedTotal)}</p>
              <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Capacity: {formatINR((s as any).potentialRevenue ?? 256000)}</p>
            </div>
          </Card>

          {/* Card 3: Total Payment Inflow */}
          <Card className="border border-slate-200 bg-white p-3.5 rounded-2xl shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase text-blue-700">Payment Inflow</span>
              <div className="size-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Banknote className="size-3.5" />
              </div>
            </div>
            <div className="mt-1.5">
              <p className="text-lg sm:text-xl font-black text-blue-600">{formatINR(s.totalPaymentsReceived ?? s.monthlyCollection)}</p>
              <p className="text-[10px] font-medium text-slate-400 mt-0.5">{currentDateLabel} Received</p>
            </div>
          </Card>

          {/* Card 4: Outstanding Dues */}
          <Card className="border border-slate-200 bg-white p-3.5 rounded-2xl shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase text-rose-700">Outstanding</span>
              <div className="size-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="size-3.5" />
              </div>
            </div>
            <div className="mt-1.5">
              <p className="text-lg sm:text-xl font-black text-rose-600">{formatINR(s.outstanding)}</p>
              <p className="text-[10px] font-medium text-rose-700 mt-0.5">{formatINR(s.overdue)} Overdue</p>
            </div>
          </Card>

          {/* Card 6: Operating Expenses & P&L */}
          <Card className="border border-slate-200 bg-white p-3.5 rounded-2xl shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase text-amber-700">Period Expenses</span>
              <div className="size-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Receipt className="size-3.5" />
              </div>
            </div>
            <div className="mt-1.5">
              <p className="text-lg sm:text-xl font-black text-slate-900">{formatINR(s.periodOperatingExpenses || s.totalExpenses)}</p>
              <p className="text-[10px] font-medium text-amber-700 mt-0.5">{currentDateLabel} Expenses</p>
            </div>
          </Card>

          {/* Card 5: Overall Occupancy (100% width on mobile) */}
          <Card className="border border-slate-200 bg-white p-3.5 rounded-2xl shadow-2xs col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase text-blue-700">Occupancy</span>
              <div className="size-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <BedDouble className="size-3.5" />
              </div>
            </div>
            <div className="mt-1.5">
              <p className="text-lg sm:text-xl font-black text-blue-600">{s.occupancyRate}%</p>
              <p className="text-[10px] font-medium text-slate-400 mt-0.5">
                {data.occupancy?.occupiedCapacity ?? s.occupied} / {data.occupancy?.totalCapacity ?? (s.occupied + s.vacant)} Units
              </p>
            </div>
          </Card>
        </div>
      </div>



        {/* Occupancy Overview Breakdown (Two-Column Layout) */}
        <Card className="border border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-black text-slate-900">Occupancy Overview</CardTitle>
              <span className="text-xs font-extrabold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                {s.occupancyRate}% Total Capacity Occupied
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Multi House Occupancy */}
              <div className="space-y-2 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-900 flex items-center gap-1.5 font-black">
                    <span className="size-2 rounded-full bg-blue-600" />
                    MULTI HOUSE OCCUPANCY
                  </span>
                  <span className="text-blue-700 font-mono font-black">{occupiedBeds} / {totalBeds} houses ({pgBedPct}%)</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full bg-blue-600 transition-all duration-500 rounded-full"
                    style={{ width: `${pgBedPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-semibold text-slate-500 pt-0.5">
                  <span>Occupied: {occupiedBeds}</span>
                  <span>Available: {availableBeds}</span>
                </div>
              </div>

              {/* Right Column: Individual Villa Occupancy */}
              <div className="space-y-2 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-900 flex items-center gap-1.5 font-black">
                    <span className="size-2 rounded-full bg-emerald-600" />
                    INDIVIDUAL VILLA OCCUPANCY
                  </span>
                  <span className="text-emerald-700 font-mono font-black">{houseOccupied} / {houseTotal} villas ({housePct}%)</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full bg-emerald-600 transition-all duration-500 rounded-full"
                    style={{ width: `${housePct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-semibold text-slate-500 pt-0.5">
                  <span>Occupied: {houseOccupied}</span>
                  <span>Available: {houseAvailable}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      {/* ========================================================================= */}
      {/* 5. COLLECTION ANALYTICS (TREND CHART) */}
      {/* ========================================================================= */}
      <Card className="border border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100 bg-slate-50/50">
          <div>
            <CardTitle className="text-base font-black text-slate-900">Monthly Rent Collection Trend</CardTitle>
            <p className="text-xs font-semibold text-slate-500">Historical monthly collections across all properties</p>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setChartTimeframe("6")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                chartTimeframe === "6" ? "bg-white text-blue-600 shadow-2xs font-extrabold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              6 Months
            </button>
            <button
              onClick={() => setChartTimeframe("12")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                chartTimeframe === "12" ? "bg-white text-blue-600 shadow-2xs font-extrabold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              12 Months
            </button>
          </div>
        </CardHeader>
        <CardContent className="h-64 pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={collectionSeries} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="label" fontSize={11} stroke="#64748B" tickLine={false} axisLine={false} />
              <YAxis fontSize={11} stroke="#64748B" tickLine={false} axisLine={false} tickFormatter={(v) => formatCompact(v)} width={55} />
              <Tooltip
                formatter={(v: number) => [formatINR(v), "Collected Rent"]}
                contentStyle={{
                  backgroundColor: "#FFFFFF",
                  borderColor: "#E2E8F0",
                  borderRadius: "12px",
                  color: "#0F172A",
                  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                  fontWeight: "bold",
                }}
              />
              <Bar dataKey="total" fill="#2563EB" radius={[6, 6, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ========================================================================= */}
      {/* 6. ATTENTION REQUIRED */}
      {/* ========================================================================= */}
      <Card className="border border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600 border border-rose-200">
              <ShieldAlert className="size-4 font-bold" />
            </div>
            <CardTitle className="text-base font-black text-slate-900">ATTENTION REQUIRED</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          {attentionItems.length === 0 ? (
            <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80 flex items-center gap-3 text-emerald-900">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                <Check className="size-4 stroke-[3]" />
              </div>
              <div>
                <p className="font-extrabold text-xs text-emerald-950">All caught up</p>
                <p className="text-[11px] font-semibold text-emerald-700">No urgent actions require your attention today.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {attentionItems.map((item) => (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-3 transition-all ${
                    item.type === "danger"
                      ? "bg-rose-50/50 border-rose-200/90"
                      : item.type === "warning"
                      ? "bg-amber-50/50 border-amber-200/90"
                      : "bg-blue-50/50 border-blue-200/90"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-slate-900">{item.title}</span>
                      <span
                        className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                          item.type === "danger"
                            ? "bg-rose-100 text-rose-800"
                            : item.type === "warning"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold text-slate-600">{item.description}</p>
                  </div>

                  <div>
                    <Link
                      to={item.link}
                      className={`inline-flex items-center gap-1 font-extrabold text-xs ${
                        item.type === "danger"
                          ? "text-rose-700 hover:text-rose-900"
                          : item.type === "warning"
                          ? "text-amber-800 hover:text-amber-950"
                          : "text-blue-700 hover:text-blue-900"
                      }`}
                    >
                      {item.actionText} <ChevronRight className="size-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========================================================================= */}
      {/* 7. RECENT ACTIVITY (UPCOMING DUES & RECENT PAYMENTS) */}
      {/* ========================================================================= */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Dues */}
        <Card className="border border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden flex flex-col justify-between">
          <div>
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-sm font-black text-slate-900">Upcoming Dues</CardTitle>
              <Link to="/admin/rent" className="text-xs text-blue-600 font-extrabold hover:underline flex items-center gap-0.5">
                View all <ChevronRight className="size-3" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {data.recentActivity.upcomingDues.length === 0 ? (
                <div className="p-6">
                  <EmptyState title="Nothing due" description="No pending rent records currently due." />
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 text-xs">
                  {data.recentActivity.upcomingDues.slice(0, 5).map((d) => {
                    const message = encodeURIComponent(
                      `Hi ${d.tenant}, your rent of ${formatINR(d.outstanding)} for ${d.billingMonth} is pending (due ${d.dueDate.slice(
                        0,
                        10
                      )}). Kindly complete payment. Thank you!`
                    );
                    const cleanPhone = d.phone ? d.phone.replace(/\D/g, "") : "";
                    const initials = d.tenant ? d.tenant.slice(0, 2).toUpperCase() : "TN";

                    return (
                      <li key={d.id} className="flex items-center justify-between gap-3 p-3.5 hover:bg-slate-50/60 transition-colors">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="size-9 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-black text-xs flex items-center justify-center shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-black text-xs text-slate-900 truncate">{d.tenant}</p>
                            <p className="text-[11px] font-semibold text-slate-500 truncate">
                              Month: {d.billingMonth} · Due {toDateInput(d.dueDate)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          {cleanPhone && (
                            <a
                              href={`https://wa.me/91${cleanPhone}?text=${message}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex size-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 active:scale-95 transition-all"
                              title="Send WhatsApp Reminder"
                            >
                              <WhatsAppIcon className="size-4" />
                            </a>
                          )}
                          <div className="text-right">
                            <p className="text-xs font-black text-rose-600">{formatINR(d.outstanding)}</p>
                            <StatusBadge status={d.status ?? "PENDING"} />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </div>
        </Card>

        {/* Recent Payments */}
        <Card className="border border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden flex flex-col justify-between">
          <div>
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-sm font-black text-slate-900">Recent Payments</CardTitle>
              <Link to="/admin/payments" className="text-xs text-blue-600 font-extrabold hover:underline flex items-center gap-0.5">
                View all <ChevronRight className="size-3" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {data.recentActivity.payments.length === 0 ? (
                <div className="p-6">
                  <EmptyState title="No payments recorded yet" />
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 text-xs">
                  {data.recentActivity.payments.slice(0, 5).map((p) => {
                    const initials = p.tenant ? p.tenant.slice(0, 2).toUpperCase() : "TN";

                    return (
                      <li key={p.id} className="flex items-center justify-between gap-3 p-3.5 hover:bg-slate-50/60 transition-colors">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="size-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-black text-xs flex items-center justify-center shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-black text-xs text-slate-900 truncate">{p.tenant}</p>
                            <p className="text-[11px] font-semibold text-slate-500 truncate">
                              {p.method.replace(/_/g, " ")} · {toDateInput(p.date)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-black text-emerald-600">{formatINR(p.amount)}</span>
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                              p.status === "SUCCESS" || p.status === "VERIFIED"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {p.status}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </div>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* 8. AGREEMENT EXPIRY */}
      {/* ========================================================================= */}
      <Card className="border border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100 bg-slate-50/50">
          <CardTitle className="text-sm font-black text-slate-900">Expiring Agreements (Next 30 Days)</CardTitle>
          <Link to="/admin/agreements" className="text-xs text-blue-600 font-extrabold hover:underline flex items-center gap-0.5">
            Manage agreements <ChevronRight className="size-3" />
          </Link>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          {data.recentActivity.expiringAgreements.length === 0 ? (
            <div className="p-4 sm:p-6 text-center rounded-xl bg-slate-50/80 border border-slate-200 max-h-[180px] flex flex-col items-center justify-center space-y-1">
              <Clock className="size-6 text-slate-400 mb-1" />
              <p className="text-xs font-extrabold text-slate-900">No agreements expiring in the next 30 days.</p>
              <p className="text-[11px] font-semibold text-slate-500">All active tenant agreements are valid beyond the next 30 days.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 text-xs">
              {data.recentActivity.expiringAgreements.map((a) => {
                const expiryDate = new Date(a.endDate);
                const today = new Date();
                const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                return (
                  <li key={a.id} className="flex items-center justify-between py-3 hover:bg-slate-50/60 transition-colors">
                    <div className="space-y-0.5 min-w-0 pr-2">
                      <p className="font-black text-slate-900 text-xs truncate">{a.tenant}</p>
                      <p className="text-[11px] font-semibold text-slate-500 truncate">
                        {a.property} · Expires {toDateInput(a.endDate)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                        {diffDays > 0 ? `${diffDays} days remaining` : "Expires today"}
                      </span>
                      <Link
                        to={`/admin/agreements?search=${encodeURIComponent(a.tenant)}`}
                        className="inline-flex items-center gap-1 text-xs font-extrabold text-blue-600 hover:text-blue-800"
                      >
                        View <ArrowUpRight className="size-3.5" />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Helper Date Formatting Function
function toDateInput(d?: string | Date | null): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(0, 10);
}
