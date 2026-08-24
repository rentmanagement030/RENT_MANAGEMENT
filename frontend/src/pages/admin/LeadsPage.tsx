import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Users,
  Plus,
  Phone,
  MessageCircle,
  Calendar,
  Building2,
  UserCheck,
  Search,
  Filter,
  Globe,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatINR, formatDate } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  PageLoader,
  Select,
} from "@/components/ui/primitives";
import { EmptyState, PageHeader, Pagination, StatusBadge } from "@/components/ui/data";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlay";
import { cn } from "@/lib/utils";
import { validateName, validatePhone, validateEmail } from "@/lib/validation";
import type { Lead, Property } from "@/types";

export default function LeadsPage() {
  const { success, error: toastError } = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);

  const [leadForm, setLeadForm] = useState({
    name: "",
    phone: "",
    email: "",
    propertyId: "",
    roomType: "SINGLE",
    budget: "",
    source: "WEBSITE",
    notes: "",
  });

  const [convertForm, setConvertForm] = useState({
    propertyId: "",
    roomId: "",
    bedId: "",
    rentAmount: "",
  });

  const { data: properties } = useQuery({
    queryKey: ["propertiesListAll"],
    queryFn: async () => {
      const res = await api.listProperties({ pageSize: 500 });
      return res?.items ?? [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["leads", page, statusFilter, search],
    queryFn: async () => {
      const res = await api.listLeads({ page, pageSize: 10, status: statusFilter || undefined, search: search || undefined });
      return res ?? { items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 };
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["leads"] });

  const createLeadMutation = useMutation({
    mutationFn: () => api.createLead({ ...leadForm, budget: Number(leadForm.budget) || undefined }),
    onSuccess: () => {
      success("Lead Created", "New lead added to CRM pipeline.");
      setNewLeadOpen(false);
      setLeadForm({ name: "", phone: "", email: "", propertyId: "", roomType: "SINGLE", budget: "", source: "WEBSITE", notes: "" });
      invalidate();
    },
    onError: (e) => toastError("Failed to create lead", e instanceof Error ? e.message : undefined),
  });

  const convertMutation = useMutation({
    mutationFn: () =>
      api.convertLead(convertingLead!.id, {
        propertyId: convertForm.propertyId,
        roomId: convertForm.roomId || undefined,
        bedId: convertForm.bedId || undefined,
        rentAmount: Number(convertForm.rentAmount) || undefined,
      }),
    onSuccess: () => {
      success("Lead Converted!", "Tenant profile and authentication PIN created successfully.");
      setConvertingLead(null);
      invalidate();
      qc.invalidateQueries({ queryKey: ["tenants"] });
    },
    onError: (e) => toastError("Conversion Failed", e instanceof Error ? e.message : undefined),
  });

  const pipelineStatuses = [
    { label: "All Leads", value: "" },
    { label: "New", value: "NEW" },
    { label: "Contacted", value: "CONTACTED" },
    { label: "Visited", value: "VISITED" },
    { label: "Interested", value: "INTERESTED" },
    { label: "Booked", value: "BOOKED" },
    { label: "Converted", value: "CONVERTED" },
  ];

  const leads = data?.items ?? [];

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Lead Management & CRM"
        description="Track prospective tenants, schedule walk-throughs, and convert leads to active residents."
        actions={
          <Button onClick={() => setNewLeadOpen(true)} className="bg-blue-600 hover:bg-blue-700 font-bold shadow-xs">
            <Plus className="size-4" /> Add New Lead
          </Button>
        }
      />

      {/* Filter Chips & Search Bar */}
      <Card className="border border-slate-200 bg-white shadow-xs">
        <CardContent className="p-3.5 sm:p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
            <Input
              placeholder="Search leads by name, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs font-bold"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto scrollbar-none pb-1 sm:pb-0">
            {pipelineStatuses.map((st) => (
              <button
                key={st.value}
                onClick={() => setStatusFilter(st.value)}
                className={`whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-black transition-all active:scale-95 ${
                  statusFilter === st.value
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 border border-slate-200/80 hover:bg-slate-200/60"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-slate-200 bg-white shadow-xs overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <PageLoader />
          ) : !leads.length ? (
            <EmptyState icon={<Users className="size-6" />} title="No leads found" description="Create a new lead or adjust search filters." />
          ) : (
            <>
              {/* Mobile Card List View */}
              <ul className="divide-y divide-slate-100 lg:hidden">
                {leads.map((l) => (
                  <li key={l.id} className="p-4 space-y-3 bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 font-black text-xs border border-blue-200/80">
                          {l.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-extrabold text-sm text-slate-900">{l.name}</p>
                          <p className="text-xs font-semibold text-slate-500">{l.phone}</p>
                        </div>
                      </div>
                      <StatusBadge status={l.status} />
                    </div>

                    <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 grid grid-cols-2 gap-2 text-xs font-semibold">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-extrabold">Interested In</span>
                        <span className="font-extrabold text-slate-800 truncate block">{l.property?.name ?? l.roomType ?? "Any PG/House"}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 block text-[10px] uppercase font-extrabold">Budget</span>
                        <span className="font-black text-blue-600">{l.budget ? formatINR(l.budget) : "—"}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`tel:${l.phone}`}
                          className="inline-flex size-8 items-center justify-center rounded-lg bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 text-xs"
                          title="Call"
                        >
                          <Phone className="size-3.5" />
                        </a>
                        <a
                          href={`https://wa.me/91${l.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-xs"
                          title="WhatsApp"
                        >
                          <MessageCircle className="size-3.5" />
                        </a>
                      </div>

                      {l.status !== "CONVERTED" && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setConvertingLead(l);
                            setConvertForm({ propertyId: l.propertyId || "", roomId: "", bedId: "", rentAmount: l.budget ? String(l.budget) : "" });
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 font-extrabold text-xs h-8"
                        >
                          <UserCheck className="size-3.5 mr-1" /> Convert to Tenant
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-black uppercase text-slate-600">
                    <tr>
                      <th className="px-4 py-3.5">Lead Details</th>
                      <th className="px-4 py-3.5">Property / Room</th>
                      <th className="px-4 py-3.5">Budget</th>
                      <th className="px-4 py-3.5">Source</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {leads.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 font-black text-xs border border-blue-200/80">
                              {l.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="font-extrabold text-sm text-slate-900">{l.name}</p>
                                {l.source === "WEBSITE" && (
                                  <span className="text-[10px] font-black uppercase text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Globe className="size-3 text-blue-600 inline" /> Website
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-semibold text-slate-500">{l.phone}</p>
                              {l.notes && (
                                <p className="mt-1 text-xs font-medium text-slate-600 line-clamp-2 italic border-l-2 border-slate-200 pl-2">"{l.notes}"</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-bold text-slate-800">{l.property?.name ?? l.roomType ?? "Any"}</td>
                        <td className="px-4 py-3.5 font-black text-blue-600">{l.budget ? formatINR(l.budget) : "—"}</td>
                        <td className="px-4 py-3.5 text-xs font-bold text-slate-600">{l.source ?? "Direct"}</td>
                        <td className="px-4 py-3.5">
                          <StatusBadge status={l.status} />
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <a
                              href={`tel:${l.phone}`}
                              className="inline-flex size-8 items-center justify-center rounded-lg bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 text-xs"
                              title="Call"
                            >
                              <Phone className="size-3.5" />
                            </a>
                            <a
                              href={`https://wa.me/91${l.phone.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-xs"
                              title="WhatsApp"
                            >
                              <MessageCircle className="size-3.5" />
                            </a>
                            {l.status !== "CONVERTED" && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setConvertingLead(l);
                                  setConvertForm({ propertyId: l.propertyId || "", roomId: "", bedId: "", rentAmount: l.budget ? String(l.budget) : "" });
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 font-extrabold text-xs h-8"
                              >
                                <UserCheck className="size-3.5 mr-1" /> Convert
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-100 p-2">
                <Pagination page={data?.page ?? 1} totalPages={data?.totalPages ?? 1} total={data?.total ?? 0} onPageChange={setPage} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* New Lead Dialog */}
      {newLeadOpen && (
        <Dialog open={newLeadOpen} onOpenChange={setNewLeadOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Prospective Lead</DialogTitle>
              <DialogDescription>Enter contact details and preferences of the prospective tenant.</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const errs: Record<string, string> = {};
                const nameErr = validateName(leadForm.name, true, "Name");
                if (nameErr) errs.name = nameErr;
                const phoneErr = validatePhone(leadForm.phone, true, "Phone");
                if (phoneErr) errs.phone = phoneErr;

                if (Object.keys(errs).length > 0) {
                  toastError("Validation Error", Object.values(errs)[0]);
                  return;
                }
                createLeadMutation.mutate();
              }}
              className="space-y-4 pt-2"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input
                    required
                    placeholder="Full Name"
                    value={leadForm.name}
                    onChange={(e) => setLeadForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone *</Label>
                  <Input
                    required
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={leadForm.phone}
                    onChange={(e) => setLeadForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Interested Property</Label>
                  <Select value={leadForm.propertyId} onChange={(e) => setLeadForm((f) => ({ ...f, propertyId: e.target.value }))}>
                    <option value="">Select Property</option>
                    {properties?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Budget (₹)</Label>
                  <Input type="number" placeholder="Monthly Budget" value={leadForm.budget} onChange={(e) => setLeadForm((f) => ({ ...f, budget: e.target.value }))} />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setNewLeadOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={createLeadMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                  Save Lead
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Convert Lead to Tenant Dialog */}
      {convertingLead && (
        <Dialog open={!!convertingLead} onOpenChange={(o) => !o && setConvertingLead(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convert {convertingLead.name} to Active Tenant</DialogTitle>
              <DialogDescription>Assign property stay allocation. This automatically creates tenant login credentials.</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                convertMutation.mutate();
              }}
              className="space-y-4 pt-2"
            >
              <div className="space-y-1.5">
                <Label>Select Property *</Label>
                <Select required value={convertForm.propertyId} onChange={(e) => setConvertForm((f) => ({ ...f, propertyId: e.target.value }))}>
                  <option value="">Choose Property</option>
                  {properties?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.type})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Monthly Rent Amount (₹)</Label>
                <Input type="number" placeholder="Monthly Rent" value={convertForm.rentAmount} onChange={(e) => setConvertForm((f) => ({ ...f, rentAmount: e.target.value }))} />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setConvertingLead(null)}>
                  Cancel
                </Button>
                <Button type="submit" loading={convertMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                  Complete Conversion
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
