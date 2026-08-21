import createWorker from "tesseract.js";
import fs from "fs";
import path from "path";
import { getFileBuffer } from "../utils/storage";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");

export type ReadabilityGrade = "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "UNREADABLE";

export interface OcrProcessingResult {
  detectedDocumentType: string;
  extractedName?: string;
  readability: ReadabilityGrade;
  requiredFieldsPass: boolean;
  confidence: number;
  formatMatch: boolean;
  hasSufficientText: boolean;
}

/**
 * Clean and normalize text extracted via OCR
 */

export function normalizeOcrText(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract text from Image or PDF file
 */
export async function extractTextFromDocument(
  storageKey: string,
  mimeType: string,
): Promise<{ text: string; confidence: number }> {
  try {
    let fileBuffer: Buffer | null = null;
    try {
      fileBuffer = getFileBuffer(storageKey);
    } catch {
      return { text: "", confidence: 0 };
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return { text: "", confidence: 0 };
    }

    if (mimeType === "application/pdf" || storageKey.toLowerCase().endsWith(".pdf")) {
      const pdfFunc = typeof pdfParse === "function" ? pdfParse : (pdfParse as any)?.default;
      if (typeof pdfFunc === "function") {
        const pdfData = await pdfFunc(fileBuffer);
        const text = pdfData.text || "";
        const confidence = text.length > 50 ? 95 : text.length > 10 ? 70 : 30;
        return { text, confidence };
      }
      return { text: "", confidence: 0 };
    }

    // For images, run Tesseract OCR
    const worker = await (createWorker as any).createWorker("eng");
    try {
      const ret = await worker.recognize(fileBuffer);
      const text = ret.data.text || "";
      const confidence = Math.round(ret.data.confidence || 0);
      return { text, confidence };
    } finally {
      await worker.terminate();
    }
  } catch (err) {
    console.error("OCR extraction failed:", err);
    return { text: "", confidence: 0 };
  }
}

/**
 * Extract structural name candidates from text
 */
export function extractCandidateName(text: string): string | undefined {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 3 && l.length <= 40);

  // Common keywords to ignore for name matching
  const ignoreKeywords = [
    "GOVERNMENT",
    "INDIA",
    "INCOME",
    "TAX",
    "DEPARTMENT",
    "AADHAAR",
    "CARD",
    "PERMANENT",
    "ACCOUNT",
    "NUMBER",
    "PASSPORT",
    "DRIVING",
    "LICENCE",
    "REPUBLIC",
    "FATHER",
    "NAME",
    "DATE",
    "BIRTH",
    "DOB",
    "MALE",
    "FEMALE",
    "ADDRESS",
    "SIGNATURE",
  ];

  for (const line of lines) {
    const norm = normalizeOcrText(line);
    const words = norm.split(" ").filter((w) => w.length >= 2);
    if (words.length >= 2 && words.length <= 4) {
      const containsIgnore = words.some((w) => ignoreKeywords.includes(w));
      if (!containsIgnore && /^[A-Z\s.]+$/.test(norm)) {
        return norm;
      }
    }
  }

  return undefined;
}

/**
 * Determine readability grade based on text length and confidence
 */
export function calculateReadability(textLength: number, confidence: number): ReadabilityGrade {
  if (textLength < 10 || confidence < 20) return "UNREADABLE";
  if (textLength < 30 || confidence < 50) return "POOR";
  if (textLength < 60 || confidence < 75) return "FAIR";
  if (confidence >= 90 && textLength >= 100) return "EXCELLENT";
  return "GOOD";
}

/**
 * Process document OCR & parse structure safely without persisting sensitive numbers
 */
export async function processDocumentOcr(
  storageKey: string,
  mimeType: string,
  expectedType: string,
): Promise<OcrProcessingResult> {
  const { text, confidence: rawConfidence } = await extractTextFromDocument(storageKey, mimeType);
  const normalizedText = normalizeOcrText(text);
  const textLength = normalizedText.length;

  const readability = calculateReadability(textLength, rawConfidence);
  const extractedName = extractCandidateName(text);

  let formatMatch = false;
  let requiredFieldsPass = false;
  let detectedDocumentType = expectedType;

  switch (expectedType) {
    case "PAN": {
      // PAN format: 5 alpha + 4 digits + 1 alpha
      const panRegex = /[A-Z]{5}[0-9]{4}[A-Z]/;
      formatMatch = panRegex.test(normalizedText) || normalizedText.includes("INCOME TAX") || normalizedText.includes("PERMANENT ACCOUNT");
      requiredFieldsPass = formatMatch && (readability === "GOOD" || readability === "EXCELLENT");
      break;
    }
    case "AADHAAR": {
      // Aadhaar format: 12 digits or 4-digit masked
      const aadhaarRegex = /\d{4}\s?\d{4}\s?\d{4}/;
      const maskedRegex = /XXXX\s?XXXX\s?\d{4}/i;
      formatMatch = aadhaarRegex.test(normalizedText) || maskedRegex.test(text) || normalizedText.includes("GOVERNMENT OF INDIA") || normalizedText.includes("UNIQUE IDENTIFICATION");
      requiredFieldsPass = formatMatch && (readability === "GOOD" || readability === "EXCELLENT");
      break;
    }
    case "PASSPORT": {
      const passportRegex = /[A-Z][0-9]{7}/;
      formatMatch = passportRegex.test(normalizedText) || normalizedText.includes("REPUBLIC OF INDIA") || normalizedText.includes("PASSPORT");
      requiredFieldsPass = formatMatch && (readability === "GOOD" || readability === "EXCELLENT");
      break;
    }
    case "DRIVING_LICENSE": {
      const dlRegex = /[A-Z]{2}[0-9]{2}\s?[0-9]{11}/;
      formatMatch = dlRegex.test(normalizedText) || normalizedText.includes("DRIVING") || normalizedText.includes("LICENCE") || normalizedText.includes("TRANSPORT");
      requiredFieldsPass = formatMatch && (readability === "GOOD" || readability === "EXCELLENT");
      break;
    }
    case "AGREEMENT": {
      formatMatch = normalizedText.includes("AGREEMENT") || normalizedText.includes("RENT") || normalizedText.includes("LEASE") || textLength > 100;
      requiredFieldsPass = textLength > 50 && (readability === "GOOD" || readability === "EXCELLENT");
      break;
    }
    case "PHOTO":
    case "PHOTOGRAPH": {
      formatMatch = mimeType.startsWith("image/");
      requiredFieldsPass = mimeType.startsWith("image/") && fileExists(storageKey);
      break;
    }
    default: {
      formatMatch = textLength > 20;
      requiredFieldsPass = textLength > 20 && (readability === "GOOD" || readability === "EXCELLENT");
      break;
    }
  }

  const confidence = Math.max(10, Math.min(100, Math.round(rawConfidence)));

  return {
    detectedDocumentType,
    extractedName,
    readability,
    requiredFieldsPass,
    confidence,
    formatMatch,
    hasSufficientText: textLength > 15,
  };
}

function fileExists(storageKey: string): boolean {
  try {
    const buf = getFileBuffer(storageKey);
    return !!buf && buf.length > 0;
  } catch {
    return false;
  }
}
