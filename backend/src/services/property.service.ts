import { Prisma, PropertyStatus, PropertyType, BedStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { NotFoundError, ConflictError } from "../utils/http";
import { buildPagination, parsePagination } from "../utils/pagination";
import { writeAuditLog } from "../utils/audit";
import type { Request } from "express";

export interface PropertyInput {
  type: PropertyType;
  name: string;
  number?: string;
  address: string;
  city: string;
  area?: string;
  rent: number;
  advance?: number;
  deposit?: number;
  dueDay?: number;
  latePenalty?: number;
  status?: PropertyStatus;
  description?: string;
  amenities?: string[];
  publicVisibility?: boolean;
  contactPhone?: string;
  bhkType?: string;
  maxCapacity?: number;
  ebNumber?: string;
}

const propertyInclude = {
  images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
  rooms: {
    include: {
      beds: {
        where: { archived: false },
        include: { tenant: { select: { id: true, name: true, phone: true } } },
        orderBy: { bedNumber: "asc" },
      },
    },
  },
  homes: {
    where: { archived: false },
    include: {
      tenants: { where: { status: "ACTIVE" }, select: { id: true, name: true, phone: true } },
    },
    orderBy: [{ floor: "asc" }, { homeNumber: "asc" }],
  },
  tenants: { where: { status: "ACTIVE" }, select: { id: true, name: true, phone: true } },
} satisfies Prisma.PropertyInclude;

import { serializeAdminProperty } from "../utils/serializers";

export async function listProperties(query: Record<string, unknown>) {
  const { page, pageSize } = parsePagination(query);
  const search = String(query.search ?? "").trim();
  const type = query.type ? String(query.type) : undefined;
  const status = query.status ? String(query.status) : undefined;
  const city = query.city ? String(query.city) : undefined;
  const includeArchived = query.includeArchived === "true";

  const where: Prisma.PropertyWhereInput = {
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { number: { contains: search, mode: "insensitive" } },
            { address: { contains: search, mode: "insensitive" } },
            { city: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(type ? { type: type as PropertyType } : {}),
    ...(status ? { status: status as PropertyStatus } : {}),
    ...(city ? { city } : {}),
    ...(!includeArchived ? { archived: false } : {}),
  };

  const [total, properties] = await Promise.all([
    prisma.property.count({ where }),
    prisma.property.findMany({
      where,
      include: propertyInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return buildPagination(properties.map(serializeAdminProperty), total, { page, pageSize });
}

export async function getProperty(id: string) {
  const property = await prisma.property.findUnique({ where: { id }, include: propertyInclude });
  if (!property) throw new NotFoundError("Property not found");
  return serializeAdminProperty(property);
}

export async function createProperty(input: PropertyInput, req: Request, actorId: string) {
  const property = await prisma.property.create({
    data: {
      type: input.type,
      name: input.name,
      number: input.number || null,
      address: input.address,
      city: input.city,
      area: input.area || null,
      rent: new Prisma.Decimal(input.rent),
      advance: new Prisma.Decimal(input.advance ?? 0),
      deposit: new Prisma.Decimal(input.deposit ?? 0),
      dueDay: input.dueDay ?? 5,
      latePenalty: new Prisma.Decimal(input.latePenalty ?? 50),
      status: input.status ?? "AVAILABLE",
      description: input.description || null,
      amenities: input.amenities ?? [],
      publicVisibility: input.publicVisibility ?? false,
      contactPhone: input.contactPhone || null,
      bhkType: input.bhkType || null,
      maxCapacity: input.maxCapacity ?? null,
      ebNumber: input.ebNumber || null,
    },
  });
  await writeAuditLog(req, {
    action: "property.created",
    entityType: "property",
    entityId: property.id,
    metadata: { name: property.name, type: property.type },
  }, actorId);
  return property;
}

export async function updateProperty(
  id: string,
  input: Partial<PropertyInput>,
  req: Request,
  actorId: string,
) {
  const existing = await prisma.property.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Property not found");

  const property = await prisma.property.update({
    where: { id },
    data: {
      type: input.type,
      name: input.name,
      number: input.number !== undefined ? input.number || null : undefined,
      address: input.address,
      city: input.city,
      area: input.area !== undefined ? input.area || null : undefined,
      rent: input.rent !== undefined ? new Prisma.Decimal(input.rent) : undefined,
      advance: input.advance !== undefined ? new Prisma.Decimal(input.advance) : undefined,
      deposit: input.deposit !== undefined ? new Prisma.Decimal(input.deposit) : undefined,
      dueDay: input.dueDay !== undefined ? input.dueDay : undefined,
      latePenalty: input.latePenalty !== undefined ? new Prisma.Decimal(input.latePenalty) : undefined,
      status: input.status,
      description: input.description !== undefined ? input.description || null : undefined,
      amenities: input.amenities,
      publicVisibility: input.publicVisibility,
      contactPhone: input.contactPhone !== undefined ? input.contactPhone || null : undefined,
      bhkType: input.bhkType !== undefined ? input.bhkType || null : undefined,
      maxCapacity: input.maxCapacity ?? undefined,
      ebNumber: input.ebNumber !== undefined ? input.ebNumber || null : undefined,
    },
  });

  await writeAuditLog(req, {
    action: "property.updated",
    entityType: "property",
    entityId: id,
    metadata: { changed: Object.keys(input) },
  }, actorId);

  return property;
}

export async function archiveProperty(id: string, req: Request, actorId: string) {
  const existing = await prisma.property.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Property not found");
  const property = await prisma.property.update({
    where: { id },
    data: { archived: true, publicVisibility: false },
  });
  await writeAuditLog(req, {
    action: "property.archived",
    entityType: "property",
    entityId: id,
  }, actorId);
  return property;
}

export async function deleteProperty(id: string, req: Request, actorId: string) {
  const existing = await prisma.property.findUnique({
    where: { id },
    include: { tenants: { where: { status: "ACTIVE" } } },
  });
  if (!existing) throw new NotFoundError("Property not found");

  if (existing.tenants.length > 0) {
    throw new ConflictError("Cannot delete property while active residents are assigned to it. Please reassign or relocate residents first.");
  }

  await prisma.$transaction(async (tx) => {
    // 0. Break circular foreign key relations between PgBed/PropertyHome and Tenant/Room
    await tx.pgBed.updateMany({ where: { room: { propertyId: id } }, data: { tenantId: null, status: "AVAILABLE" } });
    await tx.tenant.updateMany({ where: { propertyId: id }, data: { roomId: null, homeId: null } });

    // 1. Delete payment allocations & payments for this property
    await tx.paymentAllocation.deleteMany({
      where: {
        OR: [
          { payment: { propertyId: id } },
          { bill: { propertyId: id } },
        ],
      },
    });
    await tx.payment.deleteMany({ where: { propertyId: id } });
    await tx.paymentLink.deleteMany({ where: { tenant: { propertyId: id } } });

    // 2. Delete bills & rent records for this property
    await tx.billItem.deleteMany({ where: { bill: { propertyId: id } } });
    await tx.penalty.deleteMany({ where: { bill: { propertyId: id } } });
    await tx.bill.deleteMany({ where: { propertyId: id } });
    await tx.rentAdjustment.deleteMany({ where: { rentRecord: { propertyId: id } } });
    await tx.rentRecord.deleteMany({ where: { propertyId: id } });

    // 3. Delete agreements, maintenance requests, leads, bookings, visits, notifications, expenses for this property
    await tx.agreement.deleteMany({ where: { propertyId: id } });
    await tx.maintenanceRequest.deleteMany({ where: { propertyId: id } });
    await tx.propertyVisit.deleteMany({ where: { propertyId: id } });
    await tx.lead.deleteMany({ where: { propertyId: id } });
    await tx.booking.deleteMany({ where: { propertyId: id } });
    await tx.notification.deleteMany({
      where: {
        OR: [
          { tenant: { propertyId: id } },
          { bill: { propertyId: id } },
        ],
      },
    });
    await tx.expense.deleteMany({ where: { propertyId: id } });

    // 4. Delete inactive/former tenants and their family/docs/guest logs/leaves
    await tx.familyMember.deleteMany({ where: { tenant: { propertyId: id } } });
    await tx.tenantDocument.deleteMany({ where: { tenant: { propertyId: id } } });
    await tx.guestLog.deleteMany({ where: { tenant: { propertyId: id } } });
    await tx.tenantLeave.deleteMany({ where: { tenant: { propertyId: id } } });
    await tx.tenantTransferHistory.deleteMany({
      where: {
        OR: [
          { fromPropertyId: id },
          { toPropertyId: id },
          { tenant: { propertyId: id } },
        ],
      },
    });
    await tx.tenant.deleteMany({ where: { propertyId: id } });

    // 5. Delete tax records, homes, rooms, beds, images
    await tx.taxPaymentRecord.deleteMany({ where: { taxRecord: { propertyId: id } } });
    await tx.taxRecord.deleteMany({ where: { propertyId: id } });

    await tx.pgBed.deleteMany({ where: { room: { propertyId: id } } });
    await tx.pgRoom.deleteMany({ where: { propertyId: id } });
    await tx.propertyHome.deleteMany({ where: { propertyId: id } });
    await tx.propertyImage.deleteMany({ where: { propertyId: id } });

    // 6. Delete the property itself
    await tx.property.delete({ where: { id } });
  });

  await writeAuditLog(req, {
    action: "property.deleted",
    entityType: "property",
    entityId: id,
  }, actorId);

  return { success: true, message: "Property permanently deleted" };
}

export async function setPropertyImages(
  id: string,
  images: { url: string; storageKey?: string | null; isPrimary?: boolean; type?: string; sortOrder?: number }[],
  req: Request,
  actorId: string,
) {
  const existing = await prisma.property.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Property not found");

  await prisma.$transaction(async (tx) => {
    await tx.propertyImage.deleteMany({ where: { propertyId: id } });
    if (images.length) {
      await tx.propertyImage.createMany({
        data: images.map((img, i) => ({
          propertyId: id,
          url: img.url,
          storageKey: img.storageKey ?? null,
          isPrimary: img.isPrimary ?? i === 0,
          type: img.type ?? "GALLERY",
          sortOrder: img.sortOrder ?? i,
        })),
      });
    }
  });

  await writeAuditLog(req, {
    action: "property.images_updated",
    entityType: "property",
    entityId: id,
    metadata: { count: images.length },
  }, actorId);
}

// ---------------------------------------------------------------------------
// PG rooms / beds
// ---------------------------------------------------------------------------

export async function listRooms(propertyId: string) {
  return prisma.pgRoom.findMany({
    where: { propertyId, archived: false },
    include: {
      beds: {
        where: { archived: false },
        include: { tenant: { select: { id: true, name: true, phone: true } } },
        orderBy: { bedNumber: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function createRoom(
  data: { propertyId: string; floor?: string; roomNumber: string; capacity?: number; rent?: number; advance?: number; deposit?: number },
  req: Request,
  actorId: string,
) {
  const property = await prisma.property.findUnique({ where: { id: data.propertyId } });
  if (!property) throw new NotFoundError("Property not found");
  if (property.type !== "PG") throw new ConflictError("Rooms can only be created for PG properties");

  const room = await prisma.pgRoom.create({
    data: {
      propertyId: data.propertyId,
      floor: data.floor || null,
      roomNumber: data.roomNumber,
      capacity: data.capacity ?? 1,
      rent: data.rent !== undefined && data.rent !== null ? new Prisma.Decimal(data.rent) : null,
      advance: data.advance !== undefined && data.advance !== null ? new Prisma.Decimal(data.advance) : null,
      deposit: data.deposit !== undefined && data.deposit !== null ? new Prisma.Decimal(data.deposit) : null,
    },
  });
  await writeAuditLog(req, {
    action: "pg.room_created",
    entityType: "pg_room",
    entityId: room.id,
    metadata: { propertyId: data.propertyId, roomNumber: room.roomNumber },
  }, actorId);
  return room;
}

export async function updateRoom(
  roomId: string,
  data: Partial<{ floor?: string; roomNumber?: string; capacity?: number; rent?: number | null; advance?: number | null; deposit?: number | null; status?: BedStatus }>,
  req: Request,
  actorId: string,
) {
  const room = await prisma.pgRoom.findUnique({ where: { id: roomId } });
  if (!room) throw new NotFoundError("Room not found");
  const updated = await prisma.pgRoom.update({
    where: { id: roomId },
    data: {
      floor: data.floor,
      roomNumber: data.roomNumber,
      capacity: data.capacity,
      rent: data.rent !== undefined ? (data.rent !== null ? new Prisma.Decimal(data.rent) : null) : undefined,
      advance: data.advance !== undefined ? (data.advance !== null ? new Prisma.Decimal(data.advance) : null) : undefined,
      deposit: data.deposit !== undefined ? (data.deposit !== null ? new Prisma.Decimal(data.deposit) : null) : undefined,
      status: data.status,
    },
  });
  await writeAuditLog(req, {
    action: "pg.room_updated",
    entityType: "pg_room",
    entityId: roomId,
  }, actorId);
  return updated;
}

export async function deleteRoom(roomId: string, req: Request, actorId: string) {
  const room = await prisma.pgRoom.findUnique({
    where: { id: roomId },
    include: { beds: { where: { archived: false } } },
  });
  if (!room) throw new NotFoundError("Room not found");
  if (room.beds.some((b) => b.status === "OCCUPIED")) {
    throw new ConflictError("Cannot delete a room with occupied beds");
  }
  await prisma.$transaction([
    prisma.pgBed.deleteMany({ where: { roomId } }),
    prisma.pgRoom.delete({ where: { id: roomId } }),
  ]);
  await writeAuditLog(req, {
    action: "pg.room_deleted",
    entityType: "pg_room",
    entityId: roomId,
    metadata: { roomNumber: room.roomNumber },
  }, actorId);
  return { message: "Room deleted" };
}

export async function createBeds(
  roomId: string,
  bedNumbers: string[],
  req: Request,
  actorId: string,
  financials?: { rent?: number; advance?: number; deposit?: number },
) {
  const room = await prisma.pgRoom.findUnique({ where: { id: roomId } });
  if (!room) throw new NotFoundError("Room not found");
  const beds = await prisma.$transaction(
    bedNumbers.map((bedNumber) =>
      prisma.pgBed.create({
        data: {
          roomId,
          bedNumber,
          rent: financials?.rent !== undefined && financials.rent !== null ? new Prisma.Decimal(financials.rent) : null,
          advance: financials?.advance !== undefined && financials.advance !== null ? new Prisma.Decimal(financials.advance) : null,
          deposit: financials?.deposit !== undefined && financials.deposit !== null ? new Prisma.Decimal(financials.deposit) : null,
        },
      }),
    ),
  );
  await writeAuditLog(req, {
    action: "pg.beds_created",
    entityType: "pg_bed",
    entityId: roomId,
    metadata: { bedNumbers },
  }, actorId);
  return beds;
}

export async function updateBed(
  bedId: string,
  data: Partial<{ bedNumber?: string; rent?: number | null; advance?: number | null; deposit?: number | null; status?: BedStatus; tenantId?: string | null }>,
  req: Request,
  actorId: string,
) {
  const bed = await prisma.pgBed.findUnique({
    where: { id: bedId },
    include: { room: true },
  });
  if (!bed) throw new NotFoundError("Bed not found");

  if (data.tenantId) {
    const occupied = await prisma.pgBed.findFirst({
      where: { tenantId: data.tenantId, id: { not: bedId } },
    });
    if (occupied) {
      throw new ConflictError("Tenant is already assigned to another bed");
    }
  }

  // Determine auto status if tenantId is provided or cleared
  let nextStatus = data.status ?? bed.status;
  let nextTenantId = data.tenantId !== undefined ? data.tenantId : bed.tenantId;

  if (data.status === "AVAILABLE" && bed.tenantId) {
    // If explicitly set to AVAILABLE, unassign current tenant
    nextTenantId = null;
  } else if (data.status === "OCCUPIED" && !nextTenantId) {
    // If set to OCCUPIED without tenant, maintain status
    nextStatus = "OCCUPIED";
  } else if (nextTenantId && nextStatus === "AVAILABLE") {
    nextStatus = "OCCUPIED";
  }

  const updated = await prisma.$transaction(async (tx) => {
    // 1. If unassigning, clear previous tenant's bed reference
    if (bed.tenantId && nextTenantId === null) {
      await tx.tenant.updateMany({
        where: { id: bed.tenantId },
        data: { roomId: null },
      });
    }

    // 2. Update bed
    const res = await tx.pgBed.update({
      where: { id: bedId },
      data: {
        bedNumber: data.bedNumber,
        rent: data.rent !== undefined ? (data.rent !== null ? new Prisma.Decimal(data.rent) : null) : undefined,
        advance: data.advance !== undefined ? (data.advance !== null ? new Prisma.Decimal(data.advance) : null) : undefined,
        deposit: data.deposit !== undefined ? (data.deposit !== null ? new Prisma.Decimal(data.deposit) : null) : undefined,
        status: nextStatus,
        tenantId: nextTenantId,
      },
    });

    // 3. If assigning tenant, update tenant's room & property reference
    if (nextTenantId) {
      await tx.tenant.update({
        where: { id: nextTenantId },
        data: {
          propertyId: bed.room.propertyId,
          roomId: bed.roomId,
        },
      });
    }

    // 4. Auto sync Room and Property occupancy statuses
    await autoSetRoomStatus(bed.roomId, tx);
    await autoSetPropertyStatus(bed.room.propertyId, tx);

    return res;
  });

  await writeAuditLog(req, {
    action: "pg.bed_updated",
    entityType: "pg_bed",
    entityId: bedId,
    metadata: { status: updated.status, tenantId: updated.tenantId ?? null },
  }, actorId);

  return updated;
}

export async function autoSetRoomStatus(roomId: string, tx: Prisma.TransactionClient = prisma) {
  const beds = await tx.pgBed.findMany({ where: { roomId, archived: false } });
  const allOccupied = beds.length > 0 && beds.every((b) => b.status === "OCCUPIED");
  const anyAvailable = beds.some((b) => b.status === "AVAILABLE");
  const status: BedStatus = allOccupied ? "OCCUPIED" : anyAvailable ? "AVAILABLE" : "MAINTENANCE";
  await tx.pgRoom.update({ where: { id: roomId }, data: { status } });
  return status;
}

export async function autoSetPropertyStatus(propertyId: string, tx: Prisma.TransactionClient = prisma) {
  const property = await tx.property.findUnique({
    where: { id: propertyId },
    include: { rooms: { where: { archived: false } } },
  });
  if (!property) return;
  if (property.type === "HOUSE") {
    const activeTenants = await tx.tenant.count({
      where: { propertyId, status: "ACTIVE" },
    });
    const status = activeTenants > 0 ? "OCCUPIED" : property.status === "MAINTENANCE" ? "MAINTENANCE" : "AVAILABLE";
    await tx.property.update({ where: { id: propertyId }, data: { status } });
    return status;
  }
  const beds = await tx.pgBed.count({ where: { room: { propertyId }, archived: false, status: "OCCUPIED" } });
  const totalBeds = await tx.pgBed.count({ where: { room: { propertyId }, archived: false } });
  let status: PropertyStatus = "AVAILABLE";
  if (beds === 0) status = "AVAILABLE";
  else if (beds === totalBeds) status = "OCCUPIED";
  else status = "AVAILABLE";
  await tx.property.update({ where: { id: propertyId }, data: { status } });
  return status;
}
