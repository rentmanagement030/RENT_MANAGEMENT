import { BillStatus, BillType, PaymentMethod, PaymentStatus } from "@prisma/client";

export interface PeriodFilter {
  billingMonth?: string;
  from?: Date;
  to?: Date;
  propertyId?: string;
  tenantId?: string;
  homeId?: string;
  taxType?: string;
  status?: string;
  search?: string;
}

export interface ParsedPeriod {
  billingMonth: string;
  fromDate: Date;
  toDate: Date;
}

export interface BillCalculationResult {
  billId: string;
  billNumber: string;
  tenantId: string;
  propertyId: string;
  grossAmount: number;
  approvedPenalties: number;
  approvedCharges: number;
  approvedAdjustments: number;
  approvedCredits: number;
  netBillAmount: number;
  allocatedAmount: number;
  outstandingAmount: number;
  status: BillStatus;
}

export interface PaymentCalculationResult {
  paymentId: string;
  receiptNumber: string;
  tenantId: string;
  propertyId: string;
  paymentDate: Date;
  amount: number;
  paymentMethod: PaymentMethod;
  cashAmount: number;
  upiAmount: number;
  paymentStatus: PaymentStatus;
  allocatedAmount: number;
  unallocatedAmount: number;
}

export interface PeriodFinancialSummary {
  billingMonth: string;
  fromDate: Date;
  toDate: Date;

  // Billing & Collections
  grossBilled: number;
  expectedRevenue: number;
  approvedPenalties: number;
  approvedAdjustments: number;
  netBilled: number;
  billedCollections: number;
  collected: number;
  cashInflow: number;
  paymentInflow: number;
  totalPaymentsReceived: number;
  unallocated: number;
  tenantCreditBalance: number;
  collectionRate: number;

  // Outstanding Dues
  outstanding: number;
  periodOutstanding: number;
  allTimeOutstanding: number;
  overdue: number;
  overdueBalances: number;
  pending: number;
  pendingBalances: number;
  tenantsWithDuesCount: number;

  // Capacity & Occupancy
  potentialRevenue: number;
  totalCapacity: number;
  occupiedCapacity: number;
  vacantCapacity: number;
  occupancyRate: number;

  // Expenses & Taxes
  periodOperatingExpenses: number;
  allTimeExpenses: number;
  averageExpense: number;
  propertyTax: number;
  waterTax: number;
  paidThisMonthTax: number;

  // P&L Metrics
  collectedRevenue: number;
  totalCollected: number;
  totalExpenses: number;
  netOperatingProfit: number;
  netIncome: number;

  // Property Profitability Summary
  propertyProfitability?: Array<{
    propertyId: string;
    propertyName: string;
    expectedRent: number;
    actualCollected: number;
    actualExpenses: number;
    outstanding: number;
    netInvoice: number;
  }>;

  // Bill Report Summary
  billReportSummary?: {
    billedAmount: number;
    collectedAmount: number;
    penaltiesAmount: number;
    outstandingAmount: number;
  };
}

export interface RevenueBreakdown {
  rentIncome: number;
  utilityIncome: number;
  maintenanceIncome: number;
  penaltyIncome: number;
  otherIncome: number;
  totalRevenue: number;
}

export interface ExpenseBreakdown {
  maintenance: number;
  repairs: number;
  utilitiesPaidByOwner: number;
  propertyTax: number;
  staffCost: number;
  vendorCost: number;
  cleaning: number;
  security: number;
  insurance: number;
  administrative: number;
  software: number;
  marketing: number;
  otherOperating: number;
  capitalExpenses: number;
  totalOperatingExpenses: number;
  totalExpenses: number;
  totalCapitalExpenses?: number;
}

export interface AccountingPnLSummary {
  billingMonth?: string;
  fromDate: Date;
  toDate: Date;
  revenue: RevenueBreakdown;
  expenses: ExpenseBreakdown;
  netOperatingProfit: number;
  profitMarginPercent: number;
}

export interface PropertyProfitabilityRow {
  propertyId: string;
  propertyName: string;
  propertyType: string;
  city: string | null;
  expectedIncome: number;
  collectedIncome: number;
  totalOutstanding: number;
  operatingExpenses: number;
  capitalExpenses: number;
  netIncome: number;
  collectionRate: number;
  expenseRatio: number;
  occupancyPercent: number;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  archived?: boolean;
}

export interface PortfolioProfitabilitySummary {
  properties: PropertyProfitabilityRow[];
  summary: {
    expectedIncome: number;
    collectedIncome: number;
    operatingExpenses: number;
    totalExpenses: number;
    capitalExpenses: number;
    totalOutstanding: number;
    netIncome: number;
    collectionRate: number;
    expenseRatio: number;
  };
}

export type PropertyProfitabilitySummary = PortfolioProfitabilitySummary;

export interface TenantLedgerEntry {
  id: string;
  date: Date;
  type: "BILL" | "PAYMENT" | "ALLOCATION" | "CREDIT" | "ADVANCE" | "ADJUSTMENT" | "PENALTY" | "REFUND" | "REVERSAL" | "DEPOSIT";
  reference: string;
  description: string;
  debit: number;
  credit: number;
  allocated: number;
  unallocated: number;
  runningBalance: number;
}

export interface TenantLedgerSummary {
  tenantId: string;
  tenantName: string;
  propertyId: string;
  propertyName: string;
  currentRent: number;
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
  tenantCreditBalance: number;
  securityDepositBalance: number;
  entries: TenantLedgerEntry[];
}

export interface ReconciliationMismatch {
  category: "BILL" | "PAYMENT" | "PORTFOLIO" | "PNL" | "PROPERTY" | "TENANT" | "TAX";
  entityId: string;
  label: string;
  expectedAmount: number;
  actualAmount: number;
  difference: number;
  details: string;
}

export interface SystemReconciliationReport {
  isBalanced: boolean;
  timestamp: string;
  totals: {
    grossBilled: number;
    approvedPenalties: number;
    approvedAdjustments: number;
    netBilled: number;
    totalCollected: number;
    totalOutstanding: number;
    totalPaymentsReceived: number;
    totalUnallocated: number;
    totalOperatingExpenses: number;
    totalCapitalExpenses: number;
    netOperatingProfit: number;
  };
  mismatches: ReconciliationMismatch[];
}
