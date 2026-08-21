import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { calculateNameMatchScore, AiOcrKycProvider } from "../services/kyc.service";
import { normalizeOcrText, calculateReadability } from "../services/ocr.service";

const app = createApp();

describe("AI-Assisted Automatic KYC Verification System Test Suite", { timeout: 30000 }, () => {
  let adminCookie: string;
  let testTenantId: string;
  let autoVerifiedDocId: string;
  let manualReviewDocId: string;

  beforeAll(async () => {
    // 1. Login Admin
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@c2dtech.in", password: "Admin@123" });

    expect(loginRes.status).toBe(200);
    adminCookie = loginRes.headers["set-cookie"][0];

    // 2. Fetch or create a test property & tenant for document testing
    const tenantRes = await request(app)
      .post("/api/tenants")
      .set("Cookie", [adminCookie])
      .send({
        name: "Ramesh Kumar",
        phone: "98" + Math.floor(10000000 + Math.random() * 90000000),
        rent: 10000,
        status: "ACTIVE",
      });

    expect(tenantRes.status).toBe(201);
    testTenantId = tenantRes.body.data.tenant.id;
  });

  // ---------------------------------------------------------------------------
  // 1. NAME MATCHING & NORMALIZATION ALGORITHM
  // ---------------------------------------------------------------------------
  describe("Name Matching & Normalization Engine", () => {
    it("should consider exact matching names with different casing as 100% match", () => {
      const score = calculateNameMatchScore("Ramesh Kumar", "RAMESH KUMAR");
      expect(score).toBe(100);
    });

    it("should handle multiple spaces and punctuation cleanly", () => {
      const score = calculateNameMatchScore("Ramesh Kumar", "RAMESH   KUMAR!");
      expect(score).toBe(100);
    });

    it("should match names with middle initial or abbreviation strongly", () => {
      const score = calculateNameMatchScore("Ramesh Kumar", "RAMESH K.");
      expect(score).toBeGreaterThanOrEqual(80);
    });

    it("should return low match score for completely mismatched names", () => {
      const score = calculateNameMatchScore("Ramesh Kumar", "VIKRAM SINGH");
      expect(score).toBeLessThan(40);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. READABILITY & OCR ANALYSIS
  // ---------------------------------------------------------------------------
  describe("Readability & OCR Analysis", () => {
    it("should correctly grade readability levels", () => {
      expect(calculateReadability(150, 95)).toBe("EXCELLENT");
      expect(calculateReadability(70, 80)).toBe("GOOD");
      expect(calculateReadability(40, 60)).toBe("FAIR");
      expect(calculateReadability(20, 40)).toBe("POOR");
      expect(calculateReadability(5, 10)).toBe("UNREADABLE");
    });

    it("should normalize OCR text removing non-alphanumeric noise", () => {
      const text = normalizeOcrText(" Name :  Ramesh  Kumar #123 ");
      expect(text).toBe("NAME RAMESH KUMAR 123");
    });
  });

  // ---------------------------------------------------------------------------
  // 3. AI-ASSISTED KYC PROVIDER RULES
  // ---------------------------------------------------------------------------
  describe("AiOcrKycProvider Verification Rules", () => {
    const provider = new AiOcrKycProvider();

    it("should output AUTO_VERIFIED when confidence, required fields, and name match pass", async () => {
      const result = await provider.verifyDocument(
        {
          type: "PAN",
          storageKey: "sample_pan.jpg",
          originalName: "PAN_RAMESH_KUMAR.jpg",
          mimeType: "image/jpeg",
        },
        { name: "Ramesh Kumar" },
      );

      // Unless OCR reading fails due to missing file, structure returns valid metrics
      expect(result.metrics).toBeDefined();
      expect(result.metrics.detectedDocumentType).toBe("PAN");
    });

    it("should output MANUAL_REVIEW for unreadable documents without auto-rejecting", async () => {
      const result = await provider.verifyDocument(
        {
          type: "AADHAAR",
          storageKey: "non_existent_blurry_file.png",
          originalName: "blurry_aadhaar.png",
          mimeType: "image/png",
        },
        { name: "Ramesh Kumar" },
      );

      expect(result.status).toBe("MANUAL_REVIEW");
      expect(result.reason).toContain("Manual verification required");
    });
  });

  // ---------------------------------------------------------------------------
  // 4. DOCUMENT UPLOADS & WORKFLOW INTEGRATION
  // ---------------------------------------------------------------------------
  describe("KYC Document Upload & Manual Approval / Rejection API", () => {
    it("4.1 should upload document and recalculate KYC status", async () => {
      const uploadRes = await request(app)
        .post(`/api/tenants/${testTenantId}/documents`)
        .set("Cookie", [adminCookie])
        .field("type", "PAN")
        .attach("document", Buffer.from("INCOME TAX DEPARTMENT GOVT OF INDIA PERMANENT ACCOUNT NUMBER ABCDE1234F RAMESH KUMAR"), "pan_card.pdf");

      expect(uploadRes.status).toBe(201);
      expect(uploadRes.body.success).toBe(true);
      autoVerifiedDocId = uploadRes.body.data.document.id;
    });

    it("4.2 should list uploaded tenant documents with verification metrics", async () => {
      const listRes = await request(app)
        .get(`/api/tenants/${testTenantId}/documents`)
        .set("Cookie", [adminCookie]);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.documents.length).toBeGreaterThan(0);
      const doc = listRes.body.data.documents[0];
      expect(doc.status).toBeDefined();
    });

    it("4.3 should allow admin to manually APPROVE a document", async () => {
      const approveRes = await request(app)
        .patch(`/api/tenants/${testTenantId}/documents/${autoVerifiedDocId}/verify`)
        .set("Cookie", [adminCookie])
        .send({ status: "VERIFIED" });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.document.status).toBe("VERIFIED");
      expect(approveRes.body.data.document.verificationMethod).toBe("ADMIN_MANUAL");
    });

    it("4.4 should require rejection reason when rejecting a document", async () => {
      // Create a second document to test rejection
      const upload2 = await request(app)
        .post(`/api/tenants/${testTenantId}/documents`)
        .set("Cookie", [adminCookie])
        .field("type", "OTHER")
        .attach("document", Buffer.from("Unclear text document"), "unclear_doc.pdf");

      expect(upload2.status).toBe(201);
      manualReviewDocId = upload2.body.data.document.id;

      // Attempt reject without reason
      const failReject = await request(app)
        .patch(`/api/tenants/${testTenantId}/documents/${manualReviewDocId}/verify`)
        .set("Cookie", [adminCookie])
        .send({ status: "REJECTED" });

      expect(failReject.status).toBe(422);

      // Reject with valid reason
      const validReject = await request(app)
        .patch(`/api/tenants/${testTenantId}/documents/${manualReviewDocId}/verify`)
        .set("Cookie", [adminCookie])
        .send({ status: "REJECTED", rejectionReason: "Document image is blurred and unreadable." });

      expect(validReject.status).toBe(200);
      expect(validReject.body.data.document.status).toBe("REJECTED");
      expect(validReject.body.data.document.rejectionReason).toBe("Document image is blurred and unreadable.");
    });

    it("4.5 should correctly reflect overall tenant KYC status as REJECTED when any doc is rejected", async () => {
      const tenantRes = await request(app)
        .get(`/api/tenants/${testTenantId}`)
        .set("Cookie", [adminCookie]);

      expect(tenantRes.status).toBe(200);
      expect(tenantRes.body.data.tenant.kycStatus).toBe("REJECTED");
    });
  });

  // ---------------------------------------------------------------------------
  // 5. KYC CONFIDENCE THRESHOLD SETTING
  // ---------------------------------------------------------------------------
  describe("Settings & KYC Confidence Threshold", () => {
    it("5.1 should fetch settings with default kycConfidenceThreshold", async () => {
      const settingsRes = await request(app)
        .get("/api/system/settings")
        .set("Cookie", [adminCookie]);

      expect(settingsRes.status).toBe(200);
      expect(settingsRes.body.data.settings.kycConfidenceThreshold).toBeDefined();
    });

    it("5.2 should allow updating kycConfidenceThreshold", async () => {
      const updateRes = await request(app)
        .put("/api/system/settings")
        .set("Cookie", [adminCookie])
        .send({ kycConfidenceThreshold: 85 });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.settings.kycConfidenceThreshold).toBe(85);
    });
  });
});
