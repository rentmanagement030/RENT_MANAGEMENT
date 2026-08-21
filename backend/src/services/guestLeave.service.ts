import { Prisma, LeaveStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { NotFoundError, BadRequestError } from "../utils/http";
import { buildPagination, parsePagination } from "../utils/pagination";

export async function listGuestLogs(tenantId?: string, query: Record<string, unknown> = {}) {
  const { page, pageSize } = parsePagination(query);
  const where: Prisma.GuestLogWhereInput = {
    ...(tenantId ? { tenantId } : {}),
  };

  const [total, logs] = await Promise.all([
    prisma.guestLog.count({ where }),
    prisma.guestLog.findMany({
      where,
      include: {
        tenant: { select: { id: true, name: true, room: { select: { roomNumber: true } } } },
      },
      orderBy: { entryDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return buildPagination(logs, total, { page, pageSize });
}

export async function createGuestLog(tenantId: string, data: { guestName: string; guestPhone: string; relation?: string; notes?: string }) {
  if (!data.guestName || !data.guestPhone) throw new BadRequestError("Guest Name and Phone are required");

  return prisma.guestLog.create({
    data: {
      tenantId,
      guestName: data.guestName,
      guestPhone: data.guestPhone.replace(/\D/g, ""),
      relation: data.relation || null,
      notes: data.notes || null,
      entryDate: new Date(),
    },
  });
}

export async function markGuestExit(id: string) {
  const log = await prisma.guestLog.findUnique({ where: { id } });
  if (!log) throw new NotFoundError("Guest log entry not found");

  return prisma.guestLog.update({
    where: { id },
    data: { exitDate: new Date() },
  });
}

export async function listTenantLeaves(tenantId?: string, query: Record<string, unknown> = {}) {
  const { page, pageSize } = parsePagination(query);
  const status = query.status ? (query.status as LeaveStatus) : undefined;
  const where: Prisma.TenantLeaveWhereInput = {
    ...(tenantId ? { tenantId } : {}),
    ...(status ? { status } : {}),
  };

  const [total, leaves] = await Promise.all([
    prisma.tenantLeave.count({ where }),
    prisma.tenantLeave.findMany({
      where,
      include: {
        tenant: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { startDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return buildPagination(leaves, total, { page, pageSize });
}

export async function createTenantLeave(tenantId: string, data: { startDate: Date | string; endDate: Date | string; reason: string }) {
  if (!data.startDate || !data.endDate || !data.reason) throw new BadRequestError("Start date, End date, and Reason are required");

  return prisma.tenantLeave.create({
    data: {
      tenantId,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      reason: data.reason,
      status: "PENDING",
    },
  });
}

export async function updateLeaveStatus(id: string, status: LeaveStatus, notes?: string) {
  const leave = await prisma.tenantLeave.findUnique({ where: { id } });
  if (!leave) throw new NotFoundError("Leave request not found");

  return prisma.tenantLeave.update({
    where: { id },
    data: {
      status,
      ...(notes ? { notes } : {}),
    },
  });
}
