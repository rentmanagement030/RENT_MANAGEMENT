import { env } from "../config/env";
import { logger } from "../utils/logger";

interface SMSSendResult {
  ok: boolean;
  status: "SENT" | "FAILED" | "NOT_CONFIGURED";
  error?: string;
  messageId?: string;
}

export async function sendSMSMessage(
  toPhone: string,
  body: string,
): Promise<SMSSendResult> {
  const apiKey = process.env.SMS_API_KEY;
  const senderId = process.env.SMS_SENDER_ID || "RENTAL";

  if (!apiKey) {
    logger.warn("SMS provider not configured (SMS_API_KEY missing); message logged", { toPhone });
    return { ok: false, status: "NOT_CONFIGURED", error: "SMS provider not configured" };
  }

  const cleanPhone = toPhone.replace(/[^0-9]/g, "");
  const phone = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;

  try {
    // Standard HTTP POST payload interface for SMS Gateways (Twilio / Fast2SMS / Textlocal)
    const response = await fetch("https://api.sms-provider.com/v1/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: senderId,
        to: phone,
        message: body,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error("SMS delivery failed", { toPhone, status: response.status, error: errText });
      return { ok: false, status: "FAILED", error: `HTTP ${response.status}: ${errText}` };
    }

    const data = (await response.json()) as { messageId?: string };
    return { ok: true, status: "SENT", messageId: data.messageId };
  } catch (err) {
    logger.error("SMS send error", { toPhone, err: String(err) });
    return { ok: false, status: "FAILED", error: String(err) };
  }
}
