export interface PaymentMethodTotal {
  method: string;
  total: number;
  count: number;
}

export interface PaymentSummaryStats {
  totalCollected: number;
  totalCount: number;
  pendingCount: number;
  pendingAmount: number;
  methodTotals: PaymentMethodTotal[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary?: PaymentSummaryStats;
}

export interface ApiError {
  success: false;
  error: string;
  details?: unknown;
}

// ---------- Auth / Users ----------
export interface RoleInfo {
  id: string;
  name: string;
  description: string | null;
}

export interface Me {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  roles: RoleInfo[];
  permissions: string[];
  isSuperAdmin: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  createdAt: string;
  roles: string[];
}

export interface SessionInfo {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastSeen: string;
  expiresAt: string;
  current?: boolean;
}

// ---------- Properties ----------
export interface PropertyImage {
  id: string;
  url: string;
  storageKey: string | null;
  isPrimary: boolean;
  type: string;
  sortOrder: number;
}

export interface PgRoom {
  id: string;
  floor: string | null;
  roomNumber: string;
  capacity: number;
  rent: number | null;
  advance?: number | null;
  deposit?: number | null;
  status: string;
  beds?: PgBed[];
}

export interface PgBed {
  id: string;
  bedNumber: string;
  rent?: number | null;
  advance?: number | null;
  deposit?: number | null;
  status: string;
  tenantId?: string | null;
  tenant?: { id: string; name: string; phone?: string | null } | null;
}

export interface Property {
  id: string;
  type: "HOUSE" | "PG" | "VILLA" | "MULTI_UNIT_HOUSE" | "APARTMENT";
  name: string;
  number: string | null;
  address: string;
  city: string;
  area: string | null;
  rent: string | number;
  advance: string | number;
  deposit: string | number;
  dueDay?: number;
  latePenalty?: number;
  status: string;
  description: string | null;
  amenities: string[];
  publicVisibility: boolean;
  archived: boolean;
  contactPhone: string | null;
  bhkType: string | null;
  maxCapacity: number | null;
  ebNumber: string | null;
  ebConnectionType?: string | null;
  ebMeterNumber?: string | null;
  ebConnectionName?: string | null;
  waterConnectionType?: string | null;
  waterConsumerNumber?: string | null;
  waterMeterNumber?: string | null;
  createdAt: string;
  images: PropertyImage[];
  rooms?: PgRoom[];
  homes?: PropertyHome[];
  roomCounts?: { total: number; occupied?: number; available: number; maintenance?: number };
  tenants?: { id: string; name: string }[];
}

export interface PropertyHome {
  id: string;
  propertyId: string;
  floor: string;
  homeNumber: string;
  homeType: string;
  builtUpArea?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  rent: number;
  advance: number;
  deposit: number;
  dueDay: number;
  latePenalty: number;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "MAINTENANCE" | "INACTIVE";
  ebConnectionType?: string | null;
  ebNumber?: string | null;
  ebMeterNumber?: string | null;
  ebConnectionName?: string | null;
  ebCurrentReading?: number | null;
  ebLastReadingDate?: string | null;
  waterConnectionType?: string | null;
  waterConsumerNumber?: string | null;
  waterMeterNumber?: string | null;
  waterConnectionName?: string | null;
  waterCurrentReading?: number | null;
  waterLastReadingDate?: string | null;
  archived?: boolean;
  createdAt?: string;
  imageUrls?: string[];
  activeTenant?: { id: string; name: string; phone?: string | null; joiningDate?: string | null; rent?: number } | null;
  activeAgreement?: Agreement | null;
}

export interface TaxRecord {
  id: string;
  taxType: "PROPERTY_TAX" | "WATER_TAX";
  taxOwnership: "PROPERTY" | "HOME";
  propertyId: string;
  property?: { id: string; name: string; city?: string; address?: string };
  homeId?: string | null;
  home?: { id: string; homeNumber: string; floor?: string } | null;
  assessmentNumber?: string | null;
  zone?: string | null;
  division?: string | null;
  billNumber?: string | null;
  subNumber?: string | null;
  assesseeName?: string | null;
  consumerNumber?: string | null;
  frequency: "MONTHLY" | "BI_MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "ANNUAL" | "CUSTOM";
  annualTaxAmount: number;
  currentTaxPeriod: string;
  lastPaidDate?: string | null;
  lastPaidAmount?: number | null;
  nextDueDate: string;
  outstandingAmount: number;
  status: string;
  derivedStatus?: string;
  reminderStatus?: string;
  notes?: string | null;
  createdAt?: string;
  payments?: TaxPaymentRecord[];
}

export interface TaxPaymentRecord {
  id: string;
  taxRecordId: string;
  taxType: string;
  propertyId: string;
  homeId?: string | null;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  receiptNumber: string;
  referenceNumber?: string | null;
  taxPeriod: string;
  notes?: string | null;
  recordedBy?: { id: string; name: string; email?: string } | null;
  createdAt?: string;
}

export interface TaxStats {
  propertyTaxDue: number;
  waterTaxDue: number;
  dueSoonCount: number;
  overdueCount: number;
  paidThisMonth: number;
}

export interface TaxSettings {
  defaultPropertyTaxFrequency: string;
  defaultWaterTaxFrequency: string;
  reminderDays: number[];
  enablePropertyTaxReminders: boolean;
  enableWaterTaxReminders: boolean;
  enableEbReminders: boolean;
  defaultLatePenalty: number;
}

export interface PublicProperty extends Omit<Property, "images" | "rent" | "advance" | "deposit"> {
  images: string[];
  rent: number | string;
  advance: number | string;
  deposit: number | string;
}

export type TenantKycStatus = "NOT_STARTED" | "DOCUMENTS_PENDING" | "PARTIALLY_VERIFIED" | "VERIFIED" | "REJECTED";
export type KycDocStatus = "PENDING" | "AUTO_VERIFIED" | "MANUAL_REVIEW" | "VERIFIED" | "REJECTED";

// ---------- Tenants ----------
export interface Tenant {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  aadhaarNumber: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  propertyId: string | null;
  roomId: string | null;
  bedId?: string | null;
  rent: string;
  advance: string;
  deposit: string;
  joiningDate: string | null;
  status: string;
  kycStatus?: TenantKycStatus;
  notes: string | null;
  createdAt: string;
  property?: { id: string; name: string; type: string; city: string } | null;
  room?: { id: string; roomNumber: string; floor: string | null; capacity?: number | null } | null;
  bed?: { id: string; bedNumber: string } | null;
  documents?: TenantDocument[];
  familyMembers?: FamilyMember[];
}

export interface FamilyMember {
  id: string;
  tenantId: string;
  name: string;
  relation: string;
  phone: string | null;
  age: number | null;
  occupation: string | null;
  isDependent: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenantDocument {
  id: string;
  type: string;
  originalName: string;
  mimeType: string;
  size: number;
  status?: KycDocStatus;
  rejectionReason?: string | null;
  verificationConfidence?: number | null;
  verificationReason?: string | null;
  verificationMethod?: string | null;
  ocrData?: {
    nameMatchScore?: number;
    readability?: string;
    requiredFieldsPass?: boolean;
    detectedDocumentType?: string;
    confidence?: number;
  } | null;
  verifiedAt?: string | null;
  verifiedById?: string | null;
  verifiedBy?: { id: string; name: string } | null;
  createdAt: string;
  downloadUrl?: string;
}

export interface TenantTransferHistory {
  id: string;
  tenantId: string;
  fromProperty: { id: string; name: string; type: string };
  fromRoom?: { id: string; roomNumber: string } | null;
  fromBed?: { id: string; bedNumber: string } | null;
  fromRent: number | string;
  toProperty: { id: string; name: string; type: string };
  toRoom?: { id: string; roomNumber: string } | null;
  toBed?: { id: string; bedNumber: string } | null;
  toRent: number | string;
  effectiveFrom: string;
  effectiveTo: string | null;
  reason: string;
  notes?: string | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
}

// ---------- Agreements ----------
export interface AgreementDocument {
  name: string;
  mimeType: string;
  size: number;
  url: string;
}

export interface Agreement {
  id: string;
  agreementNumber: string;
  tenantId: string;
  propertyId: string;
  startDate: string;
  endDate: string;
  rent: string;
  advance: string;
  deposit: string;
  status: string;
  token?: string | null;
  tokenExpiresAt?: string | null;
  tokenRevoked?: boolean;
  sentAt?: string | null;
  viewedAt?: string | null;
  signedAt?: string | null;
  signatureUrl?: string | null;
  signatureName?: string | null;
  signatureMethod?: string | null;
  signedIp?: string | null;
  version?: number;
  isLocked?: boolean;
  signedPdfUrl?: string | null;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  cancelledById?: string | null;
  createdAt: string;
  tenant?: { id: string; name: string; phone: string };
  property?: { id: string; name: string; type: string };
  document?: AgreementDocument | null;
  signedPdf?: { name: string; url: string } | null;
}

// ---------- Rent ----------
export interface RentRecord {
  id: string;
  tenantId: string;
  propertyId: string;
  billingMonth: string;
  dueDate: string;
  rent: string;
  additionalCharges: string;
  previousBalance: string;
  paidAmount: string;
  outstanding: string;
  penaltyAmount?: string | number | null;
  status: string;
  tenant?: { id: string; name: string; phone: string };
  property?: { id: string; name: string; type: string };
  payments?: Payment[];
}

// ---------- Payments ----------
export type PaymentMethod = "CASH" | "BANK_TRANSFER_DD" | "RAZORPAY_UPI";
export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED" | "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED";

export interface PaymentAllocation {
  id: string;
  paymentId: string;
  billId: string;
  amount: string;
  bill?: { id: string; billNumber: string; billingMonth: string; billType: string } | null;
  payment?: { id: string; receiptNumber: string | null; paymentDate: string; paymentMethod: string } | null;
}

export interface Payment {
  id: string;
  tenantId: string;
  propertyId: string;
  rentRecordId: string | null;
  amount: string;
  currency: string;
  paymentMethod: string;
  paymentStatus: string;
  paymentDate: string;
  cashAmount?: string | number | null;
  upiAmount?: string | number | null;
  upiApp?: string | null;
  razorpayPaymentId: string | null;
  razorpayOrderId: string | null;
  bankName: string | null;
  bankReferenceNumber: string | null;
  ddNumber: string | null;
  ddDate: string | null;
  receiptNumber: string | null;
  notes: string | null;
  createdAt: string;
  verifiedAt: string | null;
  tenant?: { id: string; name: string; phone: string };
  property?: { id: string; name: string; type: string };
  allocations?: PaymentAllocation[];
}

// ---------- Bills ----------
export type BillType = "RENT" | "EB" | "MAINTENANCE" | "WATER" | "OTHER";
export type BillStatus = "DRAFT" | "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "WAIVED" | "CANCELLED";

export interface BillItem {
  id: string;
  billId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
}

export interface Penalty {
  id: string;
  billId: string;
  ruleType: string;
  rate: string;
  daysOverdue: number;
  amount: string;
  status: string;
  appliedAt: string;
  createdAt: string;
}

export interface Bill {
  id: string;
  billNumber: string;
  tenantId: string;
  propertyId: string;
  rentRecordId: string | null;
  billType: BillType;
  billingMonth: string;
  issueDate: string;
  dueDate: string;
  graceDate: string | null;
  amount: string;
  penaltyAmount: string;
  paidAmount: string;
  outstanding: string;
  status: BillStatus;
  notes: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  tenant?: { id: string; name: string; phone: string };
  property?: { id: string; name: string; number: string | null; type: string; ebNumber: string | null };
  rentRecord?: { id: string; billingMonth: string; dueDate: string } | null;
  createdBy?: { id: string; name: string } | null;
  items?: BillItem[];
  penalties?: Penalty[];
  allocations?: PaymentAllocation[];
}

export interface BillSummary {
  total: number;
  collected: number;
  outstanding: number;
  pending?: number;
  overdue?: number;
  collectionRate?: number;
  totalPaymentsReceived?: number;
  unallocated?: number;
  count: number;
  byStatus: Partial<Record<BillStatus, number>>;
  byType: Partial<Record<BillType, { total: number; collected: number; outstanding: number }>>;
}

export interface BillReportRow {
  id: string;
  billNumber: string;
  billingMonth: string;
  billType: BillType;
  status: BillStatus;
  tenant: string;
  tenantPhone: string | null;
  property: string | null;
  amount: number;
  paidAmount: number;
  penaltyAmount: number;
  outstanding: number;
  dueDate: string;
}

export interface OutstandingRow {
  tenantId: string;
  tenantName: string;
  phone: string;
  propertyName: string;
  billingMonth: string;
  dueDate: string;
  outstanding: number;
  status: string;
  rentRecordId?: string;
  billId?: string;
  kind: "rent" | "bill";
  label?: string;
}

export interface OutstandingGroup {
  tenantId: string;
  name: string;
  phone: string;
  property: { id: string; name: string; number: string } | null;
  totalOutstanding: number;
  overdue: boolean;
  records: {
    id: string;
    rentRecordId?: string | null;
    billId?: string | null;
    kind?: "rent" | "bill";
    label?: string | null;
    billingMonth: string;
    outstanding: number;
    status: string;
    dueDate: string;
  }[];
}

export interface RazorpayOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  tenantName?: string;
  billingMonth?: string;
}

export interface BillReport {
  items: BillReportRow[];
  count: number;
  totals: { amount: number; paidAmount: number; penaltyAmount: number; outstanding: number };
}

// ---------- Dashboard ----------
export interface Dashboard {
  summary: {
    totalProperties: number;
    totalHouses: number;
    totalPgs: number;
    occupied: number;
    vacant: number;
    maintenance: number;
    totalTenants: number;
    activeTenants: number;
    monthlyCollection: number;
    previousMonthCollection: number;
    momChange: number;
    outstanding: number;
    pendingRent: number;
    overdue: number;
    totalBilled?: number;
    totalPaymentsReceived?: number;
    collectionRate?: number;
    occupancyRate: number;
    periodOperatingExpenses?: number;
    totalExpenses?: number;
    potentialRevenue?: number;
    allTimeExpenses?: number;
    netOperatingProfit?: number;
  };
  occupancy?: {
    totalPgBeds: number;
    occupiedPgBeds: number;
    availablePgBeds: number;
    totalHouseCapacity: number;
    occupiedHouseCapacity: number;
    availableHouseCapacity: number;
    totalPropertyHomes: number;
    occupiedPropertyHomes: number;
    availablePropertyHomes: number;
    totalCapacity: number;
    occupiedCapacity: number;
    availableCapacity: number;
    occupancyRate: number;
  };
  charts: {
    monthlyCollection: { month: string; total: number }[];
    outstandingByMonth: { month: string; total: number }[];
    occupancyByType: { houses: { total: number; occupied: number; available: number; maintenance: number }; beds: { total: number; occupied: number } };
  };
  recentActivity: {
    payments: { id: string; tenant: string; amount: number; method: string; status: string; date: string }[];
    newTenants: { id: string; name: string; phone: string; createdAt: string }[];
    newProperties: { id: string; name: string; type: string; createdAt: string }[];
    upcomingDues: { id: string; tenant: string; phone: string; billingMonth: string; dueDate: string; outstanding: number; status: string }[];
    expiringAgreements: { id: string; tenant: string; property: string; endDate: string }[];
    pendingNotifications: number;
  };
}

// ---------- Settings ----------
export interface Settings {
  company: Record<string, unknown>;
  payment: Record<string, unknown>;
  notification: Record<string, unknown>;
}

// ---------- Notifications / Audit / Ops ----------
export interface NotificationRecord {
  id: string;
  tenantId: string | null;
  type: string;
  channel: string;
  to: string;
  subject: string | null;
  body: string;
  status: string;
  error: string | null;
  sentAt: string | null;
  createdAt: string;
  tenant?: { id: string; name: string } | null;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  user?: { id: string; name: string; email: string } | null;
}

export interface MaintenanceRequest {
  id: string;
  propertyId: string;
  description: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  property?: { id: string; name: string };
  room?: { id: string; roomNumber: string } | null;
}

export interface Expense {
  id: string;
  propertyId: string | null;
  category: string;
  description: string;
  amount: string;
  expenseDate: string;
  property?: { id: string; name: string } | null;
}

// ---------- Reports ----------
export interface CollectionSummary {
  total: number;
  byMethod: { CASH: number; BANK_TRANSFER_DD: number; RAZORPAY_UPI: number };
  count: number;
}

export interface OutstandingReport {
  items: { tenantId: string; name: string; phone: string; property: string | null; outstanding: number; overdue: number }[];
  total: number;
  overdueTotal: number;
}

export interface TenantLedger {
  tenant: { id: string; name: string; phone: string };
  rentRecords: {
    id: string;
    billingMonth: string;
    rent: number;
    additionalCharges: number;
    previousBalance: number;
    paidAmount: number;
    outstanding: number;
    status: string;
  }[];
  payments: { id: string; amount: number; method: string; status: string; date: string; receiptNumber: string | null }[];
}

export interface CollectionReportRow {
  month: string;
  total: number;
  cash: number;
  bank: number;
  razorpay: number;
}

export interface PropertyPerformanceRow {
  propertyId: string;
  name: string;
  type: string;
  rent: number;
  collected: number;
  outstanding: number;
  collectionRate: number;
  occupancy: number;
}

export interface LedgerRow {
  date: string;
  description: string;
  amount: number;
  type: "rent" | "charge" | "discount" | "payment";
  balance: number;
}

// ---------- CRM: Leads, Visits & Bookings ----------

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  propertyId: string | null;
  property?: { id: string; name: string; city: string } | null;
  roomType: string | null;
  budget: number | string | null;
  moveInDate: string | null;
  source: string | null;
  notes: string | null;
  status: "NEW" | "CONTACTED" | "FOLLOW_UP" | "VISIT_SCHEDULED" | "VISITED" | "INTERESTED" | "TOKEN_PAID" | "BOOKED" | "CONVERTED" | "LOST";
  followUpDate: string | null;
  assignedStaffId: string | null;
  assignedStaff?: { id: string; name: string; phone: string } | null;
  convertedTenantId?: string | null;
  createdAt: string;
  activities?: LeadActivity[];
}

