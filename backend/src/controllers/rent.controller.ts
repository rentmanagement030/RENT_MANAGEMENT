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
    dueDate?: Date;
    rentOverride?: Record<string, number>;
  };
  const billingMonth = body.billingMonth ?? body.month;
  if (!billingMonth) {
    throw new ValidationError([{ path: "billingMonth", message: "billingMonth is required (YYYY-MM)" }]);
  }
  const [y, m] = billingMonth.split("-").map((n) => Number(n));
  if (!y || !m || m < 1 || m > 12) {
    throw new ValidationError([{ path: "billingMonth", message: "Invalid billing month, expected YYYY-MM" }]);
  }
  const { billingDueDay } = await getSettings(false);
  const dueDate = body.dueDate ?? new Date(y, m - 1, Number(billingDueDay ?? 5));

  const activeTenants = await prisma.tenant.findMany({ where: { status: "ACTIVE" } });
  const created: string[] = [];
  const skipped: string[] = [];
  for (const tenant of activeTenants) {
    if (!tenant.propertyId) continue;
    try {
      const record = await rentService.createRentRecord(
        {
          tenantId: tenant.id,
          propertyId: tenant.propertyId,
          billingMonth,
          dueDate,
          rent: body.rentOverride?.[tenant.id] ?? tenant.rent.toNumber(),
        },
        req,
        req.user!.id,
      );
      await ensureRentBill(prisma, record.id, req.user?.id).catch(() => null);
      created.push(record.id);
    } catch {
      skipped.push(tenant.id);
    }
  }
  return ok(res, { created: created.length, skipped: skipped.length });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const result = await rentService.deleteRentRecord(req.params.id, req, req.user!.id);
  return ok(res, result);
});

