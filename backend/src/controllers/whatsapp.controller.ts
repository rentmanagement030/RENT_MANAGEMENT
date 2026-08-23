import type { Request, Response } from "express";
import { env } from "../config/env";
import { logger } from "../utils/logger";

export const verifyWebhook = (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === env.whatsappVerifyToken) {
    logger.info("WhatsApp webhook verified successfully with Meta");
    return res.status(200).send(challenge);
  }

  logger.warn("WhatsApp webhook verification failed", { mode, tokenReceived: token });
  return res.status(403).send("Forbidden");
};

export const handleWebhook = (req: Request, res: Response) => {
  const body = req.body;
  logger.info("WhatsApp webhook event received", { object: body?.object });
  return res.status(200).send("EVENT_RECEIVED");
};
