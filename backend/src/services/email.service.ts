import nodemailer from "nodemailer";
import { env } from "../config/env";
import { logger } from "../utils/logger";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!env.smtpHost) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPassword } : undefined,
    });
  }
  return transporter;
}

export async function sendEmail(to: string, subject: string, text: string) {
  const t = getTransporter();
  if (!t) {
    logger.warn("SMTP not configured; email not sent", { to, subject });
    return { ok: false, error: "Email not configured" };
  }
  try {
    await t.sendMail({ from: env.emailFrom, to, subject, text });
    return { ok: true };
  } catch (err) {
    logger.error("Email send failed", { to, err: String(err) });
    return { ok: false, error: String(err) };
  }
}
