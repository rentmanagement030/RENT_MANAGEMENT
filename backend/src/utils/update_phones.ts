import { prisma } from "../config/prisma";

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { id: "cmsolvvhp001mfkwob2s1rprd" },
  });
  if (!tenant) return;

  // Create a pending bill for testing automated sends
  const billNumber = `BILL-202608-${Math.floor(1000 + Math.random() * 9000)}`;
  const bill = await prisma.bill.create({
    data: {
      billNumber,
      tenantId: tenant.id,
      propertyId: tenant.propertyId ?? "cmsomkn0g005afkwo63uxq1cm",
      billType: "RENT",
      billingMonth: "2026-08-DUE",
      dueDate: new Date(),
      graceDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      amount: 15000,
      outstanding: 15000,
      status: "PENDING",
    },
  });

  console.log(`Created PENDING rent bill ${bill.billNumber} for tenant ${tenant.name} (${tenant.phone}).`);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
