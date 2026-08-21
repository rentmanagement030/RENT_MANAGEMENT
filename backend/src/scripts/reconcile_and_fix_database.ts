import { prisma } from "../config/prisma";
import { numberMoney, zero, add, sub, gt } from "../utils/money";

async function main() {
  console.log("=== RECONCILING AND FIXING ALL BILLS & PAYMENTS ===");

  // 1. Fix Santhosh M corrupted bill (Amount 9000, stored outstanding 10000 -> fix to 9000)
  const santhoshBill = await prisma.bill.findUnique({
    where: { id: "cmssoil9c0011fkxwn0pt4hvg" },
  });
  if (santhoshBill && numberMoney(santhoshBill.outstanding) > numberMoney(santhoshBill.amount)) {
    console.log("Fixing Santhosh M corrupted bill outstanding from 10000 to 9000...");
    await prisma.bill.update({
      where: { id: "cmssoil9c0011fkxwn0pt4hvg" },
      data: { outstanding: santhoshBill.amount, paidAmount: 0 },
    });
  }

  // 2. Fix over-allocated utility bills and create missing payment allocations for rent bills
  // Let's inspect each payment and its allocations
  const payments = await prisma.payment.findMany({
    include: {
      tenant: true,
      allocations: { include: { bill: true } },
    },
  });

  for (const p of payments) {
    const pAmt = numberMoney(p.amount);

    // Let's check seed payments that were partially allocated to utility bills but belonged to rent
    if (p.id === "cmssmnh2i0047fku492j660ts") {
      // Arun Kumar Aug 3 payment of 9,000 (Allocated 1500 to EB bill cmssmnfv0003nfku41zemo46f, 7500 remaining for Rent bill cmssoiv4d001cfkxwsauu675x)
      const rentBillId = "cmssoiv4d001cfkxwsauu675x";
      const existingAlloc = await prisma.paymentAllocation.findFirst({
        where: { paymentId: p.id, billId: rentBillId },
      });
      if (!existingAlloc) {
        console.log(`Adding missing 7500 allocation for Arun Kumar Rent bill from Payment ${p.id}...`);
        await prisma.paymentAllocation.create({
          data: {
            paymentId: p.id,
            billId: rentBillId,
            amount: 7500,
          },
        });
      }
    }

    if (p.id === "cmssmnh9r0049fku4blqgrxcz") {
      // Ramesh Kumar Aug 4 payment of 5,000 (Allocated 500 to Water bill cmssmnfzi003pfku49bzoscrm, 4500 remaining for Rent bill cmssoixki001gfkxwtt67s0sh)
      const rentBillId = "cmssoixki001gfkxwtt67s0sh";
      const existingAlloc = await prisma.paymentAllocation.findFirst({
        where: { paymentId: p.id, billId: rentBillId },
      });
      if (!existingAlloc) {
        console.log(`Adding missing 4500 allocation for Ramesh Kumar Rent bill from Payment ${p.id}...`);
        await prisma.paymentAllocation.create({
          data: {
            paymentId: p.id,
            billId: rentBillId,
            amount: 4500,
          },
        });
      }
    }

    if (p.id === "cmssmnhe5004bfku49414t9ki") {
      // Praveen Kumar Aug 2 payment of 19,000 (Allocated 1000 to Other bill cmssmngch003vfku4fdra9a96, 18000 remaining for Rent bill cmssoiqlp0017fkxwt0ds8uf2)
      const rentBillId = "cmssoiqlp0017fkxwt0ds8uf2";
      const existingAlloc = await prisma.paymentAllocation.findFirst({
        where: { paymentId: p.id, billId: rentBillId },
      });
      if (!existingAlloc) {
        console.log(`Adding missing 18000 allocation for Praveen Kumar Rent bill from Payment ${p.id}...`);
        await prisma.paymentAllocation.create({
          data: {
            paymentId: p.id,
            billId: rentBillId,
            amount: 18000,
          },
        });
      }
    }

    if (p.id === "cmssmnhic004dfku43zgzh0pz") {
      // Vignesh S Aug 5 payment of 10,000 (Allocated 150 to Other bill cmssmnggv003xfku49uqus0ji, 9850 remaining for Rent bill cmssoit190019fkxwuijbhsm3)
      const rentBillId = "cmssoit190019fkxwuijbhsm3";
      const existingAlloc = await prisma.paymentAllocation.findFirst({
        where: { paymentId: p.id, billId: rentBillId },
      });
      if (!existingAlloc) {
        console.log(`Adding missing 9850 allocation for Vignesh S Rent bill from Payment ${p.id}...`);
        await prisma.paymentAllocation.create({
          data: {
            paymentId: p.id,
            billId: rentBillId,
            amount: 9850,
          },
        });
      }
    }
  }

  // 3. Remove duplicate / over-allocations on utility bills where allocations exceed bill amount
  const bills = await prisma.bill.findMany({
    include: { allocations: true },
  });

  for (const b of bills) {
    const bAmt = numberMoney(b.amount);
    let totalAlloc = b.allocations.reduce((s, a) => s + numberMoney(a.amount), 0);

    if (totalAlloc > bAmt && b.allocations.length > 1) {
      console.log(`Cleaning over-allocation on Bill ${b.id} (${b.billType} ${b.billingMonth}): Amount ${bAmt}, Allocations Total ${totalAlloc}`);
      // Keep only first allocation or trim allocations so total <= bAmt
      let running = 0;
      for (const a of b.allocations) {
        const aAmt = numberMoney(a.amount);
        if (running >= bAmt) {
          console.log(`  Deleting duplicate allocation ${a.id}...`);
          await prisma.paymentAllocation.delete({ where: { id: a.id } });
        } else if (running + aAmt > bAmt) {
          const trimmed = bAmt - running;
          console.log(`  Trimming allocation ${a.id} from ${aAmt} to ${trimmed}...`);
          await prisma.paymentAllocation.update({
            where: { id: a.id },
            data: { amount: trimmed },
          });
          running = bAmt;
        } else {
          running += aAmt;
        }
      }
    }
  }

  // 4. Recalculate paidAmount, outstanding, and status for ALL bills in database
  const updatedBills = await prisma.bill.findMany({
    include: { allocations: true },
  });

  const now = new Date();

  for (const b of updatedBills) {
    const billAmt = numberMoney(b.amount);
    const allocSum = b.allocations.reduce((s, a) => s + numberMoney(a.amount), 0);
    const paidAmount = Math.min(billAmt, allocSum);
    const outstanding = Math.max(0, billAmt - paidAmount);

    let status = b.status;
    if (status !== "CANCELLED") {
      if (outstanding === 0) {
        status = "PAID";
      } else if (paidAmount > 0) {
        status = "PARTIAL";
      } else if (b.dueDate < now) {
        status = "OVERDUE";
      } else {
        status = "PENDING";
      }
    }

    await prisma.bill.update({
      where: { id: b.id },
      data: {
        paidAmount,
        outstanding,
        status,
      },
    });
  }

  console.log("=== RECONCILIATION COMPLETE ===");
}

main().finally(() => prisma.$disconnect());
