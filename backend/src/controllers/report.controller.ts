import type { Request, Response } from "express";
import { asyncHandler, ok } from "../utils/http";
import * as reportService from "../services/report.service";
import * as dashboardService from "../services/dashboard.service";
import * as financialService from "../services/financial.service";

export const dashboard = asyncHandler(async (_req: Request, res: Response) => {
  const data = await dashboardService.getDashboard();
  return ok(res, data);
});

export const collection = asyncHandler(async (req: Request, res: Response) => {
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;
  const data = await reportService.collectionSummary({
    from,
    to,
    tenantId: req.query.tenantId ? String(req.query.tenantId) : undefined,
    propertyId: req.query.propertyId ? String(req.query.propertyId) : undefined,
    method: req.query.method ? String(req.query.method) as never : undefined,
  });
  return ok(res, data);
});

export const exportCollection = asyncHandler(async (req: Request, res: Response) => {
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;
  const buffer = await reportService.exportCollectionExcel({
    from,
    to,
    tenantId: req.query.tenantId ? String(req.query.tenantId) : undefined,
    propertyId: req.query.propertyId ? String(req.query.propertyId) : undefined,
    method: req.query.method ? String(req.query.method) as never : undefined,
  });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="payments-collection.xlsx"');
  res.send(buffer);
});

export const outstanding = asyncHandler(async (_req: Request, res: Response) => {
  const data = await reportService.outstandingReport();
  return ok(res, data);
});

export const propertyPerformance = asyncHandler(async (_req: Request, res: Response) => {
  const data = await reportService.propertyPerformanceReport();
  return ok(res, data);
});

export const tenantLedger = asyncHandler(async (req: Request, res: Response) => {
  const data = await reportService.tenantLedgerReport(req.params.tenantId);
  return ok(res, data);
});

export const methodTotals = asyncHandler(async (req: Request, res: Response) => {
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;
  const data = await reportService.collectionSummary({ from, to });
  return ok(res, data);
});

export const bills = asyncHandler(async (req: Request, res: Response) => {
  const data = await reportService.billsReport({
    billingMonth: req.query.billingMonth ? String(req.query.billingMonth) : undefined,
    billType: req.query.billType ? String(req.query.billType) as never : undefined,
    status: req.query.status ? String(req.query.status) as never : undefined,
    tenantId: req.query.tenantId ? String(req.query.tenantId) : undefined,
    propertyId: req.query.propertyId ? String(req.query.propertyId) : undefined,
  });
  return ok(res, data);
});

export const exportBills = asyncHandler(async (req: Request, res: Response) => {
  const buffer = await reportService.exportBillsExcel({
    billingMonth: req.query.billingMonth ? String(req.query.billingMonth) : undefined,
    billType: req.query.billType ? String(req.query.billType) as never : undefined,
    status: req.query.status ? String(req.query.status) as never : undefined,
    tenantId: req.query.tenantId ? String(req.query.tenantId) : undefined,
    propertyId: req.query.propertyId ? String(req.query.propertyId) : undefined,
  });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="bills.xlsx"');
  res.send(buffer);
});

export const exportOutstanding = asyncHandler(async (_req: Request, res: Response) => {
  const buffer = await reportService.exportOutstandingExcel();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="outstanding.xlsx"');
  res.send(buffer);
});

export const exportTenantLedger = asyncHandler(async (req: Request, res: Response) => {
  const buffer = await reportService.exportTenantLedgerExcel(req.params.tenantId);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="tenant-ledger.xlsx"');
  res.send(buffer);
});

export const profitability = asyncHandler(async (req: Request, res: Response) => {
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;
  const propertyId = req.query.propertyId ? String(req.query.propertyId) : undefined;
  const billingMonth = req.query.billingMonth ? String(req.query.billingMonth) : undefined;
  const data = await financialService.getPropertyProfitabilityEngine({ propertyId, from, to, billingMonth });
  return ok(res, data);
});

export const pnl = asyncHandler(async (req: Request, res: Response) => {
  const billingMonth = req.query.billingMonth ? String(req.query.billingMonth) : undefined;
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;
  const propertyId = req.query.propertyId ? String(req.query.propertyId) : undefined;
  const data = await financialService.getAccountingPnL({ billingMonth, from, to, propertyId });
  return ok(res, data);
});

export const reconciliation = asyncHandler(async (req: Request, res: Response) => {
  const billingMonth = req.query.billingMonth ? String(req.query.billingMonth) : undefined;
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;
  const propertyId = req.query.propertyId ? String(req.query.propertyId) : undefined;
  const data = await financialService.reconcileFinancialData({ billingMonth, from, to, propertyId });
  return ok(res, data);
});
