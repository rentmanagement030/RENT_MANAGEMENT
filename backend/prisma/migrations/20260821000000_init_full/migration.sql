-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'STAFF', 'VIEWER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'LOCKED');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('HOUSE', 'PG', 'VILLA', 'MULTI_UNIT_HOUSE', 'APARTMENT');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "BedStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'UNDER_NOTICE', 'MAINTENANCE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'FOLLOW_UP', 'VISIT_SCHEDULED', 'VISITED', 'INTERESTED', 'TOKEN_PAID', 'BOOKED', 'CONVERTED', 'LOST');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('RESERVED', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('UPLOADED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'FORMER', 'PENDING');

-- CreateEnum
CREATE TYPE "KycDocStatus" AS ENUM ('PENDING', 'AUTO_VERIFIED', 'MANUAL_REVIEW', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TenantKycStatus" AS ENUM ('NOT_STARTED', 'DOCUMENTS_PENDING', 'PARTIALLY_VERIFIED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'SIGNED', 'COMPLETED', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'RENEWED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'WAIVED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('RAZORPAY_UPI', 'CASH', 'BANK_TRANSFER_DD', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'MIXED', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PENDING_VERIFICATION', 'VERIFIED', 'SUCCESS', 'FAILED', 'REFUNDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('AADHAAR', 'PAN', 'PASSPORT', 'DRIVING_LICENSE', 'AGREEMENT', 'PHOTOGRAPH', 'PHOTO', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('RENT_DUE', 'RENT_OVERDUE', 'PAYMENT_CONFIRMATION', 'PAYMENT_LINK', 'AGREEMENT_EXPIRY', 'GENERAL');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED', 'NOT_CONFIGURED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('SEND_NOTIFICATION', 'GENERATE_REPORT', 'RENT_REMINDERS', 'AGREEMENT_REMINDERS', 'BILL_GENERATION', 'APPLY_PENALTIES', 'RETRY');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "BillType" AS ENUM ('RENT', 'EB', 'MAINTENANCE', 'WATER', 'LATE_FEE', 'OTHER');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('DRAFT', 'PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'WAIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PenaltyRuleType" AS ENUM ('FIXED_PER_DAY');

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" "UserRole" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "firebaseUid" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRoleAssignment" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "UserRoleAssignment_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "type" "PropertyType" NOT NULL,
    "name" TEXT NOT NULL,
    "number" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "area" TEXT,
    "bhkType" TEXT,
    "maxCapacity" INTEGER,
    "ebNumber" TEXT,
    "ebConnectionType" TEXT DEFAULT 'SHARED_PROPERTY',
    "ebMeterNumber" TEXT,
    "ebConnectionName" TEXT,
    "ebCurrentReading" DECIMAL(12,2),
    "ebLastReadingDate" TIMESTAMP(3),
    "waterConnectionType" TEXT DEFAULT 'SHARED_PROPERTY',
    "waterConsumerNumber" TEXT,
    "waterMeterNumber" TEXT,
    "waterConnectionName" TEXT,
    "waterCurrentReading" DECIMAL(12,2),
    "waterLastReadingDate" TIMESTAMP(3),
    "rent" DECIMAL(12,2) NOT NULL,
    "advance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deposit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "dueDay" INTEGER NOT NULL DEFAULT 5,
    "latePenalty" DECIMAL(12,2) NOT NULL DEFAULT 50.00,
    "status" "PropertyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "description" TEXT,
    "amenities" TEXT[],
    "publicVisibility" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "contactPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyImage" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "storageKey" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT NOT NULL DEFAULT 'GALLERY',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PgRoom" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "floor" TEXT,
    "roomNumber" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "rent" DECIMAL(12,2),
    "advance" DECIMAL(12,2),
    "deposit" DECIMAL(12,2),
    "status" "BedStatus" NOT NULL DEFAULT 'AVAILABLE',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PgRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PgBed" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "bedNumber" TEXT NOT NULL,
    "rent" DECIMAL(12,2),
    "advance" DECIMAL(12,2),
    "deposit" DECIMAL(12,2),
    "status" "BedStatus" NOT NULL DEFAULT 'AVAILABLE',
    "tenantId" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PgBed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyHome" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "floor" TEXT NOT NULL,
    "homeNumber" TEXT NOT NULL,
    "homeType" TEXT NOT NULL DEFAULT '2 BHK',
    "builtUpArea" INTEGER,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "rent" DECIMAL(12,2) NOT NULL,
    "advance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deposit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "dueDay" INTEGER NOT NULL DEFAULT 5,
    "latePenalty" DECIMAL(12,2) NOT NULL DEFAULT 50.00,
    "status" "PropertyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "ebConnectionType" TEXT DEFAULT 'INDIVIDUAL',
    "ebNumber" TEXT,
    "ebMeterNumber" TEXT,
    "ebConnectionName" TEXT,
    "ebCurrentReading" DECIMAL(12,2),
    "ebLastReadingDate" TIMESTAMP(3),
    "waterConnectionType" TEXT DEFAULT 'INDIVIDUAL',
    "waterConsumerNumber" TEXT,
    "waterMeterNumber" TEXT,
    "waterConnectionName" TEXT,
    "waterCurrentReading" DECIMAL(12,2),
    "waterLastReadingDate" TIMESTAMP(3),
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyHome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "aadhaarNumber" TEXT,
    "photographStorageKey" TEXT,
    "emergencyName" TEXT,
    "emergencyPhone" TEXT,
    "propertyId" TEXT,
    "roomId" TEXT,
    "homeId" TEXT,
    "rent" DECIMAL(12,2) NOT NULL,
    "advance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deposit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "joiningDate" TIMESTAMP(3),
    "status" "TenantStatus" NOT NULL DEFAULT 'PENDING',
    "kycStatus" "TenantKycStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "notes" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "status" "KycDocStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "verificationConfidence" DECIMAL(5,2),
    "verificationReason" TEXT,
    "verificationMethod" TEXT DEFAULT 'AI_ASSISTED',
    "ocrData" JSONB,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyMember" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "phone" TEXT,
    "age" INTEGER,
    "occupation" TEXT,
    "isDependent" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantTransferHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fromPropertyId" TEXT NOT NULL,
    "fromRoomId" TEXT,
    "fromBedId" TEXT,
    "fromHomeId" TEXT,
    "fromRent" DECIMAL(12,2) NOT NULL,
    "toPropertyId" TEXT NOT NULL,
    "toRoomId" TEXT,
    "toBedId" TEXT,
    "toHomeId" TEXT,
    "toRent" DECIMAL(12,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantTransferHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agreement" (
    "id" TEXT NOT NULL,
    "agreementNumber" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "homeId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "rent" DECIMAL(12,2) NOT NULL,
    "advance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deposit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "documentStorageKey" TEXT,
    "documentName" TEXT,
    "documentMimeType" TEXT,
    "documentSize" INTEGER,
    "status" "AgreementStatus" NOT NULL DEFAULT 'DRAFT',
    "token" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "tokenRevoked" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "signatureUrl" TEXT,
    "signatureName" TEXT,
    "signatureMethod" TEXT,
    "signedIp" TEXT,
    "signedUserAgent" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "signedPdfUrl" TEXT,
    "cancellationReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "homeId" TEXT,
    "billingMonth" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "rent" DECIMAL(12,2) NOT NULL,
    "additionalCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "previousBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "outstanding" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "RentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentAdjustment" (
    "id" TEXT NOT NULL,
    "rentRecordId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "adjustedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "paymentMethod" "PaymentMethod" NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "rentRecordId" TEXT,
    "razorpayPaymentId" TEXT,
    "razorpayOrderId" TEXT,
    "razorpaySignature" TEXT,
    "razorpayWebhookEventId" TEXT,
    "bankName" TEXT,
    "bankReferenceNumber" TEXT,
    "ddNumber" TEXT,
    "ddDate" TIMESTAMP(3),
    "cashAmount" DECIMAL(12,2),
    "upiAmount" DECIMAL(12,2),
    "upiApp" TEXT,
    "receiptNumber" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rentRecordId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "razorpayOrderId" TEXT NOT NULL,
    "razorpayLinkId" TEXT,
    "shortUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "PaymentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhook" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSED',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "billNumber" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "homeId" TEXT,
    "rentRecordId" TEXT,
    "billType" "BillType" NOT NULL,
    "billingMonth" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "graceDate" TIMESTAMP(3),
    "amount" DECIMAL(12,2) NOT NULL,
    "penaltyAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "outstanding" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "BillStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillItem" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,2),
    "unitPrice" DECIMAL(12,2),
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Penalty" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "ruleType" "PenaltyRuleType" NOT NULL DEFAULT 'FIXED_PER_DAY',
    "rate" DECIMAL(12,2) NOT NULL,
    "daysOverdue" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Penalty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT,
    "billId" TEXT,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceRequest" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomId" TEXT,
    "tenantId" TEXT,
    "description" TEXT NOT NULL,
    "category" TEXT DEFAULT 'GENERAL',
    "priority" TEXT DEFAULT 'MEDIUM',
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'OPEN',
    "reportedById" TEXT,
    "assignedStaffId" TEXT,
    "assignedVendorId" TEXT,
    "estimatedCost" DECIMAL(12,2),
    "actualCost" DECIMAL(12,2),
    "expenseId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT,
    "vendorId" TEXT,
    "staffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRecord" (
    "id" TEXT NOT NULL,
    "taxType" TEXT NOT NULL,
    "taxOwnership" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "homeId" TEXT,
    "assessmentNumber" TEXT,
    "zone" TEXT,
    "division" TEXT,
    "billNumber" TEXT,
    "subNumber" TEXT,
    "assesseeName" TEXT,
    "consumerNumber" TEXT,
    "frequency" TEXT NOT NULL,
    "annualTaxAmount" DECIMAL(12,2) NOT NULL,
    "currentTaxPeriod" TEXT NOT NULL,
    "lastPaidDate" TIMESTAMP(3),
    "lastPaidAmount" DECIMAL(12,2) DEFAULT 0,
    "nextDueDate" TIMESTAMP(3) NOT NULL,
    "outstandingAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DUE',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxPaymentRecord" (
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

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantAuth" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantAuth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantSession" (
    "id" TEXT NOT NULL,
    "tenantAuthId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "propertyId" TEXT,
    "roomId" TEXT,
    "bedId" TEXT,
    "roomType" TEXT,
    "budget" DECIMAL(12,2),
    "moveInDate" TIMESTAMP(3),
    "source" TEXT,
    "notes" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "followUpDate" TIMESTAMP(3),
    "assignedStaffId" TEXT,
    "convertedTenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadActivity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyVisit" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomId" TEXT,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "assignedStaffId" TEXT,
    "notes" TEXT,
    "status" "VisitStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "bookingNumber" TEXT NOT NULL,
    "leadId" TEXT,
    "tenantId" TEXT,
    "propertyId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "bedId" TEXT NOT NULL,
    "tokenAmount" DECIMAL(12,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "bookingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'RESERVED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'CARETAKER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "company" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestPhone" TEXT NOT NULL,
    "relation" TEXT,
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantLeave" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantLeave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PropertyToStaff" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PropertyToStaff_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_PropertyToVendor" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PropertyToVendor_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "Permission_key_idx" ON "Permission"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "UserRoleAssignment_roleId_idx" ON "UserRoleAssignment"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Property_status_idx" ON "Property"("status");

-- CreateIndex
CREATE INDEX "Property_type_idx" ON "Property"("type");

-- CreateIndex
CREATE INDEX "Property_publicVisibility_idx" ON "Property"("publicVisibility");

-- CreateIndex
CREATE INDEX "Property_archived_idx" ON "Property"("archived");

-- CreateIndex
CREATE INDEX "Property_city_idx" ON "Property"("city");

-- CreateIndex
CREATE INDEX "PropertyImage_propertyId_idx" ON "PropertyImage"("propertyId");

-- CreateIndex
CREATE INDEX "PgRoom_propertyId_idx" ON "PgRoom"("propertyId");

-- CreateIndex
CREATE INDEX "PgRoom_status_idx" ON "PgRoom"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PgBed_tenantId_key" ON "PgBed"("tenantId");

-- CreateIndex
CREATE INDEX "PgBed_roomId_idx" ON "PgBed"("roomId");

-- CreateIndex
CREATE INDEX "PgBed_status_idx" ON "PgBed"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PgBed_roomId_bedNumber_key" ON "PgBed"("roomId", "bedNumber");

-- CreateIndex
CREATE INDEX "PropertyHome_propertyId_idx" ON "PropertyHome"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyHome_status_idx" ON "PropertyHome"("status");

-- CreateIndex
CREATE INDEX "PropertyHome_floor_idx" ON "PropertyHome"("floor");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyHome_propertyId_homeNumber_key" ON "PropertyHome"("propertyId", "homeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_phone_key" ON "Tenant"("phone");

-- CreateIndex
CREATE INDEX "Tenant_phone_idx" ON "Tenant"("phone");

-- CreateIndex
CREATE INDEX "Tenant_email_idx" ON "Tenant"("email");

-- CreateIndex
CREATE INDEX "Tenant_propertyId_idx" ON "Tenant"("propertyId");

-- CreateIndex
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");

-- CreateIndex
CREATE INDEX "Tenant_kycStatus_idx" ON "Tenant"("kycStatus");

-- CreateIndex
CREATE UNIQUE INDEX "TenantDocument_storageKey_key" ON "TenantDocument"("storageKey");

-- CreateIndex
CREATE INDEX "TenantDocument_tenantId_idx" ON "TenantDocument"("tenantId");

-- CreateIndex
CREATE INDEX "TenantDocument_status_idx" ON "TenantDocument"("status");

-- CreateIndex
CREATE INDEX "FamilyMember_tenantId_idx" ON "FamilyMember"("tenantId");

-- CreateIndex
CREATE INDEX "TenantTransferHistory_tenantId_idx" ON "TenantTransferHistory"("tenantId");

-- CreateIndex
CREATE INDEX "TenantTransferHistory_effectiveFrom_idx" ON "TenantTransferHistory"("effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "Agreement_agreementNumber_key" ON "Agreement"("agreementNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Agreement_token_key" ON "Agreement"("token");

-- CreateIndex
CREATE INDEX "Agreement_tenantId_idx" ON "Agreement"("tenantId");

-- CreateIndex
CREATE INDEX "Agreement_propertyId_idx" ON "Agreement"("propertyId");

-- CreateIndex
CREATE INDEX "Agreement_endDate_idx" ON "Agreement"("endDate");

-- CreateIndex
CREATE INDEX "Agreement_status_idx" ON "Agreement"("status");

-- CreateIndex
CREATE INDEX "Agreement_token_idx" ON "Agreement"("token");

-- CreateIndex
CREATE INDEX "RentRecord_tenantId_idx" ON "RentRecord"("tenantId");

-- CreateIndex
CREATE INDEX "RentRecord_propertyId_idx" ON "RentRecord"("propertyId");

-- CreateIndex
CREATE INDEX "RentRecord_dueDate_idx" ON "RentRecord"("dueDate");

-- CreateIndex
CREATE INDEX "RentRecord_status_idx" ON "RentRecord"("status");

-- CreateIndex
CREATE INDEX "RentRecord_billingMonth_idx" ON "RentRecord"("billingMonth");

-- CreateIndex
CREATE UNIQUE INDEX "RentRecord_tenantId_billingMonth_key" ON "RentRecord"("tenantId", "billingMonth");

-- CreateIndex
CREATE INDEX "RentAdjustment_rentRecordId_idx" ON "RentAdjustment"("rentRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpayPaymentId_key" ON "Payment"("razorpayPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_receiptNumber_key" ON "Payment"("receiptNumber");

-- CreateIndex
CREATE INDEX "Payment_tenantId_idx" ON "Payment"("tenantId");

-- CreateIndex
CREATE INDEX "Payment_propertyId_idx" ON "Payment"("propertyId");

-- CreateIndex
CREATE INDEX "Payment_rentRecordId_idx" ON "Payment"("rentRecordId");

-- CreateIndex
CREATE INDEX "Payment_paymentDate_idx" ON "Payment"("paymentDate");

-- CreateIndex
CREATE INDEX "Payment_paymentMethod_idx" ON "Payment"("paymentMethod");

-- CreateIndex
CREATE INDEX "Payment_paymentStatus_idx" ON "Payment"("paymentStatus");

-- CreateIndex
CREATE INDEX "Payment_razorpayPaymentId_idx" ON "Payment"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "Payment_receiptNumber_idx" ON "Payment"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentLink_razorpayOrderId_key" ON "PaymentLink"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentLink_razorpayLinkId_key" ON "PaymentLink"("razorpayLinkId");

-- CreateIndex
CREATE INDEX "PaymentLink_tenantId_idx" ON "PaymentLink"("tenantId");

-- CreateIndex
CREATE INDEX "PaymentLink_rentRecordId_idx" ON "PaymentLink"("rentRecordId");

-- CreateIndex
CREATE INDEX "PaymentLink_status_idx" ON "PaymentLink"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhook_eventId_key" ON "PaymentWebhook"("eventId");

-- CreateIndex
CREATE INDEX "PaymentWebhook_eventId_idx" ON "PaymentWebhook"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_billNumber_key" ON "Bill"("billNumber");

-- CreateIndex
CREATE INDEX "Bill_tenantId_idx" ON "Bill"("tenantId");

-- CreateIndex
CREATE INDEX "Bill_propertyId_idx" ON "Bill"("propertyId");

-- CreateIndex
CREATE INDEX "Bill_billType_idx" ON "Bill"("billType");

-- CreateIndex
CREATE INDEX "Bill_status_idx" ON "Bill"("status");

-- CreateIndex
CREATE INDEX "Bill_dueDate_idx" ON "Bill"("dueDate");

-- CreateIndex
CREATE INDEX "Bill_billingMonth_idx" ON "Bill"("billingMonth");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_tenantId_billingMonth_billType_key" ON "Bill"("tenantId", "billingMonth", "billType");

-- CreateIndex
CREATE INDEX "BillItem_billId_idx" ON "BillItem"("billId");

-- CreateIndex
CREATE INDEX "Penalty_billId_idx" ON "Penalty"("billId");

-- CreateIndex
CREATE INDEX "Penalty_status_idx" ON "Penalty"("status");

-- CreateIndex
CREATE INDEX "PaymentAllocation_billId_idx" ON "PaymentAllocation"("billId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_paymentId_idx" ON "PaymentAllocation"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_paymentId_billId_key" ON "PaymentAllocation"("paymentId", "billId");

-- CreateIndex
CREATE INDEX "Notification_status_idx" ON "Notification"("status");

-- CreateIndex
CREATE INDEX "Notification_scheduledAt_idx" ON "Notification"("scheduledAt");

-- CreateIndex
CREATE INDEX "Notification_tenantId_idx" ON "Notification"("tenantId");

-- CreateIndex
CREATE INDEX "Notification_billId_idx" ON "Notification"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_key_key" ON "NotificationTemplate"("key");

-- CreateIndex
CREATE INDEX "Job_status_runAt_idx" ON "Job"("status", "runAt");

-- CreateIndex
CREATE INDEX "Job_type_idx" ON "Job"("type");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceRequest_expenseId_key" ON "MaintenanceRequest"("expenseId");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_propertyId_idx" ON "MaintenanceRequest"("propertyId");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_status_idx" ON "MaintenanceRequest"("status");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_tenantId_idx" ON "MaintenanceRequest"("tenantId");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_assignedStaffId_idx" ON "MaintenanceRequest"("assignedStaffId");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_assignedVendorId_idx" ON "MaintenanceRequest"("assignedVendorId");

-- CreateIndex
CREATE INDEX "Expense_expenseDate_idx" ON "Expense"("expenseDate");

-- CreateIndex
CREATE INDEX "Expense_propertyId_idx" ON "Expense"("propertyId");

-- CreateIndex
CREATE INDEX "Expense_vendorId_idx" ON "Expense"("vendorId");

-- CreateIndex
CREATE INDEX "Expense_staffId_idx" ON "Expense"("staffId");

-- CreateIndex
CREATE INDEX "TaxRecord_propertyId_idx" ON "TaxRecord"("propertyId");

-- CreateIndex
CREATE INDEX "TaxRecord_homeId_idx" ON "TaxRecord"("homeId");

-- CreateIndex
CREATE INDEX "TaxRecord_taxType_idx" ON "TaxRecord"("taxType");

-- CreateIndex
CREATE INDEX "TaxRecord_status_idx" ON "TaxRecord"("status");

-- CreateIndex
CREATE INDEX "TaxRecord_nextDueDate_idx" ON "TaxRecord"("nextDueDate");

-- CreateIndex
CREATE UNIQUE INDEX "TaxPaymentRecord_receiptNumber_key" ON "TaxPaymentRecord"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TaxPaymentRecord_expenseId_key" ON "TaxPaymentRecord"("expenseId");

-- CreateIndex
CREATE INDEX "TaxPaymentRecord_taxRecordId_idx" ON "TaxPaymentRecord"("taxRecordId");

-- CreateIndex
CREATE INDEX "TaxPaymentRecord_propertyId_idx" ON "TaxPaymentRecord"("propertyId");

-- CreateIndex
CREATE INDEX "TaxPaymentRecord_paymentDate_idx" ON "TaxPaymentRecord"("paymentDate");

-- CreateIndex
CREATE INDEX "TaxPaymentRecord_receiptNumber_idx" ON "TaxPaymentRecord"("receiptNumber");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "TenantAuth_tenantId_key" ON "TenantAuth"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantAuth_phone_key" ON "TenantAuth"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSession_tokenHash_key" ON "TenantSession"("tokenHash");

-- CreateIndex
CREATE INDEX "TenantSession_tenantAuthId_idx" ON "TenantSession"("tenantAuthId");

-- CreateIndex
CREATE INDEX "TenantSession_expiresAt_idx" ON "TenantSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_convertedTenantId_key" ON "Lead"("convertedTenantId");

-- CreateIndex
CREATE INDEX "Lead_phone_idx" ON "Lead"("phone");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_followUpDate_idx" ON "Lead"("followUpDate");

-- CreateIndex
CREATE INDEX "LeadActivity_leadId_idx" ON "LeadActivity"("leadId");

-- CreateIndex
CREATE INDEX "PropertyVisit_leadId_idx" ON "PropertyVisit"("leadId");

-- CreateIndex
CREATE INDEX "PropertyVisit_propertyId_idx" ON "PropertyVisit"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyVisit_visitDate_idx" ON "PropertyVisit"("visitDate");

-- CreateIndex
CREATE INDEX "PropertyVisit_status_idx" ON "PropertyVisit"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_bookingNumber_key" ON "Booking"("bookingNumber");

-- CreateIndex
CREATE INDEX "Booking_propertyId_idx" ON "Booking"("propertyId");

-- CreateIndex
CREATE INDEX "Booking_roomId_idx" ON "Booking"("roomId");

-- CreateIndex
CREATE INDEX "Booking_bedId_idx" ON "Booking"("bedId");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_phone_key" ON "Staff"("phone");

-- CreateIndex
CREATE INDEX "GuestLog_tenantId_idx" ON "GuestLog"("tenantId");

-- CreateIndex
CREATE INDEX "TenantLeave_tenantId_idx" ON "TenantLeave"("tenantId");

-- CreateIndex
CREATE INDEX "TenantLeave_status_idx" ON "TenantLeave"("status");

-- CreateIndex
CREATE INDEX "_PropertyToStaff_B_index" ON "_PropertyToStaff"("B");

-- CreateIndex
CREATE INDEX "_PropertyToVendor_B_index" ON "_PropertyToVendor"("B");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyImage" ADD CONSTRAINT "PropertyImage_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PgRoom" ADD CONSTRAINT "PgRoom_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PgBed" ADD CONSTRAINT "PgBed_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "PgRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PgBed" ADD CONSTRAINT "PgBed_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyHome" ADD CONSTRAINT "PropertyHome_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "PgRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "PropertyHome"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantDocument" ADD CONSTRAINT "TenantDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantDocument" ADD CONSTRAINT "TenantDocument_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantDocument" ADD CONSTRAINT "TenantDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantTransferHistory" ADD CONSTRAINT "TenantTransferHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantTransferHistory" ADD CONSTRAINT "TenantTransferHistory_fromPropertyId_fkey" FOREIGN KEY ("fromPropertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantTransferHistory" ADD CONSTRAINT "TenantTransferHistory_fromRoomId_fkey" FOREIGN KEY ("fromRoomId") REFERENCES "PgRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantTransferHistory" ADD CONSTRAINT "TenantTransferHistory_fromBedId_fkey" FOREIGN KEY ("fromBedId") REFERENCES "PgBed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantTransferHistory" ADD CONSTRAINT "TenantTransferHistory_fromHomeId_fkey" FOREIGN KEY ("fromHomeId") REFERENCES "PropertyHome"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantTransferHistory" ADD CONSTRAINT "TenantTransferHistory_toPropertyId_fkey" FOREIGN KEY ("toPropertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantTransferHistory" ADD CONSTRAINT "TenantTransferHistory_toRoomId_fkey" FOREIGN KEY ("toRoomId") REFERENCES "PgRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantTransferHistory" ADD CONSTRAINT "TenantTransferHistory_toBedId_fkey" FOREIGN KEY ("toBedId") REFERENCES "PgBed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantTransferHistory" ADD CONSTRAINT "TenantTransferHistory_toHomeId_fkey" FOREIGN KEY ("toHomeId") REFERENCES "PropertyHome"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantTransferHistory" ADD CONSTRAINT "TenantTransferHistory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "PropertyHome"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentRecord" ADD CONSTRAINT "RentRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentRecord" ADD CONSTRAINT "RentRecord_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentRecord" ADD CONSTRAINT "RentRecord_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "PropertyHome"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentAdjustment" ADD CONSTRAINT "RentAdjustment_rentRecordId_fkey" FOREIGN KEY ("rentRecordId") REFERENCES "RentRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentAdjustment" ADD CONSTRAINT "RentAdjustment_adjustedById_fkey" FOREIGN KEY ("adjustedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_rentRecordId_fkey" FOREIGN KEY ("rentRecordId") REFERENCES "RentRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_rentRecordId_fkey" FOREIGN KEY ("rentRecordId") REFERENCES "RentRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "PropertyHome"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_rentRecordId_fkey" FOREIGN KEY ("rentRecordId") REFERENCES "RentRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillItem" ADD CONSTRAINT "BillItem_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Penalty" ADD CONSTRAINT "Penalty_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "PgRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_assignedVendorId_fkey" FOREIGN KEY ("assignedVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRecord" ADD CONSTRAINT "TaxRecord_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRecord" ADD CONSTRAINT "TaxRecord_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "PropertyHome"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRecord" ADD CONSTRAINT "TaxRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxPaymentRecord" ADD CONSTRAINT "TaxPaymentRecord_taxRecordId_fkey" FOREIGN KEY ("taxRecordId") REFERENCES "TaxRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxPaymentRecord" ADD CONSTRAINT "TaxPaymentRecord_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxPaymentRecord" ADD CONSTRAINT "TaxPaymentRecord_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "PropertyHome"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxPaymentRecord" ADD CONSTRAINT "TaxPaymentRecord_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxPaymentRecord" ADD CONSTRAINT "TaxPaymentRecord_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantSession" ADD CONSTRAINT "TenantSession_tenantAuthId_fkey" FOREIGN KEY ("tenantAuthId") REFERENCES "TenantAuth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "PgRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "PgBed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyVisit" ADD CONSTRAINT "PropertyVisit_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyVisit" ADD CONSTRAINT "PropertyVisit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyVisit" ADD CONSTRAINT "PropertyVisit_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "PgRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyVisit" ADD CONSTRAINT "PropertyVisit_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "PgRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "PgBed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestLog" ADD CONSTRAINT "GuestLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantLeave" ADD CONSTRAINT "TenantLeave_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PropertyToStaff" ADD CONSTRAINT "_PropertyToStaff_A_fkey" FOREIGN KEY ("A") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PropertyToStaff" ADD CONSTRAINT "_PropertyToStaff_B_fkey" FOREIGN KEY ("B") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PropertyToVendor" ADD CONSTRAINT "_PropertyToVendor_A_fkey" FOREIGN KEY ("A") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PropertyToVendor" ADD CONSTRAINT "_PropertyToVendor_B_fkey" FOREIGN KEY ("B") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

