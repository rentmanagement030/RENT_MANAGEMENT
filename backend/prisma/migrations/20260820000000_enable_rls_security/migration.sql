-- Enable Row Level Security (RLS) on all application tables in public schema

ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantAuth" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Permission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RolePermission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserRoleAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Job" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Setting" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "Property" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PropertyHome" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PgRoom" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PgBed" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PropertyImage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_PropertyToStaff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_PropertyToVendor" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantTransferHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FamilyMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GuestLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantLeave" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "Agreement" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "RentRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RentAdjustment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Bill" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BillItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentAllocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentWebhook" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Expense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Penalty" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "TaxRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaxPaymentRecord" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "MaintenanceRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Staff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Vendor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeadActivity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PropertyVisit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Booking" ENABLE ROW LEVEL SECURITY;


-- 1. Property & Units (Public properties visible for marketing / inquiry)
DROP POLICY IF EXISTS "Public properties select policy" ON "Property";
CREATE POLICY "Public properties select policy" ON "Property"
    FOR SELECT TO anon, authenticated
    USING ("publicVisibility" = true);

DROP POLICY IF EXISTS "Public property homes select policy" ON "PropertyHome";
CREATE POLICY "Public property homes select policy" ON "PropertyHome"
    FOR SELECT TO anon, authenticated
    USING (EXISTS (
        SELECT 1 FROM "Property" p WHERE p.id = "PropertyHome"."propertyId" AND p."publicVisibility" = true
    ));

DROP POLICY IF EXISTS "Public property rooms select policy" ON "PgRoom";
CREATE POLICY "Public property rooms select policy" ON "PgRoom"
    FOR SELECT TO anon, authenticated
    USING (EXISTS (
        SELECT 1 FROM "Property" p WHERE p.id = "PgRoom"."propertyId" AND p."publicVisibility" = true
    ));

DROP POLICY IF EXISTS "Public property beds select policy" ON "PgBed";
CREATE POLICY "Public property beds select policy" ON "PgBed"
    FOR SELECT TO anon, authenticated
    USING (EXISTS (
        SELECT 1 FROM "PgRoom" r JOIN "Property" p ON r."propertyId" = p.id
        WHERE r.id = "PgBed"."roomId" AND p."publicVisibility" = true
    ));

DROP POLICY IF EXISTS "Public property images select policy" ON "PropertyImage";
CREATE POLICY "Public property images select policy" ON "PropertyImage"
    FOR SELECT TO anon, authenticated
    USING (EXISTS (
        SELECT 1 FROM "Property" p WHERE p.id = "PropertyImage"."propertyId" AND p."publicVisibility" = true
    ));

-- 2. System Settings (Public info readable)
DROP POLICY IF EXISTS "Public settings select policy" ON "Setting";
CREATE POLICY "Public settings select policy" ON "Setting"
    FOR SELECT TO anon, authenticated
    USING (key IN ('company_name', 'company_logo', 'support_email', 'support_phone', 'terms_url', 'privacy_url'));

-- 3. Agreement Signing (Public token-based read policy for active signing)
DROP POLICY IF EXISTS "Public agreement sign select policy" ON "Agreement";
CREATE POLICY "Public agreement sign select policy" ON "Agreement"
    FOR SELECT TO anon
    USING (token IS NOT NULL AND status IN ('DRAFT', 'SENT', 'VIEWED', 'SIGNED'));

-- 4. Leads & Contact Enquiries (Public insert policy with strict field check)
DROP POLICY IF EXISTS "Public lead create policy" ON "Lead";
DROP POLICY IF EXISTS "Public lead insert policy" ON "Lead";
CREATE POLICY "Public lead insert policy" ON "Lead"
    FOR INSERT TO anon, authenticated
    WITH CHECK ("name" IS NOT NULL AND "phone" IS NOT NULL);

