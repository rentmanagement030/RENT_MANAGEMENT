import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Wrench, Plus, Building2 } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { usePageResetOnFilter } from "@/hooks/usePageResetOnFilter";
import { useAuth } from "@/auth/AuthContext";
import { PERMISSIONS } from "@/lib/permissions";
import { Button, Card, CardContent, Input, Label, PageLoader, Select, Textarea } from "@/components/ui/primitives";
import { EmptyState, PageHeader, Pagination, StatusBadge } from "@/components/ui/data";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import type { MaintenanceRequest, Property } from "@/types";

export default function MaintenancePage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  usePageResetOnFilter(setPage, statusFilter);
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["maintenance", page, statusFilter],
    queryFn: () => api.listMaintenance({ page, pageSize: 10, status: statusFilter || undefined }),
  });

  useEffect(() => {
    if (searchParams.get("action") === "new" && can(PERMISSIONS.MAINTENANCE_MANAGE)) {
      setCreating(true);
      searchParams.delete("action");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, can]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["maintenance"] });

  const statuses = [
    { label: "All Statuses", value: "" },
    { label: "Open", value: "OPEN" },
    { label: "In Progress", value: "IN_PROGRESS" },
    { label: "Resolved", value: "RESOLVED" },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Maintenance & Issue Requests"
        description="Track tenant complaint logs, plumbing repairs, electrical work, and property upkeep."
        actions={
          can(PERMISSIONS.MAINTENANCE_MANAGE) ? (
            <Button onClick={() => setCreating(true)} className="bg-blue-600 hover:bg-blue-700 font-extrabold shadow-xs">
              <Plus className="size-4" /> New Maintenance Request
            </Button>
          ) : undefined
        }
      />

      <Card className="border border-slate-200 bg-white shadow-xs">
        <CardContent className="flex items-center gap-1.5 overflow-x-auto scrollbar-none p-4">
          {statuses.map((st) => (
            <button
              key={st.value}
              onClick={() => setStatusFilter(st.value)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-extrabold transition-all active:scale-95 min-h-[36px] flex items-center ${
                statusFilter === st.value
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 border border-slate-200/80 hover:bg-slate-200/60"
              }`}
            >
              {st.label}
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="border border-slate-200 bg-white shadow-xs overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <PageLoader />
          ) : !data?.items.length ? (
            <EmptyState icon={<Wrench className="size-6 text-slate-400" />} title="No maintenance requests" description="Everything is in good condition! No repair requests reported." />
          ) : (
            <>
              {/* Mobile Card List View */}
              <ul className="divide-y divide-slate-100 lg:hidden space-y-3 p-3">
                {data.items.map((m) => (
                  <li key={m.id} className="p-4 space-y-3 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-base text-slate-900 flex items-center gap-1.5">
                          <Building2 className="size-4 text-blue-600 inline" /> {m.property?.name}
                          {m.room ? <span className="text-slate-500 font-semibold"> · Room {m.room.roomNumber}</span> : null}
                        </p>
                        <p className="text-xs font-semibold text-slate-500 mt-0.5">{formatDateTime(m.createdAt)}</p>
                      </div>
                      <StatusBadge status={m.status} />
                    </div>

                    <p className="text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                      {m.description}
                    </p>

                    {can(PERMISSIONS.MAINTENANCE_MANAGE) && m.status !== "RESOLVED" && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-slate-600 font-bold">Update Status:</span>
                        <StatusUpdate item={m} onChanged={invalidate} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              {/* High-Contrast Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-600">
                    <tr>
                      <th className="px-4 py-3.5">Property / Room</th>
                      <th className="px-4 py-3.5">Description</th>
                      <th className="px-4 py-3.5">Reported On</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {data.items.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5 font-black text-slate-900">
                          {m.property?.name}
                          {m.room ? <span className="text-xs font-bold text-slate-500"> · Room {m.room.roomNumber}</span> : null}
                        </td>
                        <td className="max-w-md px-4 py-3.5 text-slate-800 font-medium">
                          <p className="line-clamp-2">{m.description}</p>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 font-semibold">{formatDateTime(m.createdAt)}</td>
                        <td className="px-4 py-3.5">
                          <StatusBadge status={m.status} />
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex justify-end">
                            {can(PERMISSIONS.MAINTENANCE_MANAGE) && m.status !== "RESOLVED" && (
                              <StatusUpdate item={m} onChanged={invalidate} />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-slate-200 p-4 bg-slate-50/50">
                <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {creating && (
        <CreateDialog
          open={creating}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            invalidate();
          }}
        />
      )}
    </div>
  );
}

function StatusUpdate({ item, onChanged }: { item: any; onChanged: () => void }) {
  const { success, error: toastError } = useToast();
  const [openResolve, setOpenResolve] = useState(false);
  const [actualCost, setActualCost] = useState(item.actualCost ? String(item.actualCost) : "");
  const [createExpense, setCreateExpense] = useState(true);
  const [expenseCategory, setExpenseCategory] = useState("Maintenance & Repairs");

  const { data: staffData } = useQuery({ queryKey: ["staff", "all"], queryFn: () => api.listStaff({ pageSize: 100 }) });
  const { data: vendorData } = useQuery({ queryKey: ["vendors", "all"], queryFn: () => api.listVendors({ pageSize: 100 }) });

  const [assignedStaffId, setAssignedStaffId] = useState(item.assignedStaffId ?? "");
  const [assignedVendorId, setAssignedVendorId] = useState(item.assignedVendorId ?? "");

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.updateMaintenance(item.id, body),
    onSuccess: () => {
      success("Maintenance updated");
      setOpenResolve(false);
      onChanged();
    },
    onError: (e) => toastError("Failed", e instanceof Error ? e.message : undefined),
  });

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Select
        className="h-9 w-32 text-xs font-bold rounded-xl border-slate-300 bg-white"
        value={item.status}
        onChange={(e) => {
          const val = e.target.value;
          if (val === "RESOLVED") {
            setOpenResolve(true);
          } else {
            mutation.mutate({ status: val });
          }
        }}
        disabled={mutation.isPending}
      >
        <option value="OPEN">Open</option>
        <option value="IN_PROGRESS">In Progress</option>
        <option value="RESOLVED">Resolved</option>
      </Select>

      <Dialog open={openResolve} onOpenChange={setOpenResolve}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black text-slate-900">Complete & Record Cost</DialogTitle>
            <DialogDescription>Enter actual completion cost and create a property expense.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4 pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate({
                status: "RESOLVED",
                assignedStaffId: assignedStaffId || null,
                assignedVendorId: assignedVendorId || null,
                actualCost: actualCost ? Number(actualCost) : null,
                createExpense,
                expenseCategory,
              });
            }}
          >
            <div className="space-y-1">
              <Label className="text-xs font-bold">Assign Staff Member</Label>
              <Select value={assignedStaffId} onChange={(e) => setAssignedStaffId(e.target.value)} className="h-10 text-xs font-semibold rounded-xl border-slate-300">
                <option value="">No Staff Assigned</option>
                {(staffData?.items ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                ))}
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Assign Service Vendor</Label>
              <Select value={assignedVendorId} onChange={(e) => setAssignedVendorId(e.target.value)} className="h-10 text-xs font-semibold rounded-xl border-slate-300">
                <option value="">No Vendor Assigned</option>
                {(vendorData?.items ?? []).map((v) => (
                  <option key={v.id} value={v.id}>{v.name} ({v.service})</option>
                ))}
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Actual Completion Cost (₹)</Label>
              <Input type="number" min={0} value={actualCost} onChange={(e) => setActualCost(e.target.value)} placeholder="e.g. 2500" className="h-10 font-bold rounded-xl border-slate-300" />
            </div>

            <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 space-y-2">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                <input type="checkbox" checked={createExpense} onChange={(e) => setCreateExpense(e.target.checked)} className="rounded-md text-blue-600 size-4" />
                Record as Property Expense automatically
              </label>
              {createExpense && (
                <div className="space-y-1 pt-1">
                  <Label className="text-[11px] font-semibold text-slate-600">Expense Category</Label>
                  <Select value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value)} className="h-9 text-xs font-semibold bg-white rounded-xl border-slate-300">
                    <option value="Maintenance & Repairs">Maintenance & Repairs</option>
                    <option value="Plumbing">Plumbing</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Carpentry">Carpentry</option>
                    <option value="Cleaning">Cleaning & Sanitation</option>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenResolve(false)} className="rounded-xl border-slate-300 font-bold">
                Cancel
              </Button>
              <Button type="submit" loading={mutation.isPending} className="bg-emerald-600 hover:bg-emerald-700 font-black rounded-xl shadow-xs text-white">
                Mark Resolved & Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { success, error: toastError } = useToast();
  const [propertyId, setPropertyId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [priority, setPriority] = useState("MEDIUM");
  const [assignedStaffId, setAssignedStaffId] = useState("");
  const [assignedVendorId, setAssignedVendorId] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [description, setDescription] = useState("");

  const { data: properties } = useQuery({ queryKey: ["properties", "all"], queryFn: () => api.listProperties({ pageSize: 200 }) });
  const { data: staffData } = useQuery({ queryKey: ["staff", "all"], queryFn: () => api.listStaff({ pageSize: 100 }) });
  const { data: vendorData } = useQuery({ queryKey: ["vendors", "all"], queryFn: () => api.listVendors({ pageSize: 100 }) });

  const propList = properties?.items ?? [];
  const selectedProperty = propList.find((p) => p.id === propertyId);

  const mutation = useMutation({
    mutationFn: () =>
      api.createMaintenance({
        propertyId,
        roomId: roomId || undefined,
        category,
        priority,
        assignedStaffId: assignedStaffId || undefined,
        assignedVendorId: assignedVendorId || undefined,
        estimatedCost: estimatedCost ? Number(estimatedCost) : undefined,
        description,
      }),
    onSuccess: () => {
      success("Maintenance request created");
      onSaved();
    },
    onError: (e) => toastError("Creation failed", e instanceof Error ? e.message : undefined),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-black text-slate-900">New Maintenance Request</DialogTitle>
          <DialogDescription>Log a repair issue for a property or specific room.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3.5 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold">Property *</Label>
              <Select required value={propertyId} onChange={(e) => { setPropertyId(e.target.value); setRoomId(""); }} className="h-10 text-xs font-bold rounded-xl border-slate-300">
                <option value="">Choose Property</option>
                {propList.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.city})</option>
                ))}
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Category</Label>
              <Select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 text-xs font-bold rounded-xl border-slate-300">
                <option value="GENERAL">General</option>
                <option value="PLUMBING">Plumbing</option>
                <option value="ELECTRICAL">Electrical</option>
                <option value="CARPENTRY">Carpentry</option>
                <option value="CLEANING">Cleaning</option>
              </Select>
            </div>
          </div>

          {selectedProperty && selectedProperty.type === "PG" && (selectedProperty.rooms ?? []).length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs font-bold">Specific PG Room</Label>
              <Select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="h-10 text-xs font-bold rounded-xl border-slate-300">
                <option value="">Entire Building / General</option>
                {selectedProperty.rooms?.map((r) => (
                  <option key={r.id} value={r.id}>Room {r.roomNumber}</option>
                ))}
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold">Assign Staff</Label>
              <Select value={assignedStaffId} onChange={(e) => setAssignedStaffId(e.target.value)} className="h-10 text-xs font-semibold rounded-xl border-slate-300">
                <option value="">No Staff Assigned</option>
                {(staffData?.items ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                ))}
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Assign Vendor</Label>
              <Select value={assignedVendorId} onChange={(e) => setAssignedVendorId(e.target.value)} className="h-10 text-xs font-semibold rounded-xl border-slate-300">
                <option value="">No Vendor Assigned</option>
                {(vendorData?.items ?? []).map((v) => (
                  <option key={v.id} value={v.id}>{v.name} ({v.service})</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold">Priority</Label>
              <Select value={priority} onChange={(e) => setPriority(e.target.value)} className="h-10 text-xs font-bold rounded-xl border-slate-300">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Estimated Cost (₹)</Label>
              <Input type="number" min={0} value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} placeholder="e.g. 1500" className="h-10 font-bold rounded-xl border-slate-300" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-bold">Issue Description *</Label>
            <Textarea required minLength={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe problem (e.g. bathroom pipe leaking, AC not cooling)..." rows={3} className="rounded-xl border-slate-300 text-xs" />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl border-slate-300 font-bold">
              Cancel
            </Button>
            <Button type="submit" disabled={!propertyId || !description} loading={mutation.isPending} className="bg-blue-600 hover:bg-blue-700 font-extrabold rounded-xl shadow-xs">
              Log Maintenance Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
