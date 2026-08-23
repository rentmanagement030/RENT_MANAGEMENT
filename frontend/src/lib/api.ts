import type {
  Agreement,
  AuditLog,
  Bill,
  BillReport,
  BillSummary,
  CollectionSummary,
  Dashboard,
  Expense,
  FamilyMember,
  LedgerRow,
  MaintenanceRequest,
  Me,
  NotificationRecord,
  OutstandingGroup,
  OutstandingReport,
  OutstandingRow,
  Paginated,
  Payment,
  PgBed,
  PgRoom,
  Property,
  PublicProperty,
  PropertyPerformanceRow,
  RazorpayOrder,
  RentRecord,
  RoleInfo,
  SessionInfo,
  Settings,
  Tenant,
  TenantDocument,
  TenantTransferHistory,
  TenantLedger,
  User,
  Lead,
  LeadActivity,
  PropertyVisit,
  Booking,
  Staff,
  Vendor,
  GuestLog,
  TenantLeave,
  PropertyHome,
  TaxRecord,
  TaxPaymentRecord,
  TaxStats,
  TaxSettings,
} from "../types";

let BASE = import.meta.env.VITE_API_URL || "/api";
if (BASE.startsWith("http") && !BASE.endsWith("/api")) {
  if (BASE.endsWith("/")) BASE = BASE.slice(0, -1);
  BASE = BASE + "/api";
}

export class ApiClientError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.details = details;
  }
}

function describeDetails(details: unknown): string | undefined {
  if (!Array.isArray(details)) return undefined;
  const parts: string[] = [];
  for (const d of details) {
    if (!d || typeof d !== "object") continue;
    const { path, message } = d as { path?: string | number | (string | number)[]; message?: string };
    const label = Array.isArray(path) ? path.join(".") : path;
    if (message) parts.push(label ? `${label}: ${message}` : message);
  }
  return parts.length ? parts.join("; ") : undefined;
}

function messageWithDetails(base: string, details?: unknown): string {
  const extra = describeDetails(details);
  return extra ? `${base} — ${extra}` : base;
}

const AUTH_TOKEN_KEY = "rm_auth_token";

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {
    // ignore
  }
}

export function clearAuthToken(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // ignore
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  const token = getAuthToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (res.status === 401) {
    clearAuthToken();
    const body = await res.json().catch(() => null);
    throw new ApiClientError(401, messageWithDetails(body?.error || "Not authenticated", body?.details), body?.details);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    if (!res.ok) throw new ApiClientError(res.status, `Request failed with status ${res.status}`);
    return (await res.text()) as unknown as T;
  }

  const data = await res.json();
  if (!res.ok) {
    throw new ApiClientError(res.status, messageWithDetails(data?.error || "Request failed", data?.details), data?.details);
  }
  return data && typeof data === "object" && "data" in data && (data as { data: unknown }).data !== undefined
    ? ((data as { data: T }).data)
    : (data as T);
}

const qs = (params: Record<string, unknown> | undefined) => {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
};

