import "dotenv/config";
import { prisma } from "./src/config/prisma";

async function main() {
  const tables = ["property", "tenant", "rentRecord", "bill", "payment", "paymentLink", "maintenanceRequest", "agreement", "notification", "propertyImage", "tenantDocument", "familyMember", "pgRoom", "pgBed", "auditLog", "job"] as const;
  for (const t of tables) {
    const count = await (prisma as any)[t].count();
    console.log(`${t}: ${count}`);
  }
}

main().finally(async () => {
  await prisma.$disconnect();
});
