import { prisma } from "../config/prisma";
import { numberMoney } from "../utils/money";

async function main() {
  console.log("=== ALL PAYMENTS IN DATABASE ===");

  const payments = await prisma.payment.findMany({
    include: {
      tenant: { select: { name: true } },
      allocations: { include: { bill: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Total Payments: ${payments.length}`);

  let totalPaymentAmount = 0;
  let totalAllocated = 0;

  payments.forEach((p) => {
    const amt = numberMoney(p.amount);
    const allocSum = p.allocations.reduce((s, a) => s + numberMoney(a.amount), 0);
    totalPaymentAmount += amt;
    totalAllocated += allocSum;

    console.log(`\nPayment ID: ${p.id}`);
    console.log(`  Tenant: ${p.tenant?.name}`);
    console.log(`  Date: ${p.paymentDate.toISOString().slice(0, 10)} | Amount: ${amt} | Status: ${p.paymentStatus} | Method: ${p.paymentMethod}`);
    console.log(`  Allocations (${p.allocations.length}):`);
    p.allocations.forEach((a) => {
      console.log(`    -> Bill ${a.billId} (${a.bill?.billType} ${a.bill?.billingMonth}) Alloc Amount: ${a.amount}`);
    });
  });

  console.log(`\nTotal Payments Amount (All Time): ${totalPaymentAmount}`);
  console.log(`Total Allocated Amount (All Time): ${totalAllocated}`);
}

main().finally(() => prisma.$disconnect());
