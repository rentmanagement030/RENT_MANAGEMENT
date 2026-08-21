import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { buildPagination, parsePagination } from "../utils/pagination";

export async function listAuditLogs(query: Record<string, unknown>) {
  const { page, pageSize } = parsePagination(query);
  const action = query.action ? String(query.action) : undefined;
  const entityType = query.entityType ? String(query.entityType) : undefined;
  const userId = query.userId ? String(query.userId) : undefined;
  const from = query.from ? new Date(String(query.from)) : undefined;
  const to = query.to ? new Date(String(query.to)) : undefined;

  const where: Prisma.AuditLogWhereInput = {
    ...(action ? { action: { contains: action, mode: "insensitive" } } : {}),
    ...(entityType ? { entityType } : {}),
    ...(userId ? { userId } : {}),
    ...(from || to ? { createdAt: { gte: from, lte: to } } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return buildPagination(items, total, { page, pageSize });
}
