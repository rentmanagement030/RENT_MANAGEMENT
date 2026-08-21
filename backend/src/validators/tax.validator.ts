import { z } from "zod";
import { zodId } from "./common";

export const createTaxRecordSchema = z.object({
  taxType: z.enum(["PROPERTY_TAX", "WATER_TAX"]),
  taxOwnership: z.enum(["PROPERTY", "HOME"]),
  propertyId: zodId,
  homeId: zodId.optional().nullable(),
  assessmentNumber: z.string().optional().nullable(),
  zone: z.string().optional().nullable(),
  division: z.string().optional().nullable(),
  billNumber: z.string().optional().nullable(),
  subNumber: z.string().optional().nullable(),
  assesseeName: z.string().optional().nullable(),
  consumerNumber: z.string().optional().nullable(),
  frequency: z.enum(["MONTHLY", "BI_MONTHLY", "QUARTERLY", "HALF_YEARLY", "ANNUAL", "CUSTOM"]).default("ANNUAL"),
  annualTaxAmount: z.number().positive("Annual/Bill tax amount must be positive"),
  currentTaxPeriod: z.string().min(1, "Tax period is required (e.g. 2026-27)"),
  nextDueDate: z.string().min(1, "Next due date is required"),
  notes: z.string().optional().nullable(),
});

export const updateTaxRecordSchema = createTaxRecordSchema.partial().omit({ taxType: true, taxOwnership: true, propertyId: true });

export const recordTaxPaymentSchema = z.object({
  taxRecordId: zodId,
  amount: z.number().positive("Payment amount must be positive"),
  paymentDate: z.string().optional().nullable(),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "UPI", "CHEQUE", "DEMAND_DRAFT", "OTHER"]).default("UPI"),
  referenceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateTaxSettingsSchema = z.object({
  defaultPropertyTaxFrequency: z.enum(["MONTHLY", "BI_MONTHLY", "QUARTERLY", "HALF_YEARLY", "ANNUAL", "CUSTOM"]).optional(),
  defaultWaterTaxFrequency: z.enum(["MONTHLY", "BI_MONTHLY", "QUARTERLY", "HALF_YEARLY", "ANNUAL", "CUSTOM"]).optional(),
  reminderDays: z.array(z.number()).optional(),
  enablePropertyTaxReminders: z.boolean().optional(),
  enableWaterTaxReminders: z.boolean().optional(),
  enableEbReminders: z.boolean().optional(),
  defaultLatePenalty: z.number().nonnegative().optional(),
});

export type CreateTaxRecordInput = z.infer<typeof createTaxRecordSchema>;
export type UpdateTaxRecordInput = z.infer<typeof updateTaxRecordSchema>;
export type RecordTaxPaymentInput = z.infer<typeof recordTaxPaymentSchema>;
export type UpdateTaxSettingsInput = z.infer<typeof updateTaxSettingsSchema>;
