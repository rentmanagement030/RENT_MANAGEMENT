import { z } from "zod";
import { amountSchema, dateSchema, zodId } from "./common";

export const billAllocationSchema = z.object({
  billId: zodId.optional().nullable().or(z.literal("")),
  rentRecordId: zodId.optional().nullable().or(z.literal("")),
  amount: z.coerce.number().min(0).max(9999999999),
});

export const cashPaymentSchema = z.object({
  tenantId: zodId,
  rentRecordId: zodId.optional().nullable().or(z.literal("")),
  amount: amountSchema,
  paymentDate: dateSchema.optional().nullable(),
  cashAmount: z.coerce.number().min(0).optional().nullable(),
  upiAmount: z.coerce.number().min(0).optional().nullable(),
  upiApp: z.string().max(50).optional().nullable().or(z.literal("")),
  notes: z.string().max(1000).optional().nullable().or(z.literal("")),
  waivePenalty: z.boolean().optional().nullable(),
  allocations: z.array(billAllocationSchema).max(50).optional().nullable(),
});

export const bankPaymentSchema = z.object({
  tenantId: zodId,
  rentRecordId: zodId.optional().nullable().or(z.literal("")),
  amount: amountSchema,
  paymentDate: dateSchema.optional().nullable(),
  bankName: z.string().min(2).max(100),
  bankReferenceNumber: z.string().max(100).optional().nullable().or(z.literal("")),
  ddNumber: z.string().max(100).optional().nullable().or(z.literal("")),
  ddDate: dateSchema.optional().nullable(),
  notes: z.string().max(1000).optional().nullable().or(z.literal("")),
  waivePenalty: z.boolean().optional().nullable(),
  allocations: z.array(billAllocationSchema).max(50).optional().nullable(),
}).refine(
  (d) => (d.bankReferenceNumber && d.bankReferenceNumber.trim().length > 0) || (d.ddNumber && d.ddNumber.trim().length > 0),
  { message: "Provide either a bank reference number or DD number" },
);

export const razorpayOrderSchema = z.object({
  tenantId: zodId,
  rentRecordId: zodId.optional(),
  billId: zodId.optional(),
  amount: amountSchema.optional(),
  notes: z.string().max(1000).optional().or(z.literal("")),
}).refine(
  (d) => d.rentRecordId || d.billId,
  { message: "Provide either a rent record or a bill to pay" },
);

export const verifyBankPaymentSchema = z.object({
  status: z.enum(["VERIFIED", "REJECTED"]),
  notes: z.string().max(1000).optional().or(z.literal("")),
});
