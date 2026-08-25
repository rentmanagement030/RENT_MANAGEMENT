import type { Request, Response } from "express";
import { asyncHandler, ok, ValidationError } from "../utils/http";
import * as rentService from "../services/rent.service";
import { ensureRentBill } from "../services/bill.service";
import { getSettings } from "../services/settings.service";
import { prisma } from "../config/prisma";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await rentService.listRentRecords(req.query);
  return ok(res, result);
});

export const get = asyncHandler(async (req: Request, res: Response) => {
  const record = await rentService.getRentRecord(req.params.id);
  return ok(res, { record });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const record = await rentService.createRentRecord(req.body, req, req.user!.id);
  await ensureRentBill(prisma, record.id, req.user?.id).catch(() => null);
  return ok(res, { record }, 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const record = await rentService.updateRentRecord(req.params.id, req.body, req, req.user!.id);
  return ok(res, { record });
});

export const adjust = asyncHandler(async (req: Request, res: Response) => {
  const record = await rentService.addRentAdjustment(req.params.id, req.body, req, req.user!.id);
  return ok(res, { record });
});

export const generateMonth = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as {
    month?: string;
    billingMonth?: string;
  };
  const billingMonth = body.billingMonth ?? body.month;
  if (billingMonth) {
    const [y, m] = billingMonth.split("-").map((n) => Number(n));
    if (!y || !m || m < 1 || m > 12) {
      throw new ValidationError([{ path: "billingMonth", message: "Invalid billing month, expected YYYY-MM" }]);
    }
  }

  const result = await rentService.autoGenerateMonthlyRent(billingMonth, req.user?.id);
  return ok(res, result);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const result = await rentService.deleteRentRecord(req.params.id, req, req.user!.id);
  return ok(res, result);
});

