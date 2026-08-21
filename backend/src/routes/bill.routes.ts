import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { authorize, requireAny } from "../middleware/authorize";
import { validateBody, validateQuery } from "../middleware/validate";
import { PERMISSIONS } from "../utils/permissions";
import { paginationSchema } from "../validators/common";
import { billCreateSchema, billUpdateSchema, generateMonthSchema, billBatchSchema } from "../validators/bill.validator";
import * as billController from "../controllers/bill.controller";

const router = Router();

router.use(authenticate);

router.get("/", requireAny(PERMISSIONS.RENT_READ, PERMISSIONS.RENT_MANAGE, PERMISSIONS.PAYMENTS_READ, PERMISSIONS.BILLS_READ), validateQuery(paginationSchema), billController.list);
router.get("/summary", requireAny(PERMISSIONS.RENT_READ, PERMISSIONS.REPORTS_READ, PERMISSIONS.BILLS_READ), billController.summary);
router.post("/generate-month", authorize(PERMISSIONS.RENT_MANAGE), validateBody(generateMonthSchema), billController.generateMonth);
router.post("/batch", authorize(PERMISSIONS.RENT_MANAGE), validateBody(billBatchSchema), billController.batch);

router.get("/:id", requireAny(PERMISSIONS.RENT_READ, PERMISSIONS.RENT_MANAGE, PERMISSIONS.PAYMENTS_READ, PERMISSIONS.BILLS_READ), billController.get);
router.post("/", authorize(PERMISSIONS.RENT_MANAGE), validateBody(billCreateSchema), billController.create);
router.put("/:id", authorize(PERMISSIONS.RENT_MANAGE), validateBody(billUpdateSchema), billController.update);
router.delete("/:id/permanent", authorize(PERMISSIONS.RENT_MANAGE), billController.removePermanently);
router.delete("/:id", authorize(PERMISSIONS.RENT_MANAGE), billController.cancel);
router.post("/:id/penalties", authorize(PERMISSIONS.RENT_MANAGE), billController.penalty);
router.post("/:id/penalties/waive", authorize(PERMISSIONS.RENT_MANAGE), billController.waivePenalty);

export default router;
