import { Router } from "express";
import { webhookLimiter } from "../middleware/rateLimit";
import * as whatsappController from "../controllers/whatsapp.controller";

const router = Router();

// Meta verification GET endpoint
router.get("/webhook", whatsappController.verifyWebhook);

// Meta message & status events POST endpoint
router.post("/webhook", webhookLimiter, whatsappController.handleWebhook);

export default router;