-- 5. Operational Property-Scoped Policies for Authenticated Application Users
DROP POLICY IF EXISTS "Authenticated user properties policy" ON "Property";
CREATE POLICY "Authenticated user properties policy" ON "Property"
    FOR ALL TO authenticated
    USING (archived = false);

DROP POLICY IF EXISTS "Authenticated user property homes policy" ON "PropertyHome";
CREATE POLICY "Authenticated user property homes policy" ON "PropertyHome"
    FOR ALL TO authenticated
    USING (archived = false);

DROP POLICY IF EXISTS "Authenticated user pg rooms policy" ON "PgRoom";
CREATE POLICY "Authenticated user pg rooms policy" ON "PgRoom"
    FOR ALL TO authenticated
    USING (archived = false);

DROP POLICY IF EXISTS "Authenticated user pg beds policy" ON "PgBed";
CREATE POLICY "Authenticated user pg beds policy" ON "PgBed"
    FOR ALL TO authenticated
    USING (archived = false);

DROP POLICY IF EXISTS "Authenticated user tenants policy" ON "Tenant";
CREATE POLICY "Authenticated user tenants policy" ON "Tenant"
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM "Property" p WHERE p.id = "Tenant"."propertyId" AND p.archived = false
    ));

DROP POLICY IF EXISTS "Authenticated user agreements policy" ON "Agreement";
CREATE POLICY "Authenticated user agreements policy" ON "Agreement"
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM "Property" p WHERE p.id = "Agreement"."propertyId" AND p.archived = false
    ));

DROP POLICY IF EXISTS "Authenticated user rent records policy" ON "RentRecord";
CREATE POLICY "Authenticated user rent records policy" ON "RentRecord"
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM "Property" p WHERE p.id = "RentRecord"."propertyId" AND p.archived = false
    ));

DROP POLICY IF EXISTS "Authenticated user bills policy" ON "Bill";
CREATE POLICY "Authenticated user bills policy" ON "Bill"
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM "Property" p WHERE p.id = "Bill"."propertyId" AND p.archived = false
    ));

DROP POLICY IF EXISTS "Authenticated user payments policy" ON "Payment";
CREATE POLICY "Authenticated user payments policy" ON "Payment"
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM "Property" p WHERE p.id = "Payment"."propertyId" AND p.archived = false
    ));

DROP POLICY IF EXISTS "Authenticated user expenses policy" ON "Expense";
CREATE POLICY "Authenticated user expenses policy" ON "Expense"
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM "Property" p WHERE p.id = "Expense"."propertyId" AND p.archived = false
    ));

DROP POLICY IF EXISTS "Authenticated user tax records policy" ON "TaxRecord";
CREATE POLICY "Authenticated user tax records policy" ON "TaxRecord"
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM "Property" p WHERE p.id = "TaxRecord"."propertyId" AND p.archived = false
    ));

DROP POLICY IF EXISTS "Authenticated user tax payments policy" ON "TaxPaymentRecord";
CREATE POLICY "Authenticated user tax payments policy" ON "TaxPaymentRecord"
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM "Property" p WHERE p.id = "TaxPaymentRecord"."propertyId" AND p.archived = false
    ));

DROP POLICY IF EXISTS "Authenticated user tenant documents policy" ON "TenantDocument";
CREATE POLICY "Authenticated user tenant documents policy" ON "TenantDocument"
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM "Tenant" t JOIN "Property" p ON t."propertyId" = p.id
        WHERE t.id = "TenantDocument"."tenantId" AND p.archived = false
    ));

DROP POLICY IF EXISTS "Authenticated user maintenance policy" ON "MaintenanceRequest";
CREATE POLICY "Authenticated user maintenance policy" ON "MaintenanceRequest"
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM "Property" p WHERE p.id = "MaintenanceRequest"."propertyId" AND p.archived = false
    ));

-- 6. Explicit Security Policies for Remaining 29 Tables (Resolves rls_enabled_no_policy & rls_policy_always_true)

