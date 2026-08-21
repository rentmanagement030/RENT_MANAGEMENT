import type { Request, Response } from "express";
import { asyncHandler, UnauthorizedError } from "../utils/http";
import { readStored, verifyDownloadToken } from "../utils/storage";

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  txt: "text/plain",
  csv: "text/csv",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export const downloadFile = asyncHandler(async (req: Request, res: Response) => {
  const token = req.params.token;
  const storageKey = verifyDownloadToken(token);
  if (!storageKey) throw new UnauthorizedError("Invalid or expired download link");

  if (storageKey.startsWith("http://") || storageKey.startsWith("https://")) {
    return res.redirect(storageKey);
  }

  const buffer = readStored(storageKey);
  const filename = storageKey.split("/").pop() ?? "document";
  const ext = (filename.split(".").pop() ?? "").toLowerCase();
  const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";

  res.setHeader("Content-Type", mime);
  res.setHeader("Content-Length", String(buffer.length));
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  res.send(buffer);
});
