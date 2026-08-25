import { NotificationChannel, NotificationType, NotificationStatus, Prisma, JobType, BillType } from "@prisma/client";
import { prisma } from "../config/prisma";
import {
  sendWhatsAppMessage,
  paymentConfirmationBody,
  billGeneratedBody,
  rentOutstandingReminderBody,
} from "./whatsapp.service";
import { sendEmail } from "./email.service";
import { getOrCreatePaymentLinkForBill } from "./razorpay.service";
import { computePenaltyForBill, applyPenaltyToBill } from "./bill.service";
import { enqueue } from "../jobs/queue";
import { logger } from "../utils/logger";
import { numberMoney } from "../utils/money";
import { NotFoundError } from "../utils/http";
import { env } from "../config/env";

export interface NotificationPayload {
  type: NotificationType;
  amount?: Prisma.Decimal;
  receiptNumber?: string;
  method?: string;
  subject?: string;
  body?: string;
  days?: number;
  billId?: string;
  remainingBalance?: string;
  receiptUrl?: string;
}

export async function notifyBillGenerated(billId: string) {
  try {
    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      include: {
        tenant: { select: { id: true, name: true, phone: true, email: true } },
        property: { select: { name: true } },
      },
    });
    if (!bill || !bill.tenant?.phone) return;

    const payUrl = await getOrCreatePaymentLinkForBill(bill.id).catch(() => null);
    const portalUrl = `${env.clientUrl || "https://rent-management-frontend-tawny.vercel.app"}/tenant/login`;
    const viewUrl = payUrl || portalUrl;

    const dueDateFormatted = new Date(bill.dueDate).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    const body = billGeneratedBody({
      tenantName: bill.tenant.name,
      propertyName: bill.property?.name || "your property",
      billNumber: bill.billNumber,
      billingMonth: bill.billingMonth,
      amount: `₹${numberMoney(bill.amount).toLocaleString("en-IN")}`,
      dueDate: dueDateFormatted,
      billType: bill.billType,
      payUrl: viewUrl,
    });

    await sendNotificationNow({
      tenantId: bill.tenant.id,
      billId: bill.id,
      channel: "WHATSAPP",
      to: bill.tenant.phone,
      type: "RENT_DUE",
      body,
    });
  } catch (err) {
    logger.error("Failed to send WhatsApp bill notification", { billId, err: String(err) });
  }
}

export async function enqueueNotification(tenantId: string, payload: NotificationPayload) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, phone: true, email: true },
  });
  if (!tenant) return;

  if (payload.type === "PAYMENT_CONFIRMATION") {
    const portalUrl = `${env.clientUrl || "https://rent-management-frontend-tawny.vercel.app"}/tenant/login`;
    const receiptDocUrl = payload.receiptNumber
      ? `${portalUrl}`
      : portalUrl;

    const body =
      payload.body ??
      paymentConfirmationBody({
        tenantName: tenant.name,
        amount: "₹" + (payload.amount ? numberMoney(payload.amount).toFixed(2) : "0"),
        receiptNumber: payload.receiptNumber ?? "",
        method: payload.method ?? "",
        remainingBalance: payload.remainingBalance,
        receiptUrl: payload.receiptUrl || receiptDocUrl,
      });

    await sendNotificationNow({
      tenantId: tenant.id,
      billId: payload.billId,
      channel: "WHATSAPP",
      to: tenant.phone,
      type: payload.type,
      body,
    }).catch(() => null);

    if (tenant.email) {
      await sendNotificationNow({
        tenantId: tenant.id,
        billId: payload.billId,
        channel: "EMAIL",
        to: tenant.email,
        type: payload.type,
        subject: "Payment Confirmation & Receipt - Rentals",
        body,
      }).catch(() => null);
    }
  }
}

import { sendSMSMessage } from "./sms.service";

