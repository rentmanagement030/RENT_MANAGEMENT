import "dotenv/config";
import { prisma } from "../src/config/prisma";
import { ensureRolesAndPermissions } from "../src/services/user.service";
import { logger } from "../src/utils/logger";
import { unlinkSync, existsSync } from "fs";
import path from "path";

/**
 * Safe database cleanup for production/demo reset.
 *
 * Deletes ALL tenant, agreement, billing, payment, CRM, maintenance,
 * expense, notification, and log records while keeping:
 *   - Properties, PG Rooms, PG Beds, Property Images
 *   - Users, roles, permissions, role assignments (admin auth stays intact)
 *   - Notification templates and settings
 */
async function collectDocumentStorageKeys(): Promise<string[]> {
  const keys: string[] = [];
  const docs = await prisma.tenantDocument.findMany({ select: { storageKey: true } });
  docs.forEach((d) => d.storageKey && keys.push(d.storageKey));
  const agreements = await prisma.agreement.findMany({ select: { documentStorageKey: true } });
  agreements.forEach((a) => a.documentStorageKey && keys.push(a.documentStorageKey));
  return keys;
}

function deleteUploadedFiles(keys: string[]) {
  let removed = 0;
  for (const key of keys) {
    const p = path.join(process.cwd(), "uploads", key);
    if (existsSync(p)) {
      try {
        unlinkSync(p);
        removed++;
      } catch (err) {
        logger.warn(`Failed to remove file ${p}: ${String(err)}`);
      }
    }
  }
  if (removed > 0) logger.info(`Removed ${removed} uploaded document file(s)`);
}

async function main() {
  logger.info("Collecting document storage keys to clean up...");
  const keys = await collectDocumentStorageKeys();

  logger.info("Deleting non-property records...");
  await prisma.$transaction([
    prisma.guestLog.deleteMany(),
    prisma.tenantLeave.deleteMany(),
    prisma.leadActivity.deleteMany(),
    prisma.propertyVisit.deleteMany(),
    prisma.booking.deleteMany(),
    prisma.lead.deleteMany(),
    prisma.tenantSession.deleteMany(),
    prisma.tenantAuth.deleteMany(),
    prisma.paymentWebhook.deleteMany(),
    prisma.paymentLink.deleteMany(),
    prisma.paymentAllocation.deleteMany(),
    prisma.penalty.deleteMany(),
    prisma.billItem.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.bill.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.rentAdjustment.deleteMany(),
    prisma.rentRecord.deleteMany(),
    prisma.agreement.deleteMany(),
    prisma.familyMember.deleteMany(),
    prisma.tenantDocument.deleteMany(),
    prisma.tenantTransferHistory.deleteMany(),
    prisma.maintenanceRequest.deleteMany(),
    prisma.expense.deleteMany(),
    prisma.staff.deleteMany(),
    prisma.vendor.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.job.deleteMany(),
  ]);

  logger.info("Unlinking beds & resetting status...");
  await prisma.pgBed.updateMany({
    data: {
      tenantId: null,
      status: "AVAILABLE",
    },
  });

  logger.info("Deleting tenant records...");
  await prisma.tenant.deleteMany();

  logger.info("Resetting property and room statuses...");
  await prisma.property.updateMany({
    data: {
      status: "AVAILABLE",
    },
  });

  await prisma.pgRoom.updateMany({
    data: {
      status: "AVAILABLE",
    },
  });

  deleteUploadedFiles(keys);

  logger.info("Ensuring roles & permissions...");
  await ensureRolesAndPermissions();

  const [propertiesCount, roomsCount, bedsCount, imagesCount, tenantsCount, paymentsCount, billsCount] = await Promise.all([
    prisma.property.count(),
    prisma.pgRoom.count(),
    prisma.pgBed.count(),
    prisma.propertyImage.count(),
    prisma.tenant.count(),
    prisma.payment.count(),
    prisma.bill.count(),
  ]);

  console.log("===============================================");
  console.log("DATABASE CLEANUP COMPLETED (PROPERTIES PRESERVED)");
  console.log(`- Properties: ${propertiesCount}`);
  console.log(`- PG Rooms:   ${roomsCount}`);
  console.log(`- PG Beds:    ${bedsCount}`);
  console.log(`- Images:     ${imagesCount}`);
  console.log(`- Tenants:    ${tenantsCount}`);
  console.log(`- Payments:   ${paymentsCount}`);
  console.log(`- Bills:      ${billsCount}`);
  console.log("===============================================");
}

main()
  .catch((e) => {
    logger.error(`Clean failed: ${String(e)}`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
