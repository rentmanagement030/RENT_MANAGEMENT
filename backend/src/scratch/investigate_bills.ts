import { prisma } from "../config/prisma";

async function run() {
  const bills = await prisma.bill.aggregate({
    where: { billingMonth: "2026-08", status: { not: "CANCELLED" } },
    _sum: { amount: true, penaltyAmount: true, paidAmount: true, outstanding: true }
  });
  console.log("Bills 2026-08:", bills);
  
  const byType = await prisma.bill.groupBy({
    by: ['billType'],
    where: { billingMonth: "2026-08", status: { not: "CANCELLED" } },
    _sum: { amount: true, penaltyAmount: true }
  });
  console.log("By Type:", byType);

  const rentRecords = await prisma.rentRecord.aggregate({
    where: { billingMonth: "2026-08" },
    _sum: { rent: true, additionalCharges: true, paidAmount: true, outstanding: true }
  });
  console.log("RentRecords 2026-08:", rentRecords);
}

run().catch(console.error).finally(() => prisma.$disconnect());
