import { Prisma, TenantStatus, DocumentType } from "@prisma/client";
import { prisma } from "../config/prisma";
import { NotFoundError, ConflictError, ValidationError } from "../utils/http";
import { buildPagination, parsePagination } from "../utils/pagination";
import { writeAuditLog } from "../utils/audit";
import { signDownloadToken, deleteFile } from "../utils/storage";
import { autoSetRoomStatus, autoSetPropertyStatus } from "./property.service";
import { registerOrUpdateTenantAuth } from "./tenantAuth.service";
import type { Request } from "express";

const tenantInclude = {
  property: { select: { id: true, name: true, number: true, type: true, city: true } },
  home: { select: { id: true, homeNumber: true, floor: true, homeType: true } },
  room: { select: { id: true, roomNumber: true, floor: true, capacity: true } },
  bed: { select: { id: true, bedNumber: true } },
  documents: { orderBy: { createdAt: "desc" } },
  familyMembers: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.TenantInclude;

export interface TenantInput {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  aadhaarNumber?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  propertyId?: string;
  homeId?: string;
  roomId?: string;
  bedId?: string;
  rent: number;
  advance?: number;
  deposit?: number;
  joiningDate?: Date;
  status?: TenantStatus;
  notes?: string;
}

export async function getTenantStats(propertyId?: string) {
  const where: Prisma.TenantWhereInput = propertyId ? { propertyId } : {};
  const [total, active, pending, inactive] = await Promise.all([
    prisma.tenant.count({ where }),
    prisma.tenant.count({ where: { ...where, status: "ACTIVE" } }),
    prisma.tenant.count({ where: { ...where, status: "PENDING" } }),
    prisma.tenant.count({ where: { ...where, status: { in: ["INACTIVE", "FORMER"] } } }),
  ]);

  return { total, active, pending, inactive };
}

function buildKycStatusFilter(kycStatus: string): Prisma.TenantWhereInput | undefined {
  if (kycStatus === "VERIFIED") {
    return { kycStatus: "VERIFIED" };
  }
  if (kycStatus === "REJECTED") {
    return { kycStatus: "REJECTED" };
  }
  if (kycStatus === "NOT_STARTED") {
    return { kycStatus: "NOT_STARTED" };
  }
  if (kycStatus === "DOCUMENTS_PENDING" || kycStatus === "PENDING") {
    return {
      OR: [
        { kycStatus: "DOCUMENTS_PENDING" },
        { documents: { some: { status: "PENDING" } } },
      ],
    };
  }
  if (kycStatus === "AUTO_VERIFIED") {
    return {
      documents: { some: { status: "AUTO_VERIFIED" } },
    };
  }
  if (kycStatus === "MANUAL_REVIEW" || kycStatus === "PARTIALLY_VERIFIED") {
    return {
      OR: [
        { kycStatus: "PARTIALLY_VERIFIED" },
        { documents: { some: { status: "MANUAL_REVIEW" } } },
      ],
    };
  }
  return undefined;
}

export async function listTenants(query: Record<string, unknown>) {
  const { page, pageSize } = parsePagination(query);
  const search = String(query.search ?? "").trim();
  const status = query.status ? String(query.status) : undefined;
  const propertyId = query.propertyId ? String(query.propertyId) : undefined;
  const kycStatus = query.kycStatus ? String(query.kycStatus) : undefined;
  const kycWhere = kycStatus ? buildKycStatusFilter(kycStatus) : undefined;

  const where: Prisma.TenantWhereInput = {
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
            { email: { contains: search, mode: "insensitive" } },
            { property: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(status ? { status: status as TenantStatus } : {}),
    ...(propertyId ? { propertyId } : {}),
    ...(kycWhere ? kycWhere : {}),
  };

  const [total, tenants] = await Promise.all([
    prisma.tenant.count({ where }),
    prisma.tenant.findMany({
      where,
      include: tenantInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return buildPagination(tenants, total, { page, pageSize });
}

export async function getTenant(id: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id }, include: tenantInclude });
  if (!tenant) throw new NotFoundError("Tenant not found");
  return tenant;
}

async function validatePropertyCapacity(
  tx: Prisma.TransactionClient,
  propertyId: string,
  excludeTenantId?: string,
) {
  const property = await tx.property.findUnique({
    where: { id: propertyId },
    select: { id: true, name: true, type: true, maxCapacity: true },
  });
  if (!property) throw new NotFoundError("Property not found");

  // PG properties use room/bed capacity & availability, NOT property maxCapacity!
  if (property.type === "PG") {
    return;
  }

  const effectiveCapacity = property.maxCapacity ?? 1;

  const activeTenantCount = await tx.tenant.count({
    where: {
      propertyId,
      status: { in: ["ACTIVE", "PENDING"] },
      ...(excludeTenantId ? { id: { not: excludeTenantId } } : {}),
    },
  });

  if (activeTenantCount >= effectiveCapacity) {
    throw new ConflictError(
      `Property "${property.name}" is already at full capacity (${activeTenantCount}/${effectiveCapacity} active tenants). Please increase the property capacity in Property Details or add this person as a family member/occupant.`,
      [
        {
          path: ["propertyId"],
          code: "CAPACITY_FULL",
          message: "Property capacity limit reached",
          maxCapacity: effectiveCapacity,
          activeTenantCount,
          propertyName: property.name,
          propertyId: property.id,
        },
      ],
    );
  }
}

export async function createTenant(input: TenantInput, req: Request, actorId: string) {
  const existing = await prisma.tenant.findUnique({ where: { phone: input.phone } });
  if (existing) throw new ConflictError("A tenant with this phone number already exists");

  const data: Prisma.TenantCreateInput = {
    name: input.name,
    phone: input.phone,
    email: input.email || null,
    address: input.address || null,
    aadhaarNumber: input.aadhaarNumber || null,
    emergencyName: input.emergencyName || null,
    emergencyPhone: input.emergencyPhone || null,
    rent: new Prisma.Decimal(input.rent),
    advance: new Prisma.Decimal(input.advance ?? 0),
    deposit: new Prisma.Decimal(input.deposit ?? 0),
    joiningDate: input.joiningDate,
    status: input.status ?? "ACTIVE",
    notes: input.notes || null,
    createdBy: { connect: { id: actorId } },
  };

  const tenant = await prisma.$transaction(async (tx) => {
    if (input.propertyId && (input.status === "ACTIVE" || input.status === "PENDING" || !input.status)) {
      await validatePropertyCapacity(tx, input.propertyId);
    }
    if (input.propertyId) data.property = { connect: { id: input.propertyId } };
    if (input.homeId) data.home = { connect: { id: input.homeId } };
    if (input.roomId) data.room = { connect: { id: input.roomId } };
    if (input.bedId) {
      const bed = await tx.pgBed.findUnique({ where: { id: input.bedId } });
      if (!bed) throw new NotFoundError("Bed not found");
      if (bed.tenantId && bed.tenantId !== null) throw new ConflictError("Bed is already occupied");
      data.bed = { connect: { id: input.bedId } };
      await tx.pgBed.update({ where: { id: input.bedId }, data: { status: "OCCUPIED", tenantId: null } });
    }
    const created = await tx.tenant.create({ data, include: tenantInclude });
    if (input.bedId) {
      await tx.pgBed.update({ where: { id: input.bedId }, data: { tenantId: created.id, status: "OCCUPIED" } });
    }
    if (input.homeId) {
      await tx.propertyHome.update({ where: { id: input.homeId }, data: { status: "OCCUPIED" } });
    }
    if (input.roomId) await autoSetRoomStatus(input.roomId, tx);
    if (input.propertyId) await autoSetPropertyStatus(input.propertyId, tx);
    return created;
  });

  await registerOrUpdateTenantAuth(tenant.id, tenant.phone).catch(() => null);

  await writeAuditLog(req, {
    action: "tenant.created",
    entityType: "tenant",
    entityId: tenant.id,
    metadata: { name: tenant.name, phone: tenant.phone },
  }, actorId);

  return tenant;
}

export async function updateTenant(
  id: string,
  input: Partial<TenantInput>,
  req: Request,
  actorId: string,
) {
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) throw new NotFoundError("Tenant not found");

  const targetPropertyId = input.propertyId ?? tenant.propertyId;
  const targetStatus = input.status ?? tenant.status;

  if (targetPropertyId && (targetStatus === "ACTIVE" || targetStatus === "PENDING")) {
    await prisma.$transaction(async (tx) => {
      await validatePropertyCapacity(tx, targetPropertyId, id);
    });
  }

  const data: Prisma.TenantUpdateInput = {
    name: input.name,
    phone: input.phone,
    email: input.email !== undefined ? input.email || null : undefined,
    address: input.address !== undefined ? input.address || null : undefined,
    aadhaarNumber: input.aadhaarNumber !== undefined ? input.aadhaarNumber || null : undefined,
    emergencyName: input.emergencyName !== undefined ? input.emergencyName || null : undefined,
    emergencyPhone: input.emergencyPhone !== undefined ? input.emergencyPhone || null : undefined,
    rent: input.rent !== undefined ? new Prisma.Decimal(input.rent) : undefined,
    advance: input.advance !== undefined ? new Prisma.Decimal(input.advance) : undefined,
    deposit: input.deposit !== undefined ? new Prisma.Decimal(input.deposit) : undefined,
    joiningDate: input.joiningDate,
    status: input.status,
    notes: input.notes !== undefined ? input.notes || null : undefined,
    updatedBy: { connect: { id: actorId } },
  };

  if (input.propertyId) data.property = { connect: { id: input.propertyId } };
  if (input.homeId !== undefined) {
    if (input.homeId) {
      data.home = { connect: { id: input.homeId } };
    } else {
      data.home = { disconnect: true };
    }
  }
  if (input.roomId !== undefined) {
    if (input.roomId) {
      data.room = { connect: { id: input.roomId } };
    } else {
      data.room = { disconnect: true };
    }
  }
  if (input.bedId !== undefined) {
    if (input.bedId) {
      data.bed = { connect: { id: input.bedId } };
    } else {
      data.bed = { disconnect: true };
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.tenant.update({ where: { id }, data, include: tenantInclude });

    // Bed updates
    if (input.bedId !== undefined) {
      await tx.pgBed.updateMany({ where: { tenantId: id }, data: { tenantId: null, status: "AVAILABLE" } });
      if (input.bedId) {
        await tx.pgBed.update({ where: { id: input.bedId }, data: { tenantId: id, status: "OCCUPIED" } });
      }
    }

    // Home updates
    if (input.homeId !== undefined) {
      if (tenant.homeId && tenant.homeId !== input.homeId) {
        const otherActive = await tx.tenant.count({
          where: { homeId: tenant.homeId, id: { not: id }, status: "ACTIVE" },
        });
        if (otherActive === 0) {
          await tx.propertyHome.update({ where: { id: tenant.homeId }, data: { status: "AVAILABLE" } });
        }
      }
      if (input.homeId) {
        await tx.propertyHome.update({ where: { id: input.homeId }, data: { status: "OCCUPIED" } });
      }
    }

    // Inactive status release
    if (input.status && input.status !== "ACTIVE") {
      await tx.pgBed.updateMany({ where: { tenantId: id }, data: { tenantId: null, status: "AVAILABLE" } });
      const currentHomeId = input.homeId || tenant.homeId;
      if (currentHomeId) {
        const otherActive = await tx.tenant.count({
          where: { homeId: currentHomeId, id: { not: id }, status: "ACTIVE" },
        });
        if (otherActive === 0) {
          await tx.propertyHome.update({ where: { id: currentHomeId }, data: { status: "AVAILABLE" } });
        }
      }
    }

    if (input.roomId || tenant.roomId) await autoSetRoomStatus(input.roomId || tenant.roomId!, tx);
    if (targetPropertyId) await autoSetPropertyStatus(targetPropertyId, tx);

    return res;
  });

  if (input.phone) {
    await registerOrUpdateTenantAuth(id, input.phone).catch(() => null);
  }

  await writeAuditLog(req, {
    action: "tenant.updated",
    entityType: "tenant",
    entityId: id,
    metadata: { changed: Object.keys(input) },
  }, actorId);

  return updated;
}

export async function markTenantFormer(id: string, req: Request, actorId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) throw new NotFoundError("Tenant not found");

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.tenant.update({ where: { id }, data: { status: "INACTIVE" } });
    await tx.pgBed.updateMany({ where: { tenantId: id }, data: { tenantId: null, status: "AVAILABLE" } });
    if ((tenant as any).homeId) {
      await tx.propertyHome.updateMany({ where: { id: (tenant as any).homeId }, data: { status: "AVAILABLE" } });
    }
    if (tenant.roomId) await autoSetRoomStatus(tenant.roomId, tx);
    if (tenant.propertyId) await autoSetPropertyStatus(tenant.propertyId, tx);
    return updated;
  });

  await writeAuditLog(req, {
    action: "tenant.marked_inactive",
    entityType: "tenant",
    entityId: id,
  }, actorId);
  return result;
}

