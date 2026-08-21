import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { PERMISSIONS } from "../utils/permissions";
import * as systemController from "../controllers/system.controller";
import { dashboard } from "../controllers/report.controller";

const router = Router();

router.use(authenticate);

router.get("/dashboard", authorize(PERMISSIONS.DASHBOARD_READ), dashboard);
router.get("/audit-logs", authorize(PERMISSIONS.AUDIT_READ), systemController.auditList);
router.get("/settings", authorize(PERMISSIONS.SETTINGS_MANAGE), systemController.getSettings);
router.put("/settings", authorize(PERMISSIONS.SETTINGS_MANAGE), systemController.updateSettings);

export default router;