export async function sendNotificationNow(data: {
  tenantId?: string;
  userId?: string;
  billId?: string;
  channel: NotificationChannel;
  to: string;
  type: NotificationType;
  subject?: string;
  body: string;
}): Promise<boolean> {
  const record = await prisma.notification.create({
    data: {
      tenantId: data.tenantId,
      userId: data.userId,
      billId: data.billId,
      channel: data.channel,
      to: data.to,
      type: data.type,
      subject: data.subject,
      body: data.body,
      status: "PENDING",
      scheduledAt: new Date(),
    },
  });

  let result: { ok: boolean; status?: NotificationStatus; error?: string } = { ok: false, error: "Unknown channel" };
  if (data.channel === "WHATSAPP") {
    const wa = await sendWhatsAppMessage(data.to, data.body);
    result = {
      ok: wa.ok,
      status: wa.ok ? "SENT" : wa.error?.includes("not configured") ? "NOT_CONFIGURED" : "FAILED",
      error: wa.error,
    };
  } else if (data.channel === "EMAIL") {
    const em = await sendEmail(data.to, data.subject ?? data.type, data.body);
    result = { ok: em.ok, status: em.ok ? "SENT" : "FAILED", error: em.error };
  } else if (data.channel === "SMS") {
    const sms = await sendSMSMessage(data.to, data.body);
    result = { ok: sms.ok, status: sms.status as NotificationStatus, error: sms.error };
  }

  const finalStatus: NotificationStatus = result.status ?? (result.ok ? "SENT" : "FAILED");

  await prisma.notification.update({
    where: { id: record.id },
    data: {
      status: finalStatus,
      sentAt: result.ok ? new Date() : null,
      error: result.ok ? null : result.error,
    },
  });
  return result.ok;
}

export async function resendNotification(notificationId: string): Promise<{ ok: boolean; error?: string }> {
  const notif = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notif) throw new NotFoundError("Notification record not found");

  let result: { ok: boolean; error?: string } = { ok: false, error: "Unknown channel" };
  if (notif.channel === "WHATSAPP") {
    result = await sendWhatsAppMessage(notif.to, notif.body);
  } else if (notif.channel === "EMAIL") {
    result = await sendEmail(notif.to, notif.subject ?? notif.type, notif.body);
  } else {
    result = { ok: false, error: "Channel not configured" };
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: {
      status: result.ok ? "SENT" : "FAILED",
      sentAt: result.ok ? new Date() : notif.sentAt,
      error: result.ok ? null : result.error,
    },
  });
  return result;
}

