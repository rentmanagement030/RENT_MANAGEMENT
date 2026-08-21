import crypto from "node:crypto";
import { env } from "../config/env";

export const generateSessionToken = (): string => crypto.randomBytes(32).toString("hex");

export const hashToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

export const randomId = (size = 12): string =>
  crypto.randomBytes(size).toString("hex");

const base64url = (buf: Buffer) => buf.toString("base64url");

export interface SignedPayload {
  email: string;
  exp: number;
}

export function signResetToken(email: string, ttlMinutes = 60): string {
  const exp = Date.now() + ttlMinutes * 60 * 1000;
  const payload = JSON.stringify({ email, exp });
  const sig = crypto.createHmac("sha256", env.authSecret).update(payload).digest();
  return `${base64url(Buffer.from(payload))}.${base64url(sig)}`;
}

export function verifyResetToken(token: string): SignedPayload | null {
  try {
    const [payloadB64, sigB64] = token.split(".");
    if (!payloadB64 || !sigB64) return null;
    const payloadBuf = Buffer.from(payloadB64, "base64url");
    const expected = crypto.createHmac("sha256", env.authSecret).update(payloadBuf).digest();
    const provided = Buffer.from(sigB64, "base64url");
    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
      return null;
    }
    const payload = JSON.parse(payloadBuf.toString("utf8")) as SignedPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
