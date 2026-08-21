import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { authorize, requireAny } from "../middleware/authorize";
import { validateBody, validateQuery } from "../middleware/validate";
import { PERMISSIONS } from "../utils/permissions";
import { paginationSchema } from "../validators/common";
import { agreementCreateSchema, agreementUpdateSchema, rentCreateSchema, rentUpdateSchema, rentAdjustmentSchema, generateRentMonthSchema } from "../validators/agreement.validator";
import { uploadTenantDocument } from "../middleware/upload";
import * as agreementController from "../controllers/agreement.controller";
import * as rentController from "../controllers/rent.controller";

const router = Router();

router.use(authenticate);

// ---- Agreements ----
router.get("/agreements", requireAny(PERMISSIONS.AGREEMENTS_READ, PERMISSIONS.AGREEMENTS_MANAGE), validateQuery(paginationSchema), agreementController.list);
router.get("/agreements/stats", requireAny(PERMISSIONS.AGREEMENTS_READ, PERMISSIONS.AGREEMENTS_MANAGE), agreementController.stats);
router.get("/agreements/:id", requireAny(PERMISSIONS.AGREEMENTS_READ, PERMISSIONS.AGREEMENTS_MANAGE), agreementController.get);
router.get("/agreements/:id/document", requireAny(PERMISSIONS.AGREEMENTS_READ, PERMISSIONS.AGREEMENTS_MANAGE), agreementController.getDocument);
router.get("/agreements/:id/signed-document", requireAny(PERMISSIONS.AGREEMENTS_READ, PERMISSIONS.AGREEMENTS_MANAGE), agreementController.getSignedDocument);
router.post("/agreements", authorize(PERMISSIONS.AGREEMENTS_MANAGE), validateBody(agreementCreateSchema), agreementController.create);
router.put("/agreements/:id", authorize(PERMISSIONS.AGREEMENTS_MANAGE), validateBody(agreementUpdateSchema), agreementController.update);
router.post(
  "/agreements/:id/document",
  authorize(PERMISSIONS.AGREEMENTS_MANAGE),
  uploadTenantDocument.single("document"),
  agreementController.uploadDocument,
);
router.delete("/agreements/:id/document", authorize(PERMISSIONS.AGREEMENTS_MANAGE), agreementController.removeDocument);
router.post("/agreements/:id/send", authorize(PERMISSIONS.AGREEMENTS_MANAGE), agreementController.sendForSigning);
router.post("/agreements/:id/revoke", authorize(PERMISSIONS.AGREEMENTS_MANAGE), agreementController.revokeSigning);
router.post("/agreements/:id/cancel", authorize(PERMISSIONS.AGREEMENTS_MANAGE), agreementController.cancel);

// ---- Rent ----
router.get("/", requireAny(PERMISSIONS.RENT_READ, PERMISSIONS.RENT_MANAGE), validateQuery(paginationSchema), rentController.list);
router.get("/:id", requireAny(PERMISSIONS.RENT_READ, PERMISSIONS.RENT_MANAGE), rentController.get);
router.post("/", authorize(PERMISSIONS.RENT_MANAGE), validateBody(rentCreateSchema), rentController.create);
router.put("/:id", authorize(PERMISSIONS.RENT_MANAGE), validateBody(rentUpdateSchema), rentController.update);
router.delete("/:id", authorize(PERMISSIONS.RENT_MANAGE), rentController.remove);
router.post("/:id/adjustments", authorize(PERMISSIONS.RENT_MANAGE), validateBody(rentAdjustmentSchema), rentController.adjust);
router.post("/generate-month", authorize(PERMISSIONS.RENT_MANAGE), validateBody(generateRentMonthSchema), rentController.generateMonth);

export default router;
