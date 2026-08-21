import type { Request, Response } from "express";
import { asyncHandler, ok } from "../utils/http";
import * as auditService from "../services/audit.service";
import * as settingsService from "../services/settings.service";

export const auditList = asyncHandler(async (req: Request, res: Response) => {
  const result = await auditService.listAuditLogs(req.query);
  return ok(res, result);
});

export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await settingsService.getSettings(false);
  return ok(res, { settings });
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await settingsService.updateSettings(req.body, req, req.user!.id);
  return ok(res, { settings });
});