export async function deleteTenant(id: string, req: Request, actorId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) throw new NotFoundError("Tenant not found");

  await prisma.$transaction(async (tx) => {
    // 1. Unlink beds & homes (release occupied room/unit/bed back to AVAILABLE)
    await tx.pgBed.updateMany({ where: { tenantId: id }, data: { tenantId: null, status: "AVAILABLE" } });
    if ((tenant as any).homeId) {
      await tx.propertyHome.updateMany({ where: { id: (tenant as any).homeId }, data: { status: "AVAILABLE" } });
    }

    // 2. Delete payment allocations, payments & payment links
    await tx.paymentAllocation.deleteMany({
      where: {
        OR: [
          { payment: { tenantId: id } },
          { bill: { tenantId: id } },
        ],
      },
    });
    await tx.payment.deleteMany({ where: { tenantId: id } });
    await tx.paymentLink.deleteMany({ where: { tenantId: id } });

    // 3. Delete bill items, penalties & bills
    await tx.billItem.deleteMany({ where: { bill: { tenantId: id } } });
    await tx.penalty.deleteMany({ where: { bill: { tenantId: id } } });
    await tx.bill.deleteMany({ where: { tenantId: id } });

    // 4. Delete rent adjustments & rent records
    await tx.rentAdjustment.deleteMany({ where: { rentRecord: { tenantId: id } } });
    await tx.rentRecord.deleteMany({ where: { tenantId: id } });

    // 5. Delete agreements, notifications, family members, documents, bookings, guest logs, leaves, maintenance requests & transfer history
    await tx.agreement.deleteMany({ where: { tenantId: id } });
    await tx.notification.deleteMany({ where: { tenantId: id } });
    await tx.familyMember.deleteMany({ where: { tenantId: id } });
    await tx.tenantDocument.deleteMany({ where: { tenantId: id } });
    await tx.booking.deleteMany({ where: { tenantId: id } });
    await tx.guestLog.deleteMany({ where: { tenantId: id } });
    await tx.tenantLeave.deleteMany({ where: { tenantId: id } });
    await tx.maintenanceRequest.deleteMany({ where: { tenantId: id } });
    await tx.tenantTransferHistory.deleteMany({ where: { tenantId: id } });

    // 6. Delete tenant record
    await tx.tenant.delete({ where: { id } });

    if (tenant.roomId) await autoSetRoomStatus(tenant.roomId, tx);
    if (tenant.propertyId) await autoSetPropertyStatus(tenant.propertyId, tx);
  });

  await writeAuditLog(req, {
    action: "tenant.deleted",
    entityType: "tenant",
    entityId: id,
    metadata: { name: tenant.name },
  }, actorId);

  return { message: "Tenant deleted successfully" };
}

export async function listTenantDocuments(tenantId: string) {
  const docs = await prisma.tenantDocument.findMany({
    where: { tenantId },
    include: { verifiedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return docs.map((d) => ({
    id: d.id,
    type: d.type,
    originalName: d.originalName,
    mimeType: d.mimeType,
    size: d.size,
    status: d.status,
    rejectionReason: d.rejectionReason,
    verificationConfidence: d.verificationConfidence ? Number(d.verificationConfidence) : null,
    verificationReason: d.verificationReason,
    verificationMethod: d.verificationMethod,
    ocrData: d.ocrData,
    verifiedAt: d.verifiedAt,
    verifiedById: d.verifiedById,
    verifiedBy: d.verifiedBy,
    uploadedAt: d.createdAt,
    downloadUrl: `/api/files/${signDownloadToken(d.storageKey, 300)}`,
  }));
}

export async function addTenantDocument(
  tenantId: string,
  data: { type: DocumentType; storageKey: string; originalName: string; mimeType: string; size: number },
  req: Request,
  actorId: string,
) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new NotFoundError("Tenant not found");

  const doc = await prisma.tenantDocument.create({
    data: {
      tenantId,
      type: data.type,
      storageKey: data.storageKey,
      originalName: data.originalName,
      mimeType: data.mimeType,
      size: data.size,
      status: "PENDING",
      uploadedById: actorId,
    },
  });

  await recalculateTenantKycStatus(prisma, tenantId);

  await writeAuditLog(req, {
    action: "tenant.document_uploaded",
    entityType: "tenant_document",
    entityId: doc.id,
    metadata: { tenantId, type: doc.type },
  }, actorId);

  // Trigger AI-assisted KYC processing (asynchronous non-blocking call)
  import("./kyc.service").then((kyc) => {
    kyc.processDocument(doc.id, req).catch((err) => {
      console.error("Async KYC verification failed for doc:", doc.id, err);
    });
  });

  return doc;
}

export async function deleteTenantDocument(docId: string, req: Request, actorId: string) {
  const doc = await prisma.tenantDocument.findUnique({ where: { id: docId } });
  if (!doc) throw new NotFoundError("Document not found");
  if (doc.storageKey) deleteFile(doc.storageKey);
  await prisma.tenantDocument.delete({ where: { id: docId } });
  await recalculateTenantKycStatus(prisma, doc.tenantId);
  await writeAuditLog(req, {
    action: "tenant.document_deleted",
    entityType: "tenant_document",
    entityId: docId,
  }, actorId);
}

export async function recalculateTenantKycStatus(
  txOrTenantId: Prisma.TransactionClient | typeof prisma | string,
  maybeTenantId?: string,
): Promise<"NOT_STARTED" | "DOCUMENTS_PENDING" | "PARTIALLY_VERIFIED" | "VERIFIED" | "REJECTED"> {
  const client = typeof txOrTenantId === "string" ? prisma : txOrTenantId;
  const tenantId = typeof txOrTenantId === "string" ? txOrTenantId : maybeTenantId!;
  const docs = await client.tenantDocument.findMany({ where: { tenantId } });
  let kycStatus: "NOT_STARTED" | "DOCUMENTS_PENDING" | "PARTIALLY_VERIFIED" | "VERIFIED" | "REJECTED";

  if (docs.length === 0) {
    kycStatus = "NOT_STARTED";
  } else if (docs.some((d) => d.status === "REJECTED")) {
    kycStatus = "REJECTED";
  } else if (docs.every((d) => d.status === "VERIFIED" || d.status === "AUTO_VERIFIED")) {
    kycStatus = "VERIFIED";
  } else if (docs.some((d) => d.status === "VERIFIED" || d.status === "AUTO_VERIFIED")) {
    kycStatus = "PARTIALLY_VERIFIED";
  } else {
    kycStatus = "DOCUMENTS_PENDING";
  }

  await client.tenant.update({
    where: { id: tenantId },
    data: { kycStatus },
  });

  return kycStatus;
}

export async function verifyTenantDocument(
  tenantId: string,
  docId: string,
  status: "VERIFIED" | "REJECTED",
  rejectionReason?: string | null,
  req?: Request | null,
  actorId?: string | null,
) {
  const doc = await prisma.tenantDocument.findFirst({
    where: { id: docId, tenantId },
  });
  if (!doc) throw new NotFoundError("Document not found");

  if (status === "REJECTED" && (!rejectionReason || rejectionReason.trim().length === 0)) {
    throw new ValidationError([{ path: "rejectionReason", message: "Rejection reason is required when rejecting a document" }]);
  }

  const updated = await prisma.tenantDocument.update({
    where: { id: docId },
    data: {
      status,
      rejectionReason: status === "REJECTED" ? rejectionReason : null,
      verificationMethod: "ADMIN_MANUAL",
      verifiedAt: new Date(),
      verifiedById: actorId ?? null,
    },
  });

  await recalculateTenantKycStatus(prisma, tenantId);

  if (req) {
    await writeAuditLog(req, {
      action: "tenant.document_verified",
      entityType: "tenant_document",
      entityId: docId,
      metadata: { tenantId, status, rejectionReason, verificationMethod: "ADMIN_MANUAL" },
    }, actorId);
  }

  return updated;
}

// ---------------------------------------------------------------------------
// Tenant Shifting / Transfer History
// ---------------------------------------------------------------------------

export interface TenantTransferInput {
  toPropertyId: string;
  toHomeId?: string | null;
  toRoomId?: string | null;
  toBedId?: string | null;
  toRent: number;
  transferDate: string | Date;
  reason: string;
  notes?: string | null;
}

export async function transferTenant(
  tenantId: string,
  input: TenantTransferInput,
  req: Request,
  actorId: string,
) {
  const tDate = new Date(input.transferDate);
  if (isNaN(tDate.getTime())) {
    throw new ValidationError([{ path: "transferDate", message: "Invalid transfer date" }]);
  }

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      include: { property: true, room: true, bed: true, home: true },
    });
    if (!tenant) throw new NotFoundError("Tenant not found");
    if (!tenant.propertyId) {
      throw new ConflictError("Tenant does not have an active property stay to transfer from");
    }

    // 1. Validate target property
    const targetProperty = await tx.property.findUnique({ where: { id: input.toPropertyId } });
    if (!targetProperty) throw new NotFoundError("Target property not found");

    // 2. Validate capacity (HOUSE properties limit active occupants)
    if (targetProperty.type === "HOUSE") {
      if (targetProperty.maxCapacity && targetProperty.id !== tenant.propertyId) {
        const activeCount = await tx.tenant.count({
          where: { propertyId: targetProperty.id, status: "ACTIVE" },
        });
        if (activeCount >= targetProperty.maxCapacity) {
          throw new ConflictError(`Target property is at full capacity (${activeCount}/${targetProperty.maxCapacity} occupants)`);
        }
      }
    }

    // 3. Validate target room/bed/home and availability
    let targetRoomId: string | null = null;
    let targetBedId: string | null = null;
    let targetHomeId: string | null = null;

    if (input.toHomeId) {
      const targetHome = await tx.propertyHome.findUnique({ where: { id: input.toHomeId } });
      if (!targetHome) throw new NotFoundError("Target home not found");
      targetHomeId = targetHome.id;
    }

    if (input.toBedId) {
      const targetBed = await tx.pgBed.findUnique({
        where: { id: input.toBedId },
      });
      if (!targetBed) throw new NotFoundError("Target bed not found");
      if (targetBed.status !== "AVAILABLE" && targetBed.id !== tenant.bed?.id) {
        throw new ConflictError(`Target bed is currently ${targetBed.status.toLowerCase()} and cannot be assigned`);
      }
      targetBedId = targetBed.id;
      targetRoomId = targetBed.roomId;
    } else if (input.toRoomId) {
      const targetRoom = await tx.pgRoom.findUnique({ where: { id: input.toRoomId } });
      if (!targetRoom) throw new NotFoundError("Target room not found");
      targetRoomId = targetRoom.id;
    }

    const currentBedId = tenant.bed?.id;
    const currentHomeId = tenant.homeId;
    const oldRoomId = tenant.roomId;
    const oldPropertyId = tenant.propertyId;

    // 4. Transfer history: close the current open stay and create the new one.
    await tx.tenantTransferHistory.updateMany({
      where: { tenantId, effectiveTo: null },
      data: { effectiveTo: tDate },
    });

    const transferRecord = await tx.tenantTransferHistory.create({
      data: {
        tenantId,
        fromPropertyId: oldPropertyId,
        fromRoomId: oldRoomId,
        fromBedId: currentBedId || null,
        fromHomeId: currentHomeId || null,
        fromRent: tenant.rent,
        toPropertyId: targetProperty.id,
        toRoomId: targetRoomId,
        toBedId: targetBedId,
        toHomeId: targetHomeId,
        toRent: new Prisma.Decimal(input.toRent),
        effectiveFrom: tDate,
        effectiveTo: null,
        reason: input.reason,
        notes: input.notes || null,
        createdById: actorId,
      },
    });

    // 5. Free the previous bed and home
    if (currentBedId && currentBedId !== targetBedId) {
      await tx.pgBed.update({
        where: { id: currentBedId },
        data: { status: "AVAILABLE", tenantId: null },
      });
    }
    if (currentHomeId && currentHomeId !== targetHomeId) {
      const otherActive = await tx.tenant.count({
        where: { homeId: currentHomeId, id: { not: tenantId }, status: "ACTIVE" },
      });
      if (otherActive === 0) {
        await tx.propertyHome.update({ where: { id: currentHomeId }, data: { status: "AVAILABLE" } });
      }
    }

    // 6. Occupy the new bed and home
    if (targetBedId) {
      await tx.pgBed.update({
        where: { id: targetBedId },
        data: { status: "OCCUPIED", tenantId },
      });
    }
    if (targetHomeId) {
      await tx.propertyHome.update({
        where: { id: targetHomeId },
        data: { status: "OCCUPIED" },
      });
    }

    // 7. Update tenant assignment and 8. future rent configuration
    const updatedTenant = await tx.tenant.update({
      where: { id: tenantId },
      data: {
        propertyId: targetProperty.id,
        homeId: targetHomeId,
        roomId: targetRoomId,
        rent: new Prisma.Decimal(input.toRent),
      },
      include: { property: true, room: true, bed: true, home: true },
    });

    // 9. Recompute room/property statuses for both the source and target
    if (oldRoomId) await autoSetRoomStatus(oldRoomId, tx);
    if (targetRoomId) await autoSetRoomStatus(targetRoomId, tx);
    await autoSetPropertyStatus(oldPropertyId, tx);
    await autoSetPropertyStatus(targetProperty.id, tx);

    return { tenant: updatedTenant, transfer: transferRecord };
  });

  await writeAuditLog(req, {
    action: "tenant.transferred",
    entityType: "tenant",
    entityId: tenantId,
    metadata: {
      fromPropertyId: result.transfer.fromPropertyId,
      toPropertyId: result.transfer.toPropertyId,
      toRent: input.toRent,
      effectiveFrom: tDate,
    },
  }, actorId);

  return result;
}

export async function getTenantTransferHistory(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new NotFoundError("Tenant not found");

  return prisma.tenantTransferHistory.findMany({
    where: { tenantId },
    include: {
      fromProperty: { select: { id: true, name: true, type: true } },
      fromRoom: { select: { id: true, roomNumber: true } },
      fromBed: { select: { id: true, bedNumber: true } },
      toProperty: { select: { id: true, name: true, type: true } },
      toRoom: { select: { id: true, roomNumber: true } },
      toBed: { select: { id: true, bedNumber: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { effectiveFrom: "desc" },
  });
}

// ---------------------------------------------------------------------------
// Family members
// ---------------------------------------------------------------------------

export interface FamilyMemberInput {
  name: string;
  relation: string;
  phone?: string;
  age?: number;
  occupation?: string;
  isDependent?: boolean;
  notes?: string;
}

export async function listFamilyMembers(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new NotFoundError("Tenant not found");
  return prisma.familyMember.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
  });
}

export async function addFamilyMember(
  tenantId: string,
  input: FamilyMemberInput,
  req: Request,
  actorId: string,
) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new NotFoundError("Tenant not found");

  const member = await prisma.familyMember.create({
    data: {
      tenantId,
      name: input.name,
      relation: input.relation,
      phone: input.phone || null,
      age: input.age ?? null,
      occupation: input.occupation || null,
      isDependent: input.isDependent ?? false,
      notes: input.notes || null,
    },
  });

  await writeAuditLog(req, {
    action: "tenant.family_member_added",
    entityType: "family_member",
    entityId: member.id,
    metadata: { tenantId, name: member.name },
  }, actorId);
  return member;
}

export async function updateFamilyMember(
  tenantId: string,
  memberId: string,
  input: Partial<FamilyMemberInput>,
  req: Request,
  actorId: string,
) {
  const member = await prisma.familyMember.findFirst({
    where: { id: memberId, tenantId },
  });
  if (!member) throw new NotFoundError("Family member not found");

  const updated = await prisma.familyMember.update({
    where: { id: memberId },
    data: {
      name: input.name,
      relation: input.relation,
      phone: input.phone !== undefined ? input.phone || null : undefined,
      age: input.age,
      occupation: input.occupation !== undefined ? input.occupation || null : undefined,
      isDependent: input.isDependent,
      notes: input.notes !== undefined ? input.notes || null : undefined,
    },
  });

  await writeAuditLog(req, {
    action: "tenant.family_member_updated",
    entityType: "family_member",
    entityId: memberId,
    metadata: { tenantId },
  }, actorId);
  return updated;
}

export async function deleteFamilyMember(
  tenantId: string,
  memberId: string,
  req: Request,
  actorId: string,
) {
  const member = await prisma.familyMember.findFirst({
    where: { id: memberId, tenantId },
  });
  if (!member) throw new NotFoundError("Family member not found");
  await prisma.familyMember.delete({ where: { id: memberId } });
  await writeAuditLog(req, {
    action: "tenant.family_member_deleted",
    entityType: "family_member",
    entityId: memberId,
    metadata: { tenantId },
  }, actorId);
}
