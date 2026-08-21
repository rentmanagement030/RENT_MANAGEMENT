import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LogIn, LogOut, CheckCircle, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { Button, Card, CardContent, PageLoader } from "@/components/ui/primitives";
import { PageHeader, StatusBadge } from "@/components/ui/data";

export default function PgOperationsPage() {
  const { success, error: toastError } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"guests" | "leaves">("guests");

  const { data: guestsData, isLoading: guestsLoading } = useQuery({
    queryKey: ["pgGuests"],
    queryFn: async () => {
      const res = await api.listGuestLogs();
      return res ?? { items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 };
    },
  });

  const { data: leavesData, isLoading: leavesLoading } = useQuery({
    queryKey: ["pgLeaves"],
    queryFn: async () => {
      const res = await api.listTenantLeaves();
      return res ?? { items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 };
    },
  });

  const markExitMutation = useMutation({
    mutationFn: (id: string) => api.markGuestExit(id),
    onSuccess: () => {
      success("Guest Exit Recorded");
      qc.invalidateQueries({ queryKey: ["pgGuests"] });
    },
  });

  const updateLeaveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.updateLeaveStatus(id, { status }),
    onSuccess: () => {
      success("Leave Request Updated");
      qc.invalidateQueries({ queryKey: ["pgLeaves"] });
    },
  });

  const guests = guestsData?.items ?? [];
  const leaves = leavesData?.items ?? [];

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="PG Operations & Security" description="Track PG guest entry/exit logs and tenant leave applications." />

      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("guests")}
          className={`pb-2.5 px-4 text-xs font-black border-b-2 transition-all ${
            activeTab === "guests" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Guest Entry/Exit Register ({guests.length})
        </button>
        <button
          onClick={() => setActiveTab("leaves")}
          className={`pb-2.5 px-4 text-xs font-black border-b-2 transition-all ${
            activeTab === "leaves" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Tenant Leave Applications ({leaves.length})
        </button>
      </div>

      <Card className="border border-slate-200 bg-white shadow-xs overflow-hidden">
        <CardContent className="p-0">
          {activeTab === "guests" ? (
            guestsLoading ? (
              <PageLoader />
            ) : !guests.length ? (
              <div className="p-6 text-center text-xs font-bold text-slate-500">No guest logs found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-black uppercase text-slate-600">
                    <tr>
                      <th className="px-4 py-3.5">Guest Name & Phone</th>
                      <th className="px-4 py-3.5">Visiting Resident</th>
                      <th className="px-4 py-3.5">Entry Time</th>
                      <th className="px-4 py-3.5">Exit Time</th>
                      <th className="px-4 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {guests.map((g) => (
                      <tr key={g.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5 font-extrabold text-slate-900">
                          {g.guestName} <span className="text-slate-400 text-xs font-normal">({g.guestPhone})</span>
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-slate-800">{g.tenant?.name ?? "—"}</td>
                        <td className="px-4 py-3.5 text-blue-600 font-extrabold">{new Date(g.entryDate).toLocaleString()}</td>
                        <td className="px-4 py-3.5 font-semibold text-slate-600">{g.exitDate ? new Date(g.exitDate).toLocaleString() : "Inside PG"}</td>
                        <td className="px-4 py-3.5 text-right">
                          {!g.exitDate && (
                            <Button size="sm" variant="outline" className="text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200 h-8 font-bold text-xs" onClick={() => markExitMutation.mutate(g.id)}>
                              Mark Exit
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : leavesLoading ? (
            <PageLoader />
          ) : !leaves.length ? (
            <div className="p-6 text-center text-xs font-bold text-slate-500">No leave requests found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-black uppercase text-slate-600">
                  <tr>
                    <th className="px-4 py-3.5">Resident</th>
                    <th className="px-4 py-3.5">Leave Period</th>
                    <th className="px-4 py-3.5">Reason</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {leaves.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5 font-extrabold text-slate-900">{l.tenant?.name}</td>
                      <td className="px-4 py-3.5 font-bold text-blue-600">
                        {formatDate(l.startDate)} → {formatDate(l.endDate)}
                      </td>
                      <td className="px-4 py-3.5 text-slate-700 font-semibold">{l.reason}</td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={l.status} />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {l.status === "PENDING" && (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8 font-bold text-xs" onClick={() => updateLeaveMutation.mutate({ id: l.id, status: "APPROVED" })}>
                              Approve
                            </Button>
                            <Button size="sm" variant="outline" className="text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200 h-8 font-bold text-xs" onClick={() => updateLeaveMutation.mutate({ id: l.id, status: "REJECTED" })}>
                              Reject
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
