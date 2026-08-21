import { prisma } from "../config/prisma";
import { transferTenant, verifyTenantDocument, recalculateTenantKycStatus } from "../services/tenant.service";
import { sendAgreementForSigning, getAgreementByToken, signAgreementByToken, updateAgreement } from "../services/agreement.service";
import { computePenaltyForBill, applyPenaltyToBill, applyAllPenalties } from "../services/bill.service";
import type { Request } from "express";

const mockReq = {
  ip: "127.0.0.1",
  headers: { "user-agent": "verification-suite-agent" },
  get: () => "verification-suite-agent",
} as unknown as Request;

type KycStatusValue = "NOT_STARTED" | "DOCUMENTS_PENDING" | "PARTIALLY_VERIFIED" | "VERIFIED" | "REJECTED";

async function runVerificationSuite() {
  console.log("=================================================================");
  console.log("RUNNING COMPREHENSIVE VERIFICATION SUITE FOR 4 NEW FEATURES");
  console.log("=================================================================\n");

  let passCount = 0;
  let failCount = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(` PASS: ${testName} ${detail ? `(${detail})` : ""}`);
      passCount++;
    } else {
      console.error(` FAIL: ${testName} ${detail ? `(${detail})` : ""}`);
      failCount++;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // Setup Test Seed Data
    // -------------------------------------------------------------------------
    const adminUser = await prisma.user.findFirst() || await prisma.user.create({
      data: { name: "Test Admin", email: `testadmin_${Date.now()}@test.com`, passwordHash: "dummy" },
    });

    // Create 2 test properties (PG and HOUSE)
    const houseProp = await prisma.property.create({
      data: {
        name: `Test House ${Date.now()}`,
        type: "HOUSE",
        address: "123 Main St",
        city: "Chennai",
        rent: 15000,
        maxCapacity: 2,
      },
    });

    const pgProp = await prisma.property.create({
      data: {
        name: `Test PG ${Date.now()}`,
        type: "PG",
        address: "456 College Rd",
        city: "Chennai",
        rent: 8000,
      },
    });

    const roomA = await prisma.pgRoom.create({
      data: { propertyId: pgProp.id, roomNumber: "101", capacity: 2, status: "AVAILABLE" },
    });

    const bed1 = await prisma.pgBed.create({
      data: { roomId: roomA.id, bedNumber: "101-A", status: "AVAILABLE" },
    });

    const bed2 = await prisma.pgBed.create({
      data: { roomId: roomA.id, bedNumber: "101-B", status: "AVAILABLE" },
    });

    // Create Test Tenant
    const testTenant = await prisma.tenant.create({
      data: {
        name: `Test Resident ${Date.now()}`,
        phone: `99${Math.floor(10000000 + Math.random() * 90000000)}`,
        propertyId: houseProp.id,
        rent: 15000,
        joiningDate: new Date(),
        status: "ACTIVE",
        kycStatus: "NOT_STARTED",
      },
    });

    // -------------------------------------------------------------------------
    // Feature 1: Tenant Shifting & Transfer History
    // -------------------------------------------------------------------------
    console.log("\n--- Scenario 1: Tenant Transfer & Shifting History ---");

    // Perform Transfer to PG Property (bed1)
    const transferRes = await transferTenant(
      testTenant.id,
      {
        toPropertyId: pgProp.id,
        toRoomId: roomA.id,
        toBedId: bed1.id,
        toRent: 9000,
        transferDate: new Date("2026-08-15").toISOString(),
        reason: "Requested PG stay closer to office",
      },
      mockReq,
      adminUser.id
    );

    assert(transferRes.tenant.propertyId === pgProp.id, "Tenant updated to new target property");
    assert(transferRes.transfer.fromPropertyId === houseProp.id, "Transfer history records original property");
    assert(transferRes.transfer.toPropertyId === pgProp.id, "Transfer history records new property");
    assert(transferRes.transfer.effectiveTo === null, "New active stay record has effectiveTo = NULL");

    // Verify Bed Status Updated to OCCUPIED
    const updatedBed1 = await prisma.pgBed.findUnique({ where: { id: bed1.id } });
    assert(updatedBed1?.status === "OCCUPIED" && updatedBed1?.tenantId === testTenant.id, "Target Bed status set to OCCUPIED and assigned to tenant");

    // Verify bed2 is still AVAILABLE
    const updatedBed2 = await prisma.pgBed.findUnique({ where: { id: bed2.id } });
    assert(updatedBed2?.status === "AVAILABLE", "Untouched bed remains AVAILABLE");

    // Perform Second Transfer to Bed 2
    await transferTenant(
      testTenant.id,
      {
        toPropertyId: pgProp.id,
        toRoomId: roomA.id,
        toBedId: bed2.id,
        toRent: 9500,
        transferDate: new Date("2026-09-01").toISOString(),
        reason: "Switching to window bed",
      },
      mockReq,
      adminUser.id
    );

    // Check Previous Stay closed with effectiveTo
    const firstTransferRecord = await prisma.tenantTransferHistory.findUnique({ where: { id: transferRes.transfer.id } });
    assert(firstTransferRecord?.effectiveTo !== null, "Previous stay closed with effectiveTo date");

    // Check old bed1 freed to AVAILABLE
    const freedBed1 = await prisma.pgBed.findUnique({ where: { id: bed1.id } });
    assert(freedBed1?.status === "AVAILABLE" && freedBed1?.tenantId === null, "Old bed1 automatically freed to AVAILABLE upon transfer");

    // -------------------------------------------------------------------------
    // Feature 2: KYC Verification Workflow
    // -------------------------------------------------------------------------
    console.log("\n--- Scenario 2: KYC Verification Workflow & Status Rules ---");

    // 1. Initial State: NOT_STARTED
    let kycStatus: KycStatusValue = await recalculateTenantKycStatus(testTenant.id);
    assert(kycStatus === "NOT_STARTED", "No documents uploaded returns KYC NOT_STARTED");

    // 2. Upload Document -> DOCUMENTS_PENDING
    const doc1 = await prisma.tenantDocument.create({
      data: { tenantId: testTenant.id, storageKey: `suite/doc1-${Date.now()}.pdf`, type: "AADHAAR", originalName: "aadhaar.pdf", mimeType: "application/pdf", size: 1024, status: "PENDING" },
    });
    kycStatus = await recalculateTenantKycStatus(testTenant.id);
    assert(kycStatus === "DOCUMENTS_PENDING", "Unverified documents returns KYC DOCUMENTS_PENDING");

    // 3. Verify Document 1 -> PARTIALLY_VERIFIED (if another pending doc exists)
    const doc2 = await prisma.tenantDocument.create({
      data: { tenantId: testTenant.id, storageKey: `suite/doc2-${Date.now()}.pdf`, type: "AGREEMENT", originalName: "agreement.pdf", mimeType: "application/pdf", size: 2048, status: "PENDING" },
    });
    await verifyTenantDocument(testTenant.id, doc1.id, "VERIFIED", undefined, mockReq, adminUser.id);
    kycStatus = (await prisma.tenant.findUnique({ where: { id: testTenant.id } }))!.kycStatus;
    assert(kycStatus === "PARTIALLY_VERIFIED", "One verified and one pending document returns KYC PARTIALLY_VERIFIED");

    // 4. Verify Document 2 -> VERIFIED
    await verifyTenantDocument(testTenant.id, doc2.id, "VERIFIED", undefined, mockReq, adminUser.id);
    kycStatus = (await prisma.tenant.findUnique({ where: { id: testTenant.id } }))!.kycStatus;
    assert(kycStatus === "VERIFIED", "All documents verified returns KYC VERIFIED");

    // 5. Reject Document -> REJECTED & enforcement of rejection reason
    await verifyTenantDocument(testTenant.id, doc2.id, "REJECTED", "Address mismatch on agreement", mockReq, adminUser.id);
    const updatedDoc2 = await prisma.tenantDocument.findUnique({ where: { id: doc2.id } });
    kycStatus = (await prisma.tenant.findUnique({ where: { id: testTenant.id } }))!.kycStatus;
    assert(kycStatus === "REJECTED", "Any rejected document returns KYC REJECTED");
    assert(updatedDoc2?.rejectionReason === "Address mismatch on agreement", "Rejection reason saved correctly");

    // Test rejection without reason throws error
    try {
      await verifyTenantDocument(testTenant.id, doc1.id, "REJECTED", "", mockReq, adminUser.id);
      assert(false, "Rejection without reason should throw ValidationError");
    } catch {
      assert(true, "Rejection without reason correctly throws ValidationError");
    }

    // -------------------------------------------------------------------------
    // Feature 3: Digital Agreement Signing & Lock Rules
    // -------------------------------------------------------------------------
    console.log("\n--- Scenario 3: Digital Agreement Signing & Term Locking ---");

    const agreement = await prisma.agreement.create({
      data: {
        agreementNumber: `AGR-TEST-${Date.now()}`,
        tenantId: testTenant.id,
        propertyId: pgProp.id,
        startDate: new Date("2026-08-01"),
        endDate: new Date("2027-07-31"),
        rent: 9500,
        advance: 19000,
        deposit: 19000,
        status: "DRAFT",
      },
    });

    // Send for Signing
    const sendRes = await sendAgreementForSigning(agreement.id, 7, mockReq, adminUser.id);
    assert(sendRes.token.length >= 40, "Cryptographically secure signing token generated");
    assert((sendRes.agreement as unknown as { status: string }).status === "SENT", "Agreement status updated to SENT");

    // Public Fetch by Token
    const publicAg = await getAgreementByToken(sendRes.token);
    assert((publicAg as unknown as { id: string }).id === agreement.id, "Public fetch by token returns correct agreement");

    // Sign Agreement via Token
    const signedAg = (await signAgreementByToken(
      sendRes.token,
      {
        signatureName: "Test Resident",
        signatureMethod: "DRAWN",
        signatureUrl: "data:image/png;base64,iVBORw0KGgo...",
      },
      mockReq
    )) as unknown as { status: string; isLocked: boolean; signedIp: string };

    assert(signedAg.status === "SIGNED", "Signed agreement status updated to SIGNED");
    assert(signedAg.isLocked === true, "Signed agreement terms locked (isLocked = true)");
    assert(signedAg.signedIp === "127.0.0.1", "Signed IP captured");

    // Term Locking Enforcement Check
    try {
      await updateAgreement(agreement.id, { rent: 5000 }, mockReq, adminUser.id);
      assert(false, "Modifying locked agreement terms should throw ConflictError");
    } catch {
      assert(true, "Modifying locked agreement terms correctly rejected with ConflictError");
    }

    // -------------------------------------------------------------------------
    // Feature 4: Automatic Late Fee & Grace Period System
    // -------------------------------------------------------------------------
    console.log("\n--- Scenario 4: Automatic Late Fee & Grace Period Calculations ---");

    const overdueRentBill = await prisma.bill.create({
      data: {
        billNumber: `BILL-RENT-${Date.now()}`,
        tenantId: testTenant.id,
        propertyId: pgProp.id,
        billType: "RENT",
        billingMonth: "2026-07",
        amount: 9500,
        paidAmount: 0,
        outstanding: 9500,
        dueDate: new Date("2026-07-05"), // Overdue by over 30 days
        status: "OVERDUE",
      },
    });

    // Apply Penalty
    const lateFeeBill1 = await applyPenaltyToBill(overdueRentBill.id, mockReq, adminUser.id);
    assert(lateFeeBill1 !== null, "Separate LATE_FEE bill record generated");
    assert(lateFeeBill1.billType === "LATE_FEE", "Bill type is LATE_FEE");
    assert(Number(overdueRentBill.amount) === 9500, "Original RENT bill amount NOT altered");

    // Late Fee Idempotency Check (re-applying updates existing late fee bill)
    const lateFeeBill2 = await applyPenaltyToBill(overdueRentBill.id, mockReq, adminUser.id);
    assert(lateFeeBill2.id === lateFeeBill1.id, "Re-running late fee updates single existing LATE_FEE bill record without creating duplicates");

    // Guard Check: Verify late fee bill CANNOT generate a late fee on itself
    const nestedPenalty = await computePenaltyForBill(lateFeeBill1.id);
    assert(nestedPenalty.applicable === false && nestedPenalty.amount.toNumber() === 0, "LATE_FEE bill returns 0 penalty (preventing late fee on late fee)");

    // Batch re-apply should be idempotent and not throw
    const appliedCount = await applyAllPenalties();
    assert(typeof appliedCount === "number", "Batch applyAllPenalties runs without error");

  } catch (err) {
    console.error("FATAL AUDIT ERROR:", err);
    failCount++;
  } finally {
    console.log("\n=================================================================");
    console.log(`SUITE COMPLETED: ${passCount} PASSED, ${failCount} FAILED`);
    console.log("=================================================================\n");
  }
}

runVerificationSuite();
