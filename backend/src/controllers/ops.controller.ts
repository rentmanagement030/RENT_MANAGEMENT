import type { Request, Response } from "express";
import { asyncHandler, ok } from "../utils/http";
import * as maintenanceService from "../services/maintenance.service";
import * as expenseService from "../services/expense.service";
import { computeExpenseBreakdown } from "../financial/expense.engine";

export const maintenanceList = asyncHandler(async (req: Request, res: Response) => {
  const result = await maintenanceService.listMaintenance(req.query);
  return ok(res, result);
});

export const maintenanceCreate = asyncHandler(async (req: Request, res: Response) => {
  const item = await maintenanceService.createMaintenanceRequest(req.body, req, req.user!.id);
  return ok(res, { item }, 201);
});

export const maintenanceUpdate = asyncHandler(async (req: Request, res: Response) => {
  const item = await maintenanceService.updateMaintenanceStatus(
    req.params.id,
    typeof req.body === "string" ? { status: req.body as any } : req.body,
    req,
    req.user!.id,
  );
  return ok(res, { item });
});

export const expenseList = asyncHandler(async (req: Request, res: Response) => {
  const result = await expenseService.listExpenses(req.query);
  return ok(res, result);
});

export const expenseSummary = asyncHandler(async (req: Request, res: Response) => {
  const summary = await computeExpenseBreakdown(req.query as any);
  return ok(res, summary);
});

export const expenseCreate = asyncHandler(async (req: Request, res: Response) => {
  const expense = await expenseService.createExpense(req.body, req, req.user!.id);
  return ok(res, { expense }, 201);
});
