import { Prisma, VisitStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { NotFoundError, BadRequestError } from "../utils/http";
import { buildPagination, parsePagination } from "../utils/pagination";

export interface CreateVisitInput {
  leadId: string;
  propertyId: string;
  roomId?: string;
  visitDate: Date | string;
  assignedStaffId?: string;
  notes?: string;
}

export async function listVisits(query: Record<string, unknown>) {
  const { page, pageSize } = parsePagination(query);
  const status = query.status ? (query.status as VisitStatus) : undefined;
  const propertyId = query.propertyId ? String(query.propertyId) : undefined;
  const dateStr = query.date ? String(query.date) : undefined;

  let dateWhere: Prisma.DateTimeFilter | undefined;
  if (dateStr) {
    const start = new Date(dateStr);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dateStr);
    end.setHours(23, 59, 59, 999);
    dateWhere = { gte: start, lte: end };
  }

  const where: Prisma.PropertyVisitWhereInput = {
    ...(status ? { status } : {}),
    ...(propertyId ? { propertyId } : {}),
    ...(dateWhere ? { visitDate: dateWhere } : {}),
  };

  const [total, visits] = await Promise.all([
    prisma.propertyVisit.count({ where }),
    prisma.propertyVisit.findMany({
      where,
      include: {
        lead: { select: { id: true, name: true, phone: true, email: true } },
        property: { select: { id: true, name: true, address: true, city: true } },
        room: { select: { id: true, roomNumber: true } },
        assignedStaff: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { visitDate: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return buildPagination(visits, total, { page, pageSize });
}

export async function getTodayVisits() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return prisma.propertyVisit.findMany({
    where: {
      visitDate: { gte: start, lte: end },
    },
    include: {
      lead: { select: { id: true, name: true, phone: true } },
      property: { select: { id: true, name: true } },
      room: { select: { id: true, roomNumber: true } },
      assignedStaff: { select: { id: true, name: true } },
    },
    orderBy: { visitDate: "asc" },
  });
}

export async function createVisit(input: CreateVisitInput) {
  if (!input.leadId || !input.propertyId || !input.visitDate) {
    throw new BadRequestError("Lead, Property, and Visit Date are required");
  }

  const lead = await prisma.lead.findUnique({ where: { id: input.leadId } });
  if (!lead) throw new NotFoundError("Lead not found");

  const visit = await prisma.propertyVisit.create({
    data: {
      leadId: input.leadId,
      propertyId: input.propertyId,
      roomId: input.roomId || null,
      visitDate: new Date(input.visitDate),
      assignedStaffId: input.assignedStaffId || null,
      notes: input.notes || null,
      status: "SCHEDULED",
    },
  });

  // Update Lead status to VISIT_SCHEDULED
  await prisma.lead.update({
    where: { id: input.leadId },
    data: { status: "VISIT_SCHEDULED" },
  });

  await prisma.leadActivity.create({
    data: {
      leadId: input.leadId,
      action: "VISIT_SCHEDULED",
      notes: `Visit scheduled for ${new Date(input.visitDate).toLocaleString()}`,
    },
  });

  return visit;
}

export async function updateVisitStatus(id: string, status: VisitStatus, notes?: string) {
  const visit = await prisma.propertyVisit.findUnique({ where: { id } });
  if (!visit) throw new NotFoundError("Visit not found");

  const updated = await prisma.propertyVisit.update({
    where: { id },
    data: {
      status,
      ...(notes ? { notes } : {}),
    },
  });

  if (status === "COMPLETED") {
    await prisma.lead.update({
      where: { id: visit.leadId },
      data: { status: "VISITED" },
    });
  }

  return updated;
}
