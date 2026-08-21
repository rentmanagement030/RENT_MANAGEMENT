import { Router } from "express";
import { asyncHandler } from "../utils/http";
import { authenticate } from "../middleware/authenticate";
import { listBookings, createBookingTransactionSafe, cancelBooking } from "../services/booking.service";

const router = Router();
router.use(authenticate);

// GET /api/bookings
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const bookings = await listBookings(req.query);
    res.json(bookings);
  })
);

// POST /api/bookings
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const booking = await createBookingTransactionSafe(req.body);
    res.status(201).json(booking);
  })
);

// POST /api/bookings/:id/cancel
router.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const booking = await cancelBooking(req.params.id, reason);
    res.json(booking);
  })
);

export default router;
