import crypto from "node:crypto";
import Razorpay from "razorpay";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { NotFoundError, ConflictError } from "../utils/http";
import { toPaise, toDecimal, numberMoney } from "../utils/money";
import { recordRazorpayPayment } from "./payment.service";
import { writeAuditLog } from "../utils/audit";
import { logger } from "../utils/logger";
import type { Request } from "express";

let razorpay: Razorpay | null = null;

function getRazorpay(): Razorpay {
  if (!env.razorpayKeyId || !env.razorpayKeySecret) {
    throw new ConflictError("Razorpay is not configured on the server");
  }
  if (!razorpay) {
    razorpay = new Razorpay({
      key_id: env.razorpayKeyId,
      key_secret: env.razorpayKeySecret,
    });
  }
  return razorpay;
}

export function razorpayConfigured(): boolean {
  return Boolean(env.razorpayKeyId && env.razorpayKeySecret);
}

export async function createPaymentOrder(
  data: { tenantId: string; rentRecordId?: string; billId?: string; amount?: number; notes?: string },
  req: Request,
  actorId: string,
) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: data.tenantId },
    select: { id: true, name: true, phone: true },
  });
  if (!tenant) throw new NotFoundError("Tenant not found");

  let record: { id: string; tenantId: string; billingMonth: string; outstanding: Prisma.Decimal } | null = null;
  let billId: string | null = null;

  if (data.billId) {
    const bill = await prisma.bill.findUnique({ where: { id: data.billId } });
    if (!bill) throw new NotFoundError("Bill not found");
    if (bill.tenantId !== tenant.id) throw new ConflictError("Bill does not belong to this tenant");
    billId = bill.id;
    if (bill.rentRecordId) {
      record = await prisma.rentRecord.findUnique({ where: { id: bill.rentRecordId } });
    }
    if (!record) {
      record = await prisma.rentRecord.findFirst({
        where: { tenantId: tenant.id },
        orderBy: { billingMonth: "desc" },
      });
    }
    if (!record) throw new ConflictError("Tenant has no rent record to link the payment to");
    const outstanding = data.amount ? toDecimal(data.amount) : bill.outstanding;
    const amount = outstanding;
    if (amount.lessThanOrEqualTo(0)) throw new ConflictError("No outstanding amount for this bill");
    return createOrder(tenant, record, amount, data.notes, billId, req, actorId);
  }

  if (!data.rentRecordId) throw new ConflictError("Provide either a rent record or a bill to pay");
  record = await prisma.rentRecord.findUnique({ where: { id: data.rentRecordId } });
  if (!record) throw new NotFoundError("Rent record not found");
  if (record.tenantId !== tenant.id) throw new ConflictError("Rent record does not belong to this tenant");

  const amount = data.amount ? toDecimal(data.amount) : record.outstanding;
  if (amount.lessThanOrEqualTo(0)) throw new ConflictError("No outstanding amount for this rent record");

  return createOrder(tenant, record, amount, data.notes, null, req, actorId);
}

