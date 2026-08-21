import { prisma } from "../config/prisma";
import { NotFoundError } from "../utils/http";
import { processDocumentOcr, normalizeOcrText, ReadabilityGrade } from "./ocr.service";
import { recalculateTenantKycStatus } from "./tenant.service";
import { writeAuditLog } from "../utils/audit";
import type { Request } from "express";

export interface KycVerificationMetrics {
  nameMatchScore: number;
  readability: ReadabilityGrade;
  requiredFieldsPass: boolean;
  detectedDocumentType: string;
  confidence: number;
}

export interface KycVerificationResult {
  status: "AUTO_VERIFIED" | "MANUAL_REVIEW" | "REJECTED";
  confidence: number;
  reason: string;
  metrics: KycVerificationMetrics;
}

export interface KycVerificationProvider {
  verifyDocument(
    doc: { type: string; storageKey: string; originalName: string; mimeType: string },
    tenant: { name: string; phone?: string },
  ): Promise<KycVerificationResult>;
}

/**
 * Calculates string similarity score between 0 and 100
 * Handles name variations: "RAMESH KUMAR" vs "Ramesh Kumar" (100%), "Ramesh K." (90%), etc.
 */
export function calculateNameMatchScore(tenantName: string, ocrTextOrName: string): number {
  if (!tenantName || !ocrTextOrName) return 0;

  const tNorm = normalizeOcrText(tenantName);
  const oNorm = normalizeOcrText(ocrTextOrName);

  if (tNorm === oNorm) return 100;
  if (oNorm.includes(tNorm) || tNorm.includes(oNorm)) return 95;

  const tTokens = tNorm.split(" ").filter((t) => t.length > 0);
  const oTokens = oNorm.split(" ").filter((t) => t.length > 0);

  if (tTokens.length === 0 || oTokens.length === 0) return 0;

  let matchedTokens = 0;
  for (const tToken of tTokens) {
    const directMatch = oTokens.some((oToken) => {
      if (oToken === tToken) return true;
      // Handle initials e.g. "K." vs "KUMAR"
      if (tToken.length === 1 && oToken.startsWith(tToken)) return true;
      if (oToken.length === 1 && tToken.startsWith(oToken)) return true;
      return false;
    });

    if (directMatch) {
      matchedTokens++;
    }
  }

  const tokenScore = Math.round((matchedTokens / tTokens.length) * 100);

  // Character-level fallback comparison
  const tSet = new Set(tNorm.replace(/\s+/g, "").split(""));
  const oSet = new Set(oNorm.replace(/\s+/g, "").split(""));
  let setOverlap = 0;
  tSet.forEach((char) => {
    if (oSet.has(char)) setOverlap++;
  });
  const charScore = Math.round((setOverlap / Math.max(tSet.size, 1)) * 100);

  return Math.max(tokenScore, Math.min(100, Math.round(tokenScore * 0.8 + charScore * 0.2)));
}

/**
 * Get configured KYC confidence threshold from Settings (default 90)
 */
export async function getKycConfidenceThreshold(): Promise<number> {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: "kyc.confidenceThreshold" } });
    if (setting && setting.value !== null) {
      const val = typeof setting.value === "number" ? setting.value : Number(setting.value);
      if (!isNaN(val) && val > 0 && val <= 100) return val;
    }
  } catch (err) {
    console.error("Failed to read KYC threshold setting:", err);
  }
  return 90;
}

/**
 * AI-Assisted KYC Verification Provider implementation
 */
