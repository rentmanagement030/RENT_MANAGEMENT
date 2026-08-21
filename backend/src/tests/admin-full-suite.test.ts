import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../app";

const app = createApp();

describe("C2D Rentals — Complete Admin Side Integration Test Suite", { timeout: 30000 }, () => {
  let adminCookie: string;
  let createdPropertyId: string;
  let createdRoomId: string;
  let createdBedId: string;
  let createdTenantId: string;
  let createdBillId: string;
  let createdMaintenanceId: string;

  beforeAll(async () => {
    // Authenticate Super Admin before running full suite
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@c2dtech.in", password: "Admin@123" });

    expect(res.status).toBe(200);
    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    adminCookie = cookies[0];
  }, 15000);

  // ---------------------------------------------------------------------------
  // 1. AUTHENTICATION & SESSION SECURITY
  // ---------------------------------------------------------------------------
  it("1.1 should fail login with invalid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@c2dtech.in", password: "wrongpassword" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("1.2 should fetch current authenticated Super Admin session details", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", [adminCookie]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe("admin@c2dtech.in");
    expect(res.body.data.user.permissions).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // 2. ADMIN DASHBOARD & ANALYTICS
  // ---------------------------------------------------------------------------
  it("2.1 should fetch admin system dashboard metrics", async () => {
    const res = await request(app)
      .get("/api/system/dashboard")
      .set("Cookie", [adminCookie]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("summary");
    expect(res.body.data.summary).toHaveProperty("totalProperties");
    expect(res.body.data.summary).toHaveProperty("activeTenants");
  }, 20000);

  // ---------------------------------------------------------------------------
  // 3. PROPERTY & PG MANAGEMENT
  // ---------------------------------------------------------------------------
  it("3.1 should list portfolio properties with pagination", async () => {
    const res = await request(app)
      .get("/api/properties?page=1&pageSize=10")
      .set("Cookie", [adminCookie]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it("3.2 should create a new PG property building", async () => {
    const res = await request(app)
      .post("/api/properties")
      .set("Cookie", [adminCookie])
      .send({
        type: "PG",
        name: "Test Executive PG Hub " + Date.now(),
        number: "101",
        address: "45 MG Road, Cantonment",
        city: "Trichy",
        area: "Cantonment",
        rent: 12000,
        advance: 24000,
        deposit: 5000,
        contactPhone: "9876543210",
        amenities: ["Wi-Fi", "AC", "Laundry", "CCTV"],
        publicVisibility: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.property.rent).toBeDefined();
    createdPropertyId = res.body.data.property.id;
  });

  it("3.3 should fetch property detail by ID with normalized financial numbers", async () => {
    const res = await request(app)
      .get(`/api/properties/${createdPropertyId}`)
      .set("Cookie", [adminCookie]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.property.id).toBe(createdPropertyId);
    expect(Number(res.body.data.property.rent)).toBe(12000);
  });

  // ---------------------------------------------------------------------------
  // 4. PG ROOM & BED MATRIX
  // ---------------------------------------------------------------------------
  it("4.1 should add a PG room to the property", async () => {
    const res = await request(app)
      .post(`/api/properties/${createdPropertyId}/rooms`)
      .set("Cookie", [adminCookie])
      .send({
        roomNumber: "201",
        floor: "2",
        capacity: 2,
        rent: 6000,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.room.roomNumber).toBe("201");
    createdRoomId = res.body.data.room.id;
  });

  it("4.2 should add beds (A, B) to the PG room", async () => {
    const res = await request(app)
      .post(`/api/properties/rooms/${createdRoomId}/beds`)
      .set("Cookie", [adminCookie])
      .send({
        bedNumbers: ["201-A", "201-B"],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.beds)).toBe(true);
    expect(res.body.data.beds.length).toBe(2);
    createdBedId = res.body.data.beds[0].id;
  });

  // ---------------------------------------------------------------------------
  // 5. RESIDENT / TENANT MANAGEMENT
  // ---------------------------------------------------------------------------
  it("5.1 should onboard a new resident and assign to property & bed", async () => {
    const uniquePhone = "987" + Math.floor(1000000 + Math.random() * 9000000);
    const res = await request(app)
      .post("/api/tenants")
      .set("Cookie", [adminCookie])
      .send({
        name: "Ramesh Kumar",
        phone: uniquePhone,
        email: `ramesh.${Date.now()}@example.com`,
        propertyId: createdPropertyId,
        roomId: createdRoomId,
        bedId: createdBedId,
        rent: 6000,
        deposit: 5000,
        advance: 12000,
        joiningDate: "2026-08-01",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tenant.name).toBe("Ramesh Kumar");
    createdTenantId = res.body.data.tenant.id;
  });

  it("5.2 should verify that the allocated bed status is updated to OCCUPIED", async () => {
    const res = await request(app)
      .get(`/api/properties/${createdPropertyId}`)
      .set("Cookie", [adminCookie]);

    expect(res.status).toBe(200);
    const rooms = res.body.data.property.rooms ?? [];
    const room201 = rooms.find((r: any) => r.id === createdRoomId);
    expect(room201).toBeDefined();
    const bedA = room201.beds.find((b: any) => b.id === createdBedId);
    expect(bedA).toBeDefined();
    expect(bedA.status).toBe("OCCUPIED");
  });

  // ---------------------------------------------------------------------------
  // 6. LEASE AGREEMENTS
  // ---------------------------------------------------------------------------
  it("6.1 should create a digital lease agreement for the resident", async () => {
    const res = await request(app)
      .post("/api/rent/agreements")
      .set("Cookie", [adminCookie])
      .send({
        tenantId: createdTenantId,
        propertyId: createdPropertyId,
        startDate: "2026-08-01",
        endDate: "2027-07-31",
        rent: 6000,
        deposit: 5000,
        advance: 12000,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.agreement.status).toBe("ACTIVE");
  });

  // ---------------------------------------------------------------------------
  // 7. BILLING & RENT RECORDS
  // ---------------------------------------------------------------------------
  it("7.1 should generate a monthly rent bill for active residents", async () => {
    const res = await request(app)
      .post("/api/bills/generate-month")
      .set("Cookie", [adminCookie])
      .send({ billingMonth: "2026-08" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("created");
  });

  it("7.2 should create a manual utility EB bill for the property", async () => {
    const res = await request(app)
      .post("/api/bills")
      .set("Cookie", [adminCookie])
      .send({
        tenantId: createdTenantId,
        propertyId: createdPropertyId,
        billType: "EB",
        amount: 750,
        billingMonth: "2026-08",
        dueDate: "2026-08-25",
        notes: "Electricity Charges - Units 150",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.bill.billType).toBe("EB");
    createdBillId = res.body.data.bill.id;
  });

  // ---------------------------------------------------------------------------
  // 8. PAYMENT RECORDING & CASH DESK
  // ---------------------------------------------------------------------------
  it("8.1 should record a cash payment for the resident's bill", async () => {
    const res = await request(app)
      .post("/api/payments/cash")
      .set("Cookie", [adminCookie])
      .send({
        tenantId: createdTenantId,
        amount: 750,
        paymentDate: "2026-08-12",
        notes: "Cash received by caretaker",
        allocations: [{ billId: createdBillId, amount: 750 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.payment.paymentMethod).toBe("CASH");
    expect(res.body.data.payment.id).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // 9. MAINTENANCE WORK ORDERS
  // ---------------------------------------------------------------------------
  it("9.1 should create a maintenance request for the property", async () => {
    const res = await request(app)
      .post("/api/ops/maintenance")
      .set("Cookie", [adminCookie])
      .send({
        propertyId: createdPropertyId,
        roomId: createdRoomId,
        description: "Tap leak in Room 201 washbasin bathroom",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.item.description).toBe("Tap leak in Room 201 washbasin bathroom");
    createdMaintenanceId = res.body.data.item.id;
  });

  it("9.2 should resolve the maintenance work order", async () => {
    const res = await request(app)
      .put(`/api/ops/maintenance/${createdMaintenanceId}`)
      .set("Cookie", [adminCookie])
      .send({
        status: "RESOLVED",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.item.status).toBe("RESOLVED");
  });

  // ---------------------------------------------------------------------------
  // 10. SYSTEM AUDIT LOGS
  // ---------------------------------------------------------------------------
  it("10.1 should record audit logs for all administrative actions", async () => {
    const res = await request(app)
      .get("/api/system/audit-logs?page=1&pageSize=10")
      .set("Cookie", [adminCookie]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.items.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // 11. PROPERTY DELETION & SAFETY CHECKS
  // ---------------------------------------------------------------------------
  it("11.1 should block property deletion when active residents are assigned", async () => {
    const res = await request(app)
      .delete(`/api/properties/${createdPropertyId}`)
      .set("Cookie", [adminCookie]);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("active residents");
  });

  it("11.2 should allow property deletion after resident is marked former/vacated", async () => {
    // 1. Mark resident as former
    await request(app)
      .post(`/api/tenants/${createdTenantId}/former`)
      .set("Cookie", [adminCookie]);

    // 2. Unassign bed
    await request(app)
      .put(`/api/properties/beds/${createdBedId}`)
      .set("Cookie", [adminCookie])
      .send({ status: "AVAILABLE", tenantId: null });

    // 3. Delete property
    const res = await request(app)
      .delete(`/api/properties/${createdPropertyId}`)
      .set("Cookie", [adminCookie]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  }, 20000);
});
