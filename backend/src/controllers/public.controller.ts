import type { Request, Response } from "express";
import { asyncHandler, ok } from "../utils/http";
import * as publicService from "../services/public.service";

export const properties = asyncHandler(async (req: Request, res: Response) => {
  const result = await publicService.listPublicProperties(req.query);
  return ok(res, result);
});

export const property = asyncHandler(async (req: Request, res: Response) => {
  const result = await publicService.getPublicProperty(req.params.id);
  return ok(res, { property: result });
});

export const cities = asyncHandler(async (_req: Request, res: Response) => {
  const result = await publicService.getPublicCities();
  return ok(res, { cities: result });
});

export const info = asyncHandler(async (_req: Request, res: Response) => {
  const result = await publicService.getPublicInfo();
  return ok(res, { settings: result });
});

export const contact = asyncHandler(async (req: Request, res: Response) => {
  const result = await publicService.submitContactForm(req.body, req);
  return ok(res, result, 201);
});

export const enquiry = asyncHandler(async (req: Request, res: Response) => {
  const result = await publicService.createPublicEnquiry(req.body, req);
  return ok(res, result, 201);
});

export const getAgreementForSigning = asyncHandler(async (req: Request, res: Response) => {
  const { getAgreementByToken } = await import("../services/agreement.service");
  const agreement = await getAgreementByToken(req.params.token);
  return ok(res, { agreement });
});

export const signAgreement = asyncHandler(async (req: Request, res: Response) => {
  const { signAgreementByToken } = await import("../services/agreement.service");
  const agreement = await signAgreementByToken(req.params.token, req.body, req);
  return ok(res, { agreement });
});

export const health = asyncHandler(async (_req: Request, res: Response) => {
  const { prisma } = await import("../config/prisma");
  let db = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = "error";
  }
  return res.status(db === "ok" ? 200 : 503).json({
    success: db === "ok",
    status: "ok",
    database: db,
    timestamp: new Date().toISOString(),
  });
});
