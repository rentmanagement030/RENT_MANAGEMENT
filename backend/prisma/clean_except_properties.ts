import "dotenv/config";
import { prisma } from "../src/config/prisma";
import { logger } from "../src/utils/logger";
import { unlinkSync, existsSync } from "fs";
import path from "path";

/**
 * Delete all database records EXCEPT properties data and core auth/settings.
 */
async function collectNonPropertyStorageKeys(): Promise<string[]> {
  const keys: string[] = [];
  const docs = await prisma.tenantDocument.findMany({ select: { storageKey: true } });
  docs.forEach((d) => d.storageKey && keys.push(d.storageKey));
  const agreements = await prisma.agreement.findMany({ select: { documentStorageKey: true } });
  agreements.forEach((a) => a.documentStorageKey && keys.push(a.documentStorageKey));
  return keys;
}

function deleteUploadedNonPropertyFiles(keys: string[]) {
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
  logger.info("Collecting non-property uploaded document references...");
  const keys = await collectNonPropertyStorageKeys();

  logger.info("Deleting non-property database records...");
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

  logger.info("Unlinking beds from tenants & resetting bed statuses...");
  await prisma.pgBed.updateMany({
    data: {
      tenantId: null,
      status: "AVAILABLE",
    },
  });

  logger.info("Deleting tenants...");
  await prisma.tenant.deleteMany();

  logger.info("Resetting property and room statuses to AVAILABLE...");
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

  deleteUploadedNonPropertyFiles(keys);

  const [propCount, roomCount, bedCount, imgCount, tenantCount, paymentCount, billCount] = await Promise.all([
    prisma.property.count(),
    prisma.pgRoom.count(),
    prisma.pgBed.count(),
    prisma.propertyImage.count(),
    prisma.tenant.count(),
    prisma.payment.count(),
    prisma.bill.count(),
  ]);

  logger.info("=================================================");
  logger.info("CLEANUP COMPLETED SUCCESSFULLY");
  logger.info(`Properties remaining: ${propCount}`);
  logger.info(`PG Rooms remaining: ${roomCount}`);
  logger.info(`PG Beds remaining: ${bedCount}`);
  logger.info(`Property Images remaining: ${imgCount}`);
  logger.info(`Tenants remaining: ${tenantCount}`);
  logger.info(`Payments remaining: ${paymentCount}`);
  logger.info(`Bills remaining: ${billCount}`);
  logger.info("=================================================");
}

main()
  .catch((e) => {
    logger.error(`Cleanup failed: ${String(e)}`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
