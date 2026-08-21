import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { NotFoundError, BadRequestError } from "../utils/http";
import { buildPagination, parsePagination } from "../utils/pagination";

export async function listStaff(query: Record<string, unknown>) {
  const { page, pageSize } = parsePagination(query);
  const role = query.role ? String(query.role) : undefined;
  const search = query.search ? String(query.search).trim() : undefined;

  const where: Prisma.StaffWhereInput = {
    ...(role ? { role } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
          ],
        }
      : {}),
  };

  const [total, staff] = await Promise.all([
    prisma.staff.count({ where }),
    prisma.staff.findMany({
      where,
      include: {
        properties: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return buildPagination(staff, total, { page, pageSize });
}

export async function createStaff(data: { name: string; phone: string; email?: string; role?: string; propertyIds?: string[] }) {
  if (!data.name || !data.phone) throw new BadRequestError("Name and Phone are required");
  const phone = data.phone.replace(/\D/g, "");

  return prisma.staff.create({
    data: {
      name: data.name,
      phone,
      email: data.email || null,
      role: data.role || "CARETAKER",
      ...(data.propertyIds && data.propertyIds.length > 0
        ? { properties: { connect: data.propertyIds.map((id) => ({ id })) } }
        : {}),
    },
    include: {
      properties: { select: { id: true, name: true } },
    },
  });
}

export async function updateStaff(id: string, data: { name?: string; phone?: string; email?: string; role?: string; status?: string; propertyIds?: string[] }) {
  const existing = await prisma.staff.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Staff member not found");

  const phone = data.phone ? data.phone.replace(/\D/g, "") : undefined;

  return prisma.staff.update({
    where: { id },
    data: {
      ...(data.name ? { name: data.name } : {}),
      ...(phone ? { phone } : {}),
      ...(data.email !== undefined ? { email: data.email || null } : {}),
      ...(data.role ? { role: data.role } : {}),
      ...(data.status ? { status: data.status as any } : {}),
      ...(data.propertyIds !== undefined
        ? { properties: { set: data.propertyIds.map((pid) => ({ id: pid })) } }
        : {}),
    },
    include: {
      properties: { select: { id: true, name: true } },
    },
  });
}

export async function deleteStaff(id: string) {
  const existing = await prisma.staff.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Staff member not found");
  await prisma.staff.delete({ where: { id } });
  return { message: "Staff member deleted" };
}

export async function listVendors(query: Record<string, unknown>) {
  const { page, pageSize } = parsePagination(query);
  const service = query.service ? String(query.service) : undefined;
  const search = query.search ? String(query.search).trim() : undefined;

  const where: Prisma.VendorWhereInput = {
    ...(service ? { service } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
            { company: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, vendors] = await Promise.all([
    prisma.vendor.count({ where }),
    prisma.vendor.findMany({
      where,
      include: {
        properties: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return buildPagination(vendors, total, { page, pageSize });
}

export async function createVendor(data: { name: string; phone: string; service: string; company?: string; address?: string; propertyIds?: string[] }) {
  if (!data.name || !data.phone || !data.service) throw new BadRequestError("Name, Phone, and Service type are required");

  return prisma.vendor.create({
    data: {
      name: data.name,
      phone: data.phone.replace(/\D/g, ""),
      service: data.service,
      company: data.company || null,
      address: data.address || null,
      ...(data.propertyIds && data.propertyIds.length > 0
        ? { properties: { connect: data.propertyIds.map((id) => ({ id })) } }
        : {}),
    },
    include: {
      properties: { select: { id: true, name: true } },
    },
  });
}

export async function updateVendor(id: string, data: { name?: string; phone?: string; service?: string; company?: string; address?: string; propertyIds?: string[] }) {
  const existing = await prisma.vendor.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Vendor not found");

  const phone = data.phone ? data.phone.replace(/\D/g, "") : undefined;

  return prisma.vendor.update({
    where: { id },
    data: {
      ...(data.name ? { name: data.name } : {}),
      ...(phone ? { phone } : {}),
      ...(data.service ? { service: data.service } : {}),
      ...(data.company !== undefined ? { company: data.company || null } : {}),
      ...(data.address !== undefined ? { address: data.address || null } : {}),
      ...(data.propertyIds !== undefined
        ? { properties: { set: data.propertyIds.map((pid) => ({ id: pid })) } }
        : {}),
    },
    include: {
      properties: { select: { id: true, name: true } },
    },
  });
}

export async function deleteVendor(id: string) {
  const existing = await prisma.vendor.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Vendor not found");
  await prisma.vendor.delete({ where: { id } });
  return { message: "Vendor deleted" };
}
