import { registerHandler } from "./queue";
import { sendNotificationNow } from "../services/notification.service";
import { logger } from "../utils/logger";

registerHandler("SEND_NOTIFICATION", async (payload) => {
  const data = payload as unknown as {
    tenantId?: string;
    userId?: string;
    channel: "WHATSAPP" | "EMAIL" | "SMS";
    to: string;
    type: "RENT_DUE" | "RENT_OVERDUE" | "PAYMENT_CONFIRMATION" | "PAYMENT_LINK" | "AGREEMENT_EXPIRY" | "GENERAL";
    subject?: string;
    body: string;
  };
  const { tenantId, userId, channel, to, type, subject, body } = data;
  if (!to || !body) throw new Error("Missing to/body for notification");
  const ok = await sendNotificationNow({
    tenantId,
    userId,
    channel,
    to,
    type,
    subject,
    body,
  });
  if (!ok) throw new Error("Notification delivery failed");
  return ok;
});

registerHandler("RENT_REMINDERS", async () => {
  const { sendRentReminders } = await import("../services/notification.service");
  return sendRentReminders();
});

registerHandler("AGREEMENT_REMINDERS", async () => {
  const { sendAgreementReminders } = await import("../services/notification.service");
  return sendAgreementReminders();
});

registerHandler("GENERATE_REPORT", async (payload) => {
  const { generateReportData } = await import("../services/report.service");
  return generateReportData(payload);
});

registerHandler("BILL_GENERATION", async (payload) => {
  const { generateMonthlyBills } = await import("../services/bill.service");
  return generateMonthlyBills(String(payload.billingMonth ?? ""));
});

registerHandler("APPLY_PENALTIES", async () => {
  const { applyAllPenalties } = await import("../services/bill.service");
  return applyAllPenalties();
});

registerHandler("RETRY", async () => {
  // Reserved for retry-style operations.
  return true;
});

logger.info("Job handlers registered");
