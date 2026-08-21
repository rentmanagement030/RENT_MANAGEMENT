import { z } from "zod";
import { amountSchema } from "./common";

export const propertyCreateSchema = z.object({
  type: z.enum(["HOUSE", "PG", "VILLA", "MULTI_UNIT_HOUSE", "APARTMENT"]),
  name: z.string().min(2).max(150),
  number: z.string().max(50).optional().or(z.literal("")),
  address: z.string().min(5).max(300),
  city: z.string().min(2).max(100),
  area: z.string().max(100).optional().or(z.literal("")),
  rent: z.coerce.number().min(0).optional().default(0),
  advance: z.coerce.number().min(0).optional().default(0),
  deposit: z.coerce.number().min(0).optional().default(0),
  dueDay: z.coerce.number().int().min(1).max(31).optional().default(5),
  latePenalty: z.coerce.number().min(0).optional().default(50),
  status: z.enum(["AVAILABLE", "OCCUPIED", "MAINTENANCE"]).optional(),
  description: z.string().max(3000).optional().or(z.literal("")),
  amenities: z.array(z.string().max(100)).max(50).optional().default([]),
  publicVisibility: z.boolean().optional().default(false),
  contactPhone: z.string().max(20).optional().or(z.literal("")),
  bhkType: z.string().max(50).optional().or(z.literal("")),
  maxCapacity: z.coerce.number().int().min(1).max(1000).optional(),
  ebNumber: z.string().max(50).optional().or(z.literal("")),
});

export const propertyUpdateSchema = propertyCreateSchema.partial();

export const propertyImageSchema = z.object({
  url: z.string().min(1).max(2000),
  storageKey: z.string().max(500).nullable().optional(),
  isPrimary: z.boolean().optional(),
  type: z.enum(["GALLERY", "FLOOR_PLAN", "EXTERIOR", "OTHER"]).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export const setPropertyImagesSchema = z.object({
  images: z.array(propertyImageSchema).max(30),
});

export const pgRoomCreateSchema = z.object({
  propertyId: z.string().min(1),
  floor: z.string().max(50).optional().or(z.literal("")),
  roomNumber: z.string().min(1).max(50),
  capacity: z.coerce.number().int().min(1).max(50).optional().default(1),
  rent: z.coerce.number().min(0).nullable().optional(),
  advance: z.coerce.number().min(0).nullable().optional(),
  deposit: z.coerce.number().min(0).nullable().optional(),
});

export const pgRoomUpdateSchema = pgRoomCreateSchema.partial();

export const pgBedCreateSchema = z.object({
  roomId: z.string().min(1),
  bedNumber: z.string().min(1).max(50),
  rent: z.coerce.number().min(0).nullable().optional(),
  advance: z.coerce.number().min(0).nullable().optional(),
  deposit: z.coerce.number().min(0).nullable().optional(),
});

export const pgBedUpdateSchema = z.object({
  bedNumber: z.string().min(1).max(50).optional(),
  rent: z.coerce.number().min(0).nullable().optional(),
  advance: z.coerce.number().min(0).nullable().optional(),
  deposit: z.coerce.number().min(0).nullable().optional(),
  status: z.enum(["AVAILABLE", "OCCUPIED", "MAINTENANCE"]).optional(),
  tenantId: z.string().min(1).nullable().optional(),
});
