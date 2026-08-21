-- CreateEnums
DO $$ BEGIN
    CREATE TYPE "KycDocStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "TenantKycStatus" AS ENUM ('NOT_STARTED', 'DOCUMENTS_PENDING', 'PARTIALLY_VERIFIED', 'VERIFIED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterEnum
ALTER TYPE "BillType" ADD VALUE IF NOT EXISTS 'LATE_FEE';

ALTER TYPE "AgreementStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "AgreementStatus" ADD VALUE IF NOT EXISTS 'SENT';
ALTER TYPE "AgreementStatus" ADD VALUE IF NOT EXISTS 'VIEWED';
ALTER TYPE "AgreementStatus" ADD VALUE IF NOT EXISTS 'SIGNED';
ALTER TYPE "AgreementStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';
ALTER TYPE "AgreementStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- AlterTable Tenant
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "kycStatus" "TenantKycStatus" NOT NULL DEFAULT 'NOT_STARTED';

-- AlterTable TenantDocument
ALTER TABLE "TenantDocument" ADD COLUMN IF NOT EXISTS "status" "KycDocStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "TenantDocument" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
ALTER TABLE "TenantDocument" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);
ALTER TABLE "TenantDocument" ADD COLUMN IF NOT EXISTS "verifiedById" TEXT;

-- AlterTable Agreement
ALTER TABLE "Agreement" ADD COLUMN IF NOT EXISTS "token" TEXT;
ALTER TABLE "Agreement" ADD COLUMN IF NOT EXISTS "tokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "Agreement" ADD COLUMN IF NOT EXISTS "tokenRevoked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Agreement" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);
ALTER TABLE "Agreement" ADD COLUMN IF NOT EXISTS "viewedAt" TIMESTAMP(3);
ALTER TABLE "Agreement" ADD COLUMN IF NOT EXISTS "signedAt" TIMESTAMP(3);
ALTER TABLE "Agreement" ADD COLUMN IF NOT EXISTS "signatureUrl" TEXT;
ALTER TABLE "Agreement" ADD COLUMN IF NOT EXISTS "signatureName" TEXT;
ALTER TABLE "Agreement" ADD COLUMN IF NOT EXISTS "signatureMethod" TEXT;
ALTER TABLE "Agreement" ADD COLUMN IF NOT EXISTS "signedIp" TEXT;
ALTER TABLE "Agreement" ADD COLUMN IF NOT EXISTS "signedUserAgent" TEXT;
ALTER TABLE "Agreement" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Agreement" ADD COLUMN IF NOT EXISTS "isLocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Agreement" ADD COLUMN IF NOT EXISTS "signedPdfUrl" TEXT;

-- CreateTable TenantTransferHistory
CREATE TABLE IF NOT EXISTS "TenantTransferHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fromPropertyId" TEXT NOT NULL,
    "fromRoomId" TEXT,
    "fromBedId" TEXT,
    "fromRent" DECIMAL(12,2) NOT NULL,
    "toPropertyId" TEXT NOT NULL,
    "toRoomId" TEXT,
    "toBedId" TEXT,
    "toRent" DECIMAL(12,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantTransferHistory_pkey" PRIMARY KEY ("id")
);

-- Unique & Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "Agreement_token_key" ON "Agreement"("token");
CREATE INDEX IF NOT EXISTS "Tenant_kycStatus_idx" ON "Tenant"("kycStatus");
CREATE INDEX IF NOT EXISTS "TenantDocument_status_idx" ON "TenantDocument"("status");
CREATE INDEX IF NOT EXISTS "TenantTransferHistory_tenantId_idx" ON "TenantTransferHistory"("tenantId");
CREATE INDEX IF NOT EXISTS "TenantTransferHistory_effectiveFrom_idx" ON "TenantTransferHistory"("effectiveFrom");

-- Foreign Keys (idempotent so a partially-applied migration can be recovered)
DO $$ BEGIN
    ALTER TABLE "TenantDocument" ADD CONSTRAINT "TenantDocument_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "TenantTransferHistory" ADD CONSTRAINT "TenantTransferHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "TenantTransferHistory" ADD CONSTRAINT "TenantTransferHistory_fromPropertyId_fkey" FOREIGN KEY ("fromPropertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "TenantTransferHistory" ADD CONSTRAINT "TenantTransferHistory_fromRoomId_fkey" FOREIGN KEY ("fromRoomId") REFERENCES "PgRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "TenantTransferHistory" ADD CONSTRAINT "TenantTransferHistory_fromBedId_fkey" FOREIGN KEY ("fromBedId") REFERENCES "PgBed"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "TenantTransferHistory" ADD CONSTRAINT "TenantTransferHistory_toPropertyId_fkey" FOREIGN KEY ("toPropertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "TenantTransferHistory" ADD CONSTRAINT "TenantTransferHistory_toRoomId_fkey" FOREIGN KEY ("toRoomId") REFERENCES "PgRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "TenantTransferHistory" ADD CONSTRAINT "TenantTransferHistory_toBedId_fkey" FOREIGN KEY ("toBedId") REFERENCES "PgBed"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "TenantTransferHistory" ADD CONSTRAINT "TenantTransferHistory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
