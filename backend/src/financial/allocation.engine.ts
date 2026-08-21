import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { numberMoney, zero, add, sub } from "../utils/money";

export async function recalculateBillAllocations(tx: Prisma.TransactionClient, billId: string) {
  const bill = await tx.bill.findUnique({
    where: { id: billId },
    include: {
      allocations: {
        include: { payment: { select: { paymentStatus: true } } },
      },
    },
  });

  if (!bill) return;

  let paidAmount = zero();
  for (const alloc of bill.allocations) {
    const pStatus = alloc.payment?.paymentStatus;
    if (pStatus === "SUCCESS" || pStatus === "VERIFIED") {
      paidAmount = add(paidAmount, alloc.amount);
    }
  }

  const totalBillCost = add(bill.amount, bill.penaltyAmount);
  const outstanding = paidAmount.greaterThanOrEqualTo(totalBillCost) ? zero() : sub(totalBillCost, paidAmount);

  const status =
    outstanding.lessThanOrEqualTo(0)
      ? "PAID"
      : paidAmount.greaterThan(0)
        ? bill.dueDate < new Date()
          ? "OVERDUE"
          : "PARTIAL"
        : bill.dueDate < new Date()
          ? "OVERDUE"
          : "PENDING";

  await tx.bill.update({
    where: { id: billId },
    data: { paidAmount, outstanding, status },
  });

  if (bill.billType === "RENT" && bill.rentRecordId) {
    const rentRecord = await tx.rentRecord.findUnique({ where: { id: bill.rentRecordId } });
    if (rentRecord) {
      const rrTotal = add(add(rentRecord.previousBalance, rentRecord.rent), rentRecord.additionalCharges);
      const rrOutstanding = paidAmount.greaterThanOrEqualTo(rrTotal) ? zero() : sub(rrTotal, paidAmount);
      const rrStatus =
        rrOutstanding.lessThanOrEqualTo(0)
          ? "PAID"
          : paidAmount.greaterThan(0)
            ? rentRecord.dueDate < new Date()
              ? "OVERDUE"
              : "PARTIAL"
            : rentRecord.dueDate < new Date()
              ? "OVERDUE"
              : "PENDING";

      await tx.rentRecord.update({
        where: { id: rentRecord.id },
        data: { paidAmount, outstanding: rrOutstanding, status: rrStatus },
      });
    }
  }
}
