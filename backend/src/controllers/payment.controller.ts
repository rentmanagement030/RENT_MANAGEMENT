import type { Request, Response } from "express";
import { asyncHandler, ok } from "../utils/http";
import * as paymentService from "../services/payment.service";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await paymentService.listPayments(req.query);
  return ok(res, result);
});

export const get = asyncHandler(async (req: Request, res: Response) => {
  const payment = await paymentService.getPayment(req.params.id);
  return ok(res, { payment });
});

export const recordCash = asyncHandler(async (req: Request, res: Response) => {
  const payment = await paymentService.recordManualPayment(
    {
      tenantId: req.body.tenantId,
      rentRecordId: req.body.rentRecordId,
      amount: req.body.amount,
      paymentDate: req.body.paymentDate ? new Date(req.body.paymentDate) : new Date(),
      method: req.body.cashAmount && req.body.upiAmount ? "MIXED" : req.body.upiAmount ? "UPI" : "CASH",
      cashAmount: req.body.cashAmount,
      upiAmount: req.body.upiAmount,
      upiApp: req.body.upiApp,
      notes: req.body.notes,
      allocations: req.body.allocations,
    },
    req,
    req.user!.id,
  );
  return ok(res, { payment }, 201);
});

export const recordBank = asyncHandler(async (req: Request, res: Response) => {
  const payment = await paymentService.recordManualPayment(
    {
      tenantId: req.body.tenantId,
      rentRecordId: req.body.rentRecordId,
      amount: req.body.amount,
      paymentDate: req.body.paymentDate ? new Date(req.body.paymentDate) : new Date(),
      method: "BANK_TRANSFER_DD",
      notes: req.body.notes,
      bankName: req.body.bankName,
      bankReferenceNumber: req.body.bankReferenceNumber,
      ddNumber: req.body.ddNumber,
      ddDate: req.body.ddDate ? new Date(req.body.ddDate) : undefined,
      allocations: req.body.allocations,
    },
    req,
    req.user!.id,
  );
  return ok(res, { payment }, 201);
});

export const verifyBank = asyncHandler(async (req: Request, res: Response) => {
  const payment = await paymentService.verifyBankPayment(
    req.params.id,
    req.body.status,
    req,
    req.user!.id,
  );
  return ok(res, { payment });
});

export const outstanding = asyncHandler(async (req: Request, res: Response) => {
  const result = await paymentService.listOutstanding(req.query);
  return ok(res, result);
});

export const reconcile = asyncHandler(async (_req: Request, res: Response) => {
  const result = await paymentService.reconcileRazorpay();
  return ok(res, result);
});

export const methodTotals = asyncHandler(async (req: Request, res: Response) => {
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;
  const totals = await paymentService.getPaymentMethodsTotals(from, to);
  return ok(res, { totals });
});

export const receipt = asyncHandler(async (req: Request, res: Response) => {
  const { generateReceiptPdf } = await import("../services/receipt.service");
  const pdf = await generateReceiptPdf(req.params.id);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="receipt-${req.params.id}.pdf"`);
  res.send(pdf);
});

export const excelExport = asyncHandler(async (req: Request, res: Response) => {
  const { exportCollectionExcel } = await import("../services/report.service");
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;
  const buffer = await exportCollectionExcel({
    from,
    to,
    tenantId: req.query.tenantId ? String(req.query.tenantId) : undefined,
    propertyId: req.query.propertyId ? String(req.query.propertyId) : undefined,
    method: req.query.method ? String(req.query.method) as never : undefined,
  });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="collections.xlsx"');
  res.send(buffer);
});
