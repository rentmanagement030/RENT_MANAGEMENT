import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { authorize, requireAny } from "../middleware/authorize";
import { validateBody, validateQuery } from "../middleware/validate";
import { PERMISSIONS } from "../utils/permissions";
import { paginationSchema } from "../validators/common";
import { tenantCreateSchema, tenantUpdateSchema, tenantDocumentSchema, familyMemberCreateSchema, familyMemberUpdateSchema, tenantTransferSchema, kycVerifySchema } from "../validators/tenant.validator";
import * as tenantController from "../controllers/tenant.controller";
import { uploadTenantDocument } from "../middleware/upload";

const router = Router();

router.use(authenticate);

router.get("/", requireAny(PERMISSIONS.TENANTS_READ, PERMISSIONS.TENANTS_MANAGE), validateQuery(paginationSchema), tenantController.list);
router.get("/stats", requireAny(PERMISSIONS.TENANTS_READ, PERMISSIONS.TENANTS_MANAGE), tenantController.stats);
router.get("/:id", requireAny(PERMISSIONS.TENANTS_READ, PERMISSIONS.TENANTS_MANAGE), tenantController.get);
router.post("/", authorize(PERMISSIONS.TENANTS_MANAGE), validateBody(tenantCreateSchema), tenantController.create);
router.put("/:id", authorize(PERMISSIONS.TENANTS_MANAGE), validateBody(tenantUpdateSchema), tenantController.update);
router.post("/:id/former", authorize(PERMISSIONS.TENANTS_MANAGE), tenantController.markFormer);
router.delete("/:id", authorize(PERMISSIONS.TENANTS_MANAGE), tenantController.remove);

// Tenant Transfer / Shifting
router.post("/:id/transfer", authorize(PERMISSIONS.TENANTS_MANAGE), validateBody(tenantTransferSchema), tenantController.transfer);
router.get("/:id/transfers", requireAny(PERMISSIONS.TENANTS_READ, PERMISSIONS.TENANTS_MANAGE), tenantController.transfers);

// Documents (private storage; never public)
router.get("/:id/documents", requireAny(PERMISSIONS.TENANTS_READ, PERMISSIONS.TENANTS_MANAGE), tenantController.documents);
router.post(
  "/:id/documents",
  authorize(PERMISSIONS.TENANTS_MANAGE),
  uploadTenantDocument.single("document"),
  validateBody(tenantDocumentSchema),
  tenantController.addDocument,
);
router.patch("/:id/documents/:docId/verify", authorize(PERMISSIONS.TENANTS_MANAGE), validateBody(kycVerifySchema), tenantController.verifyDocument);
router.delete("/:id/documents/:docId", authorize(PERMISSIONS.TENANTS_MANAGE), tenantController.deleteDocument);

// Family members
router.get("/:id/family", requireAny(PERMISSIONS.TENANTS_READ, PERMISSIONS.TENANTS_MANAGE), tenantController.familyMembers);
router.post("/:id/family", authorize(PERMISSIONS.TENANTS_MANAGE), validateBody(familyMemberCreateSchema), tenantController.addFamilyMember);
router.put("/:id/family/:memberId", authorize(PERMISSIONS.TENANTS_MANAGE), validateBody(familyMemberUpdateSchema), tenantController.updateFamilyMember);
router.delete("/:id/family/:memberId", authorize(PERMISSIONS.TENANTS_MANAGE), tenantController.deleteFamilyMember);

export default router;
