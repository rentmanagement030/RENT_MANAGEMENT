import { z } from "zod";
import { emailSchema, optionalPhoneSchema } from "./common";

export const loginSchema = z.object({
  email: z.string().email().max(190),
  password: z.string().min(6).max(200),
});

export const firebaseLoginSchema = z.object({
  idToken: z.string().min(10, "Firebase ID token is required"),
});

export const resetPasswordRequestSchema = z.object({
  email: z.string().email().max(190),
});

export const resetPasswordConfirmSchema = z.object({
  token: z.string().min(10).max(512),
  password: z.string().min(8).max(200),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(200),
});

export const createUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: emailSchema.transform((v) => (v ? v.toLowerCase() : undefined)),
  phone: optionalPhoneSchema,
  password: z.string().min(8).max(200),
  roleNames: z.array(z.string()).min(1),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: optionalPhoneSchema,
  status: z.enum(["ACTIVE", "INACTIVE", "LOCKED"]).optional(),
  roleNames: z.array(z.string()).min(1).optional(),
  resetPassword: z.string().min(8).max(200).optional(),
});
