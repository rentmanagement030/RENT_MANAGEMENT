import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Wrench, Plus, Phone, Pencil, Trash2, Building2 } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button, Card, CardContent, Input, Label, PageLoader, Select } from "@/components/ui/primitives";
import { PageHeader, StatusBadge } from "@/components/ui/data";
import { ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlay";
import { cn } from "@/lib/utils";
import { validateName, validatePhone, validateEmail } from "@/lib/validation";
import type { Staff, Vendor } from "@/types";

export default function StaffVendorPage() {
  const { success, error: toastError } = useToast();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<"staff" | "vendors">("staff");
  const [newStaffOpen, setNewStaffOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [deletingStaff, setDeletingStaff] = useState<Staff | null>(null);

  const [newVendorOpen, setNewVendorOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [deletingVendor, setDeletingVendor] = useState<Vendor | null>(null);

  const { data: propertiesData } = useQuery({
    queryKey: ["properties", "options"],
    queryFn: () => api.listProperties({ pageSize: 500 }),
  });
  const properties = propertiesData?.items ?? [];

  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ["staffList"],
    queryFn: async () => {
      const res = await api.listStaff();
      return res ?? { items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 };
    },
  });

  const { data: vendorData, isLoading: vendorLoading } = useQuery({
    queryKey: ["vendorList"],
    queryFn: async () => {
      const res = await api.listVendors();
      return res ?? { items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 };
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["staffList"] });
    qc.invalidateQueries({ queryKey: ["vendorList"] });
  };

  const deleteStaffMutation = useMutation({
    mutationFn: (id: string) => api.deleteStaff(id),
    onSuccess: () => {
      success("Staff member deleted");
      setDeletingStaff(null);
      invalidate();
    },
    onError: (e) => toastError("Delete failed", e instanceof Error ? e.message : undefined),
  });

  const deleteVendorMutation = useMutation({
    mutationFn: (id: string) => api.deleteVendor(id),
    onSuccess: () => {
      success("Vendor deleted");
      setDeletingVendor(null);
      invalidate();
    },
    onError: (e) => toastError("Delete failed", e instanceof Error ? e.message : undefined),
  });

  const staff = staffData?.items ?? [];
  const vendors = vendorData?.items ?? [];

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Staff & Service Vendor Directory"
        description="Assign staff members and service vendors to single or multiple rental properties."
        actions={
          activeTab === "staff" ? (
            <Button onClick={() => setNewStaffOpen(true)} className="bg-blue-600 hover:bg-blue-700 font-extrabold shadow-xs">
              <Plus className="size-4" /> Add Staff Member
            </Button>
          ) : (
            <Button onClick={() => setNewVendorOpen(true)} className="bg-blue-600 hover:bg-blue-700 font-extrabold shadow-xs">
              <Plus className="size-4" /> Add Service Vendor
            </Button>
          )
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("staff")}
          className={`pb-2.5 px-4 text-xs font-black border-b-2 transition-all ${
            activeTab === "staff" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Operational Staff ({staff.length})
        </button>
        <button
          onClick={() => setActiveTab("vendors")}
          className={`pb-2.5 px-4 text-xs font-black border-b-2 transition-all ${
            activeTab === "vendors" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Service Vendors ({vendors.length})
        </button>
      </div>

      <Card className="border border-slate-200 bg-white shadow-xs overflow-hidden">
        <CardContent className="p-0">
          {activeTab === "staff" ? (
            staffLoading ? (
              <PageLoader />
            ) : !staff.length ? (
              <div className="p-6 text-center text-xs font-bold text-slate-500">No staff members registered.</div>
            ) : (
              <>
                {/* Mobile Cards */}
                <ul className="divide-y divide-slate-100 lg:hidden space-y-3 p-3">
                  {staff.map((s) => (
                    <li key={s.id} className="p-4 space-y-3 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-base text-slate-900">{s.name}</p>
                          <p className="text-xs font-extrabold text-blue-600 mt-0.5">{s.role}</p>
                          <p className="text-xs font-semibold text-slate-500 mt-0.5 flex items-center gap-1">
                            <Phone className="size-3 text-slate-400 inline" /> {s.phone}
                          </p>
                        </div>
                        <StatusBadge status={s.status} />
                      </div>

                      <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-200 text-xs">
                        <span className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Assigned Properties</span>
                        <div className="flex flex-wrap gap-1">
                          {s.properties && s.properties.length > 0 ? (
                            s.properties.map((p) => (
                              <span key={p.id} className="inline-flex items-center gap-1 rounded-md bg-blue-100/80 text-blue-800 px-2 py-0.5 text-[11px] font-bold">
                                <Building2 className="size-3" /> {p.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 italic">No property assigned</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button variant="outline" size="sm" onClick={() => setEditingStaff(s)} className="font-bold text-xs border-slate-200 rounded-xl">
                          <Pencil className="size-3.5" /> Edit
                        </Button>
                        <Button variant="outline" size="sm" className="text-rose-600 border-rose-200 hover:bg-rose-50 font-bold text-xs rounded-xl" onClick={() => setDeletingStaff(s)}>
                          <Trash2 className="size-3.5" /> Delete
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Desktop Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs font-black uppercase text-slate-600">
                      <tr>
                        <th className="px-4 py-3.5">Name & Role</th>
                        <th className="px-4 py-3.5">Phone</th>
                        <th className="px-4 py-3.5">Assigned Properties</th>
                        <th className="px-4 py-3.5">Status</th>
                        <th className="px-4 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {staff.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3.5">
                            <p className="font-black text-slate-900">{s.name}</p>
                            <p className="text-xs font-bold text-blue-600">{s.role}</p>
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-slate-700">{s.phone}</td>
                          <td className="px-4 py-3.5">
                            <div className="flex flex-wrap gap-1">
                              {s.properties && s.properties.length > 0 ? (
                                s.properties.map((p) => (
                                  <span key={p.id} className="inline-flex items-center gap-1 rounded-md bg-blue-100/80 text-blue-800 px-2 py-0.5 text-xs font-bold">
                                    <Building2 className="size-3" /> {p.name}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400 italic text-xs">No property assigned</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <StatusBadge status={s.status} />
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex justify-end gap-1.5">
                              <Button variant="ghost" size="sm" onClick={() => setEditingStaff(s)} className="font-bold border-slate-200 rounded-xl">
                                Edit
                              </Button>
                              <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50 font-bold rounded-xl" onClick={() => setDeletingStaff(s)}>
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )
          ) : vendorLoading ? (
            <PageLoader />
          ) : !vendors.length ? (
            <div className="p-6 text-center text-xs font-bold text-slate-500">No service vendors registered.</div>
          ) : (
            <>
              {/* Mobile Cards */}
              <ul className="divide-y divide-slate-100 lg:hidden space-y-3 p-3">
                {vendors.map((v) => (
                  <li key={v.id} className="p-4 space-y-3 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-base text-slate-900">{v.name}</p>
                        <p className="text-xs font-extrabold text-blue-600 mt-0.5">{v.service}</p>
                        <p className="text-xs font-semibold text-slate-500 mt-0.5 flex items-center gap-1">
                          <Phone className="size-3 text-slate-400 inline" /> {v.phone} {v.company ? `· ${v.company}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-200 text-xs">
                      <span className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Assigned Properties</span>
                      <div className="flex flex-wrap gap-1">
                        {v.properties && v.properties.length > 0 ? (
                          v.properties.map((p) => (
                            <span key={p.id} className="inline-flex items-center gap-1 rounded-md bg-emerald-100/80 text-emerald-800 px-2 py-0.5 text-[11px] font-bold">
                              <Building2 className="size-3" /> {p.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 italic">No property assigned</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button variant="outline" size="sm" onClick={() => setEditingVendor(v)} className="font-bold text-xs border-slate-200 rounded-xl">
                        <Pencil className="size-3.5" /> Edit
                      </Button>
                      <Button variant="outline" size="sm" className="text-rose-600 border-rose-200 hover:bg-rose-50 font-bold text-xs rounded-xl" onClick={() => setDeletingVendor(v)}>
                        <Trash2 className="size-3.5" /> Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-black uppercase text-slate-600">
                    <tr>
                      <th className="px-4 py-3.5">Vendor & Service</th>
                      <th className="px-4 py-3.5">Phone</th>
                      <th className="px-4 py-3.5">Company</th>
                      <th className="px-4 py-3.5">Assigned Properties</th>
                      <th className="px-4 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {vendors.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5">
                          <p className="font-black text-slate-900">{v.name}</p>
                          <p className="text-xs font-bold text-blue-600">{v.service}</p>
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-slate-700">{v.phone}</td>
                        <td className="px-4 py-3.5 text-slate-600 font-medium">{v.company || "—"}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {v.properties && v.properties.length > 0 ? (
                              v.properties.map((p) => (
                                <span key={p.id} className="inline-flex items-center gap-1 rounded-md bg-emerald-100/80 text-emerald-800 px-2 py-0.5 text-xs font-bold">
                                  <Building2 className="size-3" /> {p.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 italic text-xs">No property assigned</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button variant="ghost" size="sm" onClick={() => setEditingVendor(v)} className="font-bold border-slate-200 rounded-xl">
                              Edit
                            </Button>
                            <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50 font-bold rounded-xl" onClick={() => setDeletingVendor(v)}>
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Staff Form Dialog (Create / Edit) */}
      {(newStaffOpen || editingStaff) && (
        <StaffFormDialog
          staff={editingStaff}
          properties={properties}
          open={newStaffOpen || !!editingStaff}
          onClose={() => {
            setNewStaffOpen(false);
            setEditingStaff(null);
          }}
          onSaved={() => {
            setNewStaffOpen(false);
            setEditingStaff(null);
            invalidate();
          }}
        />
      )}

      {/* Vendor Form Dialog (Create / Edit) */}
      {(newVendorOpen || editingVendor) && (
        <VendorFormDialog
          vendor={editingVendor}
          properties={properties}
          open={newVendorOpen || !!editingVendor}
          onClose={() => {
            setNewVendorOpen(false);
            setEditingVendor(null);
          }}
          onSaved={() => {
            setNewVendorOpen(false);
            setEditingVendor(null);
            invalidate();
          }}
        />
      )}

      <ConfirmDialog
        open={!!deletingStaff}
        onOpenChange={(o) => !o && setDeletingStaff(null)}
        title="Delete staff member?"
        description={deletingStaff ? `Are you sure you want to delete staff member "${deletingStaff.name}"?` : undefined}
        destructive
        loading={deleteStaffMutation.isPending}
        onConfirm={() => deletingStaff && deleteStaffMutation.mutate(deletingStaff.id)}
      />

      <ConfirmDialog
        open={!!deletingVendor}
        onOpenChange={(o) => !o && setDeletingVendor(null)}
        title="Delete vendor?"
        description={deletingVendor ? `Are you sure you want to delete vendor "${deletingVendor.name}"?` : undefined}
        destructive
        loading={deleteVendorMutation.isPending}
        onConfirm={() => deletingVendor && deleteVendorMutation.mutate(deletingVendor.id)}
      />
    </div>
  );
}

function StaffFormDialog({
  staff,
  properties,
  open,
  onClose,
  onSaved,
}: {
  staff: Staff | null;
  properties: { id: string; name: string }[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState(() => ({
    name: staff?.name ?? "",
    phone: staff?.phone ?? "",
    email: staff?.email ?? "",
    role: staff?.role ?? "CARETAKER",
    propertyIds: staff?.properties ? staff.properties.map((p) => p.id) : [],
  }));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateStaffForm = (): boolean => {
    const errs: Record<string, string> = {};
    const nameErr = validateName(form.name, true, "Full Name");
    if (nameErr) errs.name = nameErr;

    const phoneErr = validatePhone(form.phone, true, "Phone Number");
    if (phoneErr) errs.phone = phoneErr;

    if (form.email) {
      const emailErr = validateEmail(form.email, false, "Email Address");
      if (emailErr) errs.email = emailErr;
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const mutation = useMutation({
    mutationFn: () => (staff ? api.updateStaff(staff.id, form) : api.createStaff(form)),
    onSuccess: () => {
      success(staff ? "Staff profile updated" : "Staff member created");
      onSaved();
    },
    onError: (e) => toastError("Save failed", e instanceof Error ? e.message : undefined),
  });

  const toggleProperty = (id: string) => {
    setForm((f) => ({
      ...f,
      propertyIds: f.propertyIds.includes(id) ? f.propertyIds.filter((p) => p !== id) : [...f.propertyIds, id],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl max-w-lg">
        <DialogHeader>
          <DialogTitle>{staff ? "Edit Staff Member" : "Add Staff Member"}</DialogTitle>
          <DialogDescription>Configure staff details and assign to managed properties.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (validateStaffForm()) {
              mutation.mutate();
            }
          }}
          className="space-y-4 pt-2"
        >
          <div className="space-y-1.5">
            <Label>Full Name *</Label>
            <Input
              required
              value={form.name}
              onChange={(e) => {
                setForm((f) => ({ ...f, name: e.target.value }));
                if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: "" }));
              }}
              className={cn("h-11 font-bold rounded-xl border-slate-300", fieldErrors.name && "border-rose-500")}
            />
            {fieldErrors.name && (
              <p className="text-[11px] font-bold text-rose-600 animate-in fade-in">{fieldErrors.name}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Phone Number *</Label>
            <Input
              required
              type="tel"
              value={form.phone}
              onChange={(e) => {
                setForm((f) => ({ ...f, phone: e.target.value }));
                if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: "" }));
              }}
              placeholder="e.g. 9876543210"
              className={cn("h-11 font-bold rounded-xl border-slate-300", fieldErrors.phone && "border-rose-500")}
            />
            {fieldErrors.phone && (
              <p className="text-[11px] font-bold text-rose-600 animate-in fade-in">{fieldErrors.phone}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Role *</Label>
            <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="h-11 font-bold rounded-xl border-slate-300">
              <option value="CARETAKER">Caretaker / Warden</option>
              <option value="MANAGER">Property Manager</option>
              <option value="CLEANER">Housekeeping / Cleaning</option>
              <option value="SECURITY">Security Guard</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-700">Assign to Properties (Multi-Select)</Label>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2.5 rounded-xl border border-slate-200 bg-slate-50">
              {properties.map((p) => {
                const checked = form.propertyIds.includes(p.id);
                return (
                  <label key={p.id} className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                    <input type="checkbox" checked={checked} onChange={() => toggleProperty(p.id)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    <span className="truncate">{p.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl border-slate-300 font-bold">
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending} className="bg-blue-600 hover:bg-blue-700 font-extrabold rounded-xl shadow-xs">
              {staff ? "Save Changes" : "Create Staff Member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VendorFormDialog({
  vendor,
  properties,
  open,
  onClose,
  onSaved,
}: {
  vendor: Vendor | null;
  properties: { id: string; name: string }[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState(() => ({
    name: vendor?.name ?? "",
    phone: vendor?.phone ?? "",
    service: vendor?.service ?? "PLUMBER",
    company: vendor?.company ?? "",
    address: vendor?.address ?? "",
    propertyIds: vendor?.properties ? vendor.properties.map((p) => p.id) : [],
  }));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateVendorForm = (): boolean => {
    const errs: Record<string, string> = {};
    const nameErr = validateName(form.name, true, "Vendor Name");
    if (nameErr) errs.name = nameErr;

    const phoneErr = validatePhone(form.phone, true, "Phone Number");
    if (phoneErr) errs.phone = phoneErr;

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const mutation = useMutation({
    mutationFn: () => (vendor ? api.updateVendor(vendor.id, form) : api.createVendor(form)),
    onSuccess: () => {
      success(vendor ? "Vendor updated" : "Vendor created");
      onSaved();
    },
    onError: (e) => toastError("Save failed", e instanceof Error ? e.message : undefined),
  });

  const toggleProperty = (id: string) => {
    setForm((f) => ({
      ...f,
      propertyIds: f.propertyIds.includes(id) ? f.propertyIds.filter((p) => p !== id) : [...f.propertyIds, id],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl max-w-lg">
        <DialogHeader>
          <DialogTitle>{vendor ? "Edit Service Vendor" : "Add Service Vendor"}</DialogTitle>
          <DialogDescription>Configure vendor trade details and assigned properties.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (validateVendorForm()) {
              mutation.mutate();
            }
          }}
          className="space-y-4 pt-2"
        >
          <div className="space-y-1.5">
            <Label>Vendor Name *</Label>
            <Input
              required
              value={form.name}
              onChange={(e) => {
                setForm((f) => ({ ...f, name: e.target.value }));
                if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: "" }));
              }}
              className={cn("h-11 font-bold rounded-xl border-slate-300", fieldErrors.name && "border-rose-500")}
            />
            {fieldErrors.name && (
              <p className="text-[11px] font-bold text-rose-600 animate-in fade-in">{fieldErrors.name}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Phone Number *</Label>
            <Input
              required
              type="tel"
              value={form.phone}
              onChange={(e) => {
                setForm((f) => ({ ...f, phone: e.target.value }));
                if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: "" }));
              }}
              placeholder="e.g. 9876543210"
              className={cn("h-11 font-bold rounded-xl border-slate-300", fieldErrors.phone && "border-rose-500")}
            />
            {fieldErrors.phone && (
              <p className="text-[11px] font-bold text-rose-600 animate-in fade-in">{fieldErrors.phone}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Service Type *</Label>
            <Select value={form.service} onChange={(e) => setForm((f) => ({ ...f, service: e.target.value }))} className="h-11 font-bold rounded-xl border-slate-300">
              <option value="PLUMBER">Plumbing</option>
              <option value="ELECTRICIAN">Electrical</option>
              <option value="CARPENTER">Carpentry</option>
              <option value="CLEANING">Sanitation / Cleaning</option>
              <option value="INTERNET">Wi-Fi / Network</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Company Name</Label>
            <Input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} placeholder="Company or contractor name" className="h-11 rounded-xl border-slate-300" />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-700">Assign to Properties (Multi-Select)</Label>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2.5 rounded-xl border border-slate-200 bg-slate-50">
              {properties.map((p) => {
                const checked = form.propertyIds.includes(p.id);
                return (
                  <label key={p.id} className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                    <input type="checkbox" checked={checked} onChange={() => toggleProperty(p.id)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    <span className="truncate">{p.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl border-slate-300 font-bold">
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending} className="bg-blue-600 hover:bg-blue-700 font-extrabold rounded-xl shadow-xs">
              {vendor ? "Save Changes" : "Create Vendor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