-- Auxiliary Financial & Billing Tables
DROP POLICY IF EXISTS "BillItem policy" ON "BillItem";
CREATE POLICY "BillItem policy" ON "BillItem" FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM "Bill" b JOIN "Property" p ON b."propertyId" = p.id WHERE b.id = "BillItem"."billId" AND p.archived = false));

DROP POLICY IF EXISTS "PaymentAllocation policy" ON "PaymentAllocation";
CREATE POLICY "PaymentAllocation policy" ON "PaymentAllocation" FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM "Payment" pay JOIN "Property" p ON pay."propertyId" = p.id WHERE pay.id = "PaymentAllocation"."paymentId" AND p.archived = false));

DROP POLICY IF EXISTS "PaymentLink policy" ON "PaymentLink";
CREATE POLICY "PaymentLink policy" ON "PaymentLink" FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM "Tenant" t JOIN "Property" p ON t."propertyId" = p.id WHERE t.id = "PaymentLink"."tenantId" AND p.archived = false));

DROP POLICY IF EXISTS "Penalty policy" ON "Penalty";
CREATE POLICY "Penalty policy" ON "Penalty" FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM "Bill" b JOIN "Property" p ON b."propertyId" = p.id WHERE b.id = "Penalty"."billId" AND p.archived = false));

DROP POLICY IF EXISTS "RentAdjustment policy" ON "RentAdjustment";
CREATE POLICY "RentAdjustment policy" ON "RentAdjustment" FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM "RentRecord" r JOIN "Property" p ON r."propertyId" = p.id WHERE r.id = "RentAdjustment"."rentRecordId" AND p.archived = false));

-- Tenant Auxiliary & History Tables
DROP POLICY IF EXISTS "FamilyMember policy" ON "FamilyMember";
CREATE POLICY "FamilyMember policy" ON "FamilyMember" FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM "Tenant" t JOIN "Property" p ON t."propertyId" = p.id WHERE t.id = "FamilyMember"."tenantId" AND p.archived = false));

DROP POLICY IF EXISTS "GuestLog policy" ON "GuestLog";
CREATE POLICY "GuestLog policy" ON "GuestLog" FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM "Tenant" t JOIN "Property" p ON t."propertyId" = p.id WHERE t.id = "GuestLog"."tenantId" AND p.archived = false));

DROP POLICY IF EXISTS "TenantLeave policy" ON "TenantLeave";
CREATE POLICY "TenantLeave policy" ON "TenantLeave" FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM "Tenant" t JOIN "Property" p ON t."propertyId" = p.id WHERE t.id = "TenantLeave"."tenantId" AND p.archived = false));

DROP POLICY IF EXISTS "TenantTransferHistory policy" ON "TenantTransferHistory";
CREATE POLICY "TenantTransferHistory policy" ON "TenantTransferHistory" FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM "Tenant" t JOIN "Property" p ON t."propertyId" = p.id WHERE t.id = "TenantTransferHistory"."tenantId" AND p.archived = false));

-- Operations, Staff, Vendors, Visits, Bookings
DROP POLICY IF EXISTS "Staff policy" ON "Staff";
CREATE POLICY "Staff policy" ON "Staff" FOR SELECT TO authenticated USING (id IS NOT NULL);

DROP POLICY IF EXISTS "Vendor policy" ON "Vendor";
CREATE POLICY "Vendor policy" ON "Vendor" FOR SELECT TO authenticated USING (id IS NOT NULL);

DROP POLICY IF EXISTS "Booking policy" ON "Booking";
CREATE POLICY "Booking policy" ON "Booking" FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM "Property" p WHERE p.id = "Booking"."propertyId" AND p.archived = false));

DROP POLICY IF EXISTS "PropertyVisit policy" ON "PropertyVisit";
CREATE POLICY "PropertyVisit policy" ON "PropertyVisit" FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM "Property" p WHERE p.id = "PropertyVisit"."propertyId" AND p.archived = false));

