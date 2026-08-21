import { Router } from "express";
import { asyncHandler } from "../utils/http";
import { authenticate } from "../middleware/authenticate";
import { listStaff, createStaff, updateStaff, deleteStaff, listVendors, createVendor, updateVendor, deleteVendor } from "../services/staffVendor.service";

const router = Router();
router.use(authenticate);

// GET /api/ops/staff-vendors/staff
router.get(
  "/staff",
  asyncHandler(async (req, res) => {
    const staff = await listStaff(req.query);
    res.json(staff);
  })
);

// POST /api/ops/staff-vendors/staff
router.post(
  "/staff",
  asyncHandler(async (req, res) => {
    const newStaff = await createStaff(req.body);
    res.status(201).json(newStaff);
  })
);

// PUT /api/ops/staff-vendors/staff/:id
router.put(
  "/staff/:id",
  asyncHandler(async (req, res) => {
    const updated = await updateStaff(req.params.id, req.body);
    res.json(updated);
  })
);

// DELETE /api/ops/staff-vendors/staff/:id
router.delete(
  "/staff/:id",
  asyncHandler(async (req, res) => {
    const result = await deleteStaff(req.params.id);
    res.json(result);
  })
);

// GET /api/ops/staff-vendors/vendors
router.get(
  "/vendors",
  asyncHandler(async (req, res) => {
    const vendors = await listVendors(req.query);
    res.json(vendors);
  })
);

// POST /api/ops/staff-vendors/vendors
router.post(
  "/vendors",
  asyncHandler(async (req, res) => {
    const newVendor = await createVendor(req.body);
    res.status(201).json(newVendor);
  })
);

// PUT /api/ops/staff-vendors/vendors/:id
router.put(
  "/vendors/:id",
  asyncHandler(async (req, res) => {
    const updated = await updateVendor(req.params.id, req.body);
    res.json(updated);
  })
);

// DELETE /api/ops/staff-vendors/vendors/:id
router.delete(
  "/vendors/:id",
  asyncHandler(async (req, res) => {
    const result = await deleteVendor(req.params.id);
    res.json(result);
  })
);

export default router;
