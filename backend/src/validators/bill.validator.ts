import { z } from "zod";
import { amountSchema, dateSchema, zodId } from "./common";

export const billCreateSchema = z.object({
  tenantId: zodId,
  propertyId: zodId,
  billType: z.enum(["EB", "MAINTENANCE", "WATER", "OTHER"]),
  billingMonth: z.string().regex(/^\d{4}-\d{2}$/, "Expected YYYY-MM"),
  dueDate: dateSchema,
  graceDate: dateSchema.optional(),
  amount: amountSchema,
  notes: z.string().max(1000).optional().or(z.literal("")),
  items: z
    .array(
      z.object({
        description: z.string().min(1).max(300),
        quantity: z.coerce.number().min(0).optional(),
        unitPrice: z.coerce.number().min(0).optional(),
        amount: amountSchema,
      }),
    )
    .max(50)
    .optional(),
});

export const billUpdateSchema = z.object({
  dueDate: dateSchema.optional(),
  graceDate: dateSchema.optional(),
  amount: amountSchema.optional(),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export const generateMonthSchema = z.object({
  billingMonth: z.string().regex(/^\d{4}-\d{2}$/, "Expected YYYY-MM"),
});

export const billBatchSchema = z.object({
  billingMonth: z.string().regex(/^\d{4}-\d{2}$/, "Expected YYYY-MM"),
  bills: z.array(billCreateSchema.omit({ propertyId: true, billingMonth: true })).min(1).max(100),
});
