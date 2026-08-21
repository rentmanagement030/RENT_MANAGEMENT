import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { prisma } from "../config/prisma";

const app = createApp();

describe("C2D Rentals — Firebase Authentication & Authorization Security Suite", { timeout: 30000 }, () => {
  let adminCookie: string;
  let adminUserId: string;

  beforeAll(async () => {
    // Authenticate Super Admin before running security tests
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@c2dtech.in", password: "Admin@123" });

    expect(res.status).toBe(200);
    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    adminCookie = cookies[0];
    adminUserId = res.body.data.user.id;
  }, 15000);

  // ---------------------------------------------------------------------------
  // 1. FIREBASE TOKEN VERIFICATION & SECURITY BOUNDARIES
  // ---------------------------------------------------------------------------
  it("1.1 should reject invalid Firebase ID token (401)", async () => {
    const res = await request(app)
      .post("/api/auth/firebase-login")
      .send({ idToken: "invalid_fake_token_12345" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("1.2 should reject malformed or empty Firebase ID token (400 / 401)", async () => {
    const res = await request(app)
      .post("/api/auth/firebase-login")
      .send({ idToken: "" });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.success).toBe(false);
  });

  it("1.3 should reject unauthenticated request to protected admin endpoint (401)", async () => {
    const res = await request(app).get("/api/auth/me");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // 2. DATA EXPOSURE & SENSITIVE CREDENTIALS SECURITY
  // ---------------------------------------------------------------------------
  it("2.1 should verify passwordHash is NEVER exposed in /api/auth/me response", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", [adminCookie]);

    expect(res.status).toBe(200);
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("2.2 should verify passwordHash is NEVER exposed in /api/auth/login response", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@c2dtech.in", password: "Admin@123" });

    expect(res.status).toBe(200);
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  // ---------------------------------------------------------------------------
  // 3. ACCOUNT LINKING & ROLE PRESERVATION
  // ---------------------------------------------------------------------------
  it("3.1 should authenticate via Firebase isolated test token and link C2D account", async () => {
    const res = await request(app)
      .post("/api/auth/firebase-login")
      .send({ idToken: "test-token-:admin@c2dtech.in:test-admin-uid-101" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe("admin@c2dtech.in");
    expect(res.body.data.user.isSuperAdmin).toBe(true);

    // Verify firebaseUid link in database
    const dbUser = await prisma.user.findUnique({ where: { email: "admin@c2dtech.in" } });
    expect(dbUser?.firebaseUid).toBe("test-admin-uid-101");
  });

  it("3.2 should preserve existing C2D roles & permissions after Firebase login", async () => {
    const res = await request(app)
      .post("/api/auth/firebase-login")
      .send({ idToken: "test-token-:admin@c2dtech.in:test-admin-uid-101" });

    expect(res.status).toBe(200);
    expect(res.body.data.user.roles).toBeDefined();
    const roleNames = res.body.data.user.roles.map((r: { name: string }) => r.name);
    expect(roleNames).toContain("SUPER_ADMIN");
  });

  it("3.3 should reject payload attempts to elevate role or permissions from frontend", async () => {
    const res = await request(app)
      .post("/api/auth/firebase-login")
      .send({
        idToken: "test-token-:accounts@c2dtech.in:test-accounts-uid",
        role: "SUPER_ADMIN",
        permissions: ["users:manage", "settings:manage"],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe("accounts@c2dtech.in");
    expect(res.body.data.user.isSuperAdmin).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // 4. PASSWORD RESET SECURITY
  // ---------------------------------------------------------------------------
  it("4.1 should return generic message for password reset without revealing account existence", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password/request")
      .send({ email: "nonexistent-user-9999@c2dtech.in" });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain("If an account exists");
  });

  // ---------------------------------------------------------------------------
  // 5. SESSION MANAGEMENT & LOGOUT SECURITY
  // ---------------------------------------------------------------------------
  it("5.1 should set HttpOnly rm_session cookie on login", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@c2dtech.in", password: "Admin@123" });

    expect(res.status).toBe(200);
    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    const sessionCookie = cookies[0];
    expect(sessionCookie).toContain("rm_session=");
    expect(sessionCookie).toContain("HttpOnly");
  });

  it("5.2 should invalidate session on logout and reject subsequent API calls", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@c2dtech.in", password: "Admin@123" });

    const sessionCookie = loginRes.headers["set-cookie"][0];

    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", [sessionCookie]);

    expect(logoutRes.status).toBe(200);

    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Cookie", [sessionCookie]);

    expect(meRes.status).toBe(401);
  });

  // ---------------------------------------------------------------------------
  // 6. ISOLATION & ROW LEVEL SECURITY
  // ---------------------------------------------------------------------------
  it("6.1 should enforce 401 unauthenticated block on tenant resources", async () => {
    const res = await request(app).get("/api/tenants");

    expect(res.status).toBe(401);
  });

  it("6.2 should enforce 401 unauthenticated block on financial payments", async () => {
    const res = await request(app).get("/api/payments");

    expect(res.status).toBe(401);
  });

  it("6.3 should enforce 401 unauthenticated block on tax records", async () => {
    const res = await request(app).get("/api/taxes/records");

    expect(res.status).toBe(401);
  });

  it("6.4 should enforce 401 unauthenticated block on user management", async () => {
    const res = await request(app).get("/api/users");

    expect(res.status).toBe(401);
  });
});