async function createOrder(
  tenant: { id: string; name: string },
  record: { id: string; billingMonth: string },
  amount: Prisma.Decimal,
  notesText?: string,
  billId: string | null = null,
  req?: Request,
  actorId?: string,
) {
  const rzp = getRazorpay();
  const order = await rzp.orders.create({
    amount: toPaise(amount),
    currency: "INR",
    receipt: `rcpt_${Date.now()}`,
    notes: {
      tenantId: tenant.id,
      rentRecordId: record.id,
      billingMonth: record.billingMonth,
      tenantName: tenant.name,
      ...(billId ? { billId } : {}),
      ...(notesText ? { notes: notesText } : {}),
    },
  });

  await prisma.paymentLink.create({
    data: {
      tenantId: tenant.id,
      rentRecordId: record.id,
      amount,
      razorpayOrderId: order.id,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  if (req && actorId) {
    await writeAuditLog(req, {
      action: "razorpay.order_created",
      entityType: "payment",
      entityId: record.id,
      metadata: { orderId: order.id, amount: numberMoney(amount), billId },
    }, actorId);
  }

  return {
    orderId: order.id,
    amount: toPaise(amount),
    currency: "INR",
    keyId: env.razorpayKeyId,
    tenantName: tenant.name,
    billingMonth: record.billingMonth,
  };
}

export async function getOrCreatePaymentLinkForBill(billId: string): Promise<string | null> {
  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: { tenant: { select: { id: true, name: true, phone: true } } },
  });

  if (!bill || bill.status === "PAID" || bill.status === "WAIVED" || bill.status === "CANCELLED") {
    return null;
  }

  if (bill.rentRecordId) {
    const existing = await prisma.paymentLink.findFirst({
      where: {
        rentRecordId: bill.rentRecordId,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing?.shortUrl) {
      return existing.shortUrl;
    }
  }

  const amount = bill.outstanding;
  if (amount.lessThanOrEqualTo(0)) return null;

  let orderId = `order_auto_${bill.id.slice(-8)}_${Date.now().toString(36)}`;
  let payUrl = `${env.clientUrl}/tenant/login?billId=${bill.id}`;

  if (razorpayConfigured()) {
    try {
      const rzp = getRazorpay();
      const order = await rzp.orders.create({
        amount: toPaise(amount),
        currency: "INR",
        receipt: `bill_${bill.billNumber}`,
        notes: {
          tenantId: bill.tenantId,
          billId: bill.id,
          billingMonth: bill.billingMonth,
          billType: bill.billType,
        },
      });
      orderId = order.id;
      payUrl = `${env.clientUrl}/tenant/login?orderId=${order.id}&billId=${bill.id}`;
    } catch (err) {
      logger.error("Razorpay order creation failed, using secure fallback link", { billId, error: String(err) });
    }
  }

  if (bill.rentRecordId) {
    await prisma.paymentLink.create({
      data: {
        tenantId: bill.tenantId,
        rentRecordId: bill.rentRecordId,
        amount,
        razorpayOrderId: orderId,
        shortUrl: payUrl,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }).catch(() => null);
  }

  return payUrl;
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!env.razorpayWebhookSecret) return false;
  const expected = crypto
    .createHmac("sha256", env.razorpayWebhookSecret)
    .update(rawBody)
    .digest("hex");
  const provided = signature ?? "";
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

interface WebhookEntity {
  payment_id?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  status?: string;
  notes?: Record<string, string>;
}

export async function processWebhook(event: {
  eventId: string;
  eventType: string;
  entity: WebhookEntity;
}, rawBody: string, req: Request) {
  const existingEvent = await prisma.paymentWebhook.findUnique({
    where: { eventId: event.eventId },
  });
  if (existingEvent) {
    return { status: "SKIPPED", reason: "duplicate_event" };
  }

  await prisma.paymentWebhook.create({
    data: {
      eventId: event.eventId,
      eventType: event.eventType,
      payload: event as unknown as Prisma.InputJsonValue,
      status: "PROCESSED",
    },
  });

  if (event.eventType === "payment.captured" && event.entity.payment_id) {
    const order = await prisma.paymentLink.findUnique({
      where: { razorpayOrderId: event.entity.order_id ?? "" },
    });

    if (!order) {
      logger.warn("Razorpay webhook order not found", { eventId: event.eventId, orderId: event.entity.order_id });
      return { status: "PROCESSED", reason: "order_not_found" };
    }

    const amountInr = toDecimal((event.entity.amount ?? 0) / 100);
    // The order may be partially captured; clamp to outstanding.
    const record = await prisma.rentRecord.findUnique({ where: { id: order.rentRecordId } });
    const effectiveAmount = amountInr.greaterThan(record?.outstanding ?? 0)
      ? record?.outstanding ?? amountInr
      : amountInr;

    const result = await recordRazorpayPayment({
      razorpayPaymentId: event.entity.payment_id,
      razorpayOrderId: order.razorpayOrderId,
      razorpaySignature: "",
      razorpayWebhookEventId: event.eventId,
      amount: effectiveAmount,
      currency: event.entity.currency ?? "INR",
      tenantId: order.tenantId,
      rentRecordId: order.rentRecordId,
      billId: event.entity.notes?.billId ?? undefined,
      paymentDate: new Date(),
    }, req);

    return { status: "PROCESSED", created: result.created };
  }

  if (event.eventType === "payment.failed" && event.entity.payment_id) {
    return { status: "PROCESSED", reason: "payment_failed" };
  }

  return { status: "SKIPPED", reason: "unsupported_event" };
}
