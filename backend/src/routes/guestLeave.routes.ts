import { Router } from "express";
import { asyncHandler } from "../utils/http";
import { authenticate } from "../middleware/authenticate";
import {
  listGuestLogs,
  createGuestLog,
  markGuestExit,
  listTenantLeaves,
  createTenantLeave,
  updateLeaveStatus,
} from "../services/guestLeave.service";

const router = Router();
router.use(authenticate);

// GET /api/pg/guests
router.get(
  "/guests",
  asyncHandler(async (req, res) => {
    const tenantId = req.query.tenantId ? String(req.query.tenantId) : undefined;
    const logs = await listGuestLogs(tenantId, req.query);
    res.json(logs);
  })
);

// POST /api/pg/guests
router.post(
  "/guests",
  asyncHandler(async (req, res) => {
    const { tenantId, guestName, guestPhone, relation, notes } = req.body;
    const log = await createGuestLog(tenantId, { guestName, guestPhone, relation, notes });
    res.status(201).json(log);
  })
);

// PATCH /api/pg/guests/:id/exit
router.patch(
  "/guests/:id/exit",
  asyncHandler(async (req, res) => {
    const log = await markGuestExit(req.params.id);
    res.json(log);
  })
);

// GET /api/pg/leaves
router.get(
  "/leaves",
  asyncHandler(async (req, res) => {
    const tenantId = req.query.tenantId ? String(req.query.tenantId) : undefined;
    const leaves = await listTenantLeaves(tenantId, req.query);
    res.json(leaves);
  })
);

// POST /api/pg/leaves
router.post(
  "/leaves",
  asyncHandler(async (req, res) => {
    const { tenantId, startDate, endDate, reason } = req.body;
    const leave = await createTenantLeave(tenantId, { startDate, endDate, reason });
    res.status(201).json(leave);
  })
);

// PATCH /api/pg/leaves/:id/status
router.patch(
  "/leaves/:id/status",
  asyncHandler(async (req, res) => {
    const { status, notes } = req.body;
    const leave = await updateLeaveStatus(req.params.id, status, notes);
    res.json(leave);
  })
);

export default router;
