import { prisma } from "../config/prisma";

async function run() {
  const activeProps = await prisma.property.findMany({ where: { archived: false }, select: { id: true }});
  const activeIds = activeProps.map(p => p.id);
  
  const billsActive = await prisma.bill.aggregate({
    where: { propertyId: { in: activeIds }, status: { not: "CANCELLED" }, billingMonth: "2026-08" },
    _sum: { amount: true, paidAmount: true }
  });
  console.log("Bills for active props:", billsActive._sum);
  
  const billsAll = await prisma.bill.aggregate({
    where: { status: { not: "CANCELLED" }, billingMonth: "2026-08" },
    _sum: { amount: true, paidAmount: true }
  });
  console.log("Bills for all props:", billsAll._sum);
}
run();