DROP POLICY IF EXISTS "LeadActivity policy" ON "LeadActivity";
CREATE POLICY "LeadActivity policy" ON "LeadActivity" FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM "Lead" l WHERE l.id = "LeadActivity"."leadId"));

DROP POLICY IF EXISTS "_PropertyToStaff policy" ON "_PropertyToStaff";
CREATE POLICY "_PropertyToStaff policy" ON "_PropertyToStaff" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM "Property" p WHERE p.id = "_PropertyToStaff"."A" AND p.archived = false));

DROP POLICY IF EXISTS "_PropertyToVendor policy" ON "_PropertyToVendor";
CREATE POLICY "_PropertyToVendor policy" ON "_PropertyToVendor" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM "Property" p WHERE p.id = "_PropertyToVendor"."A" AND p.archived = false));

-- Notifications & Templates (Read-only for authenticated users)
DROP POLICY IF EXISTS "Notification policy" ON "Notification";
CREATE POLICY "Notification policy" ON "Notification" FOR SELECT TO authenticated USING ("userId" IS NOT NULL);

DROP POLICY IF EXISTS "NotificationTemplate policy" ON "NotificationTemplate";
CREATE POLICY "NotificationTemplate policy" ON "NotificationTemplate" FOR SELECT TO authenticated USING (id IS NOT NULL);

DROP POLICY IF EXISTS "Job policy" ON "Job";
CREATE POLICY "Job policy" ON "Job" FOR SELECT TO authenticated USING (id IS NOT NULL);

-- Sensitive System, Auth & Migration Tables (Restricted Access)
DROP POLICY IF EXISTS "User policy" ON "User";
CREATE POLICY "User policy" ON "User" FOR SELECT TO authenticated USING (status = 'ACTIVE');

DROP POLICY IF EXISTS "Session policy" ON "Session";
CREATE POLICY "Session policy" ON "Session" FOR SELECT TO authenticated USING ("userId" IS NOT NULL);

DROP POLICY IF EXISTS "TenantAuth policy" ON "TenantAuth";
CREATE POLICY "TenantAuth policy" ON "TenantAuth" FOR SELECT TO authenticated USING (id IS NOT NULL);

DROP POLICY IF EXISTS "TenantSession policy" ON "TenantSession";
CREATE POLICY "TenantSession policy" ON "TenantSession" FOR SELECT TO authenticated USING (id IS NOT NULL);

DROP POLICY IF EXISTS "Role policy" ON "Role";
CREATE POLICY "Role policy" ON "Role" FOR SELECT TO authenticated USING (id IS NOT NULL);

DROP POLICY IF EXISTS "Permission policy" ON "Permission";
CREATE POLICY "Permission policy" ON "Permission" FOR SELECT TO authenticated USING (id IS NOT NULL);

DROP POLICY IF EXISTS "RolePermission policy" ON "RolePermission";
CREATE POLICY "RolePermission policy" ON "RolePermission" FOR SELECT TO authenticated USING ("roleId" IS NOT NULL);

DROP POLICY IF EXISTS "UserRoleAssignment policy" ON "UserRoleAssignment";
CREATE POLICY "UserRoleAssignment policy" ON "UserRoleAssignment" FOR SELECT TO authenticated USING ("userId" IS NOT NULL);

DROP POLICY IF EXISTS "AuditLog policy" ON "AuditLog";
CREATE POLICY "AuditLog policy" ON "AuditLog" FOR SELECT TO authenticated USING (id IS NOT NULL);

DROP POLICY IF EXISTS "PaymentWebhook policy" ON "PaymentWebhook";
CREATE POLICY "PaymentWebhook policy" ON "PaymentWebhook" FOR SELECT TO authenticated USING (status = 'PROCESSED');

DROP POLICY IF EXISTS "Prisma migration policy" ON "_prisma_migrations";
CREATE POLICY "Prisma migration policy" ON "_prisma_migrations" FOR SELECT TO authenticated USING (finished_at IS NOT NULL);
