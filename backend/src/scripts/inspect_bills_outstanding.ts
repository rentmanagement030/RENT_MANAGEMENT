import { prisma } from "../config/prisma";
import { numberMoney } from "../utils/money";

async function main() {
  console.log("=== INSPECTING ALL BILLS IN DATABASE ===");

  const allBills = await prisma.bill.findMany({
    include: {
      tenant: { select: { name: true, phone: true } },
      allocations: { include: { payment: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`Total Bills in DB: ${allBills.length}`);

  let invalidOutstandingCount = 0;
  let totalBilledAug = 0;
  let totalPaidAug = 0;
  let totalOutstandingAug = 0;

  allBills.forEach((b) => {
    const amt = numberMoney(b.amount);
    const paid = numberMoney(b.paidAmount);
    const out = numberMoney(b.outstanding);
    const allocSum = b.allocations.reduce((s, a) => s + numberMoney(a.amount), 0);

    const isAug = b.billingMonth === "2026-08" && b.status !== "CANCELLED";

    if (isAug) {
      totalBilledAug += amt;
      totalPaidAug += paid;
      totalOutstandingAug += out;
    }

    const isInvalid = out > amt || Math.abs(out - (amt - allocSum)) > 0.01;

    if (isInvalid || b.tenant?.name?.includes("Santhosh")) {
      invalidOutstandingCount++;
      console.log(`\n[BILL ISSUE DETECTED] ID: ${b.id}`);
      console.log(`  Tenant: ${b.tenant?.name} (${b.tenant?.phone})`);
      console.log(`  Type: ${b.billType} | Month: ${b.billingMonth} | Status: ${b.status}`);
      console.log(`  Amount: ${amt} | PaidAmount: ${paid} | Outstanding: ${out}`);
      console.log(`  Allocations Sum: ${allocSum} | Expected Outstanding (Amt - Alloc): ${amt - allocSum}`);
      console.log(`  Allocations List:`);
      b.allocations.forEach((a) => {
        console.log(`    -> Payment ID: ${a.paymentId} | Date: ${a.payment?.paymentDate?.toISOString().slice(0, 10)} | Amount: ${a.amount}`);
      });
    }
  });

  console.log("\n=== AUGUST 2026 BILLS AGGREGATION ===");
  console.log("Total Billed (Aug):", totalBilledAug);
  console.log("Total Paid (Aug):", totalPaidAug);
  console.log("Total Outstanding (Aug):", totalOutstandingAug);
  console.log("Expected Outstanding (Billed - Paid):", totalBilledAug - totalPaidAug);
  console.log("Difference (Stored Outstanding - Expected):", totalOutstandingAug - (totalBilledAug - totalPaidAug));
}

main().finally(() => prisma.$disconnect());
