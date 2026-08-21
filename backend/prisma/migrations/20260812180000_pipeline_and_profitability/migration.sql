-- Migration: 20260812180000_pipeline_and_profitability

-- AlterEnum
ALTER TYPE "NotificationStatus" ADD VALUE IF NOT EXISTS 'NOT_CONFIGURED';

-- AlterTable MaintenanceRequest
ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'GENERAL',
ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN IF NOT EXISTS "assignedStaffId" TEXT,
ADD COLUMN IF NOT EXISTS "assignedVendorId" TEXT,
ADD COLUMN IF NOT EXISTS "estimatedCost" DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS "actualCost" DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "expenseId" TEXT;

-- AlterTable Expense
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "maintenanceId" TEXT,
ADD COLUMN IF NOT EXISTS "vendorId" TEXT,
ADD COLUMN IF NOT EXISTS "staffId" TEXT;

-- AlterTable Lead
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "roomId" TEXT,
ADD COLUMN IF NOT EXISTS "bedId" TEXT;

-- CreateIndexes & ForeignKeys
CREATE UNIQUE INDEX IF NOT EXISTS "MaintenanceRequest_expenseId_key" ON "MaintenanceRequest"("expenseId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaintenanceRequest_tenantId_fkey') THEN
    ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaintenanceRequest_assignedStaffId_fkey') THEN
    ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaintenanceRequest_assignedVendorId_fkey') THEN
    ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_assignedVendorId_fkey" FOREIGN KEY ("assignedVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaintenanceRequest_expenseId_fkey') THEN
    ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Expense_vendorId_fkey') THEN
    ALTER TABLE "Expense" ADD CONSTRAINT "Expense_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Expense_staffId_fkey') THEN
    ALTER TABLE "Expense" ADD CONSTRAINT "Expense_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Lead_roomId_fkey') THEN
    ALTER TABLE "Lead" ADD CONSTRAINT "Lead_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "PgRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Lead_bedId_fkey') THEN
    ALTER TABLE "Lead" ADD CONSTRAINT "Lead_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "PgBed"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
