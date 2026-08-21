import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { authorize, requireAny } from "../middleware/authorize";
import { validateBody } from "../middleware/validate";
import { PERMISSIONS } from "../utils/permissions";
import { notificationSendSchema } from "../validators/notification.validator";
import * as notificationController from "../controllers/notification.controller";

const router = Router();

router.use(authenticate);

router.get("/", requireAny(PERMISSIONS.NOTIFICATIONS_READ, PERMISSIONS.NOTIFICATIONS_MANAGE), notificationController.list);
router.get("/status", requireAny(PERMISSIONS.NOTIFICATIONS_READ, PERMISSIONS.NOTIFICATIONS_MANAGE), notificationController.configStatus);
router.post("/send", authorize(PERMISSIONS.NOTIFICATIONS_MANAGE), validateBody(notificationSendSchema), notificationController.sendNow);
router.post("/trigger-reminders", authorize(PERMISSIONS.NOTIFICATIONS_MANAGE), notificationController.triggerReminders);
router.post("/trigger-test", authorize(PERMISSIONS.NOTIFICATIONS_MANAGE), notificationController.triggerTestScheduler);
router.post("/:id/resend", authorize(PERMISSIONS.NOTIFICATIONS_MANAGE), notificationController.resend);

export default router;
