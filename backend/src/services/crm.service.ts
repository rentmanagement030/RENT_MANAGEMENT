import { Prisma, LeadStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma";
import { NotFoundError, BadRequestError, ConflictError } from "../utils/http";
import { buildPagination, parsePagination } from "../utils/pagination";
import { registerOrUpdateTenantAuth } from "./tenantAuth.service";
import { writeAuditLog } from "../utils/audit";
import type { Request } from "express";

export interface CreateLeadInput {
  name: string;
  phone: string;
  email?: string;
  propertyId?: string;
  roomType?: string;
  budget?: number;
  moveInDate?: Date | string;
  source?: string;
  notes?: string;
  followUpDate?: Date | string;
  assignedStaffId?: string;
}

export async function listLeads(query: Record<string, unknown>) {
  const { page, pageSize } = parsePagination(query);
  const status = query.status ? (query.status as LeadStatus) : undefined;
  const propertyId = query.propertyId ? String(query.propertyId) : undefined;
  const search = query.search ? String(query.search).trim() : undefined;

  const where: Prisma.LeadWhereInput = {
    ...(status ? { status } : {}),
    ...(propertyId ? { propertyId } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, leads] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      include: {
        property: { select: { id: true, name: true, city: true } },
        assignedStaff: { select: { id: true, name: true, phone: true } },
        activities: { orderBy: { createdAt: "desc" }, take: 5 },
        visits: { orderBy: { visitDate: "desc" }, take: 2 },
      },
      orderBy: [{ followUpDate: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return buildPagination(leads, total, { page, pageSize });
}

export async function getLead(id: string) {
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      property: true,
      assignedStaff: true,
      activities: { orderBy: { createdAt: "desc" } },
      visits: { include: { property: true, room: true }, orderBy: { visitDate: "desc" } },
      bookings: { include: { property: true, room: true, bed: true } },
    },
  });
  if (!lead) throw new NotFoundError("Lead not found");
  return lead;
}

export async function createLead(input: CreateLeadInput, req?: Request, actorId?: string) {
  if (!input.name || !input.phone) {
    throw new BadRequestError("Name and Phone are required for Lead creation");
  }

  const lead = await prisma.lead.create({
    data: {
      name: input.name,
      phone: input.phone,
      email: input.email || null,
      propertyId: input.propertyId || null,
      roomType: input.roomType || null,
      budget: input.budget ? new Prisma.Decimal(input.budget) : null,
      moveInDate: input.moveInDate ? new Date(input.moveInDate) : null,
      source: input.source || "WEBSITE",
      notes: input.notes || null,
      followUpDate: input.followUpDate ? new Date(input.followUpDate) : null,
      assignedStaffId: input.assignedStaffId || null,
      status: "NEW",
    },
  });

  await prisma.leadActivity.create({
    data: {
      leadId: lead.id,
      action: "NOTE",
      notes: `Lead registered via ${lead.source}`,
      performedBy: actorId || "SYSTEM",
    },
  });

  if (req && actorId) {
    await writeAuditLog(req, { action: "lead.created", entityType: "lead", entityId: lead.id, metadata: { name: lead.name, phone: lead.phone } }, actorId);
  }

  return lead;
}

export async function updateLead(id: string, input: Partial<CreateLeadInput> & { status?: LeadStatus }, req?: Request, actorId?: string) {
  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Lead not found");

  const updated = await prisma.lead.update({
    where: { id },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(input.phone ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email || null } : {}),
      ...(input.propertyId !== undefined ? { propertyId: input.propertyId || null } : {}),
      ...(input.roomType !== undefined ? { roomType: input.roomType || null } : {}),
      ...(input.budget !== undefined ? { budget: input.budget ? new Prisma.Decimal(input.budget) : null } : {}),
      ...(input.moveInDate !== undefined ? { moveInDate: input.moveInDate ? new Date(input.moveInDate) : null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.followUpDate !== undefined ? { followUpDate: input.followUpDate ? new Date(input.followUpDate) : null } : {}),
      ...(input.assignedStaffId !== undefined ? { assignedStaffId: input.assignedStaffId || null } : {}),
    },
  });

  if (input.status && input.status !== existing.status) {
    await prisma.leadActivity.create({
      data: {
        leadId: id,
        action: "STATUS_CHANGE",
        notes: `Status changed from ${existing.status} to ${input.status}`,
        performedBy: actorId || "SYSTEM",
      },
    });
  }

  if (req && actorId) {
    await writeAuditLog(req, { action: "lead.updated", entityType: "lead", entityId: id, metadata: { status: input.status } }, actorId);
  }

  return updated;
}

export async function addLeadActivity(leadId: string, action: string, notes: string, actorId?: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new NotFoundError("Lead not found");

  return prisma.leadActivity.create({
    data: {
      leadId,
      action,
      notes,
      performedBy: actorId || "SYSTEM",
    },
  });
}

export async function getLeadActivities(leadId: string) {
  return prisma.leadActivity.findMany({
    where: { leadId },
    orderBy: { createdAt: "desc" },
  });
}

export async function convertLeadToTenant(
  leadId: string,
  data: { rent: number; advance?: number; deposit?: number; roomId?: string; bedId?: string },
  req?: Request,
  actorId?: string,
) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new NotFoundError("Lead not found");

  const existingTenant = await prisma.tenant.findUnique({ where: { phone: lead.phone } });
  if (existingTenant) throw new ConflictError("A tenant with this phone number already exists");

  const plainPin = Math.floor(100000 + Math.random() * 900000).toString();
  const pinHash = await bcrypt.hash(plainPin, 10);

  const tenant = await prisma.$transaction(async (tx) => {
    const created = await tx.tenant.create({
      data: {
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        propertyId: lead.propertyId || undefined,
        roomId: data.roomId || undefined,
        rent: new Prisma.Decimal(data.rent),
        advance: new Prisma.Decimal(data.advance ?? 0),
        deposit: new Prisma.Decimal(data.deposit ?? 0),
        joiningDate: lead.moveInDate || new Date(),
        status: "ACTIVE",
      },
    });

    await registerOrUpdateTenantAuth(created.id, created.phone, plainPin);

    if (data.bedId) {
      await tx.pgBed.update({
        where: { id: data.bedId },
        data: { status: "OCCUPIED", tenantId: created.id },
      });
    }

    await tx.lead.update({
      where: { id: leadId },
      data: { status: "CONVERTED" },
    });

    return created;
  });

  if (req && actorId) {
    await writeAuditLog(req, { action: "lead.converted", entityType: "lead", entityId: leadId, metadata: { tenantId: tenant.id } }, actorId);
  }

  return { tenant, tempPin: plainPin };
}
