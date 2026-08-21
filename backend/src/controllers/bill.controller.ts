import type { Request, Response } from "express";
import { asyncHandler, ok } from "../utils/http";
import * as billService from "../services/bill.service";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await billService.listBills(req.query);
  return ok(res, result);
});

export const get = asyncHandler(async (req: Request, res: Response) => {
  const bill = await billService.getBill(req.params.id);
  return ok(res, { bill });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const bill = await billService.createBill(req.body, req, req.user!.id);
  return ok(res, { bill }, 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const bill = await billService.updateBill(req.params.id, req.body, req, req.user!.id);
  return ok(res, { bill });
});

export const cancel = asyncHandler(async (req: Request, res: Response) => {
  if (req.query.permanent === "true") {
    const result = await billService.deleteBillPermanently(req.params.id, req, req.user!.id);
    return ok(res, result);
  }
  const bill = await billService.cancelBill(req.params.id, req, req.user!.id);
  return ok(res, { bill });
});

export const removePermanently = asyncHandler(async (req: Request, res: Response) => {
  const result = await billService.deleteBillPermanently(req.params.id, req, req.user!.id);
  return ok(res, result);
});

export const generateMonth = asyncHandler(async (req: Request, res: Response) => {
  const { billingMonth } = req.body as { billingMonth: string };
  const result = await billService.generateMonthlyBills(billingMonth, req, req.user!.id);
  return ok(res, result);
});

export const batch = asyncHandler(async (req: Request, res: Response) => {
  const { billingMonth, bills } = req.body as { billingMonth: string; bills: unknown[] };
  const result = await billService.createBillsBatch(
    billingMonth,
    bills as Parameters<typeof billService.createBillsBatch>[1],
    req,
    req.user!.id,
  );
  return ok(res, result, 201);
});

export const penalty = asyncHandler(async (req: Request, res: Response) => {
  const bill = await billService.applyPenaltyToBill(req.params.id, req, req.user!.id);
  return ok(res, { bill });
});

export const waivePenalty = asyncHandler(async (req: Request, res: Response) => {
  const bill = await billService.waivePenalty(req.params.id, req, req.user!.id);
  return ok(res, { bill });
});

export const summary = asyncHandler(async (req: Request, res: Response) => {
  const result = await billService.billSummary(req.query);
  return ok(res, result);
});
