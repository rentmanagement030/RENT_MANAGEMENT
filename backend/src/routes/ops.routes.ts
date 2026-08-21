import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { authorize, requireAny } from "../middleware/authorize";
import { PERMISSIONS } from "../utils/permissions";
import { validateBody, validateQuery } from "../middleware/validate";
import { paginationSchema } from "../validators/common";
import { maintenanceCreateSchema, maintenanceUpdateSchema, expenseCreateSchema } from "../validators/ops.validator";
import * as reportController from "../controllers/report.controller";
import * as opsController from "../controllers/ops.controller";

const router = Router();

router.use(authenticate);

// ---- Reports ----
router.get("/reports/collection", authorize(PERMISSIONS.REPORTS_READ), reportController.collection);
router.get("/reports/collection/export", requireAny(PERMISSIONS.REPORTS_READ, PERMISSIONS.PAYMENTS_READ), reportController.exportCollection);
router.get("/reports/collection/methods", authorize(PERMISSIONS.REPORTS_READ), reportController.methodTotals);
router.get("/reports/outstanding", authorize(PERMISSIONS.REPORTS_READ), reportController.outstanding);
router.get("/reports/property-performance", authorize(PERMISSIONS.REPORTS_READ), reportController.propertyPerformance);
router.get("/reports/tenants/:tenantId/ledger", authorize(PERMISSIONS.REPORTS_READ), reportController.tenantLedger);
router.get("/reports/tenants/:tenantId/ledger/export", authorize(PERMISSIONS.REPORTS_READ), reportController.exportTenantLedger);
router.get("/reports/bills", requireAny(PERMISSIONS.REPORTS_READ, PERMISSIONS.BILLS_READ), reportController.bills);
router.get("/reports/bills/export", requireAny(PERMISSIONS.REPORTS_READ, PERMISSIONS.BILLS_READ), reportController.exportBills);
router.get("/reports/outstanding/export", authorize(PERMISSIONS.REPORTS_READ), reportController.exportOutstanding);
router.get("/reports/profitability", authorize(PERMISSIONS.REPORTS_READ), reportController.profitability);
router.get("/reports/pnl", authorize(PERMISSIONS.REPORTS_READ), reportController.pnl);
router.get("/reports/reconciliation", authorize(PERMISSIONS.REPORTS_READ), reportController.reconciliation);

// ---- Maintenance ----
router.get("/maintenance", requireAny(PERMISSIONS.MAINTENANCE_MANAGE, PERMISSIONS.PROPERTIES_READ), validateQuery(paginationSchema), opsController.maintenanceList);
router.post("/maintenance", authorize(PERMISSIONS.MAINTENANCE_MANAGE), validateBody(maintenanceCreateSchema), opsController.maintenanceCreate);
router.put("/maintenance/:id", authorize(PERMISSIONS.MAINTENANCE_MANAGE), validateBody(maintenanceUpdateSchema), opsController.maintenanceUpdate);

// ---- Expenses ----
router.get("/expenses/summary", requireAny(PERMISSIONS.EXPENSES_MANAGE, PERMISSIONS.REPORTS_READ), opsController.expenseSummary);
router.get("/expenses", requireAny(PERMISSIONS.EXPENSES_MANAGE, PERMISSIONS.REPORTS_READ), validateQuery(paginationSchema), opsController.expenseList);
router.post("/expenses", authorize(PERMISSIONS.EXPENSES_MANAGE), validateBody(expenseCreateSchema), opsController.expenseCreate);

export default router;
