import { PrismaClient } from "@prisma/client";
import fs from "fs";

const prisma = new PrismaClient();

async function main() {
  console.log("Reading database...");

  const data = {
    properties: await prisma.property.findMany(),

    propertyHomes: await prisma.propertyHome.findMany(),

    pgRooms: await prisma.pgRoom.findMany(),

    pgBeds: await prisma.pgBed.findMany(),

    tenants: await prisma.tenant.findMany(),

    rentRecords: await prisma.rentRecord.findMany(),

    bills: await prisma.bill.findMany({
      include: {
        items: true,
      },
    }),

    payments: await prisma.payment.findMany(),

    paymentAllocations: await prisma.paymentAllocation.findMany(),

    expenses: await prisma.expense.findMany(),

    taxRecords: await prisma.taxRecord.findMany(),

    taxPaymentRecords: await prisma.taxPaymentRecord.findMany(),

    rentAdjustments: await prisma.rentAdjustment.findMany(),

    penalties: await prisma.penalty.findMany(),

    agreements: await prisma.agreement.findMany(),

    tenantTransferHistory:
      await prisma.tenantTransferHistory.findMany(),

    databaseCounts: {
      properties: await prisma.property.count(),
      propertyHomes: await prisma.propertyHome.count(),
      pgRooms: await prisma.pgRoom.count(),
      pgBeds: await prisma.pgBed.count(),
      tenants: await prisma.tenant.count(),
      rentRecords: await prisma.rentRecord.count(),
      bills: await prisma.bill.count(),
      payments: await prisma.payment.count(),
      paymentAllocations:
        await prisma.paymentAllocation.count(),
      expenses: await prisma.expense.count(),
      taxRecords: await prisma.taxRecord.count(),
      taxPaymentRecords:
        await prisma.taxPaymentRecord.count(),
      agreements: await prisma.agreement.count(),
    },
  };

  fs.writeFileSync(
    "financial_raw_export.json",
    JSON.stringify(
      data,
      (key, value) =>
        typeof value === "bigint"
          ? value.toString()
          : value,
      2
    )
  );

  console.log("======================================");
  console.log("FINANCIAL DATA EXPORT COMPLETE");
  console.log("======================================");
  console.log(data.databaseCounts);
  console.log("File: backend/financial_raw_export.json");
}

main()
  .catch((error) => {
    console.error("EXPORT FAILED");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });