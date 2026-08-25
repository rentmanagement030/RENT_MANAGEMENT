import { env } from "../config/env";
import { logger } from "../utils/logger";

interface WhatsAppSendResult {
  ok: boolean;
  error?: string;
  messageId?: string;
}

export async function sendWhatsAppMessage(
  toPhone: string,
  body: string,
): Promise<WhatsAppSendResult> {
  if (!env.whatsappAccessToken || !env.whatsappPhoneNumberId) {
    logger.warn("WhatsApp credentials not configured; message not sent", { toPhone });
    return { ok: false, error: "WhatsApp not configured" };
  }

  const cleanPhone = toPhone.replace(/[^0-9]/g, "");
  const phone = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;

  try {
    // Attempt 1: Try text payload
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${env.whatsappPhoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.whatsappAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: { body },
        }),
      },
    );

    const data = (await res.json()) as { messages?: { id?: string }[]; error?: { message?: string } };

    // If Attempt 1 fails (e.g. outside 24h customer service window), attempt fallback with template
    if (!res.ok) {
      logger.warn("WhatsApp text message send failed, trying template fallback...", {
        toPhone,
        status: res.status,
        error: data.error,
      });

      const templateRes = await fetch(
        `https://graph.facebook.com/v22.0/${env.whatsappPhoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.whatsappAccessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: phone,
            type: "template",
            template: {
              name: "hello_world",
              language: { code: "en_US" },
            },
          }),
        },
      );

      const templateData = (await templateRes.json()) as {
        messages?: { id?: string }[];
        error?: { message?: string };
      };

      if (templateRes.ok) {
        logger.info("WhatsApp template fallback succeeded", { toPhone, messageId: templateData.messages?.[0]?.id });
        return { ok: true, messageId: templateData.messages?.[0]?.id };
      }

      logger.error("WhatsApp send failed for both text and template", {
        toPhone,
        textError: data.error,
        templateError: templateData.error,
      });
      return { ok: false, error: data.error?.message ?? `HTTP ${res.status}` };
    }

    return { ok: true, messageId: data.messages?.[0]?.id };
  } catch (err) {
    logger.error("WhatsApp send error", { toPhone, err: String(err) });
    return { ok: false, error: String(err) };
  }
}

export function paymentConfirmationBody(opts: {
  tenantName: string;
  amount: string;
  receiptNumber: string;
  method: string;
  remainingBalance?: string;
  receiptUrl?: string;
}): string {
  const methodLabel: Record<string, string> = {
    RAZORPAY_UPI: "UPI (Razorpay)",
    CASH: "Cash",
    UPI: "UPI",
    MIXED: "Cash + UPI",
    BANK_TRANSFER_DD: "Bank Transfer / DD",
  };
  const parts = [
    `Dear ${opts.tenantName},`,
    ``,
    `Payment of ${opts.amount} has been received successfully via ${methodLabel[opts.method] ?? opts.method}.`,
    `Receipt Number: ${opts.receiptNumber}`,
  ];
  if (opts.remainingBalance) {
    parts.push(`Remaining Balance: ${opts.remainingBalance}`);
  }
  if (opts.receiptUrl) {
    parts.push(``, `Download / View Payment Receipt:\n${opts.receiptUrl}`);
  }
  parts.push(
    ``,
    `Thank you for your payment.`,
    ``,
    `- ${env.nodeEnv === "production" ? "Rental Management" : "C2D Tech Rentals"}`,
  );
  return parts.join("\n");
}

export function billGeneratedBody(opts: {
  tenantName: string;
  propertyName: string;
  billNumber: string;
  billingMonth: string;
  amount: string;
  dueDate: string;
  billType?: string;
  payUrl?: string;
}): string {
  const parts = [
    `Dear ${opts.tenantName},`,
    ``,
    `Your ${opts.billType || "Rent"} Bill (${opts.billNumber}) for ${opts.billingMonth} has been generated for ${opts.propertyName}.`,
    ``,
    `Amount Due: ${opts.amount}`,
    `Due Date: ${opts.dueDate}`,
  ];
  if (opts.payUrl) {
    parts.push(``, `Pay / View Invoice Online:\n${opts.payUrl}`);
  }
  parts.push(
    ``,
    `Kindly ensure payment on or before the due date to avoid late fees.`,
    ``,
    `- ${env.nodeEnv === "production" ? "Rental Management" : "C2D Tech Rentals"}`,
  );
  return parts.join("\n");
}

export function rentOutstandingReminderBody(opts: {
  tenantName: string;
  propertyName: string;
  outstandingAmount: string;
  dueDate: string;
  daysOverdue?: number;
  payUrl?: string;
}): string {
  const daysOverdue = opts.daysOverdue ?? 0;
  const isOverdue = daysOverdue > 0;
  const statusLine = isOverdue
    ? `⚠️ This payment is OVERDUE by ${daysOverdue} day${daysOverdue > 1 ? "s" : ""}.`
    : `Due Date: ${opts.dueDate}`;

  const parts = [
    `Dear ${opts.tenantName},`,
    ``,
    `This is a gentle daily reminder regarding your outstanding dues for ${opts.propertyName}.`,
    ``,
    `Total Outstanding: ${opts.outstandingAmount}`,
    statusLine,
  ];
  if (opts.payUrl) {
    parts.push(``, `Pay Online:\n${opts.payUrl}`);
  }
  parts.push(
    ``,
    `If you have already made the payment, please disregard this reminder.`,
    ``,
    `- ${env.nodeEnv === "production" ? "Rental Management" : "C2D Tech Rentals"}`,
  );
  return parts.join("\n");
}

export function agreementSigningBody(opts: {
  tenantName: string;
  propertyName: string;
  agreementNumber: string;
  signUrl: string;
  rentAmount: string;
  expiresDays?: number;
}): string {
  return [
    `Dear ${opts.tenantName},`,
    ``,
    `Your Rental Agreement (${opts.agreementNumber}) for ${opts.propertyName} has been prepared and is ready for your digital signature.`,
    ``,
    `Monthly Rent: ${opts.rentAmount}`,
    ``,
    `Please review and sign your lease agreement using the secure link below:`,
    `${opts.signUrl}`,
    ``,
    `This signing link will remain active for ${opts.expiresDays || 7} days.`,
    ``,
    `- ${env.nodeEnv === "production" ? "Rental Management" : "C2D Tech Rentals"}`,
  ].join("\n");
}