export class AiOcrKycProvider implements KycVerificationProvider {
  async verifyDocument(
    doc: { type: string; storageKey: string; originalName: string; mimeType: string },
    tenant: { name: string; phone?: string },
  ): Promise<KycVerificationResult> {
    try {
      const ocrResult = await processDocumentOcr(doc.storageKey, doc.mimeType, doc.type);

      const nameMatchScore = ocrResult.extractedName
        ? calculateNameMatchScore(tenant.name, ocrResult.extractedName)
        : calculateNameMatchScore(tenant.name, doc.originalName);

      const threshold = await getKycConfidenceThreshold();

      const metrics: KycVerificationMetrics = {
        nameMatchScore,
        readability: ocrResult.readability,
        requiredFieldsPass: ocrResult.requiredFieldsPass,
        detectedDocumentType: ocrResult.detectedDocumentType,
        confidence: ocrResult.confidence,
      };

      // Readability check: FAIR, POOR, or UNREADABLE must go to MANUAL_REVIEW
      if (ocrResult.readability === "UNREADABLE" || ocrResult.readability === "POOR" || ocrResult.readability === "FAIR") {
        return {
          status: "MANUAL_REVIEW",
          confidence: ocrResult.confidence,
          reason: `Document readability is ${ocrResult.readability.toLowerCase()}. Manual verification required.`,
          metrics,
        };
      }

      // Check for multi-metric pass rule (NOT a single score blindly)
      const isNamePass = doc.type === "PHOTO" || doc.type === "PHOTOGRAPH" || nameMatchScore >= 80;
      const isFieldsPass = ocrResult.requiredFieldsPass;
      const isConfidencePass = ocrResult.confidence >= threshold;

      if (isConfidencePass && isFieldsPass && isNamePass) {
        return {
          status: "AUTO_VERIFIED",
          confidence: ocrResult.confidence,
          reason: `Automated document validation passed (${ocrResult.confidence}% confidence, ${nameMatchScore}% name match).`,
          metrics,
        };
      }

      // Flag for manual review if any validation metric is uncertain
      const failureReasons: string[] = [];
      if (!isConfidencePass) failureReasons.push(`Confidence (${ocrResult.confidence}%) below threshold (${threshold}%)`);
      if (!isNamePass) failureReasons.push(`Tenant name match (${nameMatchScore}%) insufficient`);
      if (!isFieldsPass) failureReasons.push(`Document structure or required fields unverified`);

      return {
        status: "MANUAL_REVIEW",
        confidence: ocrResult.confidence,
        reason: `Manual review required: ${failureReasons.join("; ")}.`,
        metrics,
      };
    } catch (err) {
      console.error("KYC processing error:", err);
      return {
        status: "MANUAL_REVIEW",
        confidence: 0,
        reason: "Automatic document processing failed. Manual verification required.",
        metrics: {
          nameMatchScore: 0,
          readability: "UNREADABLE",
          requiredFieldsPass: false,
          detectedDocumentType: doc.type,
          confidence: 0,
        },
      };
    }
  }
}

const defaultKycProvider = new AiOcrKycProvider();

/**
 * Main process function called after document upload
 */
export async function processDocument(documentId: string, req?: Request) {
  const doc = await prisma.tenantDocument.findUnique({
    where: { id: documentId },
    include: { tenant: true },
  });

  if (!doc) throw new NotFoundError("Document not found");

  const verificationResult = await defaultKycProvider.verifyDocument(
    {
      type: doc.type,
      storageKey: doc.storageKey,
      originalName: doc.originalName,
      mimeType: doc.mimeType,
    },
    {
      name: doc.tenant.name,
      phone: doc.tenant.phone,
    },
  );

  const updatedDoc = await prisma.tenantDocument.update({
    where: { id: documentId },
    data: {
      status: verificationResult.status as any,
      verificationConfidence: verificationResult.confidence,
      verificationReason: verificationResult.reason,
      verificationMethod: "AI_ASSISTED",
      ocrData: verificationResult.metrics as any,
    },
  });

  await recalculateTenantKycStatus(prisma, doc.tenantId);

  if (req) {
    await writeAuditLog(
      req,
      {
        action: verificationResult.status === "AUTO_VERIFIED" ? "tenant.document_auto_verified" : "tenant.document_flagged_review",
        entityType: "tenant_document",
        entityId: documentId,
        metadata: {
          tenantId: doc.tenantId,
          type: doc.type,
          status: verificationResult.status,
          confidence: verificationResult.confidence,
          reason: verificationResult.reason,
          verificationMethod: "AI_ASSISTED",
        },
      },
      "system",
    );
  }

  return updatedDoc;
}
