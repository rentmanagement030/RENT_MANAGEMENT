import { z } from "zod";
import { amountSchema, dateSchema, zodId } from "./common";

export const billAllocationSchema = z.object({
  billId: zodId.optional().or(z.literal("")),
  rentRecordId: zodId.optional().or(z.literal("")),
  amount: amountSchema,
});

export const cashPaymentSchema = z.object({
  tenantId: zodId,
  rentRecordId: zodId.optional().or(z.literal("")),
  amount: amountSchema,
  paymentDate: dateSchema.optional(),
  cashAmount: z.number().min(0).optional(),
  upiAmount: z.number().min(0).optional(),
  upiApp: z.string().max(50).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
  waivePenalty: z.boolean().optional(),
  allocations: z.array(billAllocationSchema).max(20).optional(),
});

export const bankPaymentSchema = z.object({
  tenantId: zodId,
  rentRecordId: zodId.optional().or(z.literal("")),
  amount: amountSchema,
  paymentDate: dateSchema.optional(),
  bankName: z.string().min(2).max(100),
  bankReferenceNumber: z.string().max(100).optional().or(z.literal("")),
  ddNumber: z.string().max(100).optional().or(z.literal("")),
  ddDate: dateSchema.optional(),
  notes: z.string().max(1000).optional().or(z.literal("")),
  waivePenalty: z.boolean().optional(),
  allocations: z.array(billAllocationSchema).max(20).optional(),
}).refine(
  (d) => d.bankReferenceNumber || d.ddNumber,
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
