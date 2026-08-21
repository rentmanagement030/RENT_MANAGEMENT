import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { numberMoney, zero } from "../utils/money";
import { PaymentCalculationResult, PeriodFilter } from "./types";
import { parsePeriodDates } from "./period.engine";

export async function computePaymentDetails(paymentId: string): Promise<PaymentCalculationResult> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { allocations: true },
  });

  if (!payment) throw new Error(`Payment ${paymentId} not found`);

  const amount = numberMoney(payment.amount);
  const cashAmount = numberMoney(payment.cashAmount ?? zero());
  const upiAmount = numberMoney(payment.upiAmount ?? zero());

  const allocatedAmount = payment.allocations.reduce((sum, a) => sum + numberMoney(a.amount), 0);
  const unallocatedAmount = Math.max(0, amount - allocatedAmount);

  return {
    paymentId: payment.id,
    receiptNumber: payment.receiptNumber || payment.id,
    tenantId: payment.tenantId,
    propertyId: payment.propertyId,
    paymentDate: payment.paymentDate,
    amount,
    paymentMethod: payment.paymentMethod,
    cashAmount,
    upiAmount,
    paymentStatus: payment.paymentStatus,
    allocatedAmount,
    unallocatedAmount,
  };
}
