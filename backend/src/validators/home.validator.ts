import { z } from "zod";
import { zodId } from "./common";

export const createHomeSchema = z.object({
  propertyId: zodId,
  floor: z.string().min(1, "Floor is required (e.g., Ground Floor, First Floor)"),
  homeNumber: z.string().min(1, "Home number is required (e.g., G-01, F-01)"),
  homeType: z.enum(["1 BHK", "2 BHK", "3 BHK", "4 BHK", "Studio", "Penthouse", "Independent House", "INDEPENDENT_FLOOR", "Independent Floor", "Other"]).default("2 BHK"),
  builtUpArea: z.number().int().positive().optional().nullable(),
  bedrooms: z.number().int().positive().optional().nullable(),
  bathrooms: z.number().int().positive().optional().nullable(),
  rent: z.number().positive("Rent must be positive"),
  advance: z.number().nonnegative().default(0),
  deposit: z.number().nonnegative().default(0),
  dueDay: z.number().int().min(1).max(31).default(5),
  latePenalty: z.number().nonnegative().default(50),
  status: z.enum(["AVAILABLE", "OCCUPIED", "RESERVED", "MAINTENANCE", "INACTIVE"]).default("AVAILABLE"),

  ebConnectionType: z.enum(["INDIVIDUAL", "SHARED_PROPERTY"]).optional().nullable(),
  ebNumber: z.string().optional().nullable(),
  ebMeterNumber: z.string().optional().nullable(),
  ebConnectionName: z.string().optional().nullable(),
  ebCurrentReading: z.number().optional().nullable(),

  waterConnectionType: z.enum(["INDIVIDUAL", "SHARED_PROPERTY"]).optional().nullable(),
  waterConsumerNumber: z.string().optional().nullable(),
  waterMeterNumber: z.string().optional().nullable(),
  waterConnectionName: z.string().optional().nullable(),
  waterCurrentReading: z.number().optional().nullable(),
  imageUrls: z.array(z.string()).optional(),
});

export const updateHomeSchema = createHomeSchema.partial().omit({ propertyId: true });

export type CreateHomeInput = z.infer<typeof createHomeSchema>;
export type UpdateHomeInput = z.infer<typeof updateHomeSchema>;
