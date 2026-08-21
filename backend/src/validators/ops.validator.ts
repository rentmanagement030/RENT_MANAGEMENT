import { z } from "zod";
import { amountSchema, dateSchema, zodId } from "./common";

export const maintenanceCreateSchema = z.object({
  propertyId: zodId,
  roomId: z
    .union([zodId, z.literal("")])
    .optional()
    .transform((v) => v || undefined),
  category: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  assignedStaffId: z
    .union([zodId, z.literal("")])
    .optional()
    .transform((v) => v || undefined),
  assignedVendorId: z
    .union([zodId, z.literal("")])
    .optional()
    .transform((v) => v || undefined),
  estimatedCost: z.number().nonnegative().optional(),
  description: z.string().min(3).max(1000),
});

export const maintenanceUpdateSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]).optional(),
  category: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  assignedStaffId: z
    .union([zodId, z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" ? null : v)),
  assignedVendorId: z
    .union([zodId, z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" ? null : v)),
  estimatedCost: z.number().nonnegative().nullish(),
  actualCost: z.number().nonnegative().nullish(),
  createExpense: z.boolean().optional(),
  expenseCategory: z.string().optional(),
});

export const expenseCreateSchema = z.object({
  propertyId: z
    .union([zodId, z.literal("")])
    .optional()
    .transform((v) => v || undefined),
  category: z.string().min(2).max(100),
  description: z.string().min(3).max(1000),
  amount: amountSchema,
  expenseDate: dateSchema.optional(),
});
