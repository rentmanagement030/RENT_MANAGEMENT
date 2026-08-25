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
    queryFn: () => api.listNotifications({ page, pageSize: 15, status: statusFilter || undefined }),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
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

  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    success("Message Copied", "Notification text copied to clipboard.");
  };

  const handleOpenWhatsApp = (phoneStr: string, bodyText: string) => {
    const digits = phoneStr.replace(/[^0-9]/g, "");
    const fullPhone = digits.length === 10 ? `91${digits}` : digits;
    const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(bodyText)}`;
    window.open(url, "_blank");
  };

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
            <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center sm:gap-2">
              <Button
                variant="outline"
                loading={testSchedulerMutation.isPending}
                onClick={() => testSchedulerMutation.mutate()}
                className="h-10 px-2 sm:px-3 rounded-xl font-bold text-[11px] sm:text-xs border-slate-300 text-slate-700 hover:bg-slate-50 shadow-2xs flex items-center justify-center truncate w-full"
              >
                <Play className="size-3.5 mr-1 text-emerald-500 shrink-0" />
                <span className="truncate">Scheduler Test</span>
              </Button>
              <Button
                variant="outline"
                loading={triggerMutation.isPending}
                onClick={() => triggerMutation.mutate()}
                className="h-10 px-2 sm:px-3 rounded-xl font-bold text-[11px] sm:text-xs border-slate-300 text-slate-700 hover:bg-slate-50 shadow-2xs flex items-center justify-center truncate w-full"
              >
                <BellRing className="size-3.5 mr-1 text-slate-500 shrink-0" />
                <span className="truncate">Force Queue</span>
              </Button>
              <Button
                onClick={() => setComposing(true)}
                className="col-span-2 sm:col-auto h-10 px-3 sm:px-4 rounded-xl font-bold text-[11px] sm:text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-2xs flex items-center justify-center truncate w-full sm:w-auto"
              >
                <Send className="size-3.5 mr-1 shrink-0" />
                <span className="truncate">Send Manual Message</span>
              </Button>
            </div>
          ) : undefined
        }
      />

      {configStatus.data && (!configStatus.data.whatsapp || !configStatus.data.email) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="space-y-1 text-xs">
              <p className="font-black text-amber-950 text-sm">Delivery Channels Configuration Notice</p>
              <p className="font-semibold text-amber-900 leading-relaxed">
                {!configStatus.data.whatsapp && "Meta WhatsApp Cloud API credentials not configured in backend/.env. "}
                1-tap WhatsApp direct delivery is active on all notification cards below.
              </p>
            </div>
          </div>
        </div>
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

      <Card className="border border-slate-200 shadow-xs">
        <CardContent className="p-0">
          {isLoading ? (
            <PageLoader />
          ) : !data?.items.length ? (
            <EmptyState icon={<Bell className="size-6" />} title="No notification logs" description="Automatic reminders and bills will appear here when processed by the backend scheduler." />
          ) : (
            <>
              {/* Card List View */}
              <ul className="divide-y divide-slate-100">
                {data.items.map((n) => {
                  const channelColor =
                    n.channel === "WHATSAPP"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : n.channel === "EMAIL"
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-purple-50 text-purple-700 border-purple-200";

                  return (
                    <li key={n.id} className="p-4 sm:p-5 space-y-3 hover:bg-slate-50/50 transition-colors">
                      {/* Top Row: Name, Status Badge, Timestamp */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-extrabold text-sm sm:text-base text-slate-900 truncate">
                            {n.tenant?.name ?? "Direct Recipient"}
                          </p>
                          <p className="text-xs text-slate-500 font-mono font-bold mt-0.5">{n.to}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <StatusBadge status={n.status} />
                          <p className="text-[10px] text-slate-400 font-bold mt-1">
                            {formatDateTime(n.sentAt ?? n.createdAt)}
                          </p>
                        </div>
                      </div>

                      {/* Tag Row: Channel & Notification Type */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${channelColor}`}>
                          {n.channel}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                          {n.type.replace(/_/g, " ")}
                        </span>
                      </div>

                      {/* Message Content Bubble */}
                      <div className="text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-3.5 font-sans leading-relaxed whitespace-pre-wrap break-words">
                        {n.body}
                      </div>

                      {n.error && (
                        <p className="text-xs font-mono font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-1.5">
                          Failure details: {n.error}
                        </p>
                      )}

                      {/* Action Row */}
                      <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleCopyMessage(n.body)}
                            className="h-8 text-xs font-bold text-slate-700 border-slate-200 hover:bg-slate-100 rounded-lg px-2.5"
                          >
                            Copy Text
                          </Button>
                        </div>

                        <div className="flex items-center gap-2">
                          {(n.channel === "WHATSAPP" || n.to.replace(/[^0-9]/g, "").length >= 10) && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleOpenWhatsApp(n.to, n.body)}
                              className="h-8 text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 shadow-xs flex items-center gap-1"
                            >
                              <Send className="size-3" /> Send via WhatsApp
                            </Button>
                          )}

                          {n.status === "FAILED" && can(PERMISSIONS.NOTIFICATIONS_MANAGE) && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              loading={resendMutation.isPending}
                              onClick={() => resendMutation.mutate(n.id)}
                              className="h-8 text-xs font-bold border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg px-2.5"
                            >
                              <RefreshCw className="size-3 mr-1" /> Retry API
                            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
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
