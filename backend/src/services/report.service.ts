import { Prisma, PaymentMethod, BillType, BillStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { NotFoundError } from "../utils/http";
import { numberMoney, zero, toDecimal, add } from "../utils/money";
import { serializeAdminProperty } from "../utils/serializers";
import { getPropertyProfitabilityEngine } from "./financial.service";
import ExcelJS from "exceljs";

export interface DateRange {
  from?: Date;
  to?: Date;
}

function buildDateWhere(range: DateRange): Prisma.PaymentWhereInput["paymentDate"] {
  if (!range.from && !range.to) return undefined;
  const where: Prisma.DateTimeFilter = {};
  if (range.from) {
    const fromDate = new Date(range.from);
    fromDate.setHours(0, 0, 0, 0);
    where.gte = fromDate;
  }
  if (range.to) {
    const toDate = new Date(range.to);
    toDate.setHours(23, 59, 59, 999);
    where.lte = toDate;
  }
  return where;
}

export interface CollectionFilters extends DateRange {
  tenantId?: string;
  propertyId?: string;
  method?: PaymentMethod;
}

export async function collectionSummary(filters: CollectionFilters = {}) {
  const { tenantId, propertyId, method } = filters;
  const where: Prisma.PaymentWhereInput = {
    paymentStatus: { in: ["SUCCESS", "VERIFIED"] },
    paymentDate: buildDateWhere(filters),
    ...(tenantId ? { tenantId } : {}),
    ...(propertyId ? { propertyId } : {}),
    ...(method ? { paymentMethod: method } : {}),
  };

  const groups = await prisma.payment.groupBy({
    by: ["paymentMethod"],
    where,
    _sum: { amount: true },
    _count: { _all: true },
  });

  const byMethod = new Map<string, number>();
  for (const m of Object.values(PaymentMethod)) byMethod.set(m, 0);

  let total = zero();
  for (const g of groups) {
    byMethod.set(g.paymentMethod, numberMoney(g._sum.amount ?? zero()));
    total = add(total, g._sum.amount ?? zero());
  }

  return {
    total: numberMoney(total),
    byMethod: Object.fromEntries(byMethod),
    count: groups.reduce((s, g) => s + g._count._all, 0),
  };
}

export async function collectionTrend(days: number, range: DateRange = {}) {
  const where: Prisma.PaymentWhereInput = {
    paymentStatus: { in: ["SUCCESS", "VERIFIED"] },
    paymentDate: buildDateWhere(range),
  };
  const agg = await prisma.payment.aggregate({ where, _sum: { amount: true }, _count: true });
  return {
    total: numberMoney(agg._sum.amount ?? zero()),
    count: agg._count,
    days,
  };
}

export async function outstandingReport() {
  const openBillWhere: Prisma.BillWhereInput = {
    status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
    outstanding: { gt: 0 },
  };

  const tenants = await prisma.tenant.findMany({
    where: { status: { in: ["ACTIVE", "PENDING"] } },
    include: {
      rentRecords: { select: { outstanding: true, status: true, billingMonth: true } },
      bills: { where: openBillWhere, select: { outstanding: true, status: true, billingMonth: true } },
      property: { select: { name: true, number: true } },
    },
  });

  let total = zero();
  let overdueTotal = zero();
  const items = tenants.map((t) => {
    const outstanding = t.rentRecords
      .reduce((s, r) => add(s, r.outstanding), zero())
      .add(t.bills.reduce((s, b) => add(s, b.outstanding), zero()));
    const overdue = t.rentRecords
      .filter((r) => r.status === "OVERDUE")
      .reduce((s, r) => add(s, r.outstanding), zero())
      .add(t.bills.filter((b) => b.status === "OVERDUE").reduce((s, b) => add(s, b.outstanding), zero()));
    total = add(total, outstanding);
    overdueTotal = add(overdueTotal, overdue);
    return {
      tenantId: t.id,
      name: t.name,
      phone: t.phone,
      property: t.property ? `${t.property.name} ${t.property.number ?? ""}`.trim() : null,
      outstanding: numberMoney(outstanding),
      overdue: numberMoney(overdue),
    };
  });

  return {
    items,
    total: numberMoney(total),
    overdueTotal: numberMoney(overdueTotal),
  };
}

export async function propertyPerformanceReport() {
  const properties = await prisma.property.findMany({
    where: { archived: false },
    include: {
      tenants: { where: { status: "ACTIVE" }, select: { id: true, name: true } },
      rentRecords: {
        select: {
          paidAmount: true,
          outstanding: true,
          status: true,
          billingMonth: true,
        },
      },
      rooms: { include: { beds: true } },
    },
  });

  return properties.map((p) => {
    let totalBeds = 0;
    let occupiedBeds = 0;
    p.rooms.forEach((room) => {
      totalBeds += room.beds.length;
      occupiedBeds += room.beds.filter((b) => b.status === "OCCUPIED").length;
    });
    const collected = p.rentRecords.reduce((s, r) => add(s, r.paidAmount), zero());
    const outstanding = p.rentRecords.reduce((s, r) => add(s, r.outstanding), zero());
    const capacity = p.type === "HOUSE" ? 1 : totalBeds;
    const occupied = p.type === "HOUSE" ? (p.tenants.length > 0 ? 1 : 0) : occupiedBeds;
    return {
      id: p.id,
      propertyId: p.id,
      name: p.name,
      type: p.type,
      status: p.status,
      collected: numberMoney(collected),
      outstanding: numberMoney(outstanding),
      occupancy: capacity > 0 ? Math.round((occupied / capacity) * 100) : 0,
      tenants: p.tenants.length,
    };
  });
}

export async function tenantLedgerReport(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new NotFoundError("Tenant not found");

  const [rentRecords, payments] = await Promise.all([
    prisma.rentRecord.findMany({
      where: { tenantId },
      orderBy: { billingMonth: "desc" },
      include: { payments: true },
    }),
    prisma.payment.findMany({
      where: { tenantId },
      orderBy: { paymentDate: "desc" },
    }),
  ]);

  return {
    tenant: { id: tenant.id, name: tenant.name, phone: tenant.phone },
    rentRecords: rentRecords.map((r) => ({
      id: r.id,
      billingMonth: r.billingMonth,
      rent: numberMoney(r.rent),
      additionalCharges: numberMoney(r.additionalCharges),
      previousBalance: numberMoney(r.previousBalance),
      paidAmount: numberMoney(r.paidAmount),
      outstanding: numberMoney(r.outstanding),
      status: r.status,
    })),
    payments: payments.map((p) => ({
      id: p.id,
      amount: numberMoney(p.amount),
      method: p.paymentMethod,
      status: p.paymentStatus,
      date: p.paymentDate,
      receiptNumber: p.receiptNumber,
    })),
  };
}

export async function generateReportData(payload: Record<string, unknown>) {
  const name = String(payload.name ?? "report");
  const range: DateRange = {
    from: payload.from ? new Date(String(payload.from)) : undefined,
    to: payload.to ? new Date(String(payload.to)) : undefined,
  };
  return { name, summary: await collectionSummary(range), range };
}

function formatBillTypeLabel(type: string): string {
  switch (type.toUpperCase()) {
    case "RENT": return "Rent";
    case "EB": return "EB Bill";
    case "MAINTENANCE": return "Maintenance";
    case "WATER": return "Water Bill";
    case "GAS": return "Gas Bill";
    case "PARKING": return "Parking";
    case "WASTE": return "Waste Management";
    default:
      return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase() + (type.toLowerCase().includes("bill") ? "" : " Bill");
  }
}

export async function exportCollectionExcel(filters: CollectionFilters = {}) {
  const { tenantId, propertyId, method } = filters;
  const where: Prisma.PaymentWhereInput = {
    paymentStatus: { in: ["SUCCESS", "VERIFIED"] },
    paymentDate: buildDateWhere(filters),
    ...(tenantId ? { tenantId } : {}),
    ...(propertyId ? { propertyId } : {}),
    ...(method ? { paymentMethod: method } : {}),
  };

  const payments = await prisma.payment.findMany({
    where,
    include: {
      tenant: { select: { name: true, phone: true } },
      property: { select: { name: true } },
      rentRecord: { select: { id: true, billingMonth: true, rent: true, outstanding: true } },
      allocations: {
        include: {
          bill: { select: { id: true, billNumber: true, billType: true, amount: true, outstanding: true } },
        },
      },
    },
    orderBy: { paymentDate: "desc" },
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Collections");

  ws.columns = [
    { header: "Payment Date", key: "date", width: 14 },
    { header: "Tenant Name", key: "tenant", width: 22 },
    { header: "Tenant Phone", key: "phone", width: 16 },
    { header: "Property", key: "property", width: 20 },
    { header: "Payment Method", key: "method", width: 18 },
    { header: "Payment Purpose", key: "purpose", width: 28 },
    { header: "Rent Amount (₹)", key: "rentAmount", width: 16 },
    { header: "EB Amount (₹)", key: "ebAmount", width: 16 },
    { header: "Maintenance (₹)", key: "maintAmount", width: 16 },
    { header: "Water Amount (₹)", key: "waterAmount", width: 16 },
    { header: "Other Bills (₹)", key: "otherAmount", width: 16 },
    { header: "Total Paid (₹)", key: "totalAmount", width: 16 },
    { header: "Itemized Allocation Breakdown", key: "itemized", width: 45 },
    { header: "Bill/Invoice Ref", key: "billRef", width: 25 },
    { header: "Rent Month Ref", key: "rentRef", width: 16 },
    { header: "Payment Status", key: "status", width: 14 },
    { header: "Receipt Number", key: "receipt", width: 22 },
  ];

  payments.forEach((p) => {
    const typeAmounts: Record<string, number> = {};
    const itemizedList: string[] = [];
    const billRefs: string[] = [];
    const uniqueTypes: string[] = [];

    if (p.allocations && p.allocations.length > 0) {
      p.allocations.forEach((alloc) => {
        if (alloc.bill) {
          billRefs.push(alloc.bill.billNumber);
          const typeLabel = formatBillTypeLabel(alloc.bill.billType);
          if (!uniqueTypes.includes(typeLabel)) uniqueTypes.push(typeLabel);
          const amt = alloc.amount.toNumber();
          typeAmounts[alloc.bill.billType.toUpperCase()] = (typeAmounts[alloc.bill.billType.toUpperCase()] || 0) + amt;
          itemizedList.push(`${typeLabel} (${alloc.bill.billNumber}): ₹${amt.toLocaleString("en-IN")}`);
        }
      });
    }

    if (p.rentRecord && !uniqueTypes.includes("Rent")) {
      uniqueTypes.unshift("Rent");
      if (!typeAmounts["RENT"]) {
        typeAmounts["RENT"] = p.amount.toNumber();
      }
      if (itemizedList.length === 0) {
        itemizedList.push(`Rent (${p.rentRecord.billingMonth}): ₹${p.amount.toNumber().toLocaleString("en-IN")}`);
      }
    }

    // Build dynamic purpose e.g. "Rent + EB Bill + Maintenance"
    let purpose = uniqueTypes.join(" + ");
    if (!purpose) {
      if (p.notes && p.notes.toLowerCase().includes("eb")) purpose = "EB Bill";
      else if (p.notes && p.notes.toLowerCase().includes("rent")) purpose = "Rent";
      else purpose = "Other";
    }

    const rentAmount = typeAmounts["RENT"] || 0;
    const ebAmount = typeAmounts["EB"] || 0;
    const maintAmount = typeAmounts["MAINTENANCE"] || 0;
    const waterAmount = typeAmounts["WATER"] || 0;

    const standardTypes = ["RENT", "EB", "MAINTENANCE", "WATER"];
    const otherAmount = Object.keys(typeAmounts)
      .filter((t) => !standardTypes.includes(t))
      .reduce((sum, t) => sum + typeAmounts[t], 0);

    let outstandingSum = 0;
    if (p.rentRecord) outstandingSum += p.rentRecord.outstanding.toNumber();
    if (p.allocations) {
      p.allocations.forEach((alloc) => {
        if (alloc.bill) outstandingSum += alloc.bill.outstanding.toNumber();
      });
    }

    ws.addRow({
      date: p.paymentDate.toISOString().slice(0, 10),
      tenant: p.tenant?.name ?? "—",
      phone: p.tenant?.phone ?? "—",
      property: p.property?.name ?? "—",
      method: p.paymentMethod.replace(/_/g, " "),
      purpose,
      rentAmount,
      ebAmount,
      maintAmount,
      waterAmount,
      otherAmount,
      totalAmount: p.amount.toNumber(),
      itemized: itemizedList.join(" | ") || "—",
      billRef: billRefs.join(", ") || "—",
      rentRef: p.rentRecord?.billingMonth ?? "—",
      status: p.paymentStatus,
      receipt: p.receiptNumber ?? "—",
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function buildBillWhere(filters: {
  billingMonth?: string;
  billType?: BillType;
  status?: BillStatus;
  tenantId?: string;
  propertyId?: string;
}) {
  const where: Prisma.BillWhereInput = {};
  if (filters.billingMonth) where.billingMonth = filters.billingMonth;
  if (filters.billType) where.billType = filters.billType;
  if (filters.status) where.status = filters.status;
  else where.status = { not: "CANCELLED" as BillStatus };
  if (filters.tenantId) where.tenantId = filters.tenantId;
  if (filters.propertyId) where.propertyId = filters.propertyId;
  return where;
}

export async function billsReport(filters: {
  billingMonth?: string;
  billType?: BillType;
  status?: BillStatus;
  tenantId?: string;
  propertyId?: string;
}) {
  const where = buildBillWhere(filters);
  const [bills, agg] = await Promise.all([
    prisma.bill.findMany({
      where,
      include: {
        tenant: { select: { name: true, phone: true } },
        property: { select: { name: true, number: true } },
      },
      orderBy: [{ billingMonth: "desc" }, { billNumber: "asc" }],
      take: 500,
    }),
    prisma.bill.aggregate({
      where,
      _sum: { amount: true, paidAmount: true, penaltyAmount: true, outstanding: true },
      _count: true,
    }),
  ]);

  const items = bills.map((b) => ({
    id: b.id,
    billNumber: b.billNumber,
    billingMonth: b.billingMonth,
    billType: b.billType,
    status: b.status,
    tenant: b.tenant.name,
    tenantPhone: b.tenant.phone,
    property: b.property ? `${b.property.name} ${b.property.number ?? ""}`.trim() : null,
    amount: numberMoney(b.amount),
    paidAmount: numberMoney(b.paidAmount),
    penaltyAmount: numberMoney(b.penaltyAmount),
    outstanding: numberMoney(b.outstanding),
    dueDate: b.dueDate,
  }));

  return {
    items,
    count: agg._count,
    totals: {
      amount: numberMoney(agg._sum.amount ?? zero()),
      paidAmount: numberMoney(agg._sum.paidAmount ?? zero()),
      penaltyAmount: numberMoney(agg._sum.penaltyAmount ?? zero()),
      outstanding: numberMoney(agg._sum.outstanding ?? zero()),
    },
  };
}

export async function exportBillsExcel(filters: {
  billingMonth?: string;
  billType?: BillType;
  status?: BillStatus;
  tenantId?: string;
  propertyId?: string;
}) {
  const { items } = await billsReport(filters);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Bills");
  ws.columns = [
    { header: "Bill No", key: "billNumber", width: 18 },
    { header: "Month", key: "billingMonth", width: 12 },
    { header: "Type", key: "billType", width: 14 },
    { header: "Status", key: "status", width: 12 },
    { header: "Tenant", key: "tenant", width: 24 },
    { header: "Property", key: "property", width: 20 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Paid", key: "paidAmount", width: 14 },
    { header: "Penalty", key: "penaltyAmount", width: 14 },
    { header: "Outstanding", key: "outstanding", width: 14 },
    { header: "Due Date", key: "dueDate", width: 14 },
  ];
  items.forEach((b) =>
    ws.addRow({
      billNumber: b.billNumber,
      billingMonth: b.billingMonth,
      billType: b.billType,
      status: b.status,
      tenant: b.tenant,
      property: b.property,
      amount: toDecimal(b.amount).toNumber(),
      paidAmount: toDecimal(b.paidAmount).toNumber(),
      penaltyAmount: toDecimal(b.penaltyAmount).toNumber(),
      outstanding: toDecimal(b.outstanding).toNumber(),
      dueDate: b.dueDate ? b.dueDate.toISOString().slice(0, 10) : "",
    }),
  );
  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function exportOutstandingExcel() {
  const report = await outstandingReport();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Outstanding");
  ws.columns = [
    { header: "Tenant", key: "name", width: 24 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "Property", key: "property", width: 20 },
    { header: "Outstanding", key: "outstanding", width: 14 },
    { header: "Overdue", key: "overdue", width: 14 },
  ];
  report.items.forEach((i) => ws.addRow(i));
  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function exportTenantLedgerExcel(tenantId: string) {
  const ledger = await tenantLedgerReport(tenantId);
  const wb = new ExcelJS.Workbook();

  const rents = wb.addWorksheet("Rent Records");
  rents.columns = [
    { header: "Month", key: "billingMonth", width: 12 },
    { header: "Rent", key: "rent", width: 14 },
    { header: "Additional", key: "additionalCharges", width: 14 },
    { header: "Previous", key: "previousBalance", width: 14 },
    { header: "Paid", key: "paidAmount", width: 14 },
    { header: "Outstanding", key: "outstanding", width: 14 },
    { header: "Status", key: "status", width: 12 },
  ];
  ledger.rentRecords.forEach((r) =>
    rents.addRow({
      billingMonth: r.billingMonth,
      rent: toDecimal(r.rent).toNumber(),
      additionalCharges: toDecimal(r.additionalCharges).toNumber(),
      previousBalance: toDecimal(r.previousBalance).toNumber(),
      paidAmount: toDecimal(r.paidAmount).toNumber(),
      outstanding: toDecimal(r.outstanding).toNumber(),
      status: r.status,
    }),
  );

  const payments = wb.addWorksheet("Payments");
  payments.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Receipt", key: "receiptNumber", width: 18 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Method", key: "method", width: 18 },
    { header: "Status", key: "status", width: 12 },
  ];
  ledger.payments.forEach((p) =>
    payments.addRow({
      date: p.date.toISOString().slice(0, 10),
      receiptNumber: p.receiptNumber,
      amount: toDecimal(p.amount).toNumber(),
      method: p.method,
      status: p.status,
    }),
  );

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function getPropertyProfitability(filters: { propertyId?: string; from?: Date; to?: Date; billingMonth?: string }) {
  return getPropertyProfitabilityEngine(filters);
}
