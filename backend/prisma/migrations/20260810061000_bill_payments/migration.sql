-- AlterEnum
ALTER TYPE "JobType" ADD VALUE 'BILL_GENERATION';
ALTER TYPE "JobType" ADD VALUE 'APPLY_PENALTIES';

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_rentRecordId_fkey";

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "rentRecordId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_rentRecordId_fkey" FOREIGN KEY ("rentRecordId") REFERENCES "RentRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
