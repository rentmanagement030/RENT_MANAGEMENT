import { Prisma, BillStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { numberMoney, zero, add, sub } from "../utils/money";
import { BillCalculationResult, PeriodFilter } from "./types";
import { parsePeriodDates } from "./period.engine";

export function computeNetBillStatus(
  dueDate: Date,
  allocatedAmount: number,
  netBillAmount: number,
  outstandingAmount: number,
  currentStatus: BillStatus,
  now = new Date()
): BillStatus {
  if (currentStatus === "DRAFT" || currentStatus === "WAIVED" || currentStatus === "CANCELLED") {
    return currentStatus;
  }
  if (outstandingAmount <= 0) return "PAID";
  if (allocatedAmount > 0) return dueDate < now ? "OVERDUE" : "PARTIAL";
  return dueDate < now ? "OVERDUE" : "PENDING";
}

export async function computeBillDetails(billId: string): Promise<BillCalculationResult> {
  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: {
      allocations: {
        include: { payment: { select: { paymentStatus: true } } },
      },
    },
  });

  if (!bill) throw new Error(`Bill ${billId} not found`);

  const grossAmount = numberMoney(bill.amount);
  const approvedPenalties = numberMoney(bill.penaltyAmount);
  const approvedCharges = 0;
  const approvedAdjustments = 0;
  const approvedCredits = 0;

  const netBillAmount = Math.max(0, grossAmount + approvedPenalties + approvedCharges - approvedAdjustments - approvedCredits);

  // Authoritative Allocation sum from valid SUCCESS / VERIFIED payments
  const allocatedAmount = bill.allocations
    .filter((a) => a.payment && (a.payment.paymentStatus === "SUCCESS" || a.payment.paymentStatus === "VERIFIED"))
    .reduce((sum, a) => sum + numberMoney(a.amount), 0);

  const outstandingAmount = Math.max(0, netBillAmount - allocatedAmount);
  const status = computeNetBillStatus(bill.dueDate, allocatedAmount, netBillAmount, outstandingAmount, bill.status);

  return {
    billId: bill.id,
    billNumber: bill.billNumber,
    tenantId: bill.tenantId,
    propertyId: bill.propertyId,
    grossAmount,
    approvedPenalties,
    approvedCharges,
    approvedAdjustments,
    approvedCredits,
    netBillAmount,
    allocatedAmount,
    outstandingAmount,
    status,
  };
}
