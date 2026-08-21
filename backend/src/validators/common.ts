import { z } from "zod";

export const idSchema = z.string().min(1).max(64);

export const zodId = z.string().min(1).max(64);

const normalizeIndianPhone = (v: string): string => {
  const digits = v.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
};

const isIndianPhone = (v: string): boolean => /^[6-9]\d{9}$/.test(v);

/** Required phone number. Normalizes +91 / leading-0 prefixes and formats. */
export const phoneSchema = z
  .string()
  .trim()
  .transform(normalizeIndianPhone)
  .refine(isIndianPhone, "Enter a valid 10-digit Indian phone number");

/** Optional phone number — empty string or undefined are allowed. */
export const optionalPhoneSchema = z
  .string()
  .trim()
  .transform((v) => {
    const digits = normalizeIndianPhone(v);
    return digits.length === 0 ? "" : digits;
  })
  .refine((v) => v === "" || isIndianPhone(v), "Enter a valid 10-digit Indian phone number")
  .optional();

export const emailSchema = z.string().email().max(190).optional().or(z.literal(""));

/** Optional email — empty string or undefined are allowed, with a clear error message. */
export const optionalEmailSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email address")
  .optional();

/** Optional 12-digit Aadhaar — strips spaces/dashes, empty string or undefined allowed. */
export const optionalAadhaarSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .refine((v) => v === "" || /^\d{12}$/.test(v), "Enter a valid 12-digit Aadhaar")
  .optional();

export const amountSchema = z.coerce.number().min(0.01).max(9999999999);

export const paginationSchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(500).optional().default(20),
    search: z.string().trim().max(100).optional().default(""),
    sortBy: z.string().trim().max(50).optional().default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  })
  .passthrough();

export const dateSchema = z.coerce.date();
