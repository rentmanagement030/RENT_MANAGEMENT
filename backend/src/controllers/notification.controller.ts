import type { Request, Response } from "express";
import { asyncHandler, ok } from "../utils/http";
import * as notificationService from "../services/notification.service";
import { prisma } from "../config/prisma";

export const configStatus = asyncHandler(async (_req: Request, res: Response) => {
  const { env } = await import("../config/env");
  return ok(res, {
    whatsapp: Boolean(env.whatsappAccessToken && env.whatsappPhoneNumberId),
    email: Boolean(env.smtpHost),
  });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await notificationService.listNotifications(req.query);
  return ok(res, result);
});

export const triggerReminders = asyncHandler(async (req: Request, res: Response) => {
  const { triggerReminderJobs } = await import("../services/public.service");
  const result = await triggerReminderJobs(req, req.user!.id);
  return ok(res, result);
});

export const sendNow = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, to, channel, subject, body, type } = req.body as {
    tenantId?: string;
    to?: string;
    channel: "WHATSAPP" | "EMAIL" | "SMS";
    subject?: string;
    body: string;
    type: "RENT_DUE" | "RENT_OVERDUE" | "PAYMENT_CONFIRMATION" | "PAYMENT_LINK" | "AGREEMENT_EXPIRY" | "GENERAL";
  };

  let target = to;
  if (tenantId) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error("Tenant not found");
    target = channel === "EMAIL" ? (tenant.email ?? undefined) : tenant.phone;
  }
  if (!target) throw new Error("Recipient not available");

  const sent = await notificationService.sendNotificationNow({
    tenantId,
    channel,
    to: target,
    type,
    subject,
    body,
  });
  return ok(res, { sent });
});

export const resend = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  const result = await notificationService.resendNotification(id);
  return ok(res, result);
});

export const triggerTestScheduler = asyncHandler(async (req: Request, res: Response) => {
  const { processAutomatedNotifications } = await import("../services/notification.service");
  const result = await processAutomatedNotifications(true);
  return ok(res, {
    message: "Automated scheduler test loop executed successfully",
    ...result,
  });
});
