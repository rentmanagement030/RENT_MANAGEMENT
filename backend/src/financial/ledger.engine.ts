import { prisma } from "../config/prisma";
import { numberMoney } from "../utils/money";
import { TenantLedgerEntry, TenantLedgerSummary } from "./types";

export async function computeTenantLedger(tenantId: string): Promise<TenantLedgerSummary> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      property: { select: { id: true, name: true } },
      agreements: { where: { status: "ACTIVE" }, take: 1 },
    },
  });

  if (!tenant) {
    throw new Error(`Tenant ${tenantId} not found`);
  }

  const activeAgreement = tenant.agreements[0];
  const securityDepositBalance = activeAgreement ? numberMoney(activeAgreement.deposit) : 0;

  const [bills, payments] = await Promise.all([
    prisma.bill.findMany({
      where: { tenantId, status: { not: "CANCELLED" } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.payment.findMany({
      where: { tenantId, paymentStatus: { in: ["SUCCESS", "VERIFIED"] } },
      include: { allocations: true },
      orderBy: { paymentDate: "asc" },
    }),
  ]);

  const rawEvents: Array<{
    date: Date;
    type: "BILL" | "PAYMENT";
    id: string;
    reference: string;
    description: string;
    debit: number;
    credit: number;
    allocated: number;
    unallocated: number;
  }> = [];

  for (const b of bills) {
    rawEvents.push({
      date: b.dueDate,
      type: "BILL",
      id: b.id,
      reference: b.billNumber,
      description: `${b.billType} Bill (${b.billingMonth})`,
      debit: numberMoney(b.amount) + numberMoney(b.penaltyAmount),
      credit: 0,
      allocated: 0,
      unallocated: 0,
    });
  }

  for (const p of payments) {
    const pAmt = numberMoney(p.amount);
    const allocSum = p.allocations.reduce((s, a) => s + numberMoney(a.amount), 0);
    const unalloc = Math.max(0, pAmt - allocSum);

    const desc = unalloc > 0
      ? `Payment via ${p.paymentMethod} (Allocated: ₹${allocSum}, Tenant Credit Balance: ₹${unalloc})`
      : `Payment via ${p.paymentMethod} (Allocated: ₹${allocSum})`;

    rawEvents.push({
      date: p.paymentDate,
      type: "PAYMENT",
      id: p.id,
      reference: p.receiptNumber || p.id,
      description: desc,
      debit: 0,
      credit: pAmt,
      allocated: allocSum,
      unallocated: unalloc,
    });
  }

  rawEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

  let totalBilled = 0;
  let totalPaid = 0;
  let runningBalance = 0;

  const entries: TenantLedgerEntry[] = rawEvents.map((ev) => {
    totalBilled += ev.debit;
    totalPaid += ev.credit;
    runningBalance = runningBalance + ev.debit - ev.credit;

    return {
      id: ev.id,
      date: ev.date,
      type: ev.type,
      reference: ev.reference,
      description: ev.description,
      debit: ev.debit,
      credit: ev.credit,
      allocated: ev.allocated,
      unallocated: ev.unallocated,
      runningBalance: Math.round(runningBalance * 100) / 100,
    };
  });

  const outstanding = Math.max(0, runningBalance);
  const tenantCreditBalance = runningBalance < 0 ? Math.abs(runningBalance) : 0;

  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    propertyId: tenant.propertyId ?? "",
    propertyName: tenant.property?.name ?? "—",
    currentRent: numberMoney(tenant.rent),
    totalBilled,
    totalPaid,
    outstanding,
    tenantCreditBalance,
    securityDepositBalance,
    entries,
  };
}
