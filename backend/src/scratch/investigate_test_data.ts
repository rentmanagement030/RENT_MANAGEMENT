import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [
    properties,
    tenants,
    bills,
    payments,
    expenses,
    taxPayments
  ] = await Promise.all([
    prisma.property.count(),
    prisma.tenant.count(),
    prisma.bill.count(),
    prisma.payment.count(),
    prisma.expense.count(),
    prisma.taxPaymentRecord.count()
  ]);

  console.log("=== DB COUNTS ===");
  console.log("Properties:", properties);
  console.log("Tenants:", tenants);
  console.log("Bills:", bills);
  console.log("Payments:", payments);
  console.log("Expenses:", expenses);
  console.log("TaxPayments:", taxPayments);

  const testProperties = await prisma.property.findMany({
    where: {
      OR: [
        { name: { contains: "Test" } },
        { address: { contains: "Test" } }
      ]
    },
    select: { id: true, name: true, createdAt: true }
  });

  console.log("=== TEST PROPERTIES DETECTED ===");
  testProperties.forEach(p => {
    console.log(`Record ID: ${p.id}, Record Type: Property, Created At: ${p.createdAt}, Likely Test Source: Acceptance Tests`);
  });

}
main().catch(console.error).finally(() => prisma.$disconnect());
