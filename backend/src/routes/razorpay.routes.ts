import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validateBody } from "../middleware/validate";
import { PERMISSIONS } from "../utils/permissions";
import { razorpayOrderSchema } from "../validators/payment.validator";
import { webhookLimiter } from "../middleware/rateLimit";
import * as razorpayController from "../controllers/razorpay.controller";

const router = Router();

router.get("/status", authenticate, authorize(PERMISSIONS.PAYMENTS_CREATE), razorpayController.status);
router.post(
  "/orders",
  authenticate,
  authorize(PERMISSIONS.PAYMENTS_CREATE),
  validateBody(razorpayOrderSchema),
  razorpayController.createOrder,
);

// Webhook: unauthenticated but signature-verified + rate limited.
router.post("/webhook", webhookLimiter, razorpayController.webhook);

export default router;
