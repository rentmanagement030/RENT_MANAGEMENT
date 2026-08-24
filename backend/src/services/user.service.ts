import { Prisma, UserRole as UserRoleEnum, UserStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { hashPassword } from "../utils/password";
import { NotFoundError, ConflictError } from "../utils/http";
import { buildPagination, parsePagination } from "../utils/pagination";
import { ALL_PERMISSIONS, ROLE_PERMISSIONS } from "../utils/permissions";
import type { Request } from "express";
import { writeAuditLog } from "../utils/audit";

export async function listRoles() {
  const roles = await prisma.role.findMany({
    include: { permissions: { include: { permission: true } } },
    orderBy: { name: "asc" },
  });
  return roles.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    permissions: r.permissions.map((p) => p.permission.key),
  }));
}

export async function listAllPermissions() {
  return prisma.permission.findMany({ orderBy: { key: "asc" } });
}

export async function ensureRolesAndPermissions() {
  const permissionKeys = ALL_PERMISSIONS;
  await Promise.all(
    permissionKeys.map((key) =>
      prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key, description: key },
      }),
    ),
  );

  const perms = await prisma.permission.findMany();
  const byKey = new Map(perms.map((p) => [p.key, p.id]));

  for (const [roleName, permsForRole] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { name: roleName as UserRoleEnum },
      update: { description: undefined },
      create: {
        name: roleName as UserRoleEnum,
        description: `Default ${roleName.replace("_", " ")} role`,
      },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permsForRole.map((key) => ({ roleId: role.id, permissionId: byKey.get(key)! })),
      skipDuplicates: true,
    });
  }

  // Ensure active properties are publicly visible by default
  await prisma.property.updateMany({
    where: { archived: false, publicVisibility: false },
    data: { publicVisibility: true },
  });

  // Auto-heal any active tenants without homeId on multi-unit properties
  const unlinkedTenants = await prisma.tenant.findMany({
    where: { status: "ACTIVE", homeId: null },
    include: { property: { include: { homes: true } } },
  });
  for (const t of unlinkedTenants) {
    if (t.property && t.property.homes && t.property.homes.length > 0) {
      const matchingHome =
        t.property.homes.find((h) => Number(h.rent) === Number(t.rent) && h.status === "AVAILABLE") ||
        t.property.homes.find((h) => h.status === "AVAILABLE") ||
        t.property.homes[0];
      if (matchingHome) {
        await prisma.tenant.update({ where: { id: t.id }, data: { homeId: matchingHome.id } });
        await prisma.propertyHome.update({ where: { id: matchingHome.id }, data: { status: "OCCUPIED" } });
      }
    }
  }

  // Ensure homes with active tenants are marked OCCUPIED
  const occupiedHomes = await prisma.propertyHome.findMany({
    where: { tenants: { some: { status: "ACTIVE" } } },
    select: { id: true, status: true },
  });
  for (const h of occupiedHomes) {
    if (h.status !== "OCCUPIED") {
      await prisma.propertyHome.update({ where: { id: h.id }, data: { status: "OCCUPIED" } });
    }
  }

  // Ensure homes without active tenants are marked AVAILABLE (unless maintenance)
  const vacantHomes = await prisma.propertyHome.findMany({
    where: { tenants: { none: { status: "ACTIVE" } }, status: "OCCUPIED" },
    select: { id: true },
  });
  for (const h of vacantHomes) {
    await prisma.propertyHome.update({ where: { id: h.id }, data: { status: "AVAILABLE" } });
  }
}

export async function listUsers(query: Record<string, unknown>) {
  const { page, pageSize } = parsePagination(query);
  const search = String(query.search ?? "").trim();
  const status = query.status ? String(query.status) : undefined;
  const roleName = query.role ? String(query.role) : undefined;

  const where: Prisma.UserWhereInput = {
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
          ],
        }
      : {}),
    ...(status ? { status: status as UserStatus } : {}),
    ...(roleName
      ? { userRoles: { some: { role: { name: roleName as UserRoleEnum } } } }
      : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      include: { userRoles: { include: { role: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return buildPagination(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      status: u.status,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      roles: u.userRoles.map((ur) => ur.role.name),
    })),
    total,
    { page, pageSize },
  );
}

export async function createUser(data: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  roleNames: string[];
}, req: Request, actorId: string) {
  const existing = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
  if (existing) throw new ConflictError("A user with this email already exists");

  const roleIds = await resolveRoleIds(data.roleNames);
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email.toLowerCase(),
      phone: data.phone || null,
      passwordHash: await hashPassword(data.password),
      userRoles: { create: roleIds.map((roleId) => ({ roleId })) },
    },
  });

  await writeAuditLog(req, {
    action: "user.created",
    entityType: "user",
    entityId: user.id,
    metadata: { name: user.name, email: user.email, roles: data.roleNames },
  }, actorId);

  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

export async function updateUser(
  userId: string,
  data: {
    name?: string;
    phone?: string;
    status?: UserStatus;
    roleNames?: string[];
    resetPassword?: string;
  },
  req: Request,
  actorId: string,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("User not found");

  if (data.roleNames) {
    const roleIds = await resolveRoleIds(data.roleNames);
    await prisma.userRoleAssignment.updateMany({ where: { userId }, data: {} }); // no-op guard
    await prisma.userRoleAssignment.deleteMany({ where: { userId } });
    await prisma.userRoleAssignment.createMany({ data: roleIds.map((roleId) => ({ userId, roleId })) });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      name: data.name,
      phone: data.phone ?? undefined,
      status: data.status,
      ...(data.resetPassword
        ? { passwordHash: await hashPassword(data.resetPassword) }
        : {}),
    },
  });

  await writeAuditLog(req, {
    action: "user.updated",
    entityType: "user",
    entityId: userId,
    metadata: {
      fields: Object.keys(data).filter((k) => data[k as keyof typeof data] !== undefined),
    },
  }, actorId);

  const { passwordHash: __, ...safeUpdated } = updated;
  return safeUpdated;
}

export async function deleteUser(userId: string, req: Request, actorId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("User not found");
  if (actorId === userId) throw new ConflictError("You cannot delete your own account");
  await prisma.session.updateMany({ where: { userId }, data: { revokedAt: new Date() } });
  await prisma.user.update({ where: { id: userId }, data: { status: "INACTIVE" } });
  await writeAuditLog(req, {
    action: "user.deactivated",
    entityType: "user",
    entityId: userId,
    metadata: { email: user.email },
  }, actorId);
}

async function resolveRoleIds(roleNames: string[]): Promise<string[]> {
  const roles = await prisma.role.findMany({
    where: { name: { in: roleNames as UserRoleEnum[] } },
  });
  if (roles.length !== new Set(roleNames).size) {
    throw new NotFoundError("One or more roles do not exist");
  }
  return roles.map((r) => r.id);
}
