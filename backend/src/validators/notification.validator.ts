import { z } from "zod";
import { zodId } from "./common";

export const notificationSendSchema = z
  .object({
    tenantId: zodId.optional(),
    to: z
      .union([z.string().min(3).max(100), z.literal("")])
      .optional()
      .transform((v) => v || undefined),
    channel: z.enum(["WHATSAPP", "EMAIL", "SMS"]),
    subject: z
      .string()
      .max(200)
      .optional()
      .transform((v) => v || undefined),
    body: z.string().min(1).max(5000),
    type: z.enum([
      "RENT_DUE",
      "RENT_OVERDUE",
      "PAYMENT_CONFIRMATION",
      "PAYMENT_LINK",
      "AGREEMENT_EXPIRY",
      "GENERAL",
    ]),
  })
  .refine((d) => d.tenantId || d.to, {
    message: "Provide a tenantId or an explicit recipient",
  });
