import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/http";
import { logger } from "../utils/logger";

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ success: false, error: "Route not found" });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    if (err.statusCode >= 400) {
      logger.warn(`Rejected ${req.method} ${req.originalUrl}: ${err.message}`, {
        statusCode: err.statusCode,
        details: err.details,
      });
    }
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      details: err.details,
      code: err.code,
    });
  }

  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ success: false, error: "Invalid JSON payload" });
  }

  // Prisma known request errors
  const code = (err as { code?: string })?.code;
  if (code === "P2002") {
    const target = (err as { meta?: { target?: string[] } })?.meta?.target?.join(", ");
    return res.status(409).json({
      success: false,
      error: `A record with the same value already exists${target ? ` (${target})` : ""}`,
    });
  }
  if (code === "P2025") {
    return res.status(404).json({ success: false, error: "Record not found" });
  }
  if (code === "P2003") {
    return res.status(409).json({
      success: false,
      error: "Operation violates a related record constraint",
    });
  }

  logger.error(`Unhandled error on ${req.method} ${req.path}`, {
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  res.status(500).json({ success: false, error: "Something went wrong. Please try again." });
}
