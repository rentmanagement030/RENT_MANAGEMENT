import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  LogOut,
  CreditCard,
  FileText,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Plus,
  Receipt,
  Download,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  Home,
} from "lucide-react";
import { api, getTenantToken, clearTenantToken } from "@/lib/api";
import { formatINR, formatDate } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { Button, Card, CardContent, CardHeader, CardTitle, PageLoader, Input, Label } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/data";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlay";
import { ImageLightboxModal, LightboxImage } from "@/components/ui/ImageLightboxModal";

export default function TenantDashboardPage() {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const qc = useQueryClient();

  const [paying, setPaying] = useState(false);
  const [raisingMaintenance, setRaisingMaintenance] = useState(false);
  const [maintenanceForm, setMaintenanceForm] = useState({ description: "" });
  const [lightboxImages, setLightboxImages] = useState<LightboxImage[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);

  const token = getTenantToken();

  useEffect(() => {
    if (!token) {
      navigate("/tenant/login", { replace: true });
    }
  }, [token, navigate]);

  // Fetch tenant profile & stay details + ledger + payment history + rent records + maintenance
  const { data: meData, isLoading: meLoading } = useQuery({
    queryKey: ["tenantMe"],
    enabled: !!token,
    queryFn: () => api.tenantMe(),
    retry: false,
  });

  const tenant = meData?.tenant;
  const ledger = meData?.ledger;
  const paymentsList = meData?.payments ?? [];
  const rentRecords = meData?.rentRecords ?? [];
  const maintenanceList = meData?.maintenance ?? [];

  const handleLogout = () => {
    clearTenantToken();
    navigate("/tenant/login");
  };

  const handlePayNow = async (recordId?: string, amount?: number) => {
    if (!tenant) return;
    setPaying(true);
    try {
      const order = await api.createRazorpayOrder({
        tenantId: tenant.id,
        rentRecordId: recordId,
        amount: amount || Number(tenant.rent),
      });

      const win = window as unknown as { Razorpay: new (opts: Record<string, unknown>) => { open: () => void } };

      if (win.Razorpay) {
        const rzp = new win.Razorpay({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          name: "C2D Rentals",
          description: `Rent Payment`,
          order_id: order.orderId,
          handler: function () {
            success("Payment Authorized", "Processing confirmation...");
            qc.invalidateQueries({ queryKey: ["tenantMe"] });
          },
          prefill: {
            name: tenant.name,
            contact: tenant.phone,
            email: tenant.email || "",
          },
        });
        rzp.open();
      } else {
        toastError("Razorpay SDK not loaded");
      }
    } catch (err) {
      toastError("Payment Init Failed", err instanceof Error ? err.message : undefined);
    } finally {
      setPaying(false);
    }
  };

  const createMaintenanceMutation = useMutation({
    mutationFn: () => api.tenantCreateMaintenance({ description: maintenanceForm.description }),
    onSuccess: () => {
      success("Request Submitted", "Property manager notified.");
      setRaisingMaintenance(false);
      setMaintenanceForm({ description: "" });
      qc.invalidateQueries({ queryKey: ["tenantMe"] });
    },
    onError: (e) => toastError("Failed", e instanceof Error ? e.message : undefined),
  });

  if (meLoading) return <PageLoader label="Loading Tenant Dashboard..." />;
  if (!tenant) {
    return null;
  }

  const pendingRecords = rentRecords.filter((r) => Number(r.outstanding) > 0);
  const totalOutstanding = ledger?.outstanding ?? pendingRecords.reduce((sum, r) => sum + Number(r.outstanding), 0);
  const creditBalance = ledger?.tenantCreditBalance ?? 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      {/* Top Tenant Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3.5 shadow-2xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-blue-600 text-white font-black text-xs shadow-xs">
              {tenant.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="font-extrabold text-sm text-slate-900 leading-tight">{tenant.name}</h1>
              <p className="text-[11px] font-semibold text-slate-500">{tenant.property?.name ?? "Resident Profile"}</p>
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-600 hover:text-rose-600 text-xs font-bold">
            <LogOut className="size-4 mr-1" /> Sign Out
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-3.5 sm:p-6 space-y-4 sm:space-y-6">
        {/* Credit Balance Alert if Available */}
        {creditBalance > 0 && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 flex items-center justify-between gap-3 text-xs font-semibold text-blue-900">
            <div className="flex items-center gap-2.5">
              <Wallet className="size-5 text-blue-600 shrink-0" />
              <div>
                <span className="font-extrabold uppercase text-[10px] text-blue-700 block tracking-wider">Tenant Advance Credit Balance</span>
                <span className="text-base font-black text-blue-800">{formatINR(creditBalance)}</span>
              </div>
            </div>
            <span className="text-[11px] bg-blue-100 text-blue-800 font-bold px-3 py-1 rounded-full">Advance Pre-Paid</span>
          </div>
        )}

        {/* Outstanding Dues Banner */}
        {totalOutstanding > 0 ? (
          <Card className="border border-rose-200 bg-rose-50/60 shadow-xs overflow-hidden">
            <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-xs">
                  <AlertCircle className="size-5" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 block">Pending Outstanding Rent Balance</span>
                  <span className="text-xl sm:text-2xl font-black text-rose-800">{formatINR(totalOutstanding)}</span>
                  <p className="text-xs font-semibold text-rose-700 mt-0.5">Please clear your rent dues to avoid late payment penalties.</p>
                </div>
              </div>

              <Button
                loading={paying}
                onClick={() => handlePayNow(pendingRecords[0]?.id, totalOutstanding)}
                className="w-full sm:w-auto h-11 px-6 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md shadow-rose-600/20 rounded-xl"
              >
                <CreditCard className="size-4 mr-1.5" /> Pay Now via UPI / Card
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border border-emerald-200 bg-emerald-50/60 shadow-xs overflow-hidden">
            <CardContent className="p-4 flex items-center gap-3 text-emerald-800">
              <CheckCircle2 className="size-6 text-emerald-600 shrink-0" />
              <div>
                <h2 className="font-extrabold text-sm">All Rent Dues Cleared!</h2>
                <p className="text-xs font-semibold text-emerald-700">Thank you for making your payments on time.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stay & Allocation Card */}
        <Card className="border border-slate-200 bg-white shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Building2 className="size-4 text-blue-600" /> My Stay Allocation
            </CardTitle>
            <StatusBadge status={tenant.status} />
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-semibold">
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/80">
                <span className="text-slate-400 text-[10px] uppercase font-extrabold block">Property</span>
                <span className="font-bold text-slate-800 text-sm truncate block">{tenant.property?.name ?? "—"}</span>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/80">
                <span className="text-slate-400 text-[10px] uppercase font-extrabold block">
                  {(tenant as any).home ? "Unit / Home" : "Room / Bed"}
                </span>
                <span className="font-bold text-slate-800 text-sm block">
                  {(tenant as any).home
                    ? `${(tenant as any).home.floor ? (tenant as any).home.floor + " · " : ""}${(tenant as any).home.homeNumber || (tenant as any).home.name || "Home"}`
                    : tenant.room
                    ? `Room ${tenant.room.roomNumber} ${tenant.bed ? `(Bed ${tenant.bed.bedNumber})` : ""}`
                    : "Entire Property"}
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/80">
                <span className="text-slate-400 text-[10px] uppercase font-extrabold block">Monthly Rent</span>
                <span className="font-black text-blue-600 text-sm block">{formatINR(tenant.rent)}</span>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/80">
                <span className="text-slate-400 text-[10px] uppercase font-extrabold block">Move-in Date</span>
                <span className="font-bold text-slate-800 text-sm block">{formatDate(tenant.joiningDate)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial Ledger History */}
        {ledger && (
          <Card className="border border-slate-200 bg-white shadow-xs overflow-hidden">
            <CardHeader className="p-4 sm:p-5 border-b border-slate-100">
              <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                <FileText className="size-4 text-blue-600" /> Financial Statement & Ledger
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {!ledger.entries.length ? (
                <div className="p-6 text-center text-xs font-bold text-slate-500">No transactions recorded.</div>
              ) : (
                <table className="w-full text-left text-xs font-semibold text-slate-700">
                  <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-extrabold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5">Date</th>
                      <th className="px-4 py-2.5">Reference</th>
                      <th className="px-4 py-2.5">Description</th>
                      <th className="px-4 py-2.5 text-right">Debit (DR)</th>
                      <th className="px-4 py-2.5 text-right">Credit (CR)</th>
                      <th className="px-4 py-2.5 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ledger.entries.map((entry: any) => (
                      <tr key={entry.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-500">{entry.date.slice(0, 10)}</td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-800">{entry.reference}</td>
                        <td className="px-4 py-3 font-bold text-slate-900">{entry.description}</td>
                        <td className="px-4 py-3 text-right font-extrabold text-rose-600">
                          {entry.debit > 0 ? (
                            <span className="inline-flex items-center gap-0.5"><ArrowUpRight className="size-3" />{formatINR(entry.debit)}</span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-extrabold text-emerald-600">
                          {entry.credit > 0 ? (
                            <span className="inline-flex items-center gap-0.5"><ArrowDownRight className="size-3" />{formatINR(entry.credit)}</span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-slate-900">{formatINR(entry.runningBalance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Payment History & Digital Receipts */}
        <Card className="border border-slate-200 bg-white shadow-xs overflow-hidden">
          <CardHeader className="p-4 sm:p-5 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
              <Receipt className="size-4 text-blue-600" /> Payment Receipts History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!paymentsList.length ? (
              <div className="p-6 text-center text-xs font-bold text-slate-500">No payment receipts issued yet.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {paymentsList.map((p: any) => (
                  <li key={p.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 text-sm">{p.receiptNumber || p.id}</span>
                        <StatusBadge status={p.paymentStatus} />
                      </div>
                      <p className="text-xs font-semibold text-slate-500">
                        Date: {p.paymentDate.slice(0, 10)} · Method: <span className="font-bold text-slate-800">{p.paymentMethod}</span> · Paid:{" "}
                        <span className="font-extrabold text-emerald-600">{formatINR(p.amount)}</span>
                      </p>
                    </div>

                    <Button size="sm" variant="outline" onClick={() => setSelectedReceipt(p)} className="font-bold text-xs h-8">
                      <Receipt className="size-3.5 mr-1" /> View Receipt
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Maintenance Requests */}
        <Card className="border border-slate-200 bg-white shadow-xs overflow-hidden">
          <CardHeader className="p-4 sm:p-5 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
              <Wrench className="size-4 text-blue-600" /> Maintenance & Service Requests
            </CardTitle>
            <Button size="sm" onClick={() => setRaisingMaintenance(true)} className="bg-blue-600 hover:bg-blue-700 font-bold text-xs">
              <Plus className="size-3.5" /> New Request
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {!maintenanceList.length ? (
              <div className="p-6 text-center text-xs font-bold text-slate-500">No active maintenance requests.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {maintenanceList.map((m: any) => (
                  <li key={m.id} className="p-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-slate-900">{m.description}</span>
                      <StatusBadge status={m.status} />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400 block">{formatDate(m.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Payment Receipt Modal */}
      {selectedReceipt && (
        <Dialog open={!!selectedReceipt} onOpenChange={() => setSelectedReceipt(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center font-black text-lg">OFFICIAL PAYMENT RECEIPT</DialogTitle>
              <DialogDescription className="text-center text-xs">C2D Rentals Management Portal</DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-3 text-xs font-semibold">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Receipt Number</span>
                <span className="font-mono text-lg font-black text-slate-900 block">{selectedReceipt.receiptNumber || selectedReceipt.id}</span>
                <span className="text-xl font-black text-emerald-600 block">{formatINR(selectedReceipt.amount)}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Tenant</span>
                  <span className="font-bold text-slate-800">{tenant.name}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Date</span>
                  <span className="font-bold text-slate-800">{selectedReceipt.paymentDate.slice(0, 10)}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Method</span>
                  <span className="font-bold text-slate-800">{selectedReceipt.paymentMethod}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Status</span>
                  <StatusBadge status={selectedReceipt.paymentStatus} />
                </div>
              </div>

              {selectedReceipt.cashAmount > 0 && selectedReceipt.upiAmount > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                  <span className="text-[10px] font-extrabold uppercase block">Mixed Payment Breakdown</span>
                  <div className="flex justify-between">
                    <span>Cash Amount:</span>
                    <span className="font-bold">{formatINR(selectedReceipt.cashAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>UPI Amount:</span>
                    <span className="font-bold">{formatINR(selectedReceipt.upiAmount)}</span>
                  </div>
                </div>
              )}

              {selectedReceipt.allocations?.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Bill Allocation</span>
                  {selectedReceipt.allocations.map((a: any) => (
                    <div key={a.id} className="flex justify-between text-slate-700">
                      <span>Bill {a.bill?.billNumber ?? a.billId}:</span>
                      <span className="font-bold text-emerald-600">{formatINR(a.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setSelectedReceipt(null)} className="w-full">
                Close Receipt
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* New Maintenance Dialog */}
      {raisingMaintenance && (
        <Dialog open={raisingMaintenance} onOpenChange={setRaisingMaintenance}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Raise Maintenance Request</DialogTitle>
              <DialogDescription>Describe the issue in your room/property (e.g. plumbing leak, electrical switch).</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMaintenanceMutation.mutate();
              }}
              className="space-y-4 pt-2"
            >
              <div className="space-y-1.5">
                <Label>Issue Description *</Label>
                <Input
                  required
                  placeholder="e.g. Tap leaking in bathroom"
                  value={maintenanceForm.description}
                  onChange={(e) => setMaintenanceForm({ description: e.target.value })}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRaisingMaintenance(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={createMaintenanceMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                  Submit Request
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Image Lightbox */}
      <ImageLightboxModal images={lightboxImages} open={lightboxImages.length > 0} onClose={() => setLightboxImages([])} />
    </div>
  );
}