export const api = {
  // ---- Auth ----
  login: (email: string, password: string) =>
    request<{ user: Me; token?: string }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }).then((r) => {
      if (r.token) setAuthToken(r.token);
      return r.user;
    }),
  firebaseLogin: (idToken: string) =>
    request<{ user: Me; token?: string }>("/auth/firebase-login", { method: "POST", body: JSON.stringify({ idToken }) }).then((r) => {
      if (r.token) setAuthToken(r.token);
      return r.user;
    }),
  logout: () => {
    clearAuthToken();
    return request<{ message: string }>("/auth/logout", { method: "POST" });
  },
  me: () => request<{ user: Me }>("/auth/me").then((r) => r.user),
  sessions: () => request<{ sessions: SessionInfo[] }>("/auth/sessions").then((r) => r.sessions),
  revokeSession: (id: string) => request<{ message: string }>(`/auth/sessions/${id}`, { method: "DELETE" }),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    request<{ message: string }>("/auth/change-password", { method: "POST", body: JSON.stringify(body) }),

  // ---- Users / roles ----
  listUsers: (params?: Record<string, unknown>) => request<Paginated<User>>(`/users${qs(params)}`),
  createUser: (body: Record<string, unknown>) => request<{ user: User }>("/users", { method: "POST", body: JSON.stringify(body) }).then((r) => r.user),
  updateUser: (id: string, body: Record<string, unknown>) => request<{ user: User }>(`/users/${id}`, { method: "PUT", body: JSON.stringify(body) }).then((r) => r.user),
  deleteUser: (id: string) => request<{ message: string }>(`/users/${id}`, { method: "DELETE" }),
  listRoles: () => request<{ roles: RoleInfo[] }>("/users/roles").then((r) => r.roles),
  listPermissions: () => request<{ permissions: { id: string; key: string; description: string }[] }>("/users/permissions").then((r) => r.permissions),

  // ---- Properties ----
  listProperties: (params?: Record<string, unknown>) => request<Paginated<Property>>(`/properties${qs(params)}`),
  getProperty: (id: string) => request<{ property: Property }>(`/properties/${id}`).then((r) => r.property),
  createProperty: (body: Record<string, unknown>) => request<{ property: Property }>("/properties", { method: "POST", body: JSON.stringify(body) }).then((r) => r.property),
  updateProperty: (id: string, body: Record<string, unknown>) => request<{ property: Property }>(`/properties/${id}`, { method: "PUT", body: JSON.stringify(body) }).then((r) => r.property),
  deleteProperty: (id: string) => request<{ message: string }>(`/properties/${id}`, { method: "DELETE" }),
  archiveProperty: (id: string) => request<{ property: Property }>(`/properties/${id}/archive`, { method: "POST" }).then((r) => r.property),
  listRooms: (propertyId: string) => request<{ rooms: PgRoom[] }>(`/properties/${propertyId}/rooms`).then((r) => r.rooms),
  createRoom: (propertyId: string, body: Record<string, unknown>) => request<{ room: PgRoom }>(`/properties/${propertyId}/rooms`, { method: "POST", body: JSON.stringify(body) }).then((r) => r.room),
  updateRoom: (id: string, body: Record<string, unknown>) => request<{ room: PgRoom }>(`/properties/rooms/${id}`, { method: "PUT", body: JSON.stringify(body) }).then((r) => r.room),
  createBeds: (roomId: string, body: { bedNumbers: string[] }, financials?: { rent?: number; advance?: number; deposit?: number }) =>
    request<{ beds: PgBed[] }>(`/properties/rooms/${roomId}/beds`, { method: "POST", body: JSON.stringify({ ...body, ...financials }) }).then((r) => r.beds),
  deleteRoom: (id: string) => request<{ message: string }>(`/properties/rooms/${id}`, { method: "DELETE" }),
  updateBed: (id: string, body: Record<string, unknown>) => request<{ bed: PgBed }>(`/properties/beds/${id}`, { method: "PUT", body: JSON.stringify(body) }).then((r) => r.bed),
  uploadPropertyImage: (file: File) => {
    const fd = new FormData();
    fd.append("image", file);
    return request<{ url: string; storageKey?: string }>("/properties/upload/image", { method: "POST", body: fd });
  },
  setPropertyImages: (id: string, images: { url: string; isPrimary?: boolean; type?: string; sortOrder?: number }[]) =>
    request<{ message: string }>(`/properties/${id}/images`, { method: "PUT", body: JSON.stringify({ images }) }),

  // ---- Tenants / family ----
  listTenants: (params?: Record<string, unknown>) => request<Paginated<Tenant>>(`/tenants${qs(params)}`),
  getTenantStats: (params?: Record<string, unknown>) =>
    request<{ stats: { total: number; active: number; pending: number; inactive: number; former: number } }>(`/tenants/stats${qs(params)}`).then((r) => r.stats),
  getTenant: (id: string) => request<{ tenant: Tenant }>(`/tenants/${id}`).then((r) => r.tenant),
  createTenant: (body: Record<string, unknown>) => request<{ tenant: Tenant }>("/tenants", { method: "POST", body: JSON.stringify(body) }).then((r) => r.tenant),
  updateTenant: (id: string, body: Record<string, unknown>) => request<{ tenant: Tenant }>(`/tenants/${id}`, { method: "PUT", body: JSON.stringify(body) }).then((r) => r.tenant),
  markFormer: (id: string) => request<{ tenant: Tenant }>(`/tenants/${id}/former`, { method: "POST" }).then((r) => r.tenant),
  deleteTenant: (id: string) => request<{ message: string }>(`/tenants/${id}`, { method: "DELETE" }),
  listTenantDocuments: (id: string) => request<{ documents: TenantDocument[] }>(`/tenants/${id}/documents`).then((r) => r.documents),
  uploadTenantDocument: (id: string, file: File, type: string) => {
    const fd = new FormData();
    fd.append("document", file);
    fd.append("type", type);
    return request<{ document: TenantDocument }>(`/tenants/${id}/documents`, { method: "POST", body: fd }).then((r) => r.document);
  },
  deleteTenantDocument: (id: string, docId: string) => request<{ message: string }>(`/tenants/${id}/documents/${docId}`, { method: "DELETE" }),
  verifyTenantDocument: (id: string, docId: string, status: "VERIFIED" | "REJECTED", rejectionReason?: string) =>
    request<{ document: TenantDocument }>(`/tenants/${id}/documents/${docId}/verify`, { method: "PATCH", body: JSON.stringify({ status, rejectionReason }) }).then((r) => r.document),
  transferTenant: (id: string, body: Record<string, unknown>) =>
    request<{ tenant: Tenant; transfer: TenantTransferHistory }>(`/tenants/${id}/transfer`, { method: "POST", body: JSON.stringify(body) }),
  listTenantTransfers: (id: string) => request<{ history: TenantTransferHistory[] }>(`/tenants/${id}/transfers`).then((r) => r.history),
  listFamilyMembers: (tenantId: string) => request<{ members: FamilyMember[] }>(`/tenants/${tenantId}/family`).then((r) => r.members),
  addFamilyMember: (tenantId: string, body: Record<string, unknown>) =>
    request<{ member: FamilyMember }>(`/tenants/${tenantId}/family`, { method: "POST", body: JSON.stringify(body) }).then((r) => r.member),
  updateFamilyMember: (tenantId: string, memberId: string, body: Record<string, unknown>) =>
    request<{ member: FamilyMember }>(`/tenants/${tenantId}/family/${memberId}`, { method: "PUT", body: JSON.stringify(body) }).then((r) => r.member),
  deleteFamilyMember: (tenantId: string, memberId: string) =>
    request<{ message: string }>(`/tenants/${tenantId}/family/${memberId}`, { method: "DELETE" }),

  // ---- Agreements ----
  listAgreements: (params?: Record<string, unknown>) => request<Paginated<Agreement>>(`/rent/agreements${qs(params)}`),
  getAgreementStats: (params?: Record<string, unknown>) =>
    request<{ stats: { all: number; active: number; signed: number; expired: number; terminated: number; cancelled: number; notSigned: number } }>(`/rent/agreements/stats${qs(params)}`).then((r) => r.stats),
  getAgreement: (id: string) => request<{ agreement: Agreement }>(`/rent/agreements/${id}`).then((r) => r.agreement),
  createAgreement: (body: Record<string, unknown>) => request<{ agreement: Agreement }>("/rent/agreements", { method: "POST", body: JSON.stringify(body) }).then((r) => r.agreement),
  updateAgreement: (id: string, body: Record<string, unknown>) => request<{ agreement: Agreement }>(`/rent/agreements/${id}`, { method: "PUT", body: JSON.stringify(body) }).then((r) => r.agreement),
  cancelAgreement: (id: string, reason: string) => request<{ agreement: Agreement }>(`/rent/agreements/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }).then((r) => r.agreement),
  deleteAgreement: (id: string) => request<{ message: string }>(`/rent/agreements/${id}`, { method: "DELETE" }),
  uploadAgreementDocument: (id: string, file: File) => {
    const fd = new FormData();
    fd.append("document", file);
    return request<{ agreement: Agreement }>(`/rent/agreements/${id}/document`, { method: "POST", body: fd }).then((r) => r.agreement);
  },
  removeAgreementDocument: (id: string) =>
    request<{ agreement: Agreement }>(`/rent/agreements/${id}/document`, { method: "DELETE" }).then((r) => r.agreement),
  sendAgreementForSigning: (id: string) =>
    request<{ agreement: Agreement; token: string; signUrl: string }>(`/rent/agreements/${id}/send`, { method: "POST" }),
  getAgreementForSigning: (token: string) =>
    request<{ agreement: Agreement }>(`/public/agreements/sign/${token}`).then((r) => r.agreement),
  signAgreement: (token: string, body: { signatureName: string; signatureUrl?: string; signatureMethod?: string }) =>
    request<{ agreement: Agreement }>(`/public/agreements/sign/${token}`, { method: "POST", body: JSON.stringify(body) }).then((r) => r.agreement),

  // ---- Rent ----
  listRent: (params?: Record<string, unknown>) => request<Paginated<RentRecord>>(`/rent${qs(params)}`),
  getRent: (id: string) => request<{ record: RentRecord }>(`/rent/${id}`).then((r) => r.record),
  createRent: (body: Record<string, unknown>) => request<{ record: RentRecord }>("/rent", { method: "POST", body: JSON.stringify(body) }).then((r) => r.record),
  updateRent: (id: string, body: Record<string, unknown>) => request<{ record: RentRecord }>(`/rent/${id}`, { method: "PUT", body: JSON.stringify(body) }).then((r) => r.record),
  deleteRent: (id: string) => request<{ message: string }>(`/rent/${id}`, { method: "DELETE" }),
  adjustRent: (id: string, body: { type: string; amount: number; reason: string }) =>
    request<{ record: RentRecord }>(`/rent/${id}/adjustments`, { method: "POST", body: JSON.stringify(body) }).then((r) => r.record),
  generateMonth: (body: { month: string }) =>
    request<{ created: number; skipped: number }>("/rent/generate-month", { method: "POST", body: JSON.stringify(body) }),

  // ---- Bills ----
  listBills: (params?: Record<string, unknown>) => request<Paginated<Bill>>(`/bills${qs(params)}`),
  getBill: (id: string) => request<{ bill: Bill }>(`/bills/${id}`).then((r) => r.bill),
  createBill: (body: Record<string, unknown>) => request<{ bill: Bill }>("/bills", { method: "POST", body: JSON.stringify(body) }).then((r) => r.bill),
  updateBill: (id: string, body: Record<string, unknown>) => request<{ bill: Bill }>(`/bills/${id}`, { method: "PUT", body: JSON.stringify(body) }).then((r) => r.bill),
  cancelBill: (id: string) => request<{ bill: Bill }>(`/bills/${id}`, { method: "DELETE" }).then((r) => r.bill),
  deleteBillPermanently: (id: string) => request<{ message: string }>(`/bills/${id}/permanent`, { method: "DELETE" }),
  generateBillsForMonth: (body: { billingMonth: string }) =>
    request<{ billingMonth: string; created: number; skipped: number }>("/bills/generate-month", { method: "POST", body: JSON.stringify(body) }),
  createBillsBatch: (body: { billingMonth: string; bills: Record<string, unknown>[] }) =>
    request<{ billingMonth: string; created: number; skipped: number }>("/bills/batch", { method: "POST", body: JSON.stringify(body) }),
  billSummary: (params?: Record<string, unknown>) => request<BillSummary>(`/bills/summary${qs(params)}`),
  applyPenalty: (billId: string) =>
    request<{ bill: Bill }>(`/bills/${billId}/penalties`, { method: "POST", body: JSON.stringify({}) }).then((r) => r.bill),
  waivePenalty: (billId: string) =>
    request<{ bill: Bill }>(`/bills/${billId}/penalties/waive`, { method: "POST", body: JSON.stringify({}) }).then((r) => r.bill),

  // ---- Payments ----
  listPayments: (params?: Record<string, unknown>) => request<Paginated<Payment>>(`/payments${qs(params)}`),
  getPayment: (id: string) => request<{ payment: Payment }>(`/payments/${id}`).then((r) => r.payment),
  recordCash: (body: Record<string, unknown>) => request<{ payment: Payment }>("/payments/cash", { method: "POST", body: JSON.stringify(body) }).then((r) => r.payment),
  recordBank: (body: Record<string, unknown>) => request<{ payment: Payment }>("/payments/bank", { method: "POST", body: JSON.stringify(body) }).then((r) => r.payment),
  verifyBank: (id: string, body: { status: "VERIFIED" | "REJECTED"; notes?: string }) =>
    request<{ payment: Payment }>(`/payments/${id}/verify`, { method: "PUT", body: JSON.stringify(body) }).then((r) => r.payment),
  outstanding: (params?: Record<string, unknown>) => request<Paginated<OutstandingGroup>>(`/payments/outstanding${qs(params)}`),
  methodTotals: (params?: Record<string, unknown>) => request<{ totals: { method: string; total: number }[] }>(`/payments/totals/methods${qs(params)}`).then((r) => r.totals),
  createRazorpayOrder: (body: { tenantId: string; rentRecordId?: string; billId?: string; amount?: number; notes?: string }) =>
    request<{ order: RazorpayOrder }>("/razorpay/orders", { method: "POST", body: JSON.stringify(body) }).then((r) => r.order),
  razorpayStatus: () => request<{ configured: boolean }>("/razorpay/status").then((r) => r.configured),

  // ---- Dashboard / system ----
  dashboard: () => request<Dashboard>("/system/dashboard"),
  getSettings: () => request<{ settings: Settings }>("/system/settings").then((r) => r.settings),
  updateSettings: (body: Record<string, unknown>) => request<{ settings: Settings }>("/system/settings", { method: "PUT", body: JSON.stringify(body) }).then((r) => r.settings),
  auditLogs: (params?: Record<string, unknown>) => request<Paginated<AuditLog>>(`/system/audit-logs${qs(params)}`),

  // ---- Public ----
  publicProperties: (params?: Record<string, unknown>) => request<Paginated<PublicProperty>>(`/public/properties${qs(params)}`),
  publicProperty: (id: string) => request<{ property: PublicProperty }>(`/public/properties/${id}`).then((r) => r.property),
  publicCities: () => request<{ cities: string[] }>("/public/properties/cities").then((r) => r.cities),
  publicInfo: () => request<{ settings: { company: Record<string, unknown> } }>("/public/info").then((r) => r.settings.company),
  publicContact: (body: { name: string; email: string; phone: string; message: string }) =>
    request<{ message: string }>("/public/contact", { method: "POST", body: JSON.stringify(body) }),
  publicHealth: () => request<{ status: string; database: string }>("/public/health"),

  // ---- Notifications ----
  listNotifications: (params?: Record<string, unknown>) => request<Paginated<NotificationRecord>>(`/notifications${qs(params)}`),
  notificationStatus: () => request<{ whatsapp: boolean; email: boolean }>("/notifications/status"),
  sendNotification: (body: { tenantId?: string; type: string; channel: string; to?: string; body: string; subject?: string }) =>
    request<{ sent: boolean }>("/notifications/send", { method: "POST", body: JSON.stringify(body) }),
  resendNotification: (id: string) =>
    request<{ ok: boolean; error?: string }>(`/notifications/${id}/resend`, { method: "POST" }),
  triggerReminders: () => request<{ ok: boolean }>("/notifications/trigger-reminders", { method: "POST" }),
  triggerTestScheduler: () =>
    request<{ processed: number; sent: number; skipped: number; failed: number; message: string; details: unknown[] }>("/notifications/trigger-test", { method: "POST" }),

  // ---- Ops: reports / maintenance / expenses ----
  collectionReport: (params?: Record<string, unknown>) => request<CollectionSummary>(`/ops/reports/collection${qs(params)}`),
  exportCollection: (params?: Record<string, unknown>) => downloadUrl(`/ops/reports/collection/export${qs(params)}`),
  outstandingReport: () => request<OutstandingReport>("/ops/reports/outstanding"),
  propertyPerformance: () => request<PropertyPerformanceRow[]>("/ops/reports/property-performance"),
  tenantLedger: (tenantId: string) => request<TenantLedger>(`/ops/reports/tenants/${tenantId}/ledger`),
  billsReport: (params?: Record<string, unknown>) => request<BillReport>(`/ops/reports/bills${qs(params)}`),
  exportBills: (params?: Record<string, unknown>) => downloadUrl(`/ops/reports/bills/export${qs(params)}`),
  exportOutstanding: () => downloadUrl("/ops/reports/outstanding/export"),
  exportTenantLedger: (tenantId: string) => downloadUrl(`/ops/reports/tenants/${tenantId}/ledger/export`),
  profitabilityReport: (params?: Record<string, unknown>) => request<{ properties: any[]; summary: any }>(`/ops/reports/profitability${qs(params)}`),
  getAccountingPnL: (params?: Record<string, unknown>) => request<any>(`/ops/reports/pnl${qs(params)}`),
  getReconciliationReport: (params?: Record<string, unknown>) => request<any>(`/ops/reports/reconciliation${qs(params)}`),
  submitPublicEnquiry: (body: Record<string, unknown>) => request<{ ok: boolean; leadId: string }>("/public/enquiry", { method: "POST", body: JSON.stringify(body) }),
  listMaintenance: (params?: Record<string, unknown>) => request<Paginated<MaintenanceRequest>>(`/ops/maintenance${qs(params)}`),
  createMaintenance: (body: Record<string, unknown>) => request<{ item: MaintenanceRequest }>("/ops/maintenance", { method: "POST", body: JSON.stringify(body) }).then((r) => r.item),
  updateMaintenance: (id: string, body: Record<string, unknown>) => request<{ item: MaintenanceRequest }>(`/ops/maintenance/${id}`, { method: "PUT", body: JSON.stringify(body) }).then((r) => r.item),
  listExpenses: (params?: Record<string, unknown>) => request<Paginated<Expense>>(`/ops/expenses${qs(params)}`),
  getExpenseSummary: (params?: Record<string, unknown>) => request<any>(`/ops/expenses/summary${qs(params)}`),
  createExpense: (body: Record<string, unknown>) => request<{ expense: Expense }>("/ops/expenses", { method: "POST", body: JSON.stringify(body) }).then((r) => r.expense),

  // ---- CRM: Leads, Visits & Bookings ----
  listLeads: (params?: Record<string, unknown>) => request<Paginated<Lead>>(`/crm/leads${qs(params)}`),
  getLead: (id: string) => request<Lead>(`/crm/leads/${id}`),
  createLead: (body: Record<string, unknown>) => request<Lead>("/crm/leads", { method: "POST", body: JSON.stringify(body) }),
  updateLead: (id: string, body: Record<string, unknown>) => request<Lead>(`/crm/leads/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  addLeadActivity: (id: string, body: { action: string; notes: string }) => request<LeadActivity>(`/crm/leads/${id}/activities`, { method: "POST", body: JSON.stringify(body) }),
  convertLead: (id: string, body: { propertyId: string; roomId?: string; bedId?: string; rentAmount?: number }) =>
    request<{ success: boolean; tenant: Tenant }>(`/crm/leads/${id}/convert`, { method: "POST", body: JSON.stringify(body) }),

  listVisits: (params?: Record<string, unknown>) => request<Paginated<PropertyVisit>>(`/visits${qs(params)}`),
  getTodayVisits: () => request<PropertyVisit[]>("/visits/today"),
  createVisit: (body: Record<string, unknown>) => request<PropertyVisit>("/visits", { method: "POST", body: JSON.stringify(body) }),
  updateVisitStatus: (id: string, body: { status: string; notes?: string }) => request<PropertyVisit>(`/visits/${id}/status`, { method: "PATCH", body: JSON.stringify(body) }),

  listBookings: (params?: Record<string, unknown>) => request<Paginated<Booking>>(`/bookings${qs(params)}`),
  createBooking: (body: Record<string, unknown>) => request<Booking>("/bookings", { method: "POST", body: JSON.stringify(body) }),
  cancelBooking: (id: string, reason?: string) => request<Booking>(`/bookings/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }),

  // ---- Staff, Vendors & PG Guest/Leave ----
  listStaff: (params?: Record<string, unknown>) => request<Paginated<Staff>>(`/ops/staff-vendors/staff${qs(params)}`),
  createStaff: (body: Record<string, unknown>) => request<Staff>("/ops/staff-vendors/staff", { method: "POST", body: JSON.stringify(body) }),
  updateStaff: (id: string, body: Record<string, unknown>) => request<Staff>(`/ops/staff-vendors/staff/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteStaff: (id: string) => request<{ message: string }>(`/ops/staff-vendors/staff/${id}`, { method: "DELETE" }),
  listVendors: (params?: Record<string, unknown>) => request<Paginated<Vendor>>(`/ops/staff-vendors/vendors${qs(params)}`),
  createVendor: (body: Record<string, unknown>) => request<Vendor>("/ops/staff-vendors/vendors", { method: "POST", body: JSON.stringify(body) }),
  updateVendor: (id: string, body: Record<string, unknown>) => request<Vendor>(`/ops/staff-vendors/vendors/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteVendor: (id: string) => request<{ message: string }>(`/ops/staff-vendors/vendors/${id}`, { method: "DELETE" }),

  listGuestLogs: (params?: Record<string, unknown>) => request<Paginated<GuestLog>>(`/pg/guests${qs(params)}`),
  createGuestLog: (body: Record<string, unknown>) => request<GuestLog>("/pg/guests", { method: "POST", body: JSON.stringify(body) }),
  markGuestExit: (id: string) => request<GuestLog>(`/pg/guests/${id}/exit`, { method: "PATCH" }),
  listTenantLeaves: (params?: Record<string, unknown>) => request<Paginated<TenantLeave>>(`/pg/leaves${qs(params)}`),
  createTenantLeave: (body: Record<string, unknown>) => request<TenantLeave>("/pg/leaves", { method: "POST", body: JSON.stringify(body) }),
  updateLeaveStatus: (id: string, body: { status: string; notes?: string }) => request<TenantLeave>(`/pg/leaves/${id}/status`, { method: "PATCH", body: JSON.stringify(body) }),

  // ---- Tenant Portal ----
  tenantLogin: (body: { phone: string; password: string }) => request<{ success: boolean; token: string; tenant: Tenant }>("/tenant-auth/login", { method: "POST", body: JSON.stringify(body) }),
  tenantMe: () => request<{ success: boolean; tenant: Tenant }>("/tenant-auth/me"),
  changeTenantPassword: (body: { currentPassword: string; newPassword: string }) => request<{ success: boolean }>("/tenant-auth/change-password", { method: "POST", body: JSON.stringify(body) }),

  // ---- Multi-Unit Homes ----
  listHomesByProperty: (propertyId: string) =>
    request<{ propertyId: string; propertyName: string; totalHomes: number; occupiedHomes: number; availableHomes: number; floors: { floor: string; homes: PropertyHome[] }[] }>(`/properties/${propertyId}/homes`),
  getHome: (id: string) => request<PropertyHome>(`/properties/homes/${id}`),
  createHome: (propertyId: string, body: Record<string, unknown>) =>
    request<PropertyHome>(`/properties/${propertyId}/homes`, { method: "POST", body: JSON.stringify(body) }),
  updateHome: (id: string, body: Record<string, unknown>) =>
    request<PropertyHome>(`/properties/homes/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteHome: (id: string) => request<{ message: string }>(`/properties/homes/${id}`, { method: "DELETE" }),

  // ---- Property Tax & Water Tax ----
  listTaxes: (params?: Record<string, unknown>) => request<Paginated<TaxRecord>>(`/taxes${qs(params)}`),
  getTaxStats: (params?: Record<string, unknown>) => request<TaxStats>(`/taxes/stats${qs(params)}`),
  getTaxRecord: (id: string) => request<TaxRecord>(`/taxes/${id}`),
  createTaxRecord: (body: Record<string, unknown>) => request<TaxRecord>("/taxes", { method: "POST", body: JSON.stringify(body) }),
  updateTaxRecord: (id: string, body: Record<string, unknown>) => request<TaxRecord>(`/taxes/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  recordTaxPayment: (body: Record<string, unknown>) =>
    request<{ success: boolean; message: string; data: any }>("/taxes/payments", { method: "POST", body: JSON.stringify(body) }),
  getTaxSettings: () => request<TaxSettings>("/taxes/settings"),
  updateTaxSettings: (body: Record<string, unknown>) => request<TaxSettings>("/taxes/settings", { method: "PUT", body: JSON.stringify(body) }),
};

/** Build a URL (with auth cookie) for binary downloads served by the API. */
export function downloadUrl(path: string): string {
  return `${BASE}${path}`;
}

/** Flatten the grouped outstanding endpoint into a flat row per rent record / bill. */
export function flattenOutstanding(groups: OutstandingGroup[]): OutstandingRow[] {
  return groups.flatMap((g) =>
    g.records.map((r) => ({
      tenantId: g.tenantId,
      tenantName: g.name,
      phone: g.phone,
      propertyName: g.property?.name ?? "",
      billingMonth: r.billingMonth,
      dueDate: r.dueDate,
      outstanding: r.outstanding,
      status: r.status,
      rentRecordId: r.rentRecordId ?? undefined,
      billId: r.billId ?? undefined,
      kind: r.kind ?? "rent",
      label: r.label ?? undefined,
    })),
  );
}
