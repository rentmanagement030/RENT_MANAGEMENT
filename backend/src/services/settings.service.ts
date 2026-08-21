import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { NotFoundError } from "../utils/http";
import { writeAuditLog } from "../utils/audit";
import type { Request } from "express";

const PUBLIC_KEYS = new Set([
  "businessName",
  "businessPhone",
  "businessEmail",
  "businessAddress",
  "logoUrl",
  "currency",
  "aboutText",
]);

export const DEFAULT_SETTINGS: Record<string, unknown> = {
  businessName: "C2D Tech Rentals",
  businessPhone: "",
  businessEmail: "",
  businessAddress: "",
  logoUrl: "",
  currency: "₹",
  aboutText: "Rental properties managed by C2D Tech.",
  rentDueDay: 5,
  rentReminderDays: 3,
  agreementReminderDays: 30,
  notificationWhatsAppEnabled: false,
  notificationEmailEnabled: false,
  billingDueDay: 5,
  billingGraceDays: 5,
  billingPenaltyRule: "FIXED_PER_DAY",
  billingPenaltyRate: 50,
  billingPenaltyAfterDays: 0,
  billingBillPrefix: "INV",
  transferBillingMode: "FULL_MONTH",
  latePenaltyPerDay: 50,
  latePenaltyStartDay: 10,
  "kyc.confidenceThreshold": 90,
  kycConfidenceThreshold: 90,
};

export async function getSettings(includePublicOnly = false) {
  const settings = await prisma.setting.findMany();
  const map = new Map<string, unknown>(Object.entries(DEFAULT_SETTINGS));
  for (const s of settings) {
    map.set(s.key, s.value);
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of map) {
    if (includePublicOnly && !PUBLIC_KEYS.has(key)) continue;
    result[key] = value;
  }
  return result;
}

export async function updateSettings(
  patch: Record<string, unknown>,
  req: Request,
  actorId: string,
) {
  if (patch.latePenaltyPerDay !== undefined && patch.billingPenaltyRate === undefined) {
    patch.billingPenaltyRate = patch.latePenaltyPerDay;
  } else if (patch.billingPenaltyRate !== undefined && patch.latePenaltyPerDay === undefined) {
    patch.latePenaltyPerDay = patch.billingPenaltyRate;
  }

  if (patch.kycConfidenceThreshold !== undefined && patch["kyc.confidenceThreshold"] === undefined) {
    patch["kyc.confidenceThreshold"] = patch.kycConfidenceThreshold;
  } else if (patch["kyc.confidenceThreshold"] !== undefined && patch.kycConfidenceThreshold === undefined) {
    patch.kycConfidenceThreshold = patch["kyc.confidenceThreshold"];
  }

  const allowed = new Set([
    ...PUBLIC_KEYS,
    "rentDueDay",
    "rentReminderDays",
    "agreementReminderDays",
    "notificationWhatsAppEnabled",
    "notificationEmailEnabled",
    "billingDueDay",
    "billingGraceDays",
    "billingPenaltyRule",
    "billingPenaltyRate",
    "billingPenaltyAfterDays",
    "billingBillPrefix",
    "transferBillingMode",
    "latePenaltyPerDay",
    "latePenaltyStartDay",
    "kyc.confidenceThreshold",
    "kycConfidenceThreshold",
  ]);

  const entries = Object.entries(patch).filter(([key]) => allowed.has(key));
  if (entries.length === 0) {
    throw new NotFoundError("No valid settings keys provided");
  }

  for (const [key, value] of entries) {
    await prisma.setting.upsert({
      where: { key },
      update: { value: value as Prisma.InputJsonValue, updatedById: actorId },
      create: { key, value: value as Prisma.InputJsonValue, updatedById: actorId },
    });
  }

  await writeAuditLog(req, {
    action: "settings.updated",
    entityType: "settings",
    metadata: { keys: entries.map(([k]) => k) },
  }, actorId);

  return getSettings(false);
}
