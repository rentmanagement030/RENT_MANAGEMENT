import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { NotFoundError } from "../utils/http";
import { buildPagination, parsePagination } from "../utils/pagination";
import { writeAuditLog } from "../utils/audit";
import { toDecimal } from "../utils/money";
import type { Request } from "express";

export async function listMaintenance(query: Record<string, unknown>) {
  const { page, pageSize } = parsePagination(query);
  const status = query.status ? String(query.status) : undefined;
  const propertyId = query.propertyId ? String(query.propertyId) : undefined;

  const where: Prisma.MaintenanceRequestWhereInput = {
    ...(status ? { status: status as "OPEN" } : {}),
    ...(propertyId ? { propertyId } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.maintenanceRequest.count({ where }),
    prisma.maintenanceRequest.findMany({
      where,
      include: {
        property: { select: { id: true, name: true, number: true } },
        room: { select: { id: true, roomNumber: true } },
        tenant: { select: { id: true, name: true, phone: true } },
        reportedBy: { select: { id: true, name: true } },
        assignedStaff: { select: { id: true, name: true, role: true, phone: true } },
        assignedVendor: { select: { id: true, name: true, service: true, phone: true } },
        expense: { select: { id: true, amount: true, category: true, expenseDate: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return buildPagination(items, total, { page, pageSize });
}

export async function createMaintenanceRequest(
  data: {
    propertyId: string;
    roomId?: string;
    tenantId?: string;
    description: string;
    category?: string;
    priority?: string;
    assignedStaffId?: string;
    assignedVendorId?: string;
    estimatedCost?: number;
  },
  req: Request,
  actorId: string,
) {
  const property = await prisma.property.findUnique({ where: { id: data.propertyId } });
  if (!property) throw new NotFoundError("Property not found");

  const item = await prisma.maintenanceRequest.create({
    data: {
      propertyId: data.propertyId,
      roomId: data.roomId || null,
      tenantId: data.tenantId || null,
      description: data.description,
      category: data.category || "GENERAL",
      priority: data.priority || "MEDIUM",
      assignedStaffId: data.assignedStaffId || null,
      assignedVendorId: data.assignedVendorId || null,
      estimatedCost: data.estimatedCost ? toDecimal(data.estimatedCost) : null,
      reportedById: actorId,
    },
  });

  await writeAuditLog(req, {
    action: "maintenance.created",
    entityType: "maintenance",
    entityId: item.id,
    metadata: { propertyId: data.propertyId, category: data.category },
  }, actorId);

  return item;
}

export async function updateMaintenanceStatus(
  id: string,
  data: {
    status?: "OPEN" | "IN_PROGRESS" | "RESOLVED";
    assignedStaffId?: string | null;
    assignedVendorId?: string | null;
    estimatedCost?: number | null;
    actualCost?: number | null;
    createExpense?: boolean;
    expenseCategory?: string;
  },
  req: Request,
  actorId: string,
) {
  const item = await prisma.maintenanceRequest.findUnique({ where: { id } });
  if (!item) throw new NotFoundError("Maintenance request not found");

  const status = data.status ?? item.status;
  const isCompleted = status === "RESOLVED";

  const updated = await prisma.maintenanceRequest.update({
    where: { id },
    data: {
      status,
      assignedStaffId: data.assignedStaffId !== undefined ? data.assignedStaffId : item.assignedStaffId,
      assignedVendorId: data.assignedVendorId !== undefined ? data.assignedVendorId : item.assignedVendorId,
      estimatedCost: data.estimatedCost !== undefined ? (data.estimatedCost ? toDecimal(data.estimatedCost) : null) : item.estimatedCost,
      actualCost: data.actualCost !== undefined ? (data.actualCost ? toDecimal(data.actualCost) : null) : item.actualCost,
      resolvedAt: isCompleted ? new Date() : null,
      completedAt: isCompleted ? new Date() : null,
    },
  });

  let finalResult = updated;

  // If work is completed and actualCost > 0 and createExpense requested (or if no expense exists yet), link property Expense
  if (data.createExpense && data.actualCost && data.actualCost > 0 && !item.expenseId) {
    const expense = await prisma.expense.create({
      data: {
        propertyId: item.propertyId,
        category: data.expenseCategory || "Maintenance & Repairs",
        description: `Maintenance Request #${item.id.slice(-6)}: ${item.description}`,
        amount: toDecimal(data.actualCost),
        expenseDate: new Date(),
        vendorId: updated.assignedVendorId,
        staffId: updated.assignedStaffId,
        recordedById: actorId,
      },
    });

    finalResult = await prisma.maintenanceRequest.update({
      where: { id: item.id },
      data: { expenseId: expense.id },
      include: { expense: true, property: { select: { id: true, name: true } } },
    });
  }

  await writeAuditLog(req, {
    action: "maintenance.updated",
    entityType: "maintenance",
    entityId: id,
    metadata: { status, actualCost: data.actualCost },
  }, actorId);

  return finalResult;
}
