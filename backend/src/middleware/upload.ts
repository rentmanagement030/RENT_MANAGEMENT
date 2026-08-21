import multer from "multer";
import path from "node:path";
import { uploadToCloudinary } from "../utils/storage";

const ALLOWED_DOC_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

function fileFilter(allowed: Set<string>) {
  return (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExt = [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".avif"];
    if (allowed.has(file.mimetype) && allowedExt.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type"));
    }
  };
}

// Memory storage for direct Cloudinary upload without local disk persistence
export const uploadTenantDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: fileFilter(ALLOWED_DOC_MIME),
});

export const uploadPropertyImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: fileFilter(ALLOWED_IMAGE_MIME),
});

export function privateStorageKey(file: Express.Multer.File): string {
  return file.filename || `private/${file.originalname}`;
}

export function publicStorageKey(file: Express.Multer.File): string {
  return file.filename || `public/${file.originalname}`;
}

export function publicUrlFor(file: Express.Multer.File): string {
  return (file as any).cloudinaryUrl || file.filename || `https://res.cloudinary.com/c5rjvjvf/image/upload/${file.originalname}`;
}

export { uploadToCloudinary };
