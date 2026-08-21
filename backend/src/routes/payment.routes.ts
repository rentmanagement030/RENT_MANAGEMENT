import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { authorize, requireAny } from "../middleware/authorize";
import { validateBody, validateQuery } from "../middleware/validate";
import { PERMISSIONS } from "../utils/permissions";
import { paginationSchema } from "../validators/common";
import { cashPaymentSchema, bankPaymentSchema, verifyBankPaymentSchema } from "../validators/payment.validator";
import * as paymentController from "../controllers/payment.controller";

const router = Router();

router.use(authenticate);

// Static routes must come before parameterized routes.
router.get("/", requireAny(PERMISSIONS.PAYMENTS_READ, PERMISSIONS.PAYMENTS_CREATE), validateQuery(paginationSchema), paymentController.list);
router.get("/outstanding", requireAny(PERMISSIONS.RENT_READ, PERMISSIONS.PAYMENTS_READ), paymentController.outstanding);
router.get("/reconcile/razorpay", authorize(PERMISSIONS.REPORTS_READ), paymentController.reconcile);
router.get("/totals/methods", requireAny(PERMISSIONS.PAYMENTS_READ, PERMISSIONS.REPORTS_READ), paymentController.methodTotals);
router.get("/export", authorize(PERMISSIONS.REPORTS_READ), paymentController.excelExport);

// Cash entry
router.post("/cash", authorize(PERMISSIONS.PAYMENTS_CREATE), validateBody(cashPaymentSchema), paymentController.recordCash);
// Bank / DD entry
router.post("/bank", authorize(PERMISSIONS.PAYMENTS_CREATE), validateBody(bankPaymentSchema), paymentController.recordBank);

router.get("/:id", requireAny(PERMISSIONS.PAYMENTS_READ, PERMISSIONS.PAYMENTS_CREATE), paymentController.get);
router.get("/:id/receipt", authorize(PERMISSIONS.RECEIPTS_READ), paymentController.receipt);
router.put("/:id/verify", authorize(PERMISSIONS.PAYMENTS_VERIFY), validateBody(verifyBankPaymentSchema), paymentController.verifyBank);

export default router;
