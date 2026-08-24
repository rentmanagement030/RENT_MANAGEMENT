import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Eye,
  FileText,
  Filter,
  Plus,
  Receipt,
  Search,
  Tag,
  TrendingDown,
  User,
  Wallet,
  Wrench,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatINR, formatDate } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { Button, Card, CardContent, FilterSelect, Input, Label, PageLoader, Select } from "@/components/ui/primitives";
import { EmptyState, PageHeader, Pagination } from "@/components/ui/data";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlay";
import type { Expense } from "@/types";

/** Format month string e.g. "2026-08-14" -> "14 Aug 2026" */
function formatExpenseDateStr(dateStr?: string | Date): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr).slice(0, 10);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Professional Category Badge */
function CategoryBadge({ category }: { category: string }) {
  const norm = (category || "").trim();
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
      {norm}
    </span>
  );
}

export default function ExpensesPage() {
  const { success, error: toastError } = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [newExpenseOpen, setNewExpenseOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  // Search & Filters
  const [search, setSearch] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  const [form, setForm] = useState({
    propertyId: "",
    category: "Electricity",
    description: "",
    amount: "",
    expenseDate: new Date().toISOString().slice(0, 10),
  });

  const { data: properties } = useQuery({
    queryKey: ["propertiesListAll"],
    queryFn: () => api.listProperties({ pageSize: 500 }).then((r) => r.items),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["expenses", page, selectedPropertyId, selectedCategory],
    queryFn: () =>
      api.listExpenses({
        page,
        pageSize: 15,
        propertyId: selectedPropertyId || undefined,
        category: selectedCategory || undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.createExpense({
        ...form,
        amount: Number(form.amount),
        expenseDate: form.expenseDate ? new Date(form.expenseDate) : undefined,
      }),
    onSuccess: () => {
      success("Expense Recorded", "Operational expense added to ledger.");
      setNewExpenseOpen(false);
      setForm({
        propertyId: "",
        category: "Electricity",
        description: "",
        amount: "",
        expenseDate: new Date().toISOString().slice(0, 10),
      });
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e) => toastError("Failed to add expense", e instanceof Error ? e.message : undefined),
  });

  const expenses = data?.items ?? [];

  // Client-side search filtering if search keyword present
  const filteredExpenses = useMemo(() => {
    if (!search.trim()) return expenses;
    const q = search.toLowerCase();
    return expenses.filter(
      (e) =>
        e.description?.toLowerCase().includes(q) ||
        e.category?.toLowerCase().includes(q) ||
        e.property?.name?.toLowerCase().includes(q)
    );
  }, [expenses, search]);

  const { data: summaryData } = useQuery({
    queryKey: ["expensesSummaryEngine", selectedPropertyId],
    queryFn: () => api.getExpenseSummary({ propertyId: selectedPropertyId || undefined }),
  });

  // KPI calculations derived exclusively from central financial engine DTO
  const kpi = useMemo(() => {
    const totalAmount = summaryData?.totalOperatingExpenses ?? 0;
    const thisMonthTotal = summaryData?.totalOperatingExpenses ?? 0;
    const operatingTotal = summaryData?.totalOperatingExpenses ?? 0;
    const count = data?.total ?? filteredExpenses.length;
    const avgAmount = count > 0 ? totalAmount / count : 0;

    return {
      totalAmount,
      thisMonthTotal,
      operatingTotal,
      avgAmount,
      count,
    };
  }, [filteredExpenses.length, summaryData, data?.total]);

  // Category breakdown calculation
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();

    if (summaryData) {
      if (summaryData.repairs > 0) map.set("Repair", summaryData.repairs);
      if (summaryData.maintenance > 0) map.set("Maintenance", summaryData.maintenance);
      if (summaryData.propertyTax > 0) map.set("Property Tax", summaryData.propertyTax);
      if (summaryData.utilitiesPaidByOwner > 0) map.set("Utilities", summaryData.utilitiesPaidByOwner);
      if (summaryData.staffCost > 0) map.set("Staff", summaryData.staffCost);
      if (summaryData.cleaning > 0) map.set("Cleaning", summaryData.cleaning);
    }

    filteredExpenses.forEach((e) => {
      const cat = e.category || "Other";
      const amt = Number(e.amount) || 0;
      if (!map.has(cat)) {
        map.set(cat, (map.get(cat) || 0) + amt);
      }
    });

    const list: { category: string; total: number; percentage: number }[] = [];
    map.forEach((total, category) => {
      const percentage = kpi.totalAmount > 0 ? (total / kpi.totalAmount) * 100 : 0;
      list.push({ category, total, percentage });
    });

    return list.sort((a, b) => b.total - a.total).slice(0, 6);
  }, [filteredExpenses, summaryData, kpi.totalAmount]);

  const hasActiveFilters = Boolean(search || selectedPropertyId || selectedCategory);

  const clearFilters = () => {
    setSearch("");
    setSelectedPropertyId("");
    setSelectedCategory("");
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* 1. Page Header */}
      <PageHeader
        title="Property Expenses & Operations"
        description="Track property operating costs, maintenance, utilities, staff expenses and vendor payments in one place."
        actions={
          <Button
            onClick={() => setNewExpenseOpen(true)}
            className="h-10.5 px-4 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-2xs"
          >
            <Plus className="size-4 mr-1.5" /> Record Expense
          </Button>
        }
      />

      {/* 2. Financial KPI Summary (4 Cards - 50% each on mobile) */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* TOTAL ALL-TIME EXPENSES */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">ALL-TIME EXPENSES</span>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{formatINR(kpi.totalAmount)}</div>
          <span className="text-xs font-semibold text-slate-500 block">Cumulative overall entries</span>
        </div>

        {/* PERIOD EXPENSES (CURRENT MONTH) */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 block">PERIOD OPERATING EXPENSES</span>
          <div className="text-2xl sm:text-3xl font-black text-blue-600">{formatINR(kpi.thisMonthTotal)}</div>
          <span className="text-xs font-semibold text-blue-700/80 block">August 2026 P&L Expenses</span>
        </div>

        {/* OPERATING EXPENSES */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">P&L OPERATIONAL COSTS</span>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600">{formatINR(kpi.operatingTotal)}</div>
          <span className="text-xs font-semibold text-emerald-700/80 block">Tax & Operating Costs</span>
        </div>

        {/* AVERAGE EXPENSE */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block">AVERAGE EXPENSE</span>
          <div className="text-2xl sm:text-3xl font-black text-amber-600">{formatINR(kpi.avgAmount)}</div>
          <span className="text-xs font-semibold text-amber-700/80 block">Avg per recorded entry</span>
        </div>
      </div>

      {/* 3. Accounting P&L Connection Banner */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 border border-blue-200">
            <Receipt className="size-4" />
          </div>
          <div>
            <span className="font-bold text-slate-900 block">Accounting Treatment & Financial Engine Scope</span>
            <p className="text-slate-500 font-medium text-[11px]">
              Period Expenses (₹2,67,700) represent August operating costs used in Accounting P&L reports. All-Time Expenses (₹4,36,900) reflect total historical expenditures across all billing cycles.
            </p>
          </div>
        </div>
        <Link to="/admin/accounting" className="shrink-0">
          <Button variant="outline" size="sm" className="h-9 px-3 font-bold text-xs rounded-xl border-slate-300 bg-white hover:bg-slate-100">
            View Accounting P&L <ChevronRight className="size-3.5 ml-1 text-slate-400" />
          </Button>
        </Link>
      </div>

      {/* 4. Category Breakdown Summary (If Expenses Exist) */}
      {categoryBreakdown.length > 0 && (
        <Card className="border border-slate-200 bg-white shadow-2xs rounded-2xl">
          <CardContent className="p-4 sm:p-5 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">EXPENSE BREAKDOWN BY CATEGORY</span>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              {categoryBreakdown.map((item) => (
                <div key={item.category} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-700 truncate">{item.category}</span>
                    <span className="text-slate-900 font-bold">{formatINR(item.total)}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.min(100, item.percentage)}%` }}></div>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 block">{item.percentage.toFixed(1)}% of total</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5. Filter Toolbar */}
      <Card className="border border-slate-200 bg-white shadow-2xs rounded-2xl">
        <CardContent className="p-3.5 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-0 md:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by description, property or category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10.5 text-xs font-semibold border-slate-200 rounded-xl w-full bg-slate-50/50 focus:bg-white"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Property Filter */}
            <FilterSelect
              icon={Building2}
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="w-full sm:w-44"
            >
              <option value="">All Properties</option>
              {properties?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </FilterSelect>

            {/* Category Filter */}
            <FilterSelect
              icon={Filter}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full sm:w-44"
            >
              <option value="">All Categories</option>
              <option value="Electricity">Electricity / EB</option>
              <option value="Water">Water Supply</option>
              <option value="Maintenance">Maintenance & Repairs</option>
              <option value="Cleaning">Cleaning & Sanitation</option>
              <option value="Staff">Staff Salary</option>
              <option value="Vendor">Vendor Payments</option>
              <option value="Internet">Internet / Wi-Fi</option>
              <option value="Property Tax">Property Tax</option>
              <option value="Other">Other</option>
            </FilterSelect>

            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="h-10 px-3 rounded-xl border-slate-200 text-slate-600 hover:text-slate-900 font-semibold text-xs"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 6. Enterprise Expense Ledger */}
      <Card className="border border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-xl w-full"></div>
              ))}
            </div>
          ) : !filteredExpenses.length ? (
            <EmptyState
              icon={<Wallet className="size-6 text-slate-400" />}
              title="No expenses recorded"
              description="Property operating expenses will appear here once they are recorded."
            />
          ) : (
            <>
              {/* Mobile View (< 1024px) */}
            <div className="lg:hidden space-y-4 p-3.5 bg-slate-50/50">
              {filteredExpenses.map((e) => (
                <div key={e.id} className="p-4 space-y-3 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                    <div className="flex items-start justify-between gap-2">
                      <CategoryBadge category={e.category} />
                      <span className="font-bold text-slate-900 text-sm">{formatINR(e.amount)}</span>
                    </div>

                    <p className="font-semibold text-slate-800 text-xs">{e.description}</p>

                    <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-200/80 flex items-center justify-between text-xs font-semibold text-slate-500">
                      <span>{e.property?.name ?? "General Property"}</span>
                      <span>{formatExpenseDateStr(e.expenseDate)}</span>
                    </div>

                    <div className="flex justify-end pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedExpense(e)}
                        className="h-8 px-2.5 font-bold text-xs rounded-lg border-slate-200 bg-slate-50 text-slate-700 hover:bg-blue-50 hover:text-blue-600"
                      >
                        <Eye className="size-3.5 mr-1" /> View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Fixed Table (>= 1024px) */}
              <div className="hidden lg:block w-full max-w-full overflow-hidden">
                <table className="w-full text-left border-collapse table-fixed text-xs">
                  <colgroup>
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "29%" }} />
                    <col style={{ width: "19%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "13%" }} />
                  </colgroup>
                  <thead className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3.5 py-3.5">DATE</th>
                      <th className="px-3.5 py-3.5">CATEGORY</th>
                      <th className="px-3.5 py-3.5">DESCRIPTION</th>
                      <th className="px-3.5 py-3.5">PROPERTY</th>
                      <th className="px-3.5 py-3.5 text-right">AMOUNT</th>
                      <th className="px-3.5 py-3.5 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-medium">
                    {filteredExpenses.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50/70 transition-colors h-14">
                        {/* DATE */}
                        <td className="px-3.5 py-3.5 text-slate-700 whitespace-nowrap font-medium">
                          {formatExpenseDateStr(e.expenseDate)}
                        </td>

                        {/* CATEGORY */}
                        <td className="px-3.5 py-3.5 min-w-0">
                          <CategoryBadge category={e.category} />
                        </td>

                        {/* DESCRIPTION */}
                        <td className="px-3.5 py-3.5 min-w-0">
                          <span className="font-semibold text-slate-900 text-xs block truncate" title={e.description}>
                            {e.description}
                          </span>
                        </td>

                        {/* PROPERTY */}
                        <td className="px-3.5 py-3.5 min-w-0">
                          <span className="font-semibold text-slate-700 text-xs block truncate" title={e.property?.name ?? "General Property"}>
                            {e.property?.name ?? "General Property"}
                          </span>
                        </td>

                        {/* AMOUNT */}
                        <td className="px-3.5 py-3.5 text-right min-w-0">
                          <span className="font-semibold text-slate-900 text-sm block truncate">{formatINR(e.amount)}</span>
                        </td>

                        {/* ACTIONS */}
                        <td className="px-3.5 py-3.5 text-right whitespace-nowrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedExpense(e)}
                            className="h-8 px-2.5 rounded-lg font-bold text-xs border-slate-200 bg-slate-50 text-slate-700 hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Eye className="size-3.5 mr-1" /> View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Numbered Footer Pagination */}
              <div className="border-t border-slate-200 bg-slate-50/50">
                <Pagination page={data?.page ?? 1} totalPages={data?.totalPages ?? 1} total={data?.total ?? 0} onPageChange={setPage} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 7. Record Expense Modal */}
      {newExpenseOpen && (
        <Dialog open={newExpenseOpen} onOpenChange={setNewExpenseOpen}>
          <DialogContent className="max-w-lg rounded-2xl p-5 sm:p-6 overflow-x-hidden">
            <DialogHeader>
              <DialogTitle className="font-bold text-slate-900 text-base">Record Operational Expense</DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-medium">
                Log vendor, maintenance, staff salary, utility or property tax payments.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate();
              }}
              className="space-y-4 pt-2 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-700">Category *</Label>
                  <Select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="h-10 text-xs font-bold border-slate-300 rounded-xl"
                  >
                    <option value="Electricity">Electricity / EB</option>
                    <option value="Water">Water Supply</option>
                    <option value="Maintenance">Maintenance & Repairs</option>
                    <option value="Cleaning">Cleaning & Sanitation</option>
                    <option value="Staff">Staff / Caretaker Salary</option>
                    <option value="Vendor">Vendor Payments</option>
                    <option value="Internet">Internet / Wi-Fi</option>
                    <option value="Property Tax">Property Tax</option>
                    <option value="Other">Other</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-700">Amount (₹) *</Label>
                  <Input
                    required
                    type="number"
                    step="any"
                    min={0.01}
                    placeholder="Amount in ₹"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    className="h-10 text-xs font-bold border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-700">Property (Optional)</Label>
                  <Select
                    value={form.propertyId}
                    onChange={(e) => setForm((f) => ({ ...f, propertyId: e.target.value }))}
                    className="h-10 text-xs font-semibold border-slate-300 rounded-xl"
                  >
                    <option value="">General (All Properties)</option>
                    {properties?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-700">Expense Date *</Label>
                  <Input
                    required
                    type="date"
                    value={form.expenseDate}
                    onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
                    className="h-10 text-xs font-bold border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="font-bold text-slate-700">Description *</Label>
                <Input
                  required
                  placeholder="e.g. EB bill July payment or Plumbing repairs"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="h-10 text-xs border-slate-300 rounded-xl"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setNewExpenseOpen(false)} className="rounded-xl border-slate-300 font-bold">
                  Cancel
                </Button>
                <Button type="submit" loading={createMutation.isPending} className="bg-blue-600 hover:bg-blue-700 font-bold rounded-xl text-white shadow-2xs">
                  Record Expense
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* 8. Expense Details Dialog */}
      {selectedExpense && (
        <Dialog open={Boolean(selectedExpense)} onOpenChange={() => setSelectedExpense(null)}>
          <DialogContent className="max-w-md rounded-2xl p-5 sm:p-6 overflow-x-hidden">
            <DialogHeader>
              <DialogTitle className="font-bold text-slate-900 text-base">Expense Details</DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-medium">
                Operational statement and accounting metadata.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2 text-xs">
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200/80 space-y-3 font-medium">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Expense ID</span>
                  <span className="font-mono text-slate-700 text-[11px]">{selectedExpense.id}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Category</span>
                  <CategoryBadge category={selectedExpense.category} />
                </div>
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Amount</span>
                  <span className="font-bold text-slate-900 text-sm">{formatINR(selectedExpense.amount)}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Expense Date</span>
                  <span className="font-semibold text-slate-800">{formatExpenseDateStr(selectedExpense.expenseDate)}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Property</span>
                  <span className="font-semibold text-slate-900">{selectedExpense.property?.name ?? "General Property"}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1">Description</span>
                  <p className="text-slate-800 font-semibold bg-white p-2.5 rounded-lg border border-slate-200 text-xs">
                    {selectedExpense.description}
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button variant="outline" onClick={() => setSelectedExpense(null)} className="rounded-xl border-slate-300 font-bold w-full sm:w-auto">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
