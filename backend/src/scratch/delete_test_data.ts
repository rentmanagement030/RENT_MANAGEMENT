import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const testPropIds = [
    "cmt12ku620000fk7g8fpset81",
    "cmt19tnex0005fkjwl9h1p8cq",
    "cmt1941m00005fks4mvvjior6",
    "cmt1c1rw90005fkvs8f520zoe",
    "cmt19zl5t0005fkegn76ufqcq",
    "cmt19w9nz0005fkloxlrtle0e",
    "cmt1c3fr40005fkxwkdym1jwk"
  ];

  const executeQuietly = async (sql: string) => {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (e) {
      // ignore
    }
  };

  for (const pid of testPropIds) {
    // Delete payments first
    await executeQuietly(`DELETE FROM "PaymentAllocation" WHERE "billId" IN (SELECT "id" FROM "Bill" WHERE "propertyId" = '${pid}');`);
    await executeQuietly(`DELETE FROM "Payment" WHERE "propertyId" = '${pid}';`);
    await executeQuietly(`DELETE FROM "BillItem" WHERE "billId" IN (SELECT "id" FROM "Bill" WHERE "propertyId" = '${pid}');`);
    await executeQuietly(`DELETE FROM "Penalty" WHERE "billId" IN (SELECT "id" FROM "Bill" WHERE "propertyId" = '${pid}');`);
    await executeQuietly(`DELETE FROM "Bill" WHERE "propertyId" = '${pid}';`);
    await executeQuietly(`DELETE FROM "Expense" WHERE "propertyId" = '${pid}';`);
    await executeQuietly(`DELETE FROM "TaxPaymentRecord" WHERE "propertyId" = '${pid}';`);
    await executeQuietly(`DELETE FROM "RentRecord" WHERE "propertyId" = '${pid}';`);
    await executeQuietly(`DELETE FROM "Agreement" WHERE "propertyId" = '${pid}';`);
    await executeQuietly(`DELETE FROM "MaintenanceRequest" WHERE "propertyId" = '${pid}' OR "roomId" IN (SELECT "id" FROM "PgRoom" WHERE "propertyId" = '${pid}');`);
    await executeQuietly(`DELETE FROM "Maintenance" WHERE "propertyId" = '${pid}';`);
    await executeQuietly(`DELETE FROM "TenantTransferHistory" WHERE "tenantId" IN (SELECT "id" FROM "Tenant" WHERE "propertyId" = '${pid}');`);
    await executeQuietly(`DELETE FROM "TenantDocument" WHERE "tenantId" IN (SELECT "id" FROM "Tenant" WHERE "propertyId" = '${pid}');`);
    await executeQuietly(`DELETE FROM "KycDocument" WHERE "tenantId" IN (SELECT "id" FROM "Tenant" WHERE "propertyId" = '${pid}');`);
    await executeQuietly(`DELETE FROM "Tenant" WHERE "propertyId" = '${pid}';`);
    await executeQuietly(`DELETE FROM "PgBed" WHERE "roomId" IN (SELECT "id" FROM "PgRoom" WHERE "propertyId" = '${pid}');`);
    await executeQuietly(`DELETE FROM "PgRoom" WHERE "propertyId" = '${pid}';`);
    await executeQuietly(`DELETE FROM "PropertyHome" WHERE "propertyId" = '${pid}';`);
    await executeQuietly(`DELETE FROM "Property" WHERE "id" = '${pid}';`);
  }

  console.log("Cleanup complete!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
