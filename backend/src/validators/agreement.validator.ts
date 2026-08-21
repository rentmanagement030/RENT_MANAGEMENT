import { z } from "zod";
import { amountSchema, dateSchema } from "./common";

export const agreementCreateSchema = z.object({
  tenantId: z.string().min(1),
  propertyId: z.string().min(1),
  startDate: dateSchema,
  endDate: dateSchema,
  rent: amountSchema,
  advance: z.coerce.number().min(0).optional().default(0),
  deposit: z.coerce.number().min(0).optional().default(0),
  status: z.enum(["ACTIVE", "EXPIRED", "TERMINATED", "RENEWED"]).optional(),
});

export const agreementUpdateSchema = agreementCreateSchema.partial();

export const rentCreateSchema = z.object({
  tenantId: z.string().min(1),
  propertyId: z.string().min(1),
  billingMonth: z.string().regex(/^\d{4}-\d{2}$/, "billingMonth must be YYYY-MM"),
  dueDate: dateSchema,
  rent: amountSchema,
  additionalCharges: z.coerce.number().min(0).optional().default(0),
});

export const rentUpdateSchema = z.object({
  dueDate: dateSchema.optional(),
  additionalCharges: z.coerce.number().min(0).optional(),
  status: z.enum(["PENDING", "PARTIAL", "PAID", "OVERDUE", "WAIVED"]).optional(),
});

export const rentAdjustmentSchema = z.object({
  type: z.enum(["CHARGE", "DISCOUNT"]),
  amount: amountSchema,
  reason: z.string().min(3).max(500),
});

export const generateRentMonthSchema = z
  .object({
    month: z.string().regex(/^\d{4}-\d{2}$/, "month must be YYYY-MM").optional(),
    billingMonth: z.string().regex(/^\d{4}-\d{2}$/, "billingMonth must be YYYY-MM").optional(),
    dueDate: dateSchema.optional(),
    rentOverride: z.record(z.coerce.number().min(0)).optional(),
  })
  .refine((d) => d.month || d.billingMonth, {
    message: "Provide a billing month (month or billingMonth) in YYYY-MM format",
  });
