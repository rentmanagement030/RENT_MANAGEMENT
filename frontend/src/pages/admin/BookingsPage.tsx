import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Plus, Ban, CheckCircle } from "lucide-react";
import { api } from "@/lib/api";
import { formatINR, formatDate } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { Button, Card, CardContent, PageLoader } from "@/components/ui/primitives";
import { EmptyState, PageHeader, Pagination, StatusBadge } from "@/components/ui/data";
import type { Booking } from "@/types";

export default function BookingsPage() {
  const { success, error: toastError } = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["bookings", page],
    queryFn: async () => {
      const res = await api.listBookings({ page, pageSize: 10 });
      return res ?? { items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 };
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.cancelBooking(id, "Cancelled by Admin"),
    onSuccess: () => {
      success("Booking Cancelled", "Bed status released back to Available.");
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["properties"] });
    },
    onError: (e) => toastError("Cancel failed", e instanceof Error ? e.message : undefined),
  });

  const bookings = data?.items ?? [];

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Room & Bed Reservations (Token System)"
        description="Transaction-safe room and bed reservations with double-booking prevention."
      />

      <Card className="border border-slate-200 bg-white shadow-xs overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <PageLoader />
          ) : !bookings.length ? (
            <EmptyState icon={<Bookmark className="size-6" />} title="No active bookings" description="Token reservations will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-black uppercase text-slate-600">
                  <tr>
                    <th className="px-4 py-3.5">Booking #</th>
                    <th className="px-4 py-3.5">Lead / Tenant</th>
                    <th className="px-4 py-3.5">Property & Room/Bed</th>
                    <th className="px-4 py-3.5">Token Paid</th>
                    <th className="px-4 py-3.5">Expiry Date</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5 font-bold text-slate-900">{b.bookingNumber}</td>
                      <td className="px-4 py-3.5 font-semibold text-slate-800">{b.lead?.name || b.tenant?.name || "Anonymous"}</td>
                      <td className="px-4 py-3.5 font-semibold text-slate-700">
                        {b.property?.name} · Room {b.room?.roomNumber} (Bed {b.bed?.bedNumber})
                      </td>
                      <td className="px-4 py-3.5 font-black text-blue-600">{formatINR(b.tokenAmount)}</td>
                      <td className="px-4 py-3.5 text-slate-600 font-semibold">{formatDate(b.expiryDate)}</td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={b.status} />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {b.status === "RESERVED" && (
                          <Button size="sm" variant="outline" className="text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200 h-8 font-bold text-xs" onClick={() => cancelMutation.mutate(b.id)}>
                            <Ban className="size-3.5 mr-1" /> Cancel Token
                          </Button>
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
