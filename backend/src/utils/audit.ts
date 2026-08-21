import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import type { Request } from "express";

export interface AuditMeta {
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: unknown;
}

export async function writeAuditLog(
  req?: Request | null,
  meta?: AuditMeta,
  userId?: string | null,
): Promise<void> {
  if (!meta) return;
  try {
    let validUserId: string | undefined = undefined;
    if (userId) {
      const userExists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (userExists) validUserId = userId;
    }

    await prisma.auditLog.create({
      data: {
        userId: validUserId,
        action: meta.action,
        entityType: meta.entityType,
        entityId: meta.entityId,
        metadata: (meta.metadata as Prisma.InputJsonValue) ?? undefined,
        ip: req?.ip ?? undefined,
        userAgent: req?.get ? req.get("user-agent") : undefined,
      },
    });
  } catch (err) {
    // Audit logging must never break the main request.
    console.error("audit log write failed", err);
  }
}
