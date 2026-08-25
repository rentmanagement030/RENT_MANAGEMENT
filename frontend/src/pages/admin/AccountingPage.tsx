import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  Percent,
  PieChart,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, downloadUrl } from "@/lib/api";
import { currentMonth, formatINR } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FilterSelect,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/primitives";
import { EmptyState, PageHeader } from "@/components/ui/data";

export default function AccountingPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth());
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [showAllPropertiesInChart, setShowAllPropertiesInChart] = useState(false);

  // Calculate Date Boundaries for Month Filter
  const dateRange = useMemo(() => {
    if (!selectedMonth) return { from: undefined, to: undefined };
    const [y, m] = selectedMonth.split("-").map(Number);
    const from = new Date(Date.UTC(y, m - 1, 1)).toISOString();
    const to = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)).toISOString();
    return { from, to };
  }, [selectedMonth]);

  // Query 1: Properties List for Dropdown Filter
  const { data: propertiesData } = useQuery({
    queryKey: ["propertiesListAccounting"],
    queryFn: () => api.listProperties({ pageSize: 500 }),
  });
  const propertiesList = propertiesData?.items ?? [];

  // Query 2: Real System Profitability & Performance Report
  const {
    data: profitability,
    isLoading: loadingProf,
    isError: errorProf,
    refetch: refetchProf,
  } = useQuery({
    queryKey: ["profitabilityReport", selectedPropertyId, dateRange.from, dateRange.to],
    queryFn: () =>
      api.profitabilityReport({
        propertyId: selectedPropertyId || undefined,
        from: dateRange.from,
        to: dateRange.to,
      }),
  });

  // Query 3: Real Operating Expenses
  const {
    data: expensesData,
    isLoading: loadingExpenses,
  } = useQuery({
    queryKey: ["expensesReportAccounting", selectedPropertyId, dateRange.from, dateRange.to],
    queryFn: () =>
      api.listExpenses({
        pageSize: 500,
        propertyId: selectedPropertyId || undefined,
        from: dateRange.from,
        to: dateRange.to,
      }),
  });
  const expensesList = expensesData?.items ?? [];

  // Query 4: System Dashboard for Operational Baseline
  const { data: dashboardData } = useQuery({
    queryKey: ["dashboardDataAccounting"],
    queryFn: () => api.dashboard(),
  });

  // Financial Metrics Aggregations
  const summary = profitability?.summary;
  const propertyRows = profitability?.properties ?? [];

  const totalRevenue = summary?.expectedIncome ?? 0;
  const totalCollected = summary?.collectedIncome ?? 0;
  const totalExpenses = summary?.totalExpenses ?? 0;
  const totalOutstanding = summary?.totalOutstanding ?? 0;
  const netOperatingProfit = summary?.netIncome ?? (totalCollected - totalExpenses);

  const collectionRate =
    totalRevenue > 0
      ? Math.round((totalCollected / totalRevenue) * 100)
      : summary?.collectionRate ?? 0;

  const profitMargin =
    totalRevenue > 0
      ? ((netOperatingProfit / totalRevenue) * 100)
      : totalCollected > 0
      ? ((netOperatingProfit / totalCollected) * 100)
      : 0;

  // Expense Breakdown by Category
  const expenseBreakdown = useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    let sumAll = 0;

    expensesList.forEach((exp) => {
      const amt = Number(exp.amount || 0);
      const catKey = (exp.category || "OTHER").toUpperCase();
      categoryTotals[catKey] = (categoryTotals[catKey] || 0) + amt;
      sumAll += amt;
    });

    const categoryLabels: Record<string, string> = {
      REPAIRS: "Repairs & Maintenance",
      UTILITIES: "Utilities (EB & Water)",
      STAFF: "Staff Salaries & Wages",
      CLEANING: "Housekeeping & Cleaning",
      VENDOR: "Vendor Services",
      OTHER: "Other Expenses",
    };

    return Object.entries(categoryTotals)
      .map(([cat, amount]) => ({
        categoryKey: cat,
        label: categoryLabels[cat] || cat,
        amount,
        percentage: sumAll > 0 ? Math.round((amount / sumAll) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [expensesList]);

  // Chart Data for Revenue vs Expenses
  const chartData = useMemo(() => {
    if (propertyRows.length > 0) {
      const raw = propertyRows.map((p) => ({
        name: p.propertyName.length > 16 ? `${p.propertyName.slice(0, 16)}...` : p.propertyName,
        fullName: p.propertyName,
        Revenue: p.collectedIncome > 0 ? p.collectedIncome : p.expectedIncome,
        Expenses: p.totalExpenses,
        NetProfit: p.netIncome,
      }));
      return showAllPropertiesInChart ? raw : raw.slice(0, 5);
    }
    return [
      {
        name: selectedMonth || "Current Period",
        fullName: selectedMonth || "Current Period",
        Revenue: totalCollected > 0 ? totalCollected : totalRevenue,
        Expenses: totalExpenses,
        NetProfit: netOperatingProfit,
      },
    ];
  }, [propertyRows, showAllPropertiesInChart, totalCollected, totalRevenue, totalExpenses, netOperatingProfit, selectedMonth]);

  // Period Display Text
  const periodLabel = useMemo(() => {
    if (!selectedMonth) return "All Time";
    const [y, m] = selectedMonth.split("-").map(Number);
    const dateObj = new Date(y, m - 1, 1);
    return dateObj.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [selectedMonth]);

  const isLoading = loadingProf || loadingExpenses;

  // Render Error State
  if (errorProf) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Accounting & P&L"
          description="Track revenue, collections, expenses and profitability across your rental portfolio."
        />
        <Card className="border-rose-200 bg-rose-50/50 p-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-rose-100 text-rose-700 mb-3">
            <ShieldAlert className="size-6" />
          </div>
          <h3 className="text-base font-extrabold text-slate-900">Unable to load financial data</h3>
          <p className="mt-1 text-xs font-semibold text-slate-600">
            An unexpected connection error occurred while querying the financial ledger.
          </p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => refetchProf()}>
            <RefreshCw className="size-4" /> Try Again
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <PageHeader
        title="Accounting & P&L"
        description="Track revenue, collections, expenses and profitability across your rental portfolio."
        actions={
          <div className="flex flex-col gap-2 w-full md:w-auto md:flex-row md:items-center">
            {/* Filter Row: 50% each on mobile, auto on desktop */}
            <div className="grid grid-cols-2 gap-2 w-full md:w-auto">
              {/* Property Filter */}
              <div className="w-full md:w-52">
                <FilterSelect
                  icon={Building2}
                  value={selectedPropertyId}
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                  className="h-10 text-xs font-bold w-full rounded-xl"
                >
                  <option value="">All Properties</option>
                  {propertiesList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </FilterSelect>
              </div>

              {/* Month Filter */}
              <div className="flex items-center justify-between gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 h-10 text-xs font-bold text-slate-700 shadow-2xs w-full md:w-auto">
                <div className="flex items-center gap-1.5 min-w-0 w-full">
                  <Calendar className="size-3.5 text-slate-400 shrink-0" />
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer text-xs w-full"
                  />
                </div>
              </div>
            </div>

            {/* Export Buttons Row: 50% each on mobile, auto on desktop */}
            <div className="grid grid-cols-2 gap-2 w-full md:w-auto">
              <Button
                variant="outline"
                className="h-10 px-2 sm:px-3.5 rounded-xl font-bold text-[11px] sm:text-xs border-slate-300 text-slate-700 hover:bg-slate-50 shadow-2xs flex items-center justify-center truncate w-full"
                onClick={() =>
                  window.open(
                    downloadUrl(
                      `/ops/reports/collection/export?from=${dateRange.from || ""}&to=${dateRange.to || ""}&propertyId=${selectedPropertyId}`
                    ),
                    "_blank"
                  )
                }
              >
                <FileSpreadsheet className="size-3.5 mr-1 text-emerald-600 shrink-0" />
                <span className="truncate">Export Excel</span>
              </Button>

              <Button
                variant="outline"
                className="h-10 px-2 sm:px-3.5 rounded-xl font-bold text-[11px] sm:text-xs border-slate-300 text-slate-700 hover:bg-slate-50 shadow-2xs flex items-center justify-center truncate w-full"
                onClick={() => window.open(downloadUrl("/ops/reports/outstanding/export"), "_blank")}
              >
                <Download className="size-3.5 mr-1 text-blue-600 shrink-0" />
                <span className="truncate">Export PDF</span>
              </Button>
            </div>
          </div>
        }
      />

      {/* PRIMARY FINANCIAL KPIs (2x2 Grid on Mobile, 4-col on Desktop) */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-3 sm:p-4 space-y-2 sm:space-y-3">
              <Skeleton className="h-3 w-20 sm:w-28" />
              <Skeleton className="h-6 sm:h-7 w-28 sm:w-36" />
              <Skeleton className="h-3 w-16 sm:w-24" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
          {/* KPI 1: TOTAL / EXPECTED REVENUE */}
          <Card className="border border-slate-200/90 bg-white p-3 sm:p-5 shadow-xs transition-all hover:border-slate-300 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-500 truncate">
                {totalCollected > 0 ? "COLLECTED REVENUE" : "EXPECTED REVENUE"}
              </span>
              <div className="flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Wallet className="size-3.5 sm:size-4" />
              </div>
            </div>
            <div className="mt-2 sm:mt-3 text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight truncate">
              {formatINR(totalCollected > 0 ? totalCollected : totalRevenue)}
            </div>
            <div className="mt-1 text-[11px] sm:text-xs font-semibold text-slate-500 truncate">
              {totalCollected > 0
                ? `${periodLabel}`
                : `${periodLabel} (Projected)`}
            </div>
          </Card>

          {/* KPI 2: TOTAL COLLECTED */}
          <Card className="border border-slate-200/90 bg-white p-3 sm:p-5 shadow-xs transition-all hover:border-slate-300 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-500 truncate">
                TOTAL COLLECTED
              </span>
              <div className="flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="size-3.5 sm:size-4" />
              </div>
            </div>
            <div className="mt-2 sm:mt-3 text-xl sm:text-2xl lg:text-3xl font-black text-emerald-600 tracking-tight truncate">
              {formatINR(totalCollected)}
            </div>
            <div className="mt-1 text-[11px] sm:text-xs font-semibold text-emerald-700 flex items-center gap-1 truncate">
              <ArrowUpRight className="size-3 sm:size-3.5 shrink-0" />
              <span>{collectionRate.toFixed(1)}% collected</span>
            </div>
          </Card>

          {/* KPI 3: TOTAL EXPENSES */}
          <Card className="border border-slate-200/90 bg-white p-3 sm:p-5 shadow-xs transition-all hover:border-slate-300 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-500 truncate">
                TOTAL EXPENSES
              </span>
              <div className="flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <TrendingDown className="size-3.5 sm:size-4" />
              </div>
            </div>
            <div className="mt-2 sm:mt-3 text-xl sm:text-2xl lg:text-3xl font-black text-amber-600 tracking-tight truncate">
              {formatINR(totalExpenses)}
            </div>
            <div className="mt-1 text-[11px] sm:text-xs font-semibold text-slate-500 truncate">
              Operating expenses
            </div>
          </Card>

          {/* KPI 4: NET OPERATING PROFIT */}
          <Card
            className={`border p-3 sm:p-5 shadow-xs transition-all hover:border-slate-300 flex flex-col justify-between ${
              netOperatingProfit >= 0
                ? "border-emerald-200/80 bg-emerald-50/20"
                : "border-rose-200/80 bg-rose-50/20"
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-500 truncate">
                NET PROFIT
              </span>
              <div
                className={`flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-lg ${
                  netOperatingProfit >= 0
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-rose-100 text-rose-700"
                }`}
              >
                <TrendingUp className="size-3.5 sm:size-4" />
              </div>
            </div>
            <div
              className={`mt-2 sm:mt-3 text-xl sm:text-2xl lg:text-3xl font-black tracking-tight truncate ${
                netOperatingProfit >= 0 ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {formatINR(netOperatingProfit)}
            </div>
            <div className="mt-1 text-[11px] sm:text-xs font-semibold text-slate-600 truncate">
              Revenue - expenses
            </div>
          </Card>
        </div>
      )}

      {/* MAIN CONTENT GRID: CHART + PROFIT SUMMARY */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* REVENUE VS EXPENSES CHART */}
        <Card className="lg:col-span-2 border border-slate-200 bg-white shadow-xs">
          <CardHeader className="pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <BarChart3 className="size-4 text-blue-600" /> REVENUE VS EXPENSES
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Comparative financial breakdown across portfolio properties
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[10px] uppercase font-bold text-slate-600">
              {periodLabel}
            </Badge>
          </CardHeader>
          <CardContent className="p-5">
            {isLoading ? (
              <Skeleton className="h-64 w-full rounded-xl" />
            ) : chartData.length === 0 ? (
              <EmptyState
                title="No Financial Data"
                description="Financial information will appear here as transactions and expenses are recorded."
              />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#64748B", fontSize: 11, fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#64748B", fontSize: 11, fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(val: number) => [formatINR(val), ""]}
                      contentStyle={{
                        backgroundColor: "#0F172A",
                        borderColor: "#1E293B",
                        borderRadius: "12px",
                        color: "#F8FAFC",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: "11px", fontWeight: 700, paddingTop: "12px" }}
                    />
                    <Bar dataKey="Revenue" fill="#2563EB" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="Expenses" fill="#D97706" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="NetProfit" fill="#16A34A" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* PROFIT SUMMARY CARD */}
        <Card className="border border-slate-200 bg-white shadow-xs flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <PieChart className="size-4 text-emerald-600" /> PROFIT SUMMARY
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Net operating statement for {periodLabel}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="space-y-3 text-sm font-semibold">
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-600">Revenue (Expected)</span>
                <span className="font-extrabold text-slate-900">{formatINR(totalRevenue)}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-600">Collected Income</span>
                <span className="font-extrabold text-blue-600">{formatINR(totalCollected)}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-600">Operating Expenses</span>
                <span className="font-extrabold text-amber-600">
                  - {formatINR(totalExpenses)}
                </span>
              </div>

              <div className="border-t border-slate-200 pt-3 my-1">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-900 uppercase text-xs tracking-wider">
                    Net Operating Profit
                  </span>
                  <span
                    className={`text-lg font-black ${
                      netOperatingProfit >= 0 ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {formatINR(netOperatingProfit)}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold uppercase text-slate-500 tracking-wider">
                    Profit Margin
                  </span>
                  <span
                    className={`font-black ${
                      profitMargin >= 0 ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {profitMargin.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      profitMargin >= 0 ? "bg-emerald-600" : "bg-rose-600"
                    }`}
                    style={{ width: `${Math.min(Math.max(profitMargin, 0), 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PROPERTY PERFORMANCE TABLE */}
      <Card className="border border-slate-200 bg-white shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Building2 className="size-4 text-blue-600" /> PROPERTY PERFORMANCE
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Profitability, collections and operating margin per property
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-[11px] font-bold">
            {propertyRows.length} Properties
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : propertyRows.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No Financial Data"
                description="Financial information will appear here as transactions and expenses are recorded."
              />
            </div>
          ) : (
            <>
              {/* Mobile View (< 1024px) */}
              <div className="lg:hidden space-y-3 p-3.5 bg-slate-50/50">
                {propertyRows.map((p) => {
                  const margin = p.collectedIncome > 0 ? ((p.netIncome / p.collectedIncome) * 100).toFixed(1) : "0.0";
                  return (
                    <div key={p.propertyId} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="font-extrabold text-sm text-slate-900">{p.propertyName}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${Number(margin) >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                          {margin}% Margin
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-semibold">
                        <div>
                          <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Collected Revenue</span>
                          <span className="font-black text-emerald-600 block mt-0.5">{formatINR(p.collectedIncome)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Total Expenses</span>
                          <span className="font-black text-slate-900 block mt-0.5">{formatINR(p.totalExpenses)}</span>
                        </div>
                        <div className="col-span-2 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                          <span className="text-slate-500 font-medium">Net Income:</span>
                          <span className={`font-black text-sm ${p.netIncome >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatINR(p.netIncome)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop View (>= 1024px) */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px] font-extrabold uppercase text-slate-500">
                    PROPERTY
                  </TableHead>
                  <TableHead className="text-[11px] font-extrabold uppercase text-slate-500 text-right">
                    REVENUE
                  </TableHead>
                  <TableHead className="text-[11px] font-extrabold uppercase text-slate-500 text-right">
                    EXPENSES
                  </TableHead>
                  <TableHead className="text-[11px] font-extrabold uppercase text-slate-500 text-right">
                    NET PROFIT
                  </TableHead>
                  <TableHead className="text-[11px] font-extrabold uppercase text-slate-500 text-right">
                    MARGIN
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {propertyRows.map((p) => {
                  const margin =
                    p.collectedIncome > 0
                      ? ((p.netIncome / p.collectedIncome) * 100).toFixed(1)
                      : "0.0";
                  return (
                    <TableRow key={p.propertyId}>
                      <TableCell className="font-extrabold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{p.propertyName}</span>
                          <Badge variant="outline" className="text-[10px] font-bold text-slate-500">
                            {p.propertyType}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-extrabold text-slate-900">
                        {formatINR(p.collectedIncome)}
                      </TableCell>
                      <TableCell className="text-right font-extrabold text-amber-600">
                        {formatINR(p.totalExpenses)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-black ${
                          p.netIncome >= 0 ? "text-emerald-700" : "text-rose-700"
                        }`}
                      >
                        {formatINR(p.netIncome)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-700">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-xs ${
                            Number(margin) >= 50
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : Number(margin) >= 0
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {margin}%
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
        </CardContent>
      </Card>

      {/* LOWER SECTION: EXPENSE BREAKDOWN + COLLECTION PERFORMANCE + PORTFOLIO OPERATIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* EXPENSE BREAKDOWN */}
        <Card className="border border-slate-200 bg-white shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Layers className="size-4 text-amber-600" /> EXPENSE BREAKDOWN
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Categorized operational expenditure
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {isLoading ? (
              <Skeleton className="h-36 w-full" />
            ) : expenseBreakdown.length === 0 ? (
              <div className="py-6 text-center text-xs font-semibold text-slate-500">
                No expense entries logged for this period.
              </div>
            ) : (
              expenseBreakdown.map((exp) => (
                <div key={exp.categoryKey} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-700">{exp.label}</span>
                    <span className="text-slate-900">
                      {formatINR(exp.amount)}{" "}
                      <span className="text-slate-400 font-semibold">({exp.percentage}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full"
                      style={{ width: `${exp.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* COLLECTION PERFORMANCE */}
        <Card className="border border-slate-200 bg-white shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Activity className="size-4 text-blue-600" /> COLLECTION PERFORMANCE
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Receivables and dues progress
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-3 text-sm font-semibold">
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-600">Expected Revenue</span>
              <span className="font-extrabold text-slate-900">{formatINR(totalRevenue)}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-600">Collected</span>
              <span className="font-extrabold text-emerald-600">{formatINR(totalCollected)}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-600">Outstanding Dues</span>
              <span className="font-extrabold text-rose-600">{formatINR(totalOutstanding)}</span>
            </div>

            <div className="border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                <span className="uppercase text-slate-500 tracking-wider">Collection Rate</span>
                <span className="text-blue-700 font-black">{collectionRate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(Math.max(collectionRate, 0), 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PORTFOLIO OPERATIONS (OCCUPANCY) */}
        <Card className="border border-slate-200 bg-white shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Building2 className="size-4 text-purple-600" /> PORTFOLIO OPERATIONS
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Property & capacity statistics
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-3.5 text-sm font-semibold">
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-600">Total Properties</span>
              <span className="font-extrabold text-slate-900">
                {propertiesList.length || dashboardData?.summary?.totalProperties || 0}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-600">Occupied Beds / Units</span>
              <span className="font-extrabold text-emerald-700">
                {dashboardData?.summary?.occupied || 0}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-600">Vacant Capacity</span>
              <span className="font-extrabold text-amber-700">
                {dashboardData?.summary?.vacant || 0}
              </span>
            </div>

            <div className="border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                <span className="uppercase text-slate-500 tracking-wider">Occupancy Rate</span>
                <span className="text-purple-700 font-black">
                  {dashboardData?.summary?.occupancyRate || 0}%
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-purple-600 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(Math.max(dashboardData?.summary?.occupancyRate || 0, 0), 100)}%`,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

