import { prisma } from "../config/prisma";

async function inspectTaxDb() {
  const records = await prisma.taxRecord.findMany({
    include: { property: true, home: true },
  });
  console.log("Tax records count:", records.length);
  for (const r of records) {
    console.log(`ID: ${r.id}, Property: ${r.property?.name}, Type: ${r.taxType}, Status: ${r.status}, Annual: ${r.annualTaxAmount}, Out: ${r.outstandingAmount}, NextDue: ${r.nextDueDate}`);
  }
}

inspectTaxDb()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
