import { useState, useEffect } from "react";
import {
  Building2,
  Calendar,
  CreditCard,
  Download,
  FileCheck,
  FileText,
  Filter,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  Zap,
} from "lucide-react";
import { api, downloadUrl } from "@/lib/api";
import { TaxRecord, TaxStats, Property } from "@/types";
import { formatINR } from "@/lib/format";
import { Modal } from "@/components/ui/Modal";
import { Button, FilterSelect, Select } from "@/components/ui/primitives";

export function PropertyTaxesPage() {
  const [loading, setLoading] = useState(true);
  const [taxes, setTaxes] = useState<TaxRecord[]>([]);
  const [stats, setStats] = useState<TaxStats | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);

  // Filter states
  const [activeTab, setActiveTab] = useState<"ALL" | "PROPERTY_TAX" | "WATER_TAX">("ALL");
  const [search, setSearch] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  // Modals & Drawers
  const [addTaxModalOpen, setAddTaxModalOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [selectedTax, setSelectedTax] = useState<TaxRecord | null>(null);

  // Payment Form State
  const [payAmount, setPayAmount] = useState<number | "">("");
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [payMethod, setPayMethod] = useState<string>("UPI");
  const [payRefNo, setPayRefNo] = useState<string>("");
  const [payNotes, setPayNotes] = useState<string>("");
  const [submittingPay, setSubmittingPay] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Add Tax Form State
  const [newTaxType, setNewTaxType] = useState<"PROPERTY_TAX" | "WATER_TAX">("PROPERTY_TAX");
  const [newTaxOwnership, setNewTaxOwnership] = useState<"PROPERTY" | "HOME">("PROPERTY");
  const [newPropId, setNewPropId] = useState("");
  const [newHomeId, setNewHomeId] = useState("");
  const [newAssessmentNo, setNewAssessmentNo] = useState("");
  const [newConsumerNo, setNewConsumerNo] = useState("");
  const [newZone, setNewZone] = useState("");
  const [newDivision, setNewDivision] = useState("");
  const [newBillNo, setNewBillNo] = useState("");
  const [newAssesseeName, setNewAssesseeName] = useState("");
  const [newFrequency, setNewFrequency] = useState("ANNUAL");
  const [newAnnualAmount, setNewAnnualAmount] = useState<number | "">("");
  const [newPeriod, setNewPeriod] = useState("2026-27");
  const [newNextDueDate, setNewNextDueDate] = useState(new Date().toISOString().split("T")[0]);
  const [submittingAdd, setSubmittingAdd] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const filterParams = {
        search: search || undefined,
        propertyId: selectedPropertyId || undefined,
        taxType: activeTab !== "ALL" ? activeTab : undefined,
        status: selectedStatus || undefined,
      };

      const [statsRes, propsRes, taxRes] = await Promise.all([
        api.getTaxStats(filterParams),
        api.listProperties({ pageSize: 100 }),
        api.listTaxes({
          ...filterParams,
          pageSize: 100,
        }),
      ]);

      setStats(statsRes);
      setProperties(propsRes.items || []);
      const taxItems = Array.isArray(taxRes) ? taxRes : (taxRes as any)?.items || [];
      setTaxes(taxItems);
    } catch (err) {
      console.error("Failed to load tax data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, search, selectedPropertyId, selectedStatus]);

  const handleOpenPayModal = (tax: TaxRecord) => {
    setSelectedTax(tax);
    setPayAmount(tax.outstandingAmount);
    setPayDate(new Date().toISOString().split("T")[0]);
    setPayMethod("UPI");
    setPayRefNo("");
    setPayNotes("");
    setPayError(null);
    setPayModalOpen(true);
  };

  const handleOpenHistoryDrawer = async (tax: TaxRecord) => {
    setSelectedTax(tax);
    try {
      const fullTax = await api.getTaxRecord(tax.id);
      setSelectedTax(fullTax);
    } catch (err) {
      console.error(err);
    }
    setHistoryDrawerOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTax || !payAmount || Number(payAmount) <= 0) return;

    if (Number(payAmount) > selectedTax.outstandingAmount + 0.001) {
      setPayError("Payment cannot exceed the outstanding tax amount.");
      return;
    }

    setSubmittingPay(true);
    setPayError(null);
    try {
      await api.recordTaxPayment({
        taxRecordId: selectedTax.id,
        amount: Number(payAmount),
        paymentDate: payDate,
        paymentMethod: payMethod,
        referenceNumber: payRefNo,
        notes: payNotes,
      });

      setPayModalOpen(false);
      fetchData();
    } catch (err: any) {
      setPayError(err.message || "Failed to record payment");
    } finally {
      setSubmittingPay(false);
    }
  };

  const handleCreateTaxRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPropId || !newAnnualAmount) return;

    setSubmittingAdd(true);
    try {
      await api.createTaxRecord({
        taxType: newTaxType,
        taxOwnership: newTaxOwnership,
        propertyId: newPropId,
        homeId: newHomeId || undefined,
        assessmentNumber: newAssessmentNo || undefined,
        consumerNumber: newConsumerNo || undefined,
        zone: newZone || undefined,
        division: newDivision || undefined,
        billNumber: newBillNo || undefined,
        assesseeName: newAssesseeName || undefined,
        frequency: newFrequency,
        annualTaxAmount: Number(newAnnualAmount),
        currentTaxPeriod: newPeriod,
        nextDueDate: newNextDueDate,
      });

      setAddTaxModalOpen(false);
      fetchData();
    } catch (err) {
      console.error("Failed to create tax record", err);
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Preview calculations
  const numericPayAmt = Number(payAmount) || 0;
  const currentOut = selectedTax ? selectedTax.outstandingAmount : 0;
  const remainingOut = Math.max(0, currentOut - numericPayAmt);
  const isOverpaying = numericPayAmt > currentOut + 0.001;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Property Taxes & Utilities
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage property tax, water tax, electricity connections and payment deadlines across all properties.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAddTaxModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Tax / Utility
          </button>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Property Tax</span>
            <Building2 className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-lg sm:text-xl font-bold text-slate-900">
            {formatINR(stats?.propertyTaxDue || 0)}
          </p>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Water Tax</span>
            <Zap className="w-4 h-4 text-teal-600" />
          </div>
          <p className="text-lg sm:text-xl font-bold text-slate-900">
            {formatINR(stats?.waterTaxDue || 0)}
          </p>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Due Soon</span>
            <Calendar className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-lg sm:text-xl font-bold text-amber-600">
            {stats?.dueSoonCount || 0} Records
          </p>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Overdue</span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-lg sm:text-xl font-bold text-rose-600">
            {stats?.overdueCount || 0} Records
          </p>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-sm space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Paid This Month</span>
            <FileCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-lg sm:text-xl font-bold text-emerald-600">
            {formatINR(stats?.paidThisMonth || 0)}
          </p>
        </div>
      </div>

      {/* Tabs & Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("ALL")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === "ALL"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All Records
            </button>
            <button
              onClick={() => setActiveTab("PROPERTY_TAX")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === "PROPERTY_TAX"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Property Tax
            </button>
            <button
              onClick={() => setActiveTab("WATER_TAX")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === "WATER_TAX"
                  ? "bg-teal-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Water Tax
            </button>
          </div>

          <button
            onClick={fetchData}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {/* Filter inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
            <input
              type="text"
              placeholder="Search property, home, assessment no..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 text-xs sm:text-sm font-extrabold border border-slate-200 bg-slate-50/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white min-h-[44px]"
            />
          </div>

          <div>
            <FilterSelect
              icon={Building2}
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
            >
              <option value="">All Properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.city})
                </option>
              ))}
            </FilterSelect>
          </div>

          <div>
            <FilterSelect
              icon={Filter}
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="DUE">Due</option>
              <option value="PAID">Paid</option>
              <option value="OVERDUE">Overdue</option>
              <option value="PARTIAL">Partial</option>
            </FilterSelect>
          </div>
        </div>
      </div>

      {/* Tax Records Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            Loading tax & utility records...
          </div>
        ) : taxes.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <Receipt className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-medium text-slate-800 text-sm">No tax records found</p>
            <p className="text-xs text-slate-500">
              Click "+ Add Tax / Utility" to create a new property or water tax record.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card Stacked View (< 1024px) */}
            <div className="lg:hidden space-y-3 p-3 sm:p-4 bg-slate-50/50">
              {taxes.map((t) => {
                const status = t.derivedStatus || t.status;
                const isPaid = status === "PAID";
                const isOverdue = status === "OVERDUE";
                const isPartial = status === "PARTIAL";

                return (
                  <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div>
                        <h4 className="font-black text-sm text-slate-900">{t.property?.name || "N/A"}</h4>
                        {t.home && (
                          <p className="text-xs font-semibold text-slate-500 mt-0.5">Home: {t.home.homeNumber} ({t.home.floor})</p>
                        )}
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black ${
                        isPaid ? "bg-emerald-100 text-emerald-800" : isOverdue ? "bg-rose-100 text-rose-800" : isPartial ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                      }`}>
                        {status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Tax Type & Period</span>
                        <span className="font-bold text-slate-800 block mt-0.5">{t.taxType === "WATER_TAX" ? "Water Tax" : "Property Tax"} · {t.currentTaxPeriod}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Outstanding</span>
                        <span className="font-black text-rose-600 text-sm block mt-0.5">{formatINR(t.outstandingAmount)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-500 font-medium">Next Due: <strong className="text-slate-700">{new Date(t.nextDueDate).toLocaleDateString("en-IN")}</strong></span>
                      <div className="flex gap-2">
                        {!isPaid && (
                          <Button size="sm" onClick={() => handleOpenPayModal(t)} className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl">
                            Record Payment
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => handleOpenHistoryDrawer(t)} className="h-8 px-3 text-xs border-slate-300 text-slate-700 font-bold rounded-xl">
                          History
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Data Table (>= 1024px) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Property / Home</th>
                  <th className="px-4 py-3">Tax Type</th>
                  <th className="px-4 py-3">Account / Assessment</th>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3">Next Due</th>
                  <th className="px-4 py-3">Outstanding</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {taxes.map((t) => {
                  const status = t.derivedStatus || t.status;
                  const isPaid = status === "PAID";
                  const isOverdue = status === "OVERDUE";
                  const isPartial = status === "PARTIAL";

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        <div>{t.property?.name || "N/A"}</div>
                        {t.home && (
                          <div className="text-[11px] font-normal text-slate-500">
                            Home: {t.home.homeNumber} ({t.home.floor})
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                            t.taxType === "WATER_TAX"
                              ? "bg-teal-50 text-teal-700 border border-teal-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}
                        >
                          {t.taxType === "WATER_TAX" ? "Water Tax" : "Property Tax"}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-mono text-slate-800">
                          {t.assessmentNumber || t.consumerNumber || t.billNumber || "—"}
                        </div>
                        {t.assesseeName && (
                          <div className="text-[11px] text-slate-400">{t.assesseeName}</div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-slate-600 font-mono">
                        {t.currentTaxPeriod} ({t.frequency})
                      </td>

                      <td className="px-4 py-3 text-slate-800">
                        {new Date(t.nextDueDate).toLocaleDateString("en-IN")}
                      </td>

                      <td className="px-4 py-3 font-bold text-slate-900">
                        {formatINR(t.outstandingAmount)}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            isPaid
                              ? "bg-emerald-100 text-emerald-800"
                              : isOverdue
                              ? "bg-rose-100 text-rose-800"
                              : isPartial
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {status}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right space-x-2">
                        {!isPaid && (
                          <button
                            onClick={() => handleOpenPayModal(t)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold rounded shadow-xs"
                          >
                            Record Payment
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenHistoryDrawer(t)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded"
                        >
                          History
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>

      {/* Record Tax Payment Modal */}
      {selectedTax && (
        <Modal
          isOpen={payModalOpen}
          onClose={() => setPayModalOpen(false)}
          title={`Record ${selectedTax.taxType === "WATER_TAX" ? "Water Tax" : "Property Tax"} Payment`}
        >
          <form onSubmit={handleRecordPayment} className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>Property:</span>
                <span className="font-semibold text-slate-900">{selectedTax.property?.name}</span>
              </div>
              {selectedTax.home && (
                <div className="flex justify-between text-slate-600">
                  <span>Home / Unit:</span>
                  <span className="font-semibold text-slate-900">{selectedTax.home.homeNumber}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Tax Period:</span>
                <span className="font-semibold text-slate-900">{selectedTax.currentTaxPeriod}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Current Outstanding:</span>
                <span className="font-bold text-rose-600">{formatINR(selectedTax.outstandingAmount)}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Amount (₹)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={payAmount}
                onChange={(e) => {
                  const val = e.target.value ? parseFloat(e.target.value) : "";
                  setPayAmount(val);
                  setPayError(null);
                }}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                  isOverpaying ? "border-rose-500 focus:ring-rose-500" : "border-slate-300 focus:ring-blue-500"
                }`}
              />
            </div>

            {/* LIVE DYNAMIC PREVIEW */}
            <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200 text-xs space-y-1.5">
              <div className="font-bold text-blue-900 border-b border-blue-200 pb-1">
                Payment Breakdown Preview
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Payment Amount:</span>
                <span className="font-semibold text-emerald-700">{formatINR(numericPayAmt)}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Remaining Outstanding:</span>
                <span className="font-semibold text-slate-900">{formatINR(remainingOut)}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Next Tax Status:</span>
                <span className="font-bold text-blue-700">
                  {remainingOut <= 0 ? "PAID (Advances to next period)" : "PARTIAL (Period stays active)"}
                </span>
              </div>
            </div>

            {/* OVERPAYMENT ERROR PROTECTION */}
            {isOverpaying && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-700 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
                Payment cannot exceed the outstanding tax amount.
              </div>
            )}

            {payError && (
              <div className="p-2 bg-rose-50 text-rose-600 text-xs rounded border border-rose-200">
                {payError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Date
                </label>
                <input
                  type="date"
                  required
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Method
                </label>
                <Select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full text-xs"
                >
                  <option value="UPI">UPI</option>
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="OTHER">Other</option>
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reference / Transaction Number (Optional)
              </label>
              <input
                type="text"
                value={payRefNo}
                onChange={(e) => setPayRefNo(e.target.value)}
                placeholder="e.g. UPI/1029384756"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPayModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingPay || isOverpaying || numericPayAmt <= 0}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm"
              >
                {submittingPay ? "Saving..." : "Confirm & Save Payment"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Tax History Drawer */}
      {selectedTax && (
        <Modal
          isOpen={historyDrawerOpen}
          onClose={() => setHistoryDrawerOpen(false)}
          title={`Tax Payment History — ${selectedTax.property?.name}`}
        >
          <div className="space-y-4 text-xs">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
              <div>
                <span className="font-semibold text-slate-700">Assessment / Account:</span>{" "}
                <span className="font-mono">{selectedTax.assessmentNumber || selectedTax.consumerNumber || "N/A"}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-700">Tax Frequency:</span> {selectedTax.frequency}
              </div>
              <div>
                <span className="font-semibold text-slate-700">Current Tax Period:</span> {selectedTax.currentTaxPeriod}
              </div>
            </div>

            <h4 className="font-bold text-slate-900 text-sm">Past Payment Receipts</h4>

            {selectedTax.payments && selectedTax.payments.length > 0 ? (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2">Receipt No</th>
                      <th className="p-2">Date</th>
                      <th className="p-2">Period</th>
                      <th className="p-2">Amount</th>
                      <th className="p-2 text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedTax.payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="p-2 font-mono font-semibold text-slate-900">{p.receiptNumber}</td>
                        <td className="p-2">{new Date(p.paymentDate).toLocaleDateString("en-IN")}</td>
                        <td className="p-2 font-mono">{p.taxPeriod}</td>
                        <td className="p-2 font-bold text-emerald-700">{formatINR(p.amount)}</td>
                        <td className="p-2 text-right">
                          <a
                            href={downloadUrl(`/taxes/payments/${p.id}/receipt`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded font-semibold text-[11px]"
                          >
                            <Download className="w-3 h-3" /> PDF
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400">No payment receipts recorded yet for this record.</div>
            )}
          </div>
        </Modal>
      )}

      {/* Add Tax Modal */}
      <Modal
        isOpen={addTaxModalOpen}
        onClose={() => setAddTaxModalOpen(false)}
        title="Add Property or Water Tax Record"
      >
        <form onSubmit={handleCreateTaxRecord} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tax Type</label>
              <Select
                value={newTaxType}
                onChange={(e) => setNewTaxType(e.target.value as any)}
                className="w-full"
              >
                <option value="PROPERTY_TAX">Property Tax</option>
                <option value="WATER_TAX">Water Tax</option>
              </Select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Ownership</label>
              <Select
                value={newTaxOwnership}
                onChange={(e) => setNewTaxOwnership(e.target.value as any)}
                className="w-full"
              >
                <option value="PROPERTY">Property Level</option>
                <option value="HOME">Home Level</option>
              </Select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Property</label>
            <Select
              required
              value={newPropId}
              onChange={(e) => setNewPropId(e.target.value)}
              className="w-full"
            >
              <option value="">Select Property</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.city})
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {newTaxType === "WATER_TAX" ? "Consumer Number" : "Assessment Number"}
              </label>
              <input
                type="text"
                value={newTaxType === "WATER_TAX" ? newConsumerNo : newAssessmentNo}
                onChange={(e) =>
                  newTaxType === "WATER_TAX"
                    ? setNewConsumerNo(e.target.value)
                    : setNewAssessmentNo(e.target.value)
                }
                placeholder="e.g. PT-102938"
                className="w-full p-2 border border-slate-300 rounded"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tax Frequency</label>
              <Select
                value={newFrequency}
                onChange={(e) => setNewFrequency(e.target.value)}
                className="w-full"
              >
                <option value="ANNUAL">Annual (1 Year)</option>
                <option value="HALF_YEARLY">Half Yearly (6 Months)</option>
                <option value="QUARTERLY">Quarterly (3 Months)</option>
                <option value="BI_MONTHLY">Bi-Monthly (2 Months)</option>
                <option value="MONTHLY">Monthly (1 Month)</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tax Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                required
                value={newAnnualAmount}
                onChange={(e) => setNewAnnualAmount(e.target.value ? parseFloat(e.target.value) : "")}
                placeholder="18000"
                className="w-full p-2 border border-slate-300 rounded"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Current Tax Period</label>
              <input
                type="text"
                required
                value={newPeriod}
                onChange={(e) => setNewPeriod(e.target.value)}
                placeholder="2026-27"
                className="w-full p-2 border border-slate-300 rounded"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Next Due Date</label>
            <input
              type="date"
              required
              value={newNextDueDate}
              onChange={(e) => setNewNextDueDate(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setAddTaxModalOpen(false)}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingAdd}
              className="px-4 py-2 bg-blue-600 text-white font-semibold rounded shadow-sm hover:bg-blue-700"
            >
              {submittingAdd ? "Creating..." : "Create Record"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
