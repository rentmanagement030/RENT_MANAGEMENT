import { PrismaClient } from "@prisma/client";

async function applyDDL() {
  console.log("Connecting directly to Supabase PostgreSQL (port 5432)...");
  
  const directUrl = "postgresql://postgres.jsepzhdtittxkdrmywtr:%40ravindkaviak0821@aws-0-ap-south-1.pooler.supabase.com:5432/postgres";
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: directUrl,
      },
    },
  });

  try {
    console.log("Connected! Applying DDL migrations...");

    // 1. Add VILLA, MULTI_UNIT_HOUSE, APARTMENT to PropertyType enum
    await prisma.$executeRawUnsafe(`ALTER TYPE "PropertyType" ADD VALUE IF NOT EXISTS 'VILLA';`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "PropertyType" ADD VALUE IF NOT EXISTS 'MULTI_UNIT_HOUSE';`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "PropertyType" ADD VALUE IF NOT EXISTS 'APARTMENT';`);

    await prisma.$executeRawUnsafe(`ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'UPI';`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'BANK_TRANSFER';`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CHEQUE';`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'OTHER';`);
    console.log("PropertyType and PaymentMethod enum values updated.");

    // 2. Add columns to Property table if missing
    await prisma.$executeRawUnsafe(`ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "ebConnectionType" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "ebMeterNumber" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "ebConnectionName" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "ebCurrentReading" DOUBLE PRECISION;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "ebLastReadingDate" TIMESTAMP(3);`);

    await prisma.$executeRawUnsafe(`ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "waterConnectionType" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "waterConsumerNumber" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "waterMeterNumber" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "waterConnectionName" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "waterCurrentReading" DOUBLE PRECISION;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "waterLastReadingDate" TIMESTAMP(3);`);
    console.log("Property table utility columns added.");

    // 3. Add homeId columns
    await prisma.$executeRawUnsafe(`ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "homeId" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Agreement" ADD COLUMN IF NOT EXISTS "homeId" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "RentRecord" ADD COLUMN IF NOT EXISTS "homeId" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Bill" ADD COLUMN IF NOT EXISTS "homeId" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "TenantTransferHistory" ADD COLUMN IF NOT EXISTS "fromHomeId" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "TenantTransferHistory" ADD COLUMN IF NOT EXISTS "toHomeId" TEXT;`);
    console.log("Tenant, Agreement, RentRecord, Bill homeId columns added.");

    // 4. Create PropertyHome table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PropertyHome" (
        "id" TEXT NOT NULL,
        "propertyId" TEXT NOT NULL,
        "floor" TEXT NOT NULL,
        "homeNumber" TEXT NOT NULL,
        "homeType" TEXT NOT NULL DEFAULT '2 BHK',
        "builtUpArea" DOUBLE PRECISION,
        "bedrooms" INTEGER,
        "bathrooms" INTEGER,
        "rent" DECIMAL(12,2) NOT NULL,
        "advance" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        "deposit" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        "dueDay" INTEGER NOT NULL DEFAULT 5,
        "latePenalty" DECIMAL(12,2) NOT NULL DEFAULT 50.00,
        "status" "PropertyStatus" NOT NULL DEFAULT 'AVAILABLE',
        "ebConnectionType" TEXT,
        "ebNumber" TEXT,
        "ebMeterNumber" TEXT,
        "ebConnectionName" TEXT,
        "ebCurrentReading" DOUBLE PRECISION,
        "ebLastReadingDate" TIMESTAMP(3),
        "waterConnectionType" TEXT,
        "waterConsumerNumber" TEXT,
        "waterMeterNumber" TEXT,
        "waterConnectionName" TEXT,
        "waterCurrentReading" DOUBLE PRECISION,
        "waterLastReadingDate" TIMESTAMP(3),
        "archived" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PropertyHome_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "PropertyHome_propertyId_homeNumber_key" ON "PropertyHome"("propertyId", "homeNumber");`);
    console.log("PropertyHome table created.");

    // 5. Create TaxRecord table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TaxRecord" (
        "id" TEXT NOT NULL,
        "taxType" TEXT NOT NULL,
        "taxOwnership" TEXT NOT NULL DEFAULT 'PROPERTY',
        "propertyId" TEXT NOT NULL,
        "homeId" TEXT,
        "assessmentNumber" TEXT,
        "zone" TEXT,
        "division" TEXT,
        "billNumber" TEXT,
        "subNumber" TEXT,
        "assesseeName" TEXT,
        "consumerNumber" TEXT,
        "frequency" TEXT NOT NULL DEFAULT 'ANNUAL',
        "annualTaxAmount" DECIMAL(12,2) NOT NULL,
        "currentTaxPeriod" TEXT NOT NULL,
        "lastPaidDate" TIMESTAMP(3),
        "lastPaidAmount" DECIMAL(12,2),
        "nextDueDate" TIMESTAMP(3) NOT NULL,
        "outstandingAmount" DECIMAL(12,2) NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'DUE',
        "notes" TEXT,
        "createdById" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "TaxRecord_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log("TaxRecord table created.");

    // 6. Create TaxPaymentRecord table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TaxPaymentRecord" (
        "id" TEXT NOT NULL,
        "taxRecordId" TEXT NOT NULL,
        "taxType" TEXT NOT NULL,
        "propertyId" TEXT NOT NULL,
        "homeId" TEXT,
        "amount" DECIMAL(12,2) NOT NULL,
        "paymentDate" TIMESTAMP(3) NOT NULL,
        "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
        "receiptNumber" TEXT NOT NULL,
        "referenceNumber" TEXT,
        "taxPeriod" TEXT NOT NULL,
        "notes" TEXT,
        "recordedById" TEXT,
        "expenseId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "TaxPaymentRecord_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "TaxPaymentRecord_receiptNumber_key" ON "TaxPaymentRecord"("receiptNumber");`);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "TaxPaymentRecord_expenseId_key" ON "TaxPaymentRecord"("expenseId");`);
    console.log("TaxPaymentRecord table created.");

    console.log("ALL SCHEMAS & TABLES MIGRATED SUCCESSFULLY TO SUPABASE POSTGRESQL!");
  } catch (err) {
    console.error("DDL execution failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

applyDDL();