export async function listNotifications(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
  const status = query.status ? String(query.status) : undefined;
  const tenantId = query.tenantId ? String(query.tenantId) : undefined;
  const billId = query.billId ? String(query.billId) : undefined;

  const where: Prisma.NotificationWhereInput = {
    ...(status ? { status: status as NotificationStatus } : {}),
    ...(tenantId ? { tenantId } : {}),
    ...(billId ? { billId } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      include: {
        tenant: { select: { id: true, name: true, phone: true } },
        bill: { select: { id: true, billNumber: true, billType: true, amount: true, outstanding: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Check if notification of type has already been sent/queued today for tenant & bill */
async function isNotificationAlreadyProcessedToday(tenantId: string, billId: string | null, type: NotificationType): Promise<boolean> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const existing = await prisma.notification.findFirst({
    where: {
      tenantId,
      ...(billId ? { billId } : {}),
      type,
      createdAt: { gte: startOfDay },
      status: { in: ["SENT", "PENDING", "SKIPPED"] },
    },
  });
  return !!existing;
}

/** Main Automated Notification Processor for Scheduler */
export async function processAutomatedNotifications(isTestMode = false, options?: { forceSimulateDate?: Date }) {
  const today = options?.forceSimulateDate ?? new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);

  const openBills = await prisma.bill.findMany({
    where: {
      status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
      tenant: { status: "ACTIVE" },
    },
    include: {
      tenant: { select: { id: true, name: true, phone: true } },
      property: { select: { name: true } },
    },
  });

  let processedCount = 0;
  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const logs: { billId: string; type: string; status: string; reason?: string; payUrl?: string }[] = [];

  for (const bill of openBills) {
    if (!bill.tenant?.phone) continue;
    processedCount += 1;

    // 1. Calculate dates and status
    const dueDate = new Date(bill.dueDate);
    const graceDate = bill.graceDate ?? new Date(dueDate.getTime() + 3 * 24 * 60 * 60 * 1000);
    const isDueToday = today.toDateString() === dueDate.toDateString();
    const isPastDue = today > dueDate;
    const isPastGrace = today > graceDate;

    let targetType: NotificationType = "RENT_DUE";
    if (bill.billType === "EB") targetType = "RENT_DUE";
    else if (bill.billType === "MAINTENANCE") targetType = "RENT_DUE";
    else if (bill.billType === "WATER") targetType = "RENT_DUE";
    else if (bill.billType === "OTHER") targetType = "GENERAL";

    if (isPastGrace) {
      targetType = "RENT_OVERDUE";
      // Auto apply penalty if applicable
      await applyPenaltyToBill(bill.id, {} as any, "SCHEDULER").catch(() => null);
    } else if (isPastDue) {
      targetType = "RENT_OVERDUE";
    }

    // 2. Strictly check idempotency to avoid duplicate notifications
    const alreadyProcessed = await isNotificationAlreadyProcessedToday(bill.tenantId, bill.id, targetType);
    if (alreadyProcessed) {
      skippedCount += 1;
      logs.push({ billId: bill.id, type: targetType, status: "SKIPPED", reason: "duplicate_today" });
      continue;
    }

    // 3. Generate or retrieve active Razorpay Payment Link
    const payUrl = await getOrCreatePaymentLinkForBill(bill.id);

    // 4. Construct automatic message body based on bill type & status with dynamic itemized breakdown
    const billTypeLabelMap: Record<string, string> = {
      RENT: "Rent",
      EB: "EB",
      MAINTENANCE: "Maintenance",
      WATER: "Water",
      OTHER: "Other",
    };

    // Get all open bills for this tenant to build itemized breakdown
    const tenantOpenBills = openBills.filter((b) => b.tenantId === bill.tenantId);
    const breakdownParts = tenantOpenBills.map((b) => {
      const label = billTypeLabelMap[b.billType] || b.billType;
      return `${label} ₹${numberMoney(b.outstanding).toLocaleString("en-IN")}`;
    });
    const totalOutstandingNum = tenantOpenBills.reduce((acc, b) => acc + Number(b.outstanding || 0), 0);
    const totalOutstandingFormatted = `₹${totalOutstandingNum.toLocaleString("en-IN")}`;
    const propertyName = (bill.property as { name?: string })?.name || "your property";

    let body = "";
    if (isPastGrace) {
      body =
        `Hello ${bill.tenant.name}, your outstanding amount for ${propertyName} is ${totalOutstandingFormatted}. ` +
        `${breakdownParts.join(" + ")}. Total: ${totalOutstandingFormatted}. ` +
        `This payment is OVERDUE. Please make the payment at your earliest convenience. Thank you.`;
    } else if (isDueToday) {
      body =
        `Hello ${bill.tenant.name}, your outstanding amount for ${propertyName} is ${totalOutstandingFormatted}. ` +
        `${breakdownParts.join(" + ")}. Total: ${totalOutstandingFormatted}. ` +
        `Payment is due TODAY. Please make the payment at your earliest convenience. Thank you.`;
    } else {
      body =
        `Hello ${bill.tenant.name}, your outstanding amount for ${propertyName} is ${totalOutstandingFormatted}. ` +
        `${breakdownParts.join(" + ")}. Total: ${totalOutstandingFormatted}. ` +
        `Please make the payment at your earliest convenience. Thank you.`;
    }

    // 5. Send notification immediately or queue
    const success = await sendNotificationNow({
      tenantId: bill.tenantId,
      billId: bill.id,
      channel: "WHATSAPP",
      to: bill.tenant.phone,
      type: targetType,
      body,
    });

    if (success) {
      sentCount += 1;
      logs.push({ billId: bill.id, type: targetType, status: "SENT", payUrl: payUrl ?? undefined });
    } else {
      failedCount += 1;
      logs.push({ billId: bill.id, type: targetType, status: "FAILED", reason: "delivery_error" });
    }
  }

  return {
    processed: processedCount,
    sent: sentCount,
    skipped: skippedCount,
    failed: failedCount,
    details: logs,
  };
}

export async function sendRentReminders() {
  const result = await processAutomatedNotifications(false);
  return result.sent;
}

export async function sendAgreementReminders() {
  const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const agreements = await prisma.agreement.findMany({
    where: { status: "ACTIVE", endDate: { gte: new Date(), lte: soon } },
    include: { tenant: { select: { id: true, name: true, phone: true } } },
  });

  let queued = 0;
  for (const agreement of agreements) {
    const alreadySent = await prisma.notification.findFirst({
      where: {
        tenantId: agreement.tenantId,
        type: "AGREEMENT_EXPIRY",
        createdAt: { gte: startOfDay },
      },
    });
    if (alreadySent) continue;

    const days = Math.ceil((agreement.endDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    const body =
      `Dear ${agreement.tenant.name}, your rental agreement (${agreement.agreementNumber}) ` +
      `expires in ${days} day(s) on ${agreement.endDate.toISOString().slice(0, 10)}. ` +
      `Please contact us to renew. Thank you.`;
    await sendNotificationNow({
      tenantId: agreement.tenantId,
      channel: "WHATSAPP",
      to: agreement.tenant.phone,
      type: "AGREEMENT_EXPIRY",
      body,
    });
    queued += 1;
  }
  return queued;
}

