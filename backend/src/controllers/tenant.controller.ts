import type { Request, Response } from "express";
import { asyncHandler, ok } from "../utils/http";
import * as tenantService from "../services/tenant.service";
import { privateStorageKey, uploadToCloudinary } from "../middleware/upload";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await tenantService.listTenants(req.query);
  return ok(res, result);
});

export const stats = asyncHandler(async (req: Request, res: Response) => {
  const propertyId = req.query.propertyId ? String(req.query.propertyId) : undefined;
  const result = await tenantService.getTenantStats(propertyId);
  return ok(res, { stats: result });
});

export const get = asyncHandler(async (req: Request, res: Response) => {
  const tenant = await tenantService.getTenant(req.params.id);
  return ok(res, { tenant });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const tenant = await tenantService.createTenant(req.body, req, req.user!.id);
  return ok(res, { tenant }, 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const tenant = await tenantService.updateTenant(req.params.id, req.body, req, req.user!.id);
  return ok(res, { tenant });
});

export const markFormer = asyncHandler(async (req: Request, res: Response) => {
  const tenant = await tenantService.markTenantFormer(req.params.id, req, req.user!.id);
  return ok(res, { tenant });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const result = await tenantService.deleteTenant(req.params.id, req, req.user!.id);
  return ok(res, result);
});

export const documents = asyncHandler(async (req: Request, res: Response) => {
  const documents = await tenantService.listTenantDocuments(req.params.id);
  return ok(res, { documents });
});

export const addDocument = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file as Express.Multer.File | undefined;
  const { type } = req.body as { type: any };

  let storageKey = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  if (file && file.buffer) {
    try {
      const cloudResult = await uploadToCloudinary(file.buffer, "c2d_rentals/tenant_documents", "auto");
      storageKey = cloudResult.url;
    } catch (err) {
      storageKey = privateStorageKey(file);
    }
  }

  const doc = await tenantService.addTenantDocument(
    req.params.id,
    {
      type,
      storageKey,
      originalName: file?.originalname ?? "document",
      mimeType: file?.mimetype ?? "application/octet-stream",
      size: file?.size ?? 0,
    },
    req,
    req.user!.id,
  );
  return ok(res, { document: doc }, 201);
});

export const deleteDocument = asyncHandler(async (req: Request, res: Response) => {
  await tenantService.deleteTenantDocument(req.params.docId, req, req.user!.id);
  return ok(res, { message: "Document deleted" });
});

export const familyMembers = asyncHandler(async (req: Request, res: Response) => {
  const members = await tenantService.listFamilyMembers(req.params.id);
  return ok(res, { members });
});

export const addFamilyMember = asyncHandler(async (req: Request, res: Response) => {
  const member = await tenantService.addFamilyMember(req.params.id, req.body, req, req.user!.id);
  return ok(res, { member }, 201);
});

export const updateFamilyMember = asyncHandler(async (req: Request, res: Response) => {
  const member = await tenantService.updateFamilyMember(
    req.params.id,
    req.params.memberId,
    req.body,
    req,
    req.user!.id,
  );
  return ok(res, { member });
});

export const deleteFamilyMember = asyncHandler(async (req: Request, res: Response) => {
  await tenantService.deleteFamilyMember(req.params.id, req.params.memberId, req, req.user!.id);
  return ok(res, { message: "Family member deleted" });
});

export const verifyDocument = asyncHandler(async (req: Request, res: Response) => {
  const document = await tenantService.verifyTenantDocument(
    req.params.id,
    req.params.docId,
    req.body.status,
    req.body.rejectionReason,
    req,
    req.user!.id,
  );
  return ok(res, { document });
});

export const transfer = asyncHandler(async (req: Request, res: Response) => {
  const result = await tenantService.transferTenant(req.params.id, req.body, req, req.user!.id);
  return ok(res, result);
});

export const transfers = asyncHandler(async (req: Request, res: Response) => {
  const history = await tenantService.getTenantTransferHistory(req.params.id);
  return ok(res, { history });
});

