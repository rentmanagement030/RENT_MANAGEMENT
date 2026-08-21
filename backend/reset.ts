import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const modelsToTruncate = [
    'Property', 'PropertyImage', 'PgRoom', 'PgBed', 'PropertyHome',
    'Tenant', 'TenantDocument', 'FamilyMember', 'TenantTransferHistory',
    'Agreement', 'RentRecord', 'RentAdjustment',
    'Payment', 'PaymentLink', 'PaymentWebhook', 'PaymentAllocation',
    'Bill', 'BillItem', 'Penalty',
    'Notification', 'Job',
    'MaintenanceRequest', 'Expense',
    'TaxRecord', 'TaxPaymentRecord',
    'AuditLog',
    'TenantAuth', 'TenantSession',
    'Lead', 'LeadActivity', 'PropertyVisit', 'Booking',
    'Staff', 'Vendor', 'GuestLog', 'TenantLeave'
  ];

  console.log("Truncating application tables...");
  
  const tables = modelsToTruncate.map(name => '"' + name + '"').join(', ');
  
  try {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
    console.log("Successfully truncated tables!");
  } catch (error) {
    console.error("Error truncating tables:", error);
  }
}

main().finally(() => prisma.$disconnect());