export interface LeadActivity {
  id: string;
  leadId: string;
  action: string;
  notes: string;
  performedBy: string | null;
  createdAt: string;
}

export interface PropertyVisit {
  id: string;
  leadId: string;
  lead?: { id: string; name: string; phone: string; email: string | null };
  propertyId: string;
  property?: { id: string; name: string; address: string; city: string };
  roomId: string | null;
  room?: { id: string; roomNumber: string } | null;
  visitDate: string;
  assignedStaffId: string | null;
  assignedStaff?: { id: string; name: string; phone: string } | null;
  notes: string | null;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  createdAt: string;
}

export interface Booking {
  id: string;
  bookingNumber: string;
  leadId: string | null;
  lead?: { id: string; name: string; phone: string } | null;
  tenantId: string | null;
  tenant?: { id: string; name: string; phone: string } | null;
  propertyId: string;
  property?: { id: string; name: string };
  roomId: string;
  room?: { id: string; roomNumber: string };
  bedId: string;
  bed?: { id: string; bedNumber: string };
  tokenAmount: number | string;
  paymentMethod: string;
  bookingDate: string;
  expiryDate: string;
  status: "RESERVED" | "CONFIRMED" | "CANCELLED" | "EXPIRED" | "CONVERTED";
  notes: string | null;
  createdAt: string;
}

// ---------- Operations: Staff, Vendors & PG ----------

export interface Staff {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: string;
  status: string;
  createdAt: string;
  properties?: { id: string; name: string }[];
}

export interface Vendor {
  id: string;
  name: string;
  phone: string;
  service: string;
  company: string | null;
  address: string | null;
  createdAt: string;
  properties?: { id: string; name: string }[];
}

export interface GuestLog {
  id: string;
  tenantId: string;
  tenant?: { id: string; name: string; room?: { roomNumber: string } };
  guestName: string;
  guestPhone: string;
  relation: string | null;
  entryDate: string;
  exitDate: string | null;
  notes: string | null;
}

export interface TenantLeave {
  id: string;
  tenantId: string;
  tenant?: { id: string; name: string; phone: string };
  startDate: string;
  endDate: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  notes: string | null;
  createdAt: string;
}
