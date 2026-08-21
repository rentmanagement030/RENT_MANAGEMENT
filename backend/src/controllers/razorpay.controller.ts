import type { Request, Response } from "express";
import { asyncHandler, ok } from "../utils/http";
import * as razorpayService from "../services/razorpay.service";
import { logger } from "../utils/logger";

export const status = asyncHandler(async (_req: Request, res: Response) => {
  return ok(res, { configured: razorpayService.razorpayConfigured() });
});

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await razorpayService.createPaymentOrder(req.body, req, req.user!.id);
  return ok(res, order, 201);
});

export const webhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.get("x-razorpay-signature") ?? "";
  const rawBody = (req as Request & { rawBody?: string }).rawBody ?? "";

  if (!razorpayService.verifyWebhookSignature(rawBody, signature)) {
    logger.warn("Razorpay webhook signature verification failed");
    return res.status(400).json({ success: false, error: "Invalid webhook signature" });
  }

  const event = req.body as {
    event: string;
    payload: { payment: { entity: Record<string, unknown> } };
    created_at?: number;
  };

  const result = await razorpayService.processWebhook(
    {
      eventId: `${event.event}_${event.payload?.payment?.entity?.payment_id ?? "unknown"}`,
      eventType: event.event,
      entity: event.payload?.payment?.entity ?? {},
    },
    rawBody,
    req,
  );

  return ok(res, { received: true, ...result });
});
