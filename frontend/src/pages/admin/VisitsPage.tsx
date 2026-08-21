import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Plus, CheckCircle2, XCircle, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { Button, Card, CardContent, PageLoader } from "@/components/ui/primitives";
import { EmptyState, PageHeader, Pagination, StatusBadge } from "@/components/ui/data";
import type { PropertyVisit } from "@/types";

export default function VisitsPage() {
  const { success, error: toastError } = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["visits", page, statusFilter],
    queryFn: async () => {
      const res = await api.listVisits({ page, pageSize: 10, status: statusFilter || undefined });
      return res ?? { items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 };
    },
  });

  const { data: todayVisits } = useQuery({
    queryKey: ["todayVisits"],
    queryFn: async () => {
      const res = await api.getTodayVisits();
      return res ?? [];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.updateVisitStatus(id, { status }),
    onSuccess: () => {
      success("Visit Status Updated");
      qc.invalidateQueries({ queryKey: ["visits"] });
      qc.invalidateQueries({ queryKey: ["todayVisits"] });
    },
    onError: (e) => toastError("Failed to update status", e instanceof Error ? e.message : undefined),
  });

  const visits = data?.items ?? [];

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Property Walk-through Visits"
        description="Schedule and manage prospective tenant property walk-throughs."
      />

      {/* Today's Scheduled Visits Summary */}
      {!!todayVisits?.length && (
        <Card className="border border-blue-200 bg-blue-50/60 shadow-xs">
          <CardContent className="p-4 space-y-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-blue-700 flex items-center gap-2">
              <Clock className="size-4" /> Today's Scheduled Visits ({todayVisits.length})
            </h2>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {todayVisits.map((v) => (
                <div key={v.id} className="rounded-xl bg-white p-3 border border-blue-200/80 flex items-center justify-between text-xs shadow-2xs">
                  <div>
                    <span className="font-extrabold text-slate-900 block">{v.lead?.name}</span>
                    <span className="text-slate-500 font-semibold">{v.property?.name} · {new Date(v.visitDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="text-emerald-700 hover:bg-emerald-50 h-7 text-xs font-bold" onClick={() => updateStatusMutation.mutate({ id: v.id, status: "COMPLETED" })}>
                      ✓ Done
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border border-slate-200 bg-white shadow-xs overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <PageLoader />
          ) : !visits.length ? (
            <EmptyState icon={<Calendar className="size-6" />} title="No scheduled visits" description="Visits scheduled from CRM leads will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-black uppercase text-slate-600">
                  <tr>
                    <th className="px-4 py-3.5">Lead Name</th>
                    <th className="px-4 py-3.5">Property</th>
                    <th className="px-4 py-3.5">Visit Date & Time</th>
                    <th className="px-4 py-3.5">Assigned Staff</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {visits.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5 font-bold text-slate-900">{v.lead?.name ?? "—"}</td>
                      <td className="px-4 py-3.5 font-semibold text-slate-800">{v.property?.name ?? "—"}</td>
                      <td className="px-4 py-3.5 font-extrabold text-blue-600">{new Date(v.visitDate).toLocaleString()}</td>
                      <td className="px-4 py-3.5 text-slate-600 font-semibold">{v.assignedStaff?.name ?? "Unassigned"}</td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={v.status} />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {v.status === "SCHEDULED" && (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button size="sm" variant="outline" className="text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200 h-8 font-bold text-xs" onClick={() => updateStatusMutation.mutate({ id: v.id, status: "COMPLETED" })}>
                              Mark Completed
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
