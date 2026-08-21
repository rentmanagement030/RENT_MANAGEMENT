import { Router } from "express";
import { asyncHandler } from "../utils/http";
import { authenticate } from "../middleware/authenticate";
import { listLeads, getLead, createLead, updateLead, addLeadActivity, convertLeadToTenant } from "../services/crm.service";

const router = Router();
router.use(authenticate);

// GET /api/crm/leads
router.get(
  "/leads",
  asyncHandler(async (req, res) => {
    const leads = await listLeads(req.query);
    res.json(leads);
  })
);

// GET /api/crm/leads/:id
router.get(
  "/leads/:id",
  asyncHandler(async (req, res) => {
    const lead = await getLead(req.params.id);
    res.json(lead);
  })
);

// POST /api/crm/leads
router.post(
  "/leads",
  asyncHandler(async (req, res) => {
    const lead = await createLead(req.body, req, req.user?.id);
    res.status(201).json(lead);
  })
);

// PUT /api/crm/leads/:id
router.put(
  "/leads/:id",
  asyncHandler(async (req, res) => {
    const lead = await updateLead(req.params.id, req.body, req, req.user?.id);
    res.json(lead);
  })
);

// POST /api/crm/leads/:id/activities
router.post(
  "/leads/:id/activities",
  asyncHandler(async (req, res) => {
    const { action, notes } = req.body;
    const activity = await addLeadActivity(req.params.id, action, notes, req.user?.name || "Staff");
    res.status(201).json(activity);
  })
);

// POST /api/crm/leads/:id/convert
router.post(
  "/leads/:id/convert",
  asyncHandler(async (req, res) => {
    const { rent, advance, deposit, roomId, bedId } = req.body;
    const result = await convertLeadToTenant(req.params.id, { rent: Number(rent || 0), advance: Number(advance || 0), deposit: Number(deposit || 0), roomId, bedId }, req, req.user?.id);
    res.json({ success: true, ...result });
  })
);

export default router;
