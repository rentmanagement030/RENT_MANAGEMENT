import { Router } from "express";
import { asyncHandler } from "../utils/http";
import { authenticate } from "../middleware/authenticate";
import { listVisits, getTodayVisits, createVisit, updateVisitStatus } from "../services/visit.service";

const router = Router();
router.use(authenticate);

// GET /api/visits
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const visits = await listVisits(req.query);
    res.json(visits);
  })
);

// GET /api/visits/today
router.get(
  "/today",
  asyncHandler(async (req, res) => {
    const visits = await getTodayVisits();
    res.json(visits);
  })
);

// POST /api/visits
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const visit = await createVisit(req.body);
    res.status(201).json(visit);
  })
);

// PATCH /api/visits/:id/status
router.patch(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const { status, notes } = req.body;
    const visit = await updateVisitStatus(req.params.id, status, notes);
    res.json(visit);
  })
);

export default router;
