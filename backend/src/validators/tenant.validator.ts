import { z } from "zod";
import { amountSchema, dateSchema, optionalAadhaarSchema, optionalEmailSchema, optionalPhoneSchema, phoneSchema } from "./common";

export const tenantCreateSchema = z.object({
  name: z.string().min(2).max(100),
  phone: phoneSchema,
  email: optionalEmailSchema,
  address: z.string().max(500).optional().or(z.literal("")),
  aadhaarNumber: optionalAadhaarSchema,
  emergencyName: z.string().max(100).optional().or(z.literal("")),
  emergencyPhone: optionalPhoneSchema,
  propertyId: z.string().min(1).optional().or(z.literal("")),
  homeId: z.string().min(1).optional().or(z.literal("")),
  roomId: z.string().min(1).optional().or(z.literal("")),
  bedId: z.string().min(1).optional().or(z.literal("")),
  rent: amountSchema,
  advance: z.coerce.number().min(0).optional().default(0),
  deposit: z.coerce.number().min(0).optional().default(0),
  joiningDate: dateSchema.optional(),
  dueDay: z.coerce.number().min(1).max(31).optional().default(5),
  status: z.enum(["ACTIVE", "INACTIVE", "FORMER", "PENDING"]).optional(),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export const tenantUpdateSchema = tenantCreateSchema.partial();

export const tenantDocumentSchema = z.object({
  type: z.preprocess((val) => {
    if (typeof val !== "string") return val;
    const upper = val.toUpperCase().trim();
    if (upper === "DRIVING_LICENCE" || upper === "DRIVING LICENSE" || upper === "DL") return "DRIVING_LICENSE";
    if (upper === "RENTAL_AGREEMENT" || upper === "RENT_AGREEMENT" || upper === "LEASE_AGREEMENT") return "AGREEMENT";
    if (upper === "PASSPORT_PHOTO" || upper === "PROFILE_PHOTO") return "PHOTO";
    return upper;
  }, z.enum(["AADHAAR", "PAN", "PASSPORT", "DRIVING_LICENSE", "AGREEMENT", "PHOTOGRAPH", "PHOTO", "OTHER"])),
});

export const familyMemberCreateSchema = z.object({
  name: z.string().min(2).max(100),
  relation: z.string().min(2).max(50),
  phone: optionalPhoneSchema,
  age: z.coerce.number().int().min(0).max(150).optional(),
  occupation: z.string().max(100).optional().or(z.literal("")),
  isDependent: z.boolean().optional().default(false),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export const familyMemberUpdateSchema = familyMemberCreateSchema.partial();

export const tenantTransferSchema = z.object({
  toPropertyId: z.string().min(1, "Target property is required"),
  toHomeId: z.string().optional().or(z.literal("")),
  toRoomId: z.string().optional().or(z.literal("")),
  toBedId: z.string().optional().or(z.literal("")),
  toRent: amountSchema,
  transferDate: dateSchema,
  reason: z.string().min(2, "Reason for transfer is required").max(500),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export const kycVerifySchema = z.object({
  status: z.enum(["VERIFIED", "REJECTED"]),
  rejectionReason: z.string().max(500).optional().or(z.literal("")),
});

