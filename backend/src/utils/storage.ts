import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";
import { logger } from "./logger";

// Configure Cloudinary with user provided credentials
cloudinary.config({
  cloud_name: env.cloudinaryCloudName,
  api_key: env.cloudinaryApiKey,
  api_secret: env.cloudinaryApiSecret,
  secure: true,
});

const UPLOAD_ROOT = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");
const PUBLIC_DIR = path.join(UPLOAD_ROOT, "public");
const PRIVATE_DIR = path.join(UPLOAD_ROOT, "private");

function ensureDirs() {
  try {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    fs.mkdirSync(PRIVATE_DIR, { recursive: true });
  } catch (e) {
    // Ignore directory creation errors if read-only filesystem
  }
}
ensureDirs();

export interface SavedFile {
  url?: string;
  storageKey: string;
}

const safeName = (original: string): string => {
  const ext = path.extname(original).toLowerCase().replace(/[^a-z0-9.]/g, "");
  return `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
};

/**
 * Upload buffer directly to Cloudinary cloud storage.
 */
export async function uploadToCloudinary(
  fileBuffer: Buffer,
  folder = "c2d_rentals",
  resourceType: "image" | "raw" | "auto" = "auto"
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (error || !result) {
          logger.error("Cloudinary upload error", { error });
          return reject(error || new Error("Cloudinary upload failed"));
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    uploadStream.end(fileBuffer);
  });
}

export function savePublic(buffer: Buffer, originalName: string): SavedFile {
  const name = safeName(originalName);
  try {
    fs.writeFileSync(path.join(PUBLIC_DIR, name), buffer);
  } catch (e) {
    logger.warn("Local disk write skipped or failed", { error: String(e) });
  }
  
  uploadToCloudinary(buffer, "c2d_rentals/public")
    .then(({ url }) => {
      logger.info("Public file uploaded to Cloudinary", { url });
    })
    .catch((err) => logger.error("Background Cloudinary upload failed", { err }));

  const url = `${env.apiBaseUrl}/uploads/public/${name}`;
  return { url, storageKey: `public/${name}` };
}

export function savePrivate(buffer: Buffer, originalName: string): SavedFile {
  const name = safeName(originalName);
  try {
    fs.writeFileSync(path.join(PRIVATE_DIR, name), buffer);
  } catch (e) {
    logger.warn("Local disk write skipped or failed", { error: String(e) });
  }

  uploadToCloudinary(buffer, "c2d_rentals/private", "raw")
    .then(({ url }) => {
      logger.info("Private document uploaded to Cloudinary", { url });
    })
    .catch((err) => logger.error("Background Cloudinary upload failed", { err }));

  return { storageKey: `private/${name}` };
}

export function readPrivate(storageKey: string): Buffer {
  const name = path.basename(storageKey);
  const localPath = path.join(PRIVATE_DIR, name);
  if (fs.existsSync(localPath)) {
    return fs.readFileSync(localPath);
  }
  return Buffer.from("");
}

/** Read a stored file from either public or private uploads dir. */
export function readStored(storageKey: string): Buffer {
  if (storageKey.startsWith("http://") || storageKey.startsWith("https://")) {
    return Buffer.from("");
  }
  const isPublic = storageKey.startsWith("public/");
  const base = isPublic ? PUBLIC_DIR : PRIVATE_DIR;
  const name = path.basename(storageKey);
  const localPath = path.join(base, name);
  if (fs.existsSync(localPath)) {
    return fs.readFileSync(localPath);
  }
  return Buffer.from("");
}

export function getFileBuffer(storageKey: string): Buffer {
  return readStored(storageKey);
}

export function deleteFile(storageKey: string) {
  if (storageKey.startsWith("http://") || storageKey.startsWith("https://")) {
    const publicId = storageKey.split("/").slice(-2).join("/").split(".")[0];
    cloudinary.uploader.destroy(publicId, (err) => {
      if (err) logger.warn("Failed to delete Cloudinary file", { publicId, err });
    });
    return;
  }
  const isPublic = storageKey.startsWith("public/");
  const base = isPublic ? PUBLIC_DIR : PRIVATE_DIR;
  const name = path.basename(storageKey);
  const full = path.join(base, name);
  if (fs.existsSync(full)) {
    try {
      fs.unlinkSync(full);
    } catch (err) {
      logger.warn("Failed to delete file", { storageKey, err: String(err) });
    }
  }
}

export function signDownloadToken(storageKey: string, ttlSeconds = 300): string {
  const exp = Date.now() + ttlSeconds * 1000;
  const payload = JSON.stringify({ k: storageKey, exp });
  const sig = crypto.createHmac("sha256", env.authSecret).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifyDownloadToken(token: string): string | null {
  try {
    const [payloadB64, sigB64] = token.split(".");
    if (!payloadB64 || !sigB64) return null;
    const payloadBuf = Buffer.from(payloadB64, "base64url");
    const expected = crypto.createHmac("sha256", env.authSecret).update(payloadBuf).digest();
    const provided = Buffer.from(sigB64, "base64url");
    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
      return null;
    }
    const payload = JSON.parse(payloadBuf.toString("utf8")) as { k: string; exp: number };
    if (payload.exp < Date.now()) return null;
    return payload.k;
  } catch {
    return null;
  }
}
