import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Building2, KeyRound, Monitor, Save, ShieldCheck, Bell } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useAuth } from "@/auth/AuthContext";
import { PERMISSIONS } from "@/lib/permissions";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, FilterSelect, Input, Label, PageLoader } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

export default function SettingsPage() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"GENERAL" | "RENT_PENALTY" | "NOTIFICATIONS" | "TAX_UTILITIES" | "SECURITY">("GENERAL");

  const { data: settings, isLoading } = useQuery({ queryKey: ["settings"], queryFn: () => api.getSettings() });
  const { data: sessions, refetch: refetchSessions } = useQuery({ queryKey: ["sessions"], queryFn: () => api.sessions() });

  const [company, setCompany] = useState<Record<string, string>>({});
  const [num, setNum] = useState<Record<string, string>>({});
  const [bool, setBool] = useState<Record<string, boolean>>({});

  // hydrate once
  const [hydrated, setHydrated] = useState(false);
  if (settings && !hydrated) {
    const c: Record<string, string> = {};
    const n: Record<string, string> = {};
    const b: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(settings)) {
      if (["rentDueDay", "rentReminderDays", "agreementReminderDays", "latePenaltyPerDay", "latePenaltyStartDay", "billingPenaltyRate", "kycConfidenceThreshold", "kyc.confidenceThreshold"].includes(k)) n[k] = String(v);
      else if (["notificationWhatsAppEnabled", "notificationEmailEnabled", "enablePropertyTaxReminders", "enableWaterTaxReminders", "enableEbReminders"].includes(k)) b[k] = Boolean(v);
      else if (k !== "currency") c[k] = String(v ?? "");
    }
    if (!n.latePenaltyPerDay && n.billingPenaltyRate) n.latePenaltyPerDay = n.billingPenaltyRate;
    if (!n.latePenaltyPerDay) n.latePenaltyPerDay = "50";
    if (!n.latePenaltyStartDay) n.latePenaltyStartDay = "10";
    if (!n.kycConfidenceThreshold) n.kycConfidenceThreshold = n["kyc.confidenceThreshold"] || "90";
    setCompany(c);
    setNum(n);
    setBool(b);
    setHydrated(true);
  }

  const settingsMutation = useMutation({
    mutationFn: () =>
      api.updateSettings({
        ...Object.fromEntries(Object.entries(company).filter(([, v]) => v)),
        ...Object.fromEntries(Object.entries(num).map(([k, v]) => [k, Number(v)])),
        ...bool,
      }),
    onSuccess: () => {
      success("Settings saved successfully");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e) => toastError("Save failed", e instanceof Error ? e.message : undefined),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.revokeSession(id),
    onSuccess: () => {
      success("Session revoked");
      refetchSessions();
    },
    onError: (e) => toastError("Failed to revoke", e instanceof Error ? e.message : undefined),
  });

  if (isLoading || !settings) return <PageLoader />;

  const hasSettingsPermission = user?.isSuperAdmin || user?.permissions.includes(PERMISSIONS.SETTINGS_MANAGE);

  const tabList = [
    { id: "GENERAL", label: "GENERAL", icon: Building2 },
    { id: "RENT_PENALTY", label: "RENT & LATE PENALTY", icon: Banknote },
    { id: "NOTIFICATIONS", label: "NOTIFICATIONS & ALERTS", icon: Bell },
    { id: "TAX_UTILITIES", label: "TAX & UTILITIES", icon: Save },
    { id: "SECURITY", label: "SECURITY & SESSIONS", icon: KeyRound },
  ] as const;

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">System Settings</h1>
        <p className="mt-1 text-xs sm:text-sm font-semibold text-slate-500">
          Manage company profile, rent rules, late payment penalties, automatic KYC verification thresholds and security controls.
        </p>
      </div>

      {/* Tab Header Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200 no-scrollbar">
        {tabList.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap min-h-[44px] ${
                isActive
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                  : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200"
              }`}
            >
              <Icon className="size-4 shrink-0" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT PANELS */}
      <div className="space-y-6">
        {/* 1. GENERAL COMPANY PROFILE */}
        {activeTab === "GENERAL" && (
          <Card className="border border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50/60 border-b border-slate-100 pb-4">
              <CardTitle className="text-base font-black text-slate-900">Company Information</CardTitle>
              <CardDescription className="text-xs font-semibold text-slate-500">
                Business branding details rendered on receipts, invoices, and public rental listings.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-800 text-xs">Business Name *</Label>
                  <Input value={company.businessName ?? ""} onChange={(e) => setCompany((f) => ({ ...f, businessName: e.target.value }))} className="h-11 font-bold rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-800 text-xs">Support Phone *</Label>
                  <Input value={company.businessPhone ?? ""} onChange={(e) => setCompany((f) => ({ ...f, businessPhone: e.target.value }))} className="h-11 font-bold rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-800 text-xs">Support Email *</Label>
                  <Input value={company.businessEmail ?? ""} onChange={(e) => setCompany((f) => ({ ...f, businessEmail: e.target.value }))} className="h-11 font-bold rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-800 text-xs">Logo URL</Label>
                  <Input value={company.logoUrl ?? ""} onChange={(e) => setCompany((f) => ({ ...f, logoUrl: e.target.value }))} className="h-11 font-bold rounded-xl" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="font-bold text-slate-800 text-xs">Business Address</Label>
                  <Input value={company.businessAddress ?? ""} onChange={(e) => setCompany((f) => ({ ...f, businessAddress: e.target.value }))} className="h-11 font-bold rounded-xl" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="font-bold text-slate-800 text-xs">About Statement</Label>
                  <Input value={company.aboutText ?? ""} onChange={(e) => setCompany((f) => ({ ...f, aboutText: e.target.value }))} className="h-11 font-bold rounded-xl" />
                </div>
              </div>

              {hasSettingsPermission && (
                <div className="pt-2 flex justify-end">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 px-6 rounded-xl shadow-2xs min-h-[44px]" loading={settingsMutation.isPending} onClick={() => settingsMutation.mutate()}>
                    <Save className="size-4 mr-2" /> Save Changes
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 2. RENT & LATE PENALTY */}
        {activeTab === "RENT_PENALTY" && (
          <Card className="border border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50/60 border-b border-slate-100 pb-4">
              <CardTitle className="text-base font-black text-slate-900">Rent Rules & Late Penalty Defaults</CardTitle>
              <CardDescription className="text-xs font-semibold text-slate-500">
                Configure default rent payment due date and daily overdue penalty rates.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-800 text-xs">Default Rent Due Day of Month *</Label>
                  <Input type="number" min={1} max={28} value={num.rentDueDay ?? "5"} onChange={(e) => setNum((f) => ({ ...f, rentDueDay: e.target.value }))} className="h-11 font-black rounded-xl" />
                  <span className="text-[11px] font-semibold text-slate-500 block">Day when monthly rent statements are due (e.g. 5th).</span>
                </div>

                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-800 text-xs">Daily Late Fee Amount (₹) *</Label>
                  <Input
                    type="number"
                    min={0}
                    value={num.latePenaltyPerDay ?? "50"}
                    onChange={(e) => setNum((f) => ({ ...f, latePenaltyPerDay: e.target.value, billingPenaltyRate: e.target.value }))}
                    className="h-11 font-black rounded-xl"
                  />
                  <span className="text-[11px] font-semibold text-slate-500 block">Default: ₹50 / day. Set to 0 for no fee.</span>
                </div>

                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-800 text-xs">Grace Period Penalty Starts After Day *</Label>
                  <Input type="number" min={1} max={28} value={num.latePenaltyStartDay ?? "10"} onChange={(e) => setNum((f) => ({ ...f, latePenaltyStartDay: e.target.value }))} className="h-11 font-black rounded-xl" />
                  <span className="text-[11px] font-semibold text-slate-500 block">Penalty starts charging on the 11th if set to 10.</span>
                </div>

                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-800 text-xs">Pre-Due Rent Reminder (Days Before) *</Label>
                  <Input type="number" min={0} value={num.rentReminderDays ?? "3"} onChange={(e) => setNum((f) => ({ ...f, rentReminderDays: e.target.value }))} className="h-11 font-black rounded-xl" />
                </div>
              </div>

              {hasSettingsPermission && (
                <div className="pt-2 flex justify-end">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 px-6 rounded-xl shadow-2xs min-h-[44px]" loading={settingsMutation.isPending} onClick={() => settingsMutation.mutate()}>
                    <Save className="size-4 mr-2" /> Save Changes
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 3. NOTIFICATIONS */}
        {activeTab === "NOTIFICATIONS" && (
          <Card className="border border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50/60 border-b border-slate-100 pb-4">
              <CardTitle className="text-base font-black text-slate-900">Notifications & Alerts</CardTitle>
              <CardDescription className="text-xs font-semibold text-slate-500">
                Configure automated notifications sent to tenants regarding rent, bills, and agreements.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <Label className="font-bold text-slate-800 text-xs block">WhatsApp Notifications</Label>
                  <span className="text-[11px] font-semibold text-slate-500">Send instant WhatsApp alerts for due rent and payment receipts.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={bool.notificationWhatsAppEnabled ?? false} onChange={(e) => setBool(s => ({ ...s, notificationWhatsAppEnabled: e.target.checked }))} />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="font-bold text-slate-800 text-xs block">Email Notifications</Label>
                  <span className="text-[11px] font-semibold text-slate-500">Send detailed email statements and monthly invoices.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={bool.notificationEmailEnabled ?? false} onChange={(e) => setBool(s => ({ ...s, notificationEmailEnabled: e.target.checked }))} />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </CardContent>
            <div className="bg-slate-50/60 border-t border-slate-100 p-4 sm:px-6 flex justify-end">
              {hasSettingsPermission && (
                <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 px-6 rounded-xl shadow-2xs min-h-[44px]" loading={settingsMutation.isPending} onClick={() => settingsMutation.mutate()}>
                  <Save className="size-4 mr-2" />
                  Save Notifications
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* 4. TAX & UTILITIES */}
        {activeTab === "TAX_UTILITIES" && (
          <Card className="border border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50/60 border-b border-slate-100 pb-4">
              <CardTitle className="text-base font-black text-slate-900">Tax & Utility Reminder Configuration</CardTitle>
              <CardDescription className="text-xs font-semibold text-slate-500">
                Default frequencies and alert toggles for Property Tax, Water Tax, and Electricity connection bills.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-800 text-xs">Default Property Tax Frequency</Label>
                  <FilterSelect
                    value={company.defaultPropertyTaxFrequency || "ANNUAL"}
                    onChange={(e) => setCompany((f) => ({ ...f, defaultPropertyTaxFrequency: e.target.value }))}
                  >
                    <option value="ANNUAL">Annual (1 Year)</option>
                    <option value="HALF_YEARLY">Half Yearly (6 Months)</option>
                    <option value="QUARTERLY">Quarterly (3 Months)</option>
                  </FilterSelect>
                </div>

                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-800 text-xs">Default Water Tax Frequency</Label>
                  <FilterSelect
                    value={company.defaultWaterTaxFrequency || "BI_MONTHLY"}
                    onChange={(e) => setCompany((f) => ({ ...f, defaultWaterTaxFrequency: e.target.value }))}
                  >
                    <option value="BI_MONTHLY">Bi-Monthly (2 Months)</option>
                    <option value="MONTHLY">Monthly (1 Month)</option>
                    <option value="QUARTERLY">Quarterly (3 Months)</option>
                  </FilterSelect>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-100 text-xs font-bold text-slate-800">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bool.enablePropertyTaxReminders ?? true}
                    onChange={(e) => setBool((f) => ({ ...f, enablePropertyTaxReminders: e.target.checked }))}
                    className="size-4 rounded border-slate-300 accent-blue-600"
                  />
                  Property Tax Deadline Alerts (30, 15, 7 days before due date)
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bool.enableWaterTaxReminders ?? true}
                    onChange={(e) => setBool((f) => ({ ...f, enableWaterTaxReminders: e.target.checked }))}
                    className="size-4 rounded border-slate-300 accent-blue-600"
                  />
                  Water Tax Deadline Alerts
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bool.enableEbReminders ?? true}
                    onChange={(e) => setBool((f) => ({ ...f, enableEbReminders: e.target.checked }))}
                    className="size-4 rounded border-slate-300 accent-blue-600"
                  />
                  EB Reading & Bill Payment Reminders
                </label>
              </div>

              {hasSettingsPermission && (
                <div className="pt-2 flex justify-end">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 px-6 rounded-xl shadow-2xs min-h-[44px]" loading={settingsMutation.isPending} onClick={() => settingsMutation.mutate()}>
                    <Save className="size-4 mr-2" /> Save Changes
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 5. SECURITY & SESSIONS */}
        {activeTab === "SECURITY" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden">
              <CardHeader className="bg-slate-50/60 border-b border-slate-100 pb-4">
                <CardTitle className="text-base font-black text-slate-900">Change Password</CardTitle>
                <CardDescription className="text-xs font-semibold text-slate-500">Update your account login password.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <ChangePasswordForm />
              </CardContent>
            </Card>

            <Card className="border border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden">
              <CardHeader className="bg-slate-50/60 border-b border-slate-100 pb-4">
                <CardTitle className="text-base font-black text-slate-900">Active Security Sessions</CardTitle>
                <CardDescription className="text-xs font-semibold text-slate-500">Devices currently signed in to your account.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {!sessions?.length ? (
                  <div className="p-6 text-xs font-semibold text-slate-500">No active sessions found.</div>
                ) : (
                  <ul className="divide-y divide-slate-100 text-xs font-semibold">
                    {sessions.map((s) => (
                      <li key={s.id} className="flex items-center justify-between gap-3 p-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Monitor className="size-4 text-slate-400 shrink-0" />
                            <p className="truncate font-black text-slate-900">{s.userAgent ?? "Unknown Device"}</p>
                            {s.current && <Badge variant="info">Current</Badge>}
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {s.ip ?? "—"} · last active {formatDateTime(s.lastSeen)}
                          </p>
                        </div>
                        {!s.current && (
                          <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50 font-extrabold text-xs" loading={revokeMutation.isPending} onClick={() => revokeMutation.mutate(s.id)}>
                            Revoke
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function ChangePasswordForm() {
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) {
      toastError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      await api.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      success("Password changed");
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
    } catch (err) {
      toastError("Failed", err instanceof Error ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div className="space-y-1.5">
        <Label>Current password *</Label>
        <div className="relative">
          <KeyRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="password" required value={form.currentPassword} onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))} className="pl-9" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>New password *</Label>
          <Input type="password" required minLength={8} value={form.newPassword} onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Confirm *</Label>
          <Input type="password" required value={form.confirm} onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))} />
        </div>
      </div>
      <Button type="submit" loading={submitting}>
        Update password
      </Button>
    </form>
  );
}
