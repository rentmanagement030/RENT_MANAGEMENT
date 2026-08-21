import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Download, FileBarChart, FileText } from "lucide-react";
import { api, downloadUrl } from "@/lib/api";
import { currentMonth, formatINR } from "@/lib/format";
import { useAuth } from "@/auth/AuthContext";
import { PERMISSIONS } from "@/lib/permissions";
import { Button, Card, CardContent, CardHeader, CardTitle, FilterSelect, Input, Label, PageLoader, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/primitives";
import { EmptyState, PageHeader, StatCard, StatusBadge } from "@/components/ui/data";

export default function ReportsPage() {
  const { can } = useAuth();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [method, setMethod] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [selectedTenant, setSelectedTenant] = useState("");
  const [billMonth, setBillMonth] = useState(() => currentMonth());
  const [billType, setBillType] = useState("");
  const [billStatus, setBillStatus] = useState("");
  const [billTenant, setBillTenant] = useState("");

  const { data: tenants } = useQuery({ queryKey: ["tenants", "all"], queryFn: () => api.listTenants({ pageSize: 200 }) });
  const { data: properties } = useQuery({ queryKey: ["properties", "all"], queryFn: () => api.listProperties({ pageSize: 200 }) });
  const { data: collection, isLoading: loadingCollection } = useQuery({
    queryKey: ["collection-report", from, to, method, propertyId],
    queryFn: () => api.collectionReport({
      from: from || undefined,
      to: to || undefined,
      method: method || undefined,
      propertyId: propertyId || undefined,
    }),
  });
  const { data: performance, isLoading: loadingPerf } = useQuery({ queryKey: ["property-performance"], queryFn: () => api.propertyPerformance() });
  const { data: ledger, isLoading: loadingLedger } = useQuery({
    queryKey: ["tenant-ledger", selectedTenant],
    queryFn: () => api.tenantLedger(selectedTenant),
    enabled: !!selectedTenant,
  });
  const { data: bills, isLoading: loadingBills } = useQuery({
    queryKey: ["bills-report", billMonth, billType, billStatus, billTenant, propertyId],
    queryFn: () => api.billsReport({
      billingMonth: billMonth || undefined,
      billType: billType || undefined,
      status: billStatus || undefined,
      tenantId: billTenant || undefined,
      propertyId: propertyId || undefined,
    }),
  });

  const rentRecords = useMemo(() => {
    if (!ledger) return [];
    const rents = ledger.rentRecords.map((r) => ({ ...r, type: "rent" as const, date: `${r.billingMonth}-01` }));
    const pays = ledger.payments.map((p) => ({ ...p, type: "payment" as const, billingMonth: p.date.slice(0, 7) }));
    return [...rents, ...pays].sort((a, b) => (a.date > b.date ? -1 : 1));
  }, [ledger]);

  const { data: profitability, isLoading: loadingProf } = useQuery({
    queryKey: ["property-profitability", propertyId, from, to],
    queryFn: () => api.profitabilityReport({ propertyId: propertyId || undefined, from: from || undefined, to: to || undefined }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Reports & Property Profitability"
        description="Monitor real-time income, property expenses, net profitability, collection rates, and tenant ledgers."
        actions={
          can(PERMISSIONS.REPORTS_READ) ? (
            <Button variant="outline" onClick={() => window.open(downloadUrl(`/payments/export?from=${from || ""}&to=${to || ""}&method=${method || ""}&propertyId=${propertyId || ""}`), "_blank")}>
              <Download /> Export Excel
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="sm:w-40 font-semibold" placeholder="From Date" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="sm:w-40 font-semibold" placeholder="To Date" />
        <FilterSelect value={method} onChange={(e) => setMethod(e.target.value)} className="sm:w-44 font-semibold">
          <option value="">All payment methods</option>
          <option value="CASH">Cash</option>
          <option value="BANK_TRANSFER_DD">Bank / DD</option>
          <option value="RAZORPAY_UPI">Razorpay UPI</option>
        </FilterSelect>
        <FilterSelect value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="sm:w-56 font-bold">
          <option value="">All properties</option>
          {(properties?.items ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.type === "HOUSE" ? "House" : "PG"})
            </option>
          ))}
        </FilterSelect>
      </div>

      {/* Property Profitability Analysis Dashboard Card (Rule 7 & 8) */}
      <Card className="border border-blue-200 bg-white shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-blue-50/60 border-b border-blue-100 pb-3">
          <CardTitle className="text-base sm:text-lg font-black text-blue-900 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileBarChart className="size-5 text-blue-600 inline" /> Property Profitability Dashboard
            </span>
            <span className="text-xs font-extrabold text-blue-700 bg-blue-100 px-3 py-1 rounded-full">Net Income = Collected - Expenses</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 space-y-4">
          {loadingProf ? (
            <PageLoader />
          ) : !profitability?.properties.length ? (
            <EmptyState icon={<FileBarChart className="size-6 text-slate-400" />} title="No profitability data" description="Adjust date range filters or select another property." />
          ) : (
            <>
              {/* Profitability Executive Summary Bar */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <span className="text-[10px] font-extrabold uppercase text-slate-500 block">Expected Rent</span>
                  <span className="text-lg font-black text-slate-900 block mt-0.5">{formatINR(profitability.summary.expectedIncome)}</span>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
                  <span className="text-[10px] font-extrabold uppercase text-emerald-700 block">Actual Collected</span>
                  <span className="text-lg font-black text-emerald-800 block mt-0.5">{formatINR(profitability.summary.collectedIncome)}</span>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3">
                  <span className="text-[10px] font-extrabold uppercase text-rose-700 block">Actual Expenses</span>
                  <span className="text-lg font-black text-rose-800 block mt-0.5">{formatINR(profitability.summary.totalExpenses)}</span>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                  <span className="text-[10px] font-extrabold uppercase text-amber-700 block">Outstanding</span>
                  <span className="text-lg font-black text-amber-800 block mt-0.5">{formatINR(profitability.summary.totalOutstanding)}</span>
                </div>
                <div className={`rounded-xl border p-3 col-span-2 sm:col-span-1 ${profitability.summary.netIncome >= 0 ? "border-blue-300 bg-blue-50 text-blue-900" : "border-rose-300 bg-rose-50 text-rose-900"}`}>
                  <span className="text-[10px] font-extrabold uppercase block opacity-80">NET INCOME</span>
                  <span className="text-xl font-black block mt-0.5">{formatINR(profitability.summary.netIncome)}</span>
                </div>
              </div>

              {/* Mobile View (< 1024px) */}
              <div className="lg:hidden space-y-3.5">
                {profitability.properties.map((p) => (
                  <div key={p.propertyId} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div>
                        <p className="font-black text-slate-900 text-sm">{p.propertyName}</p>
                        <p className="text-xs font-semibold text-slate-500 mt-0.5">
                          {p.propertyType === "HOUSE" ? "House" : `PG (${p.occupiedBeds}/${p.totalBeds} Beds)`}
                        </p>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-black shrink-0 ${p.collectionRate >= 80 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                        {p.collectionRate}% Rate
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-semibold">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Expected</span>
                        <span className="font-bold text-slate-700 block mt-0.5">{formatINR(p.expectedIncome)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-extrabold uppercase text-emerald-700 block">Collected</span>
                        <span className="font-black text-emerald-700 block mt-0.5">{formatINR(p.collectedIncome)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-extrabold uppercase text-rose-700 block">Expenses</span>
                        <span className="font-black text-rose-700 block mt-0.5">{formatINR(p.totalExpenses)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-extrabold uppercase text-blue-700 block">Net Income</span>
                        <span className={`font-black text-sm block mt-0.5 ${p.netIncome >= 0 ? "text-blue-700" : "text-rose-700"}`}>
                          {formatINR(p.netIncome)}
                        </span>
                      </div>
                      {p.propertyType === "PG" && (
                        <div className="col-span-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium">RevPOB (Per Bed):</span>
                          <span className="font-bold text-slate-800">{p.revPOB > 0 ? `${formatINR(p.revPOB)} / bed` : "—"}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Property Level Profitability Matrix (>= 1024px) */}
              <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-extrabold">Property</TableHead>
                      <TableHead className="text-right font-extrabold">Expected (₹)</TableHead>
                      <TableHead className="text-right font-extrabold text-emerald-700">Collected (₹)</TableHead>
                      <TableHead className="text-right font-extrabold text-rose-700">Expenses (₹)</TableHead>
                      <TableHead className="text-right font-extrabold text-blue-700">Net Income (₹)</TableHead>
                      <TableHead className="text-center font-extrabold">Rate (%)</TableHead>
                      <TableHead className="text-right font-extrabold">PG RevPOB</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profitability.properties.map((p) => (
                      <TableRow key={p.propertyId} className="hover:bg-slate-50/80">
                        <TableCell>
                          <p className="font-black text-slate-900 text-sm">{p.propertyName}</p>
                          <p className="text-xs font-semibold text-slate-500">{p.propertyType === "HOUSE" ? "House" : `PG (${p.occupiedBeds}/${p.totalBeds} Beds)`}</p>
                        </TableCell>
                        <TableCell className="text-right font-bold text-slate-600">{formatINR(p.expectedIncome)}</TableCell>
                        <TableCell className="text-right font-black text-emerald-700">{formatINR(p.collectedIncome)}</TableCell>
                        <TableCell className="text-right font-black text-rose-700">{formatINR(p.totalExpenses)}</TableCell>
                        <TableCell className={`text-right font-black text-sm ${p.netIncome >= 0 ? "text-blue-700" : "text-rose-700"}`}>
                          {formatINR(p.netIncome)}
                        </TableCell>
                        <TableCell className="text-center font-bold">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${p.collectionRate >= 80 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                            {p.collectionRate}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-xs text-slate-700">
                          {p.propertyType === "PG" && p.revPOB > 0 ? `${formatINR(p.revPOB)} / bed` : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
          <CardHeader>
            <CardTitle>Property performance</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingPerf ? (
              <PageLoader />
            ) : !performance?.length ? (
              <EmptyState icon={<FileBarChart className="size-6" />} title="No data" />
            ) : (
              <>
                <ul className="divide-y lg:hidden">
                  {performance.map((p) => (
                    <li key={p.propertyId} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.type === "HOUSE" ? "House" : "PG"}</p>
                        </div>
                        <StatusBadge status={`${p.occupancy}%`} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          Collected <span className="font-semibold text-foreground">{formatINR(p.collected)}</span>
                        </span>
                        <span>
                          Due <span className="font-semibold text-red-600">{formatINR(p.outstanding)}</span>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="hidden lg:block">
                  <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property</TableHead>
                    <TableHead className="text-right">Collected</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Occupancy</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {performance.map((p) => (
                    <TableRow key={p.propertyId}>
                      <TableCell>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.type === "HOUSE" ? "House" : "PG"}</p>
                      </TableCell>
                      <TableCell className="text-right">{formatINR(p.collected)}</TableCell>
                      <TableCell className="text-right">{formatINR(p.outstanding)}</TableCell>
                      <TableCell className="text-right">
                        <StatusBadge status={`${p.occupancy}%`} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Bills report</CardTitle>
            <Button variant="outline" size="sm" onClick={() => window.open(api.exportBills({ billingMonth: billMonth || undefined, billType: billType || undefined, status: billStatus || undefined, tenantId: billTenant || undefined, propertyId: propertyId || undefined }), "_blank")}>
              <Download /> Export Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Input type="month" value={billMonth} onChange={(e) => setBillMonth(e.target.value)} className="sm:w-40 h-11 text-xs font-bold rounded-xl bg-slate-50/70 border-slate-200" placeholder="Month" />
            <FilterSelect value={billType} onChange={(e) => setBillType(e.target.value)} className="sm:w-44">
              <option value="">All types</option>
              <option value="RENT">Rent</option>
              <option value="EB">Electricity</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="WATER">Water</option>
              <option value="OTHER">Other</option>
            </FilterSelect>
            <FilterSelect value={billStatus} onChange={(e) => setBillStatus(e.target.value)} className="sm:w-44">
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PARTIAL">Partial</option>
              <option value="PAID">Paid</option>
              <option value="OVERDUE">Overdue</option>
              <option value="WAIVED">Waived</option>
              <option value="CANCELLED">Cancelled</option>
            </FilterSelect>
            <FilterSelect value={billTenant} onChange={(e) => setBillTenant(e.target.value)} className="sm:w-56">
              <option value="">All tenants</option>
              {(tenants?.items ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.phone}
                </option>
              ))}
            </FilterSelect>
          </div>

          {loadingBills ? (
            <PageLoader />
          ) : !bills?.items.length ? (
            <EmptyState icon={<FileText className="size-6" />} title="No bills" description="Adjust the filters or generate bills first." />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard label="Billed" value={formatINR(bills.totals.amount)} sub={`${bills.count} bills`} />
                <StatCard label="Collected" value={formatINR(bills.totals.paidAmount)} />
                <StatCard label="Penalties" value={formatINR(bills.totals.penaltyAmount)} />
                <StatCard label="Outstanding" value={formatINR(bills.totals.outstanding)} />
              </div>
              <ul className="divide-y lg:hidden">
                {bills.items.map((b) => (
                  <li key={b.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-muted-foreground">{b.billNumber}</p>
                        <p className="truncate text-sm font-medium">{b.tenant}</p>
                        <p className="text-xs text-muted-foreground">{b.property}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold">{formatINR(b.amount)}</p>
                        <StatusBadge status={b.status} />
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{b.billType}</span>
                      <span>{b.billingMonth}</span>
                      <span>
                        Paid <span className="font-semibold text-foreground">{formatINR(b.paidAmount)}</span>
                      </span>
                      <span>
                        Due <span className="font-semibold text-red-600">{formatINR(b.outstanding)}</span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bills.items.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono text-xs">{b.billNumber}</TableCell>
                      <TableCell>
                        <p className="font-medium">{b.tenant}</p>
                        <p className="text-xs text-muted-foreground">{b.tenantPhone}</p>
                      </TableCell>
                      <TableCell>{b.billType}</TableCell>
                      <TableCell>{b.billingMonth}</TableCell>
                      <TableCell className="text-right">{formatINR(b.amount)}</TableCell>
                      <TableCell className="text-right font-semibold text-red-600">{formatINR(b.outstanding)}</TableCell>
                      <TableCell><StatusBadge status={b.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Tenant Ledger Report — at the bottom with its selector */}
      <Card className="border border-slate-200 bg-white shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-slate-50/70 border-b border-slate-100 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <BookOpen className="size-5 text-slate-700 inline" /> Tenant Ledger
            </CardTitle>
            <Select value={selectedTenant} onChange={(e) => setSelectedTenant(e.target.value)} className="sm:w-72 font-bold">
              <option value="">Choose a tenant to view ledger…</option>
              {(tenants?.items ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.phone}
                </option>
              ))}
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!selectedTenant ? (
            <EmptyState title="Choose a tenant" description="Pick a tenant from the dropdown above to see their rent ledger." />
          ) : loadingLedger ? (
            <PageLoader />
          ) : !ledger ? null : (
            <>
              <ul className="divide-y lg:hidden">
                {rentRecords.map((r, i) => (
                  <li key={`${r.type}-${r.id}`} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{r.type === "rent" ? `Rent ${r.billingMonth}` : `Payment ${r.method.replace(/_/g, " ")}`}</p>
                        <p className="text-xs text-muted-foreground">{r.date.slice(0, 10)}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold">{formatINR((r as { rent?: number; amount?: number }).rent ?? (r as { amount?: number }).amount)}</p>
                        <StatusBadge status={r.status} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rentRecords.map((r, i) => (
                      <TableRow key={`${r.type}-${r.id}`}>
                        <TableCell>{r.date.slice(0, 10)}</TableCell>
                        <TableCell>{r.type === "rent" ? `Rent ${r.billingMonth}` : `Payment ${r.method.replace(/_/g, " ")}`}</TableCell>
                        <TableCell className="text-right">{formatINR((r as { rent?: number; amount?: number }).rent ?? (r as { amount?: number }).amount)}</TableCell>
                        <TableCell>
                          {r.type === "rent" ? <StatusBadge status={r.status} /> : <StatusBadge status={r.status} />}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
