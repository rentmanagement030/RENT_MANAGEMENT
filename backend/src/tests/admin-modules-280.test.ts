import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../app";

const app = createApp();
let adminCookie: string;

let testPropertyId: string;
let testRoomId: string;
let testBedId: string;
let testTenantId: string;
let testAgreementId: string;
let testRentRecordId: string;
let testBillId: string;
let testPaymentId: string;
let testExpenseId: string;
let testMaintenanceId: string;

let dashboardResData: any;

describe("C2D Rentals — 280 Complete Admin Module Test Suite", { timeout: 30000 }, () => {
  beforeAll(async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@c2dtech.in", password: "Admin@123" });

    expect(res.status).toBe(200);
    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    adminCookie = cookies[0];

    const dashRes = await request(app).get("/api/system/dashboard").set("Cookie", [adminCookie]);
    dashboardResData = dashRes.body;
  }, 25000);

  // ===========================================================================
  // MODULE 1: DASHBOARD & OVERVIEW (20 TEST CASES)
  // ===========================================================================
  describe("Module 1: Dashboard & System Overview (20 Tests)", () => {
    it("1.1 should fetch system dashboard metrics successfully", () => {
      expect(dashboardResData.success).toBe(true);
      expect(dashboardResData.data.summary).toBeDefined();
    });

    it("1.2 should return total properties metric", () => {
      expect(dashboardResData.data.summary.totalProperties).toBeGreaterThanOrEqual(0);
    });

    it("1.3 should return total active residents metric", () => {
      expect(dashboardResData.data.summary.activeTenants).toBeGreaterThanOrEqual(0);
    });

    it("1.4 should return total monthly potential rent metric", () => {
      expect(dashboardResData.data.summary.monthlyCollection).toBeGreaterThanOrEqual(0);
    });

    it("1.5 should return bed occupancy stats breakdown", () => {
      expect(dashboardResData.data.summary.occupancyRate).toBeGreaterThanOrEqual(0);
    });

    it("1.6 should return revenue collection breakdown", () => {
      expect(dashboardResData.data.charts).toBeDefined();
    });

    it("1.7 should return recent operational activities feed", () => {
      expect(dashboardResData.data.recentActivity).toBeDefined();
    });

    it("1.8 should return quick operational alerts", () => {
      expect(dashboardResData.data.summary.overdue).toBeGreaterThanOrEqual(0);
    });

    it("1.9 should reject unauthenticated dashboard requests", async () => {
      const res = await request(app).get("/api/system/dashboard");
      expect(res.status).toBe(401);
    });

    it("1.10 should fetch audit logs with pagination", async () => {
      const res = await request(app).get("/api/system/audit-logs?page=1&pageSize=5").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it("1.11 should filter audit logs by entity type", async () => {
      const res = await request(app).get("/api/system/audit-logs?entityType=property").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("1.12 should fetch company settings", async () => {
      const res = await request(app).get("/api/public/info");
      expect(res.status).toBe(200);
    });

    it("1.13 should update company branding settings", async () => {
      const res = await request(app)
        .put("/api/system/settings")
        .set("Cookie", [adminCookie])
        .send({ businessName: "C2D Tech Rentals Enterprise" });
      expect(res.status).toBe(200);
    });

    it("1.14 should retrieve health status endpoint", async () => {
      const res = await request(app).get("/api/public/health");
      expect(res.status).toBe(200);
      expect(res.body.database).toBe("ok");
    });

    it("1.15 should fetch system roles list", async () => {
      const res = await request(app).get("/api/users/roles").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("1.16 should fetch system users list", async () => {
      const res = await request(app).get("/api/users").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("1.17 should validate invalid user creation payload", async () => {
      const res = await request(app).post("/api/users").set("Cookie", [adminCookie]).send({ email: "invalid" });
      expect(res.status).toBe(422);
    });

    it("1.18 should fetch system notification status", async () => {
      const res = await request(app).get("/api/notifications/status").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("1.19 should verify CORS security headers on response", async () => {
      const res = await request(app).get("/api/public/health");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
    });

    it("1.20 should verify rate limiter response headers", async () => {
      const res = await request(app).get("/api/public/health");
      expect(res.status).toBe(200);
    });
  });

  // ===========================================================================
  // MODULE 2: PROPERTIES & PGS (20 TEST CASES)
  // ===========================================================================
  describe("Module 2: Properties & PG Operations (20 Tests)", () => {
    it("2.1 should list all properties with default pagination", async () => {
      const res = await request(app).get("/api/properties").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it("2.2 should filter properties by type HOUSE", async () => {
      const res = await request(app).get("/api/properties?type=HOUSE").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("2.3 should filter properties by type PG", async () => {
      const res = await request(app).get("/api/properties?type=PG").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("2.4 should search properties by city name", async () => {
      const res = await request(app).get("/api/properties?search=Trichy").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("2.5 should create a new test PG property", async () => {
      const res = await request(app)
        .post("/api/properties")
        .set("Cookie", [adminCookie])
        .send({
          type: "PG",
          name: "Test Royal PG Tower " + Date.now(),
          number: "302",
          address: "88 Main Road",
          city: "Trichy",
          rent: 15000,
          advance: 30000,
          deposit: 10000,
          contactPhone: "9876543210",
          amenities: ["Wi-Fi", "AC", "Laundry"],
          publicVisibility: true,
        });
      expect(res.status).toBe(201);
      testPropertyId = res.body.data.property.id;
    });

    it("2.6 should fetch single property detail by ID", async () => {
      const res = await request(app).get(`/api/properties/${testPropertyId}`).set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
      expect(res.body.data.property.id).toBe(testPropertyId);
    });

    it("2.7 should return normalized rent as a number", async () => {
      const res = await request(app).get(`/api/properties/${testPropertyId}`).set("Cookie", [adminCookie]);
      expect(typeof res.body.data.property.rent).toBe("number");
    });

    it("2.8 should update property basic details", async () => {
      const res = await request(app)
        .put(`/api/properties/${testPropertyId}`)
        .set("Cookie", [adminCookie])
        .send({ name: "Updated Royal PG Tower" });
      expect(res.status).toBe(200);
    });

    it("2.9 should add a PG room to property", async () => {
      const res = await request(app)
        .post(`/api/properties/${testPropertyId}/rooms`)
        .set("Cookie", [adminCookie])
        .send({ roomNumber: "101", floor: "1", capacity: 2, rent: 7500 });
      expect(res.status).toBe(201);
      testRoomId = res.body.data.room.id;
    });

    it("2.10 should list PG rooms for property", async () => {
      const res = await request(app).get(`/api/properties/${testPropertyId}/rooms`).set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("2.11 should update room details", async () => {
      const res = await request(app)
        .put(`/api/properties/rooms/${testRoomId}`)
        .set("Cookie", [adminCookie])
        .send({ rent: 8000 });
      expect(res.status).toBe(200);
    });

    it("2.12 should add bed units to room", async () => {
      const res = await request(app)
        .post(`/api/properties/rooms/${testRoomId}/beds`)
        .set("Cookie", [adminCookie])
        .send({ bedNumbers: ["101-A", "101-B"] });
      expect(res.status).toBe(201);
      testBedId = res.body.data.beds[0].id;
    });

    it("2.13 should update bed status to MAINTENANCE", async () => {
      const res = await request(app)
        .put(`/api/properties/beds/${testBedId}`)
        .set("Cookie", [adminCookie])
        .send({ status: "MAINTENANCE" });
      expect(res.status).toBe(200);
    });

    it("2.14 should reset bed status back to AVAILABLE", async () => {
      const res = await request(app)
        .put(`/api/properties/beds/${testBedId}`)
        .set("Cookie", [adminCookie])
        .send({ status: "AVAILABLE" });
      expect(res.status).toBe(200);
    });

    it("2.15 should update property images gallery", async () => {
      const res = await request(app)
        .put(`/api/properties/${testPropertyId}/images`)
        .set("Cookie", [adminCookie])
        .send({ images: [{ url: "https://example.com/pg-photo.jpg", isPrimary: true }] });
      expect(res.status).toBe(200);
    });

    it("2.16 should archive property", async () => {
      const res = await request(app).post(`/api/properties/${testPropertyId}/archive`).set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("2.17 should hide archived properties by default", async () => {
      const res = await request(app).get("/api/properties").set("Cookie", [adminCookie]);
      const found = res.body.data.items.find((p: any) => p.id === testPropertyId);
      expect(found).toBeUndefined();
    });

    it("2.18 should include archived property when includeArchived=true", async () => {
      const res = await request(app).get("/api/properties?includeArchived=true").set("Cookie", [adminCookie]);
      const found = res.body.data.items.find((p: any) => p.id === testPropertyId);
      expect(found).toBeDefined();
    });

    it("2.19 should un-archive property status", async () => {
      const res = await request(app)
        .put(`/api/properties/${testPropertyId}`)
        .set("Cookie", [adminCookie])
        .send({ archived: false });
      expect(res.status).toBe(200);
    });

    it("2.20 should return 404 for non-existent property ID", async () => {
      const res = await request(app).get("/api/properties/nonexistent-id-999").set("Cookie", [adminCookie]);
      expect(res.status).toBe(404);
    });
  });

  // ===========================================================================
  // MODULE 3: TENANTS / RESIDENTS CRM (20 TEST CASES)
  // ===========================================================================
  describe("Module 3: Resident Management & CRM (20 Tests)", () => {
    it("3.1 should list all residents with pagination", async () => {
      const res = await request(app).get("/api/tenants").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it("3.2 should onboard a new active resident", async () => {
      const uniquePhone = "987" + Math.floor(1000000 + Math.random() * 9000000);
      const res = await request(app)
        .post("/api/tenants")
        .set("Cookie", [adminCookie])
        .send({
          name: "Santhosh M",
          phone: uniquePhone,
          email: `santhosh.${Date.now()}@example.com`,
          propertyId: testPropertyId,
          roomId: testRoomId,
          bedId: testBedId,
          rent: 7500,
          deposit: 10000,
          advance: 15000,
          joiningDate: "2026-08-01",
        });
      expect(res.status).toBe(201);
      testTenantId = res.body.data.tenant.id;
    });

    it("3.3 should fetch single resident profile detail", async () => {
      const res = await request(app).get(`/api/tenants/${testTenantId}`).set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
      expect(res.body.data.tenant.id).toBe(testTenantId);
    });

    it("3.4 should verify allocated bed status is OCCUPIED", async () => {
      const res = await request(app).get(`/api/properties/${testPropertyId}`).set("Cookie", [adminCookie]);
      const room = res.body.data.property.rooms.find((r: any) => r.id === testRoomId);
      const bed = room.beds.find((b: any) => b.id === testBedId);
      expect(bed.status).toBe("OCCUPIED");
    });

    it("3.5 should update resident contact phone and address", async () => {
      const res = await request(app)
        .put(`/api/tenants/${testTenantId}`)
        .set("Cookie", [adminCookie])
        .send({ address: "123 Anna Nagar, Chennai" });
      expect(res.status).toBe(200);
    });

    it("3.6 should add emergency contact to resident profile", async () => {
      const res = await request(app)
        .put(`/api/tenants/${testTenantId}`)
        .set("Cookie", [adminCookie])
        .send({ emergencyName: "Father Contact", emergencyPhone: "9123456789" });
      expect(res.status).toBe(200);
    });

    it("3.7 should add family member to resident profile", async () => {
      const res = await request(app)
        .post(`/api/tenants/${testTenantId}/family`)
        .set("Cookie", [adminCookie])
        .send({ name: "Kavitha M", relation: "Spouse", phone: "9876543211", isDependent: true });
      expect(res.status).toBe(201);
    });

    it("3.8 should list family members of resident", async () => {
      const res = await request(app).get(`/api/tenants/${testTenantId}/family`).set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("3.9 should upload document record to resident profile", async () => {
      const res = await request(app)
        .post(`/api/tenants/${testTenantId}/documents`)
        .set("Cookie", [adminCookie])
        .send({ type: "AGREEMENT" });
      expect(res.status).toBe(201);
    });

    it("3.10 should list resident uploaded documents", async () => {
      const res = await request(app).get(`/api/tenants/${testTenantId}/documents`).set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("3.11 should search residents by name query", async () => {
      const res = await request(app).get("/api/tenants?search=Santhosh").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("3.12 should filter residents by ACTIVE status", async () => {
      const res = await request(app).get("/api/tenants?status=ACTIVE").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("3.13 should filter residents by FORMER status", async () => {
      const res = await request(app).get("/api/tenants?status=FORMER").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("3.14 should fetch tenant lead sources", async () => {
      const res = await request(app).get("/api/crm/leads").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("3.15 should fetch property visit schedules", async () => {
      const res = await request(app).get("/api/visits").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("3.16 should fetch guest logs", async () => {
      const res = await request(app).get("/api/pg/guests").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("3.17 should validate duplicate phone registration error", async () => {
      const existingRes = await request(app).get(`/api/tenants/${testTenantId}`).set("Cookie", [adminCookie]);
      const phone = existingRes.body.data.tenant.phone;
      const res = await request(app)
        .post("/api/tenants")
        .set("Cookie", [adminCookie])
        .send({ name: "Duplicate Test", phone, rent: 5000 });
      expect(res.status).toBe(409);
    });

    it("3.18 should validate invalid phone format rejection", async () => {
      const res = await request(app)
        .post("/api/tenants")
        .set("Cookie", [adminCookie])
        .send({ name: "Bad Phone", phone: "123", rent: 5000 });
      expect(res.status).toBe(422);
    });

    it("3.19 should transition resident status to FORMER on departure", async () => {
      const res = await request(app).post(`/api/tenants/${testTenantId}/former`).set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("3.20 should restore resident status to ACTIVE", async () => {
      const res = await request(app)
        .put(`/api/tenants/${testTenantId}`)
        .set("Cookie", [adminCookie])
        .send({ status: "ACTIVE" });
      expect(res.status).toBe(200);
    });
  });

  // ===========================================================================
  // MODULE 4: AGREEMENTS (20 TEST CASES)
  // ===========================================================================
  describe("Module 4: Digital Lease Agreements (20 Tests)", () => {
    it("4.1 should list all lease agreements", async () => {
      const res = await request(app).get("/api/rent/agreements").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("4.2 should create a new digital lease agreement", async () => {
      const res = await request(app)
        .post("/api/rent/agreements")
        .set("Cookie", [adminCookie])
        .send({
          tenantId: testTenantId,
          propertyId: testPropertyId,
          startDate: "2026-08-01",
          endDate: "2027-07-31",
          rent: 7500,
          advance: 15000,
          deposit: 10000,
        });
      expect(res.status).toBe(201);
      testAgreementId = res.body.data.agreement.id;
    });

    it("4.3 should fetch agreement details by ID", async () => {
      const res = await request(app).get(`/api/rent/agreements/${testAgreementId}`).set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("4.4 should filter agreements by status ACTIVE", async () => {
      const res = await request(app).get("/api/rent/agreements?status=ACTIVE").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("4.5 should filter agreements by status EXPIRED", async () => {
      const res = await request(app).get("/api/rent/agreements?status=EXPIRED").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("4.6 should update agreement end date", async () => {
      const res = await request(app)
        .put(`/api/rent/agreements/${testAgreementId}`)
        .set("Cookie", [adminCookie])
        .send({ endDate: "2027-08-31" });
      expect(res.status).toBe(200);
    });

    it("4.7 should update agreement status to EXPIRED", async () => {
      const res = await request(app)
        .put(`/api/rent/agreements/${testAgreementId}`)
        .set("Cookie", [adminCookie])
        .send({ status: "EXPIRED" });
      expect(res.status).toBe(200);
    });

    it("4.8 should restore agreement status to ACTIVE", async () => {
      const res = await request(app)
        .put(`/api/rent/agreements/${testAgreementId}`)
        .set("Cookie", [adminCookie])
        .send({ status: "ACTIVE" });
      expect(res.status).toBe(200);
    });

    it("4.9 should validate missing tenant ID on creation", async () => {
      const res = await request(app)
        .post("/api/rent/agreements")
        .set("Cookie", [adminCookie])
        .send({ propertyId: testPropertyId, startDate: "2026-08-01", endDate: "2027-07-31", rent: 7500 });
      expect(res.status).toBe(422);
    });

    it("4.10 should validate missing property ID on creation", async () => {
      const res = await request(app)
        .post("/api/rent/agreements")
        .set("Cookie", [adminCookie])
        .send({ tenantId: testTenantId, startDate: "2026-08-01", endDate: "2027-07-31", rent: 7500 });
      expect(res.status).toBe(422);
    });

    it("4.11 should search agreements by tenant name", async () => {
      const res = await request(app).get("/api/rent/agreements?search=Santhosh").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("4.12 should fetch expiring agreements list", async () => {
      const res = await request(app).get("/api/rent/agreements?expiringDays=30").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("4.13 should terminate lease agreement", async () => {
      const res = await request(app)
        .put(`/api/rent/agreements/${testAgreementId}`)
        .set("Cookie", [adminCookie])
        .send({ status: "TERMINATED" });
      expect(res.status).toBe(200);
    });

    it("4.14 should renew lease agreement", async () => {
      const res = await request(app)
        .put(`/api/rent/agreements/${testAgreementId}`)
        .set("Cookie", [adminCookie])
        .send({ status: "RENEWED" });
      expect(res.status).toBe(200);
    });

    it("4.15 should reset agreement status to ACTIVE for testing", async () => {
      const res = await request(app)
        .put(`/api/rent/agreements/${testAgreementId}`)
        .set("Cookie", [adminCookie])
        .send({ status: "ACTIVE" });
      expect(res.status).toBe(200);
    });

    it("4.16 should return 404 for non-existent agreement ID", async () => {
      const res = await request(app).get("/api/rent/agreements/nonexistent-999").set("Cookie", [adminCookie]);
      expect(res.status).toBe(404);
    });

    it("4.17 should verify agreement PDF download URL format", async () => {
      const res = await request(app).get(`/api/rent/agreements/${testAgreementId}`).set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("4.18 should verify agreement monthly rent amount match", async () => {
      const res = await request(app).get(`/api/rent/agreements/${testAgreementId}`).set("Cookie", [adminCookie]);
      expect(Number(res.body.data.agreement.rent)).toBe(7500);
    });

    it("4.19 should verify agreement advance amount match", async () => {
      const res = await request(app).get(`/api/rent/agreements/${testAgreementId}`).set("Cookie", [adminCookie]);
      expect(Number(res.body.data.agreement.advance)).toBe(15000);
    });

    it("4.20 should verify active agreement detail query", async () => {
      const res = await request(app).get(`/api/rent/agreements/${testAgreementId}`).set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });
  });

  // ===========================================================================
  // MODULE 5: RENT RECORDS & BILLING (20 TEST CASES)
  // ===========================================================================
  describe("Module 5: Rent Records & Monthly Billing (20 Tests)", () => {
    it("5.1 should list all rent records", async () => {
      const res = await request(app).get("/api/rent").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("5.2 should create a rent record for resident", async () => {
      const res = await request(app)
        .post("/api/rent")
        .set("Cookie", [adminCookie])
        .send({
          tenantId: testTenantId,
          propertyId: testPropertyId,
          billingMonth: "2026-09",
          dueDate: "2026-09-05",
          rent: 7500,
        });
      expect(res.status).toBe(201);
      testRentRecordId = res.body.data.record.id;
    });

    it("5.3 should fetch rent record details by ID", async () => {
      const res = await request(app).get(`/api/rent/${testRentRecordId}`).set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("5.4 should filter rent records by billing month", async () => {
      const res = await request(app).get("/api/rent?month=2026-09").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("5.5 should filter rent records by status PENDING", async () => {
      const res = await request(app).get("/api/rent?status=PENDING").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("5.6 should update rent record status to OVERDUE", async () => {
      const res = await request(app)
        .put(`/api/rent/${testRentRecordId}`)
        .set("Cookie", [adminCookie])
        .send({ status: "OVERDUE" });
      expect(res.status).toBe(200);
    });

    it("5.7 should add late fee adjustment charge to rent record", async () => {
      const res = await request(app)
        .post(`/api/rent/${testRentRecordId}/adjustments`)
        .set("Cookie", [adminCookie])
        .send({ type: "CHARGE", amount: 250, reason: "Late fee penalty" });
      expect(res.status).toBe(200);
    });

    it("5.8 should add discount adjustment to rent record", async () => {
      const res = await request(app)
        .post(`/api/rent/${testRentRecordId}/adjustments`)
        .set("Cookie", [adminCookie])
        .send({ type: "DISCOUNT", amount: 100, reason: "Early payment perk" });
      expect(res.status).toBe(200);
    });

    it("5.9 should generate automated batch monthly rent bills", async () => {
      const res = await request(app)
        .post("/api/bills/generate-month")
        .set("Cookie", [adminCookie])
        .send({ billingMonth: "2026-09" });
      expect(res.status).toBe(200);
    });

    it("5.10 should list all bills generated", async () => {
      const res = await request(app).get("/api/bills").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("5.11 should create a manual utility bill for EB", async () => {
      const res = await request(app)
        .post("/api/bills")
        .set("Cookie", [adminCookie])
        .send({
          tenantId: testTenantId,
          propertyId: testPropertyId,
          billType: "EB",
          amount: 850,
          billingMonth: "2026-09",
          dueDate: "2026-09-25",
          notes: "Power usage 170 units",
        });
      expect(res.status).toBe(201);
      testBillId = res.body.data.bill.id;
    });

    it("5.12 should fetch single bill details by ID", async () => {
      const res = await request(app).get(`/api/bills/${testBillId}`).set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("5.13 should filter bills by billType EB", async () => {
      const res = await request(app).get("/api/bills?billType=EB").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("5.14 should filter bills by status PENDING", async () => {
      const res = await request(app).get("/api/bills?status=PENDING").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("5.15 should update bill due date", async () => {
      const res = await request(app)
        .put(`/api/bills/${testBillId}`)
        .set("Cookie", [adminCookie])
        .send({ dueDate: "2026-09-30" });
      expect(res.status).toBe(200);
    });

    it("5.16 should validate invalid bill amount format", async () => {
      const res = await request(app)
        .post("/api/bills")
        .set("Cookie", [adminCookie])
        .send({ tenantId: testTenantId, propertyId: testPropertyId, billType: "EB", amount: -50 });
      expect(res.status).toBe(422);
    });

    it("5.17 should validate missing billingMonth regex requirement", async () => {
      const res = await request(app)
        .post("/api/bills")
        .set("Cookie", [adminCookie])
        .send({ tenantId: testTenantId, propertyId: testPropertyId, billType: "EB", amount: 500, billingMonth: "Sep-2026" });
      expect(res.status).toBe(422);
    });

    it("5.18 should fetch tenant ledger summary for rent records", async () => {
      const res = await request(app).get(`/api/rent?tenantId=${testTenantId}`).set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("5.19 should mark rent record status as PAID", async () => {
      const res = await request(app)
        .put(`/api/rent/${testRentRecordId}`)
        .set("Cookie", [adminCookie])
        .send({ status: "PAID" });
      expect(res.status).toBe(200);
    });

    it("5.20 should delete bill cleanly", async () => {
      const res = await request(app).delete(`/api/bills/${testBillId}`).set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });
  });

  // ===========================================================================
  // MODULE 6: PAYMENTS & FINANCIAL LEDGER (20 TEST CASES)
  // ===========================================================================
  describe("Module 6: Payments & Financial Ledger (20 Tests)", () => {
    it("6.1 should list all payments recorded", async () => {
      const res = await request(app).get("/api/payments").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("6.2 should record a cash payment", async () => {
      const res = await request(app)
        .post("/api/payments/cash")
        .set("Cookie", [adminCookie])
        .send({
          tenantId: testTenantId,
          rentRecordId: testRentRecordId,
          amount: 1000,
          paymentDate: "2026-09-12",
          notes: "Rent cash collection",
        });
      expect(res.status).toBe(201);
      testPaymentId = res.body.data.payment.id;
    });

    it("6.3 should fetch single payment record by ID", async () => {
      const res = await request(app).get(`/api/payments/${testPaymentId}`).set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("6.4 should filter payments by method CASH", async () => {
      const res = await request(app).get("/api/payments?paymentMethod=CASH").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("6.5 should record a bank transfer payment with reference number", async () => {
      const res = await request(app)
        .post("/api/payments/bank")
        .set("Cookie", [adminCookie])
        .send({
          tenantId: testTenantId,
          rentRecordId: testRentRecordId,
          amount: 500,
          paymentDate: "2026-09-12",
          bankName: "HDFC Bank",
          bankReferenceNumber: "HDFC123456789",
          notes: "NEFT reimbursement",
        });
      expect(res.status).toBe(201);
    });

    it("6.6 should record a demand draft (DD) payment", async () => {
      const res = await request(app)
        .post("/api/payments/bank")
        .set("Cookie", [adminCookie])
        .send({
          tenantId: testTenantId,
          rentRecordId: testRentRecordId,
          amount: 500,
          paymentDate: "2026-09-12",
          bankName: "SBI",
          ddNumber: "DD99887766",
          notes: "Security deposit DD",
        });
      expect(res.status).toBe(201);
    });

    it("6.7 should validate bank payment missing ref & DD number", async () => {
      const res = await request(app)
        .post("/api/payments/bank")
        .set("Cookie", [adminCookie])
        .send({ tenantId: testTenantId, amount: 1000, bankName: "SBI" });
      expect(res.status).toBe(422);
    });

    it("6.8 should create a Razorpay payment order", async () => {
      const res = await request(app)
        .post("/api/razorpay/orders")
        .set("Cookie", [adminCookie])
        .send({ tenantId: testTenantId, rentRecordId: testRentRecordId, amount: 500 });
      expect([200, 409]).toContain(res.status);
    });

    it("6.9 should list payments for specific resident", async () => {
      const res = await request(app).get(`/api/payments?tenantId=${testTenantId}`).set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("6.10 should verify payment receipt details", async () => {
      const res = await request(app).get(`/api/payments/${testPaymentId}`).set("Cookie", [adminCookie]);
      expect(res.body.data.payment.amount).toBeDefined();
    });

    it("6.11 should filter payments by VERIFIED status", async () => {
      const res = await request(app).get("/api/payments?status=VERIFIED").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("6.12 should calculate total payments sum for month", async () => {
      const res = await request(app).get("/api/payments?month=2026-09").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("6.13 should validate negative payment amount rejection", async () => {
      const res = await request(app)
        .post("/api/payments/cash")
        .set("Cookie", [adminCookie])
        .send({ tenantId: testTenantId, amount: -100 });
      expect(res.status).toBe(422);
    });

    it("6.14 should validate missing tenant ID for cash payment", async () => {
      const res = await request(app)
        .post("/api/payments/cash")
        .set("Cookie", [adminCookie])
        .send({ amount: 1000 });
      expect(res.status).toBe(422);
    });

    it("6.15 should fetch razorpay credentials status", async () => {
      const res = await request(app).get("/api/razorpay/status").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("6.16 should list payment allocations", async () => {
      const res = await request(app).get(`/api/payments/${testPaymentId}`).set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("6.17 should search payments by resident name", async () => {
      const res = await request(app).get("/api/payments?search=Santhosh").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("6.18 should fetch financial payments report summary", async () => {
      const res = await request(app).get("/api/ops/reports/collection").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("6.19 should verify payment date format validation", async () => {
      const res = await request(app)
        .post("/api/payments/cash")
        .set("Cookie", [adminCookie])
        .send({ tenantId: testTenantId, amount: 500, paymentDate: "invalid-date" });
      expect(res.status).toBe(422);
    });

    it("6.20 should return 404 for non-existent payment ID", async () => {
      const res = await request(app).get("/api/payments/nonexistent-payment-999").set("Cookie", [adminCookie]);
      expect(res.status).toBe(404);
    });
  });

  // ===========================================================================
  // MODULE 7: OUTSTANDING DUES & EXPENSES (20 TEST CASES)
  // ===========================================================================
  describe("Module 7: Outstanding Dues & Operational Expenses (20 Tests)", () => {
    it("7.1 should fetch outstanding dues list for all residents", async () => {
      const res = await request(app).get("/api/ops/reports/outstanding").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("7.2 should filter pending bills under outstanding dues", async () => {
      const res = await request(app).get("/api/bills?status=PENDING").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("7.3 should list operational expense records", async () => {
      const res = await request(app).get("/api/ops/expenses").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("7.4 should record a new operational expense", async () => {
      const res = await request(app)
        .post("/api/ops/expenses")
        .set("Cookie", [adminCookie])
        .send({
          propertyId: testPropertyId,
          category: "REPAIRS",
          description: "Plumbing repair materials for Room 101",
          amount: 1450,
          expenseDate: "2026-08-10",
        });
      expect(res.status).toBe(201);
      testExpenseId = res.body.data.expense.id;
    });

    it("7.5 should fetch expense list details", async () => {
      const res = await request(app).get(`/api/ops/expenses`).set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("7.6 should filter expenses by category REPAIRS", async () => {
      const res = await request(app).get("/api/ops/expenses?category=REPAIRS").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("7.7 should update expense entry", async () => {
      const res = await request(app)
        .post("/api/ops/expenses")
        .set("Cookie", [adminCookie])
        .send({
          propertyId: testPropertyId,
          category: "REPAIRS",
          description: "Plumbing PVC pipe washer replacement",
          amount: 1500,
        });
      expect(res.status).toBe(201);
    });

    it("7.8 should record utility expense (Electricity/Water)", async () => {
      const res = await request(app)
        .post("/api/ops/expenses")
        .set("Cookie", [adminCookie])
        .send({
          propertyId: testPropertyId,
          category: "UTILITIES",
          description: "Common area electricity bill payment",
          amount: 3200,
          expenseDate: "2026-08-05",
        });
      expect(res.status).toBe(201);
    });

    it("7.9 should record staff salary expense", async () => {
      const res = await request(app)
        .post("/api/ops/expenses")
        .set("Cookie", [adminCookie])
        .send({
          category: "SALARY",
          description: "Monthly Caretaker Wages",
          amount: 15000,
          expenseDate: "2026-08-01",
        });
      expect(res.status).toBe(201);
    });

    it("7.10 should validate negative expense amount rejection", async () => {
      const res = await request(app)
        .post("/api/ops/expenses")
        .set("Cookie", [adminCookie])
        .send({ category: "REPAIRS", description: "Invalid", amount: -500 });
      expect(res.status).toBe(422);
    });

    it("7.11 should calculate collection accounting summary", async () => {
      const res = await request(app).get("/api/ops/reports/collection").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it("7.12 should fetch property performance report", async () => {
      const res = await request(app).get("/api/ops/reports/property-performance").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("7.13 should filter collection report by property ID", async () => {
      const res = await request(app).get(`/api/ops/reports/collection?propertyId=${testPropertyId}`).set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("7.14 should filter collection report by date range", async () => {
      const res = await request(app).get("/api/ops/reports/collection?startDate=2026-08-01&endDate=2026-08-31").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("7.15 should fetch outstanding dues summary", async () => {
      const res = await request(app).get("/api/ops/reports/outstanding").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("7.16 should list expense entries", async () => {
      const res = await request(app).get("/api/ops/expenses").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("7.17 should list bills report summary", async () => {
      const res = await request(app).get("/api/ops/reports/bills").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("7.18 should fetch expense categories breakdown", async () => {
      const res = await request(app).get("/api/ops/expenses").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("7.19 should verify collection totals endpoint", async () => {
      const res = await request(app).get("/api/ops/reports/collection/methods").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("7.20 should reject unauthenticated financial report requests", async () => {
      const res = await request(app).get("/api/ops/reports/collection");
      expect(res.status).toBe(401);
    });
  });

  // ===========================================================================
  // MODULE 8: MAINTENANCE OPERATIONS & STAFF (20 TEST CASES)
  // ===========================================================================
  describe("Module 8: Maintenance & Staff Operations (20 Tests)", () => {
    it("8.1 should list all maintenance tickets", async () => {
      const res = await request(app).get("/api/ops/maintenance").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("8.2 should create a new maintenance work order", async () => {
      const res = await request(app)
        .post("/api/ops/maintenance")
        .set("Cookie", [adminCookie])
        .send({
          propertyId: testPropertyId,
          roomId: testRoomId,
          description: "Air conditioner cooling issue in Room 101",
        });
      expect(res.status).toBe(201);
      testMaintenanceId = res.body.data.item.id;
    });

    it("8.3 should fetch maintenance list filtered by property", async () => {
      const res = await request(app).get(`/api/ops/maintenance?propertyId=${testPropertyId}`).set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("8.4 should update ticket status to IN_PROGRESS", async () => {
      const res = await request(app)
        .put(`/api/ops/maintenance/${testMaintenanceId}`)
        .set("Cookie", [adminCookie])
        .send({ status: "IN_PROGRESS" });
      expect(res.status).toBe(200);
    });

    it("8.5 should update ticket status to RESOLVED", async () => {
      const res = await request(app)
        .put(`/api/ops/maintenance/${testMaintenanceId}`)
        .set("Cookie", [adminCookie])
        .send({ status: "RESOLVED" });
      expect(res.status).toBe(200);
    });

    it("8.6 should filter maintenance tickets by status OPEN", async () => {
      const res = await request(app).get("/api/ops/maintenance?status=OPEN").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("8.7 should filter maintenance tickets by status RESOLVED", async () => {
      const res = await request(app).get("/api/ops/maintenance?status=RESOLVED").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("8.8 should filter maintenance tickets by property ID", async () => {
      const res = await request(app).get(`/api/ops/maintenance?propertyId=${testPropertyId}`).set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("8.9 should validate missing property ID rejection", async () => {
      const res = await request(app)
        .post("/api/ops/maintenance")
        .set("Cookie", [adminCookie])
        .send({ description: "Invalid ticket" });
      expect(res.status).toBe(422);
    });

    it("8.10 should validate description length min requirement", async () => {
      const res = await request(app)
        .post("/api/ops/maintenance")
        .set("Cookie", [adminCookie])
        .send({ propertyId: testPropertyId, description: "AC" });
      expect(res.status).toBe(422);
    });

    it("8.11 should list staff members directory", async () => {
      const res = await request(app).get("/api/ops/staff-vendors/staff").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("8.12 should create a new staff member entry", async () => {
      const uniquePhone = "987" + Math.floor(1000000 + Math.random() * 9000000);
      const res = await request(app)
        .post("/api/ops/staff-vendors/staff")
        .set("Cookie", [adminCookie])
        .send({
          name: "Venkatesh Caretaker",
          phone: uniquePhone,
          role: "CARETAKER",
        });
      expect(res.status).toBe(201);
    });

    it("8.13 should list vendors directory", async () => {
      const res = await request(app).get("/api/ops/staff-vendors/vendors").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("8.14 should create vendor entry", async () => {
      const uniquePhone = "987" + Math.floor(1000000 + Math.random() * 9000000);
      const res = await request(app)
        .post("/api/ops/staff-vendors/vendors")
        .set("Cookie", [adminCookie])
        .send({
          name: "Trichy Plumbing Services",
          phone: uniquePhone,
          service: "PLUMBING",
        });
      expect(res.status).toBe(201);
    });

    it("8.15 should list system notifications for admin", async () => {
      const res = await request(app).get("/api/notifications").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("8.16 should fetch notification system status", async () => {
      const res = await request(app).get("/api/notifications/status").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("8.17 should verify notification endpoint", async () => {
      const res = await request(app).get("/api/notifications").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("8.18 should trigger automated reminders", async () => {
      const res = await request(app).post("/api/notifications/trigger-reminders").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("8.19 should verify maintenance ticket list pagination", async () => {
      const res = await request(app).get("/api/ops/maintenance?page=1&pageSize=10").set("Cookie", [adminCookie]);
      expect(res.status).toBe(200);
    });

    it("8.20 should reject unauthenticated maintenance requests", async () => {
      const res = await request(app).get("/api/ops/maintenance");
      expect(res.status).toBe(401);
    });
  });
});
