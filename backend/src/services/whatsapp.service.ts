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
}): string {
  const methodLabel: Record<string, string> = {
    RAZORPAY_UPI: "UPI (Razorpay)",
    CASH: "Cash",
    BANK_TRANSFER_DD: "Bank Transfer / DD",
  };
  return [
    `Dear ${opts.tenantName},`,
    ``,
    `Payment of ${opts.amount} received via ${methodLabel[opts.method] ?? opts.method}.`,
    `Receipt: ${opts.receiptNumber}`,
    ``,
    `Thank you.`,
    ``,
    `- ${env.nodeEnv === "production" ? "Rental Management" : "C2D Tech Rentals"}`,
  ].join("\n");
}
