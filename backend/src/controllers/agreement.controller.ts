import type { Request, Response } from "express";
import { asyncHandler, ok } from "../utils/http";
import { privateStorageKey } from "../middleware/upload";
import * as agreementService from "../services/agreement.service";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await agreementService.listAgreements(req.query);
  return ok(res, result);
});

export const stats = asyncHandler(async (req: Request, res: Response) => {
  const propertyId = req.query.propertyId ? String(req.query.propertyId) : undefined;
  const tenantId = req.query.tenantId ? String(req.query.tenantId) : undefined;
  const result = await agreementService.getAgreementStats({ propertyId, tenantId });
  return ok(res, { stats: result });
});

export const get = asyncHandler(async (req: Request, res: Response) => {
  const agreement = await agreementService.getAgreement(req.params.id);
  return ok(res, { agreement });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const agreement = await agreementService.createAgreement(req.body, req, req.user!.id);
  return ok(res, { agreement }, 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const agreement = await agreementService.updateAgreement(req.params.id, req.body, req, req.user!.id);
  return ok(res, { agreement });
});

export const uploadDocument = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) {
    return res.status(400).json({ success: false, error: "No file uploaded" });
  }
  const agreement = await agreementService.setAgreementDocument(
    req.params.id,
    {
      storageKey: privateStorageKey(file),
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    },
    req,
    req.user!.id,
  );
  return ok(res, { agreement });
});

export const removeDocument = asyncHandler(async (req: Request, res: Response) => {
  const agreement = await agreementService.removeAgreementDocument(req.params.id, req, req.user!.id);
  return ok(res, { agreement });
});

export const sendForSigning = asyncHandler(async (req: Request, res: Response) => {
  const result = await agreementService.sendAgreementForSigning(req.params.id, 7, req, req.user!.id);
  return ok(res, result);
});

export const revokeSigning = asyncHandler(async (req: Request, res: Response) => {
  const agreement = await agreementService.revokeAgreementSigning(req.params.id, req, req.user!.id);
  return ok(res, { agreement });
});

export const cancel = asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body;
  if (!reason || typeof reason !== "string" || !reason.trim()) {
    return res.status(400).json({ success: false, error: "Cancellation reason is required" });
  }
  const agreement = await agreementService.cancelAgreement(req.params.id, reason.trim(), req, req.user!.id);
  return ok(res, { agreement });
});

export const getDocument = asyncHandler(async (req: Request, res: Response) => {
  const file = await agreementService.getAgreementDocumentFile(req.params.id);
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Content-Length", String(file.buffer.length));
  res.setHeader("Content-Disposition", `inline; filename="${file.filename}"`);
  return res.send(file.buffer);
});

export const getSignedDocument = asyncHandler(async (req: Request, res: Response) => {
  const file = await agreementService.getAgreementSignedPdfFile(req.params.id);
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Content-Length", String(file.buffer.length));
  res.setHeader("Content-Disposition", `inline; filename="${file.filename}"`);
  return res.send(file.buffer);
});
