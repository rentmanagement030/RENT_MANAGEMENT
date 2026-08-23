import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing, Play, RefreshCw, Send } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { usePageResetOnFilter } from "@/hooks/usePageResetOnFilter";
import { useAuth } from "@/auth/AuthContext";
import { PERMISSIONS } from "@/lib/permissions";
import { Button, Card, CardContent, Input, Label, PageLoader, Select, Textarea } from "@/components/ui/primitives";
import { EmptyState, PageHeader, Pagination, StatusBadge } from "@/components/ui/data";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";

export default function NotificationsPage() {
  const { can } = useAuth();
  const { success, error: toastError } = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  usePageResetOnFilter(setPage, statusFilter);
  const [composing, setComposing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["notifications", page, statusFilter],
    queryFn: () => api.listNotifications({ page, pageSize: 10, status: statusFilter || undefined }),
  });

  const configStatus = useQuery({ queryKey: ["notification-status"], queryFn: () => api.notificationStatus() });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["notifications"] });

  const triggerMutation = useMutation({
    mutationFn: () => api.triggerReminders(),
    onSuccess: () => {
      success("Reminders triggered");
      invalidate();
    },
    onError: (e) => toastError("Failed", e instanceof Error ? e.message : undefined),
  });

  const testSchedulerMutation = useMutation({
    mutationFn: () => api.triggerTestScheduler(),
    onSuccess: (res) => {
      success("Test Scheduler Executed", `${res.sent} sent, ${res.skipped} skipped (duplicates avoided), ${res.failed} failed.`);
      invalidate();
    },
    onError: (e) => toastError("Test failed", e instanceof Error ? e.message : undefined),
  });

  const resendMutation = useMutation({
    mutationFn: (id: string) => api.resendNotification(id),
    onSuccess: (res) => {
      if (res.ok) success("Notification resent successfully");
      else toastError("Resend failed", res.error);
      invalidate();
    },
    onError: (e) => toastError("Resend error", e instanceof Error ? e.message : undefined),
  });

  const statuses = [
    { label: "All Statuses", value: "" },
    { label: "Sent", value: "SENT" },
    { label: "Failed", value: "FAILED" },
    { label: "Unconfigured", value: "NOT_CONFIGURED" },
    { label: "Skipped", value: "SKIPPED" },
    { label: "Pending", value: "PENDING" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automated Notifications & Logs"
        description="Audit log of backend automatic rent reminders, payment links, and WhatsApp deliveries."
        actions={
          can(PERMISSIONS.NOTIFICATIONS_MANAGE) ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" loading={testSchedulerMutation.isPending} onClick={() => testSchedulerMutation.mutate()}>
                <Play className="size-3.5 text-emerald-400" /> Run Auto Scheduler Test
              </Button>
              <Button variant="outline" size="sm" loading={triggerMutation.isPending} onClick={() => triggerMutation.mutate()}>
                <BellRing className="size-3.5" /> Force Queue
              </Button>
              <Button size="sm" onClick={() => setComposing(true)}>
                <Send className="size-3.5" /> Send Manual Message
              </Button>
            </div>
          ) : undefined
        }
      />

      {configStatus.data && (!configStatus.data.whatsapp || !configStatus.data.email) && (
        <Card className="border-amber-500/30 bg-amber-500/10 text-amber-300">
          <CardContent className="flex flex-col gap-1 pt-4 text-xs">
            <p className="font-bold text-amber-200">Delivery Channels Warning</p>
            <p className="text-amber-300/80">
              {!configStatus.data.whatsapp && "Meta WhatsApp Cloud API credentials missing in backend/.env. "}
              1-tap WhatsApp sharing links remain fully active for all admin users.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-5 pb-1">
          {statuses.map((st) => (
            <button
              key={st.value}
              onClick={() => setStatusFilter(st.value)}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold transition-all active:scale-95 ${
                statusFilter === st.value
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : "bg-slate-100 text-slate-700 border border-slate-200/80 hover:bg-slate-200/60"
              }`}
            >
              {st.label}
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <PageLoader />
          ) : !data?.items.length ? (
            <EmptyState icon={<Bell className="size-6" />} title="No notification logs" description="Automatic reminders will appear here when processed by the backend scheduler." />
          ) : (
            <>
              {/* Mobile Card List View */}
              <ul className="divide-y divide-slate-100">
                {data.items.map((n) => (
                  <li key={n.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-extrabold text-sm text-slate-900">{n.tenant?.name ?? n.to}</p>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                            {n.channel} · {n.type.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">{n.to}</p>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={n.status} />
                        <p className="text-[10px] text-slate-400 font-medium mt-1">{formatDateTime(n.sentAt ?? n.createdAt)}</p>
                      </div>
                    </div>

                    <p className="text-xs text-slate-800 bg-slate-50 border border-slate-200/80 rounded-xl p-3 font-sans leading-relaxed">
                      {n.body}
                    </p>

                    {n.error && (
                      <p className="text-xs font-mono text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1">
                        Failure details: {n.error}
                      </p>
                    )}

                    {n.status === "FAILED" && can(PERMISSIONS.NOTIFICATIONS_MANAGE) && (
                      <div className="flex justify-end pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          loading={resendMutation.isPending}
                          onClick={() => resendMutation.mutate(n.id)}
                          className="border-rose-200 text-rose-700 hover:bg-rose-50"
                        >
                          <RefreshCw className="size-3.5" /> Resend Message
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <div className="border-t border-slate-100">
                <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {composing && (
        <ComposeDialog
          open={composing}
          onClose={() => setComposing(false)}
          onSaved={() => {
            setComposing(false);
            invalidate();
          }}
        />
      )}
    </div>
  );
}

function ComposeDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { success, error: toastError } = useToast();
  const { data: tenants } = useQuery({ queryKey: ["tenants", "all"], queryFn: () => api.listTenants({ pageSize: 200 }) });
  const [form, setForm] = useState({
    tenantId: "",
    to: "",
    channel: "WHATSAPP",
    type: "GENERAL",
    subject: "",
    body: "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.sendNotification({
        tenantId: form.tenantId || undefined,
        to: form.to || undefined,
        channel: form.channel,
        type: form.type,
        subject: form.subject || undefined,
        body: form.body,
      }),
    onSuccess: (r) => {
      success(r.sent ? "Message sent" : "Message queued");
      onSaved();
    },
    onError: (e) => toastError("Failed", e instanceof Error ? e.message : undefined),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Send message</DialogTitle>
          <DialogDescription>Deliver a notification to a tenant via the configured channel.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>Tenant</Label>
            <Select
              value={form.tenantId}
              onChange={(e) => setForm((f) => ({ ...f, tenantId: e.target.value }))}
            >
              <option value="">Manual recipient / Custom Number</option>
              {(tenants?.items ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.phone}
                </option>
              ))}
            </Select>
          </div>
          {!form.tenantId ? (
            <div className="space-y-1.5">
              <Label>Recipient Phone / Email *</Label>
              <Input
                required
                placeholder="e.g. 7904006320"
                value={form.to}
                onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Channel *</Label>
              <Select value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
              </Select>
            </div>
          )}
          {!form.tenantId && (
            <div className="space-y-1.5">
              <Label>Channel *</Label>
              <Select value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              <option value="GENERAL">General</option>
              <option value="RENT_DUE">Rent due</option>
              <option value="RENT_OVERDUE">Rent overdue</option>
              <option value="PAYMENT_CONFIRMATION">Payment confirmation</option>
              <option value="PAYMENT_LINK">Payment link</option>
              <option value="AGREEMENT_EXPIRY">Agreement expiry</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Message *</Label>
            <Textarea required value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Send
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
