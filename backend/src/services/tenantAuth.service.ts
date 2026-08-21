import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../config/prisma";
import { UnauthorizedError, NotFoundError, ForbiddenError, BadRequestError } from "../utils/http";
import type { Request, Response, NextFunction } from "express";

export interface TenantAuthUser {
  id: string;
  tenantId: string;
  phone: string;
  tenant: {
    id: string;
    name: string;
    email: string | null;
    phone: string;
    propertyId: string | null;
    roomId: string | null;
  };
}

// Express namespace augmentation is the canonical pattern for adding request context.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenantUser?: TenantAuthUser;
    }
  }
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function registerOrUpdateTenantAuth(tenantId: string, phone: string, plainPassword?: string) {
  const normalizedPhone = phone.replace(/\D/g, "");
  const defaultPassword = plainPassword || normalizedPhone.slice(-6) || "123456";
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  const tenantAuth = await prisma.tenantAuth.upsert({
    where: { tenantId },
    create: {
      tenantId,
      phone: normalizedPhone,
      passwordHash,
    },
    update: {
      phone: normalizedPhone,
      ...(plainPassword ? { passwordHash } : {}),
    },
  });

  return tenantAuth;
}

export async function loginTenant(phone: string, plainPassword: string, userAgent?: string, ip?: string) {
  const normalizedPhone = phone.replace(/\D/g, "");
  const auth = await prisma.tenantAuth.findUnique({
    where: { phone: normalizedPhone },
    include: {
      sessions: true,
    },
  });

  if (!auth || auth.status !== "ACTIVE") {
    throw new UnauthorizedError("Invalid phone number or password");
  }

  const valid = await bcrypt.compare(plainPassword, auth.passwordHash);
  if (!valid) {
    throw new UnauthorizedError("Invalid phone number or password");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: auth.tenantId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      propertyId: true,
      roomId: true,
    },
  });

  if (!tenant) {
    throw new NotFoundError("Tenant profile not found");
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days session

  await prisma.tenantSession.create({
    data: {
      tenantAuthId: auth.id,
      tokenHash,
      userAgent: userAgent || null,
      ip: ip || null,
      expiresAt,
    },
  });

  await prisma.tenantAuth.update({
    where: { id: auth.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    token: rawToken,
    tenant,
  };
}

export async function authenticateTenant(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new UnauthorizedError("Tenant authentication required"));
  }

  const rawToken = authHeader.split(" ")[1];
  const tokenHash = hashToken(rawToken);

  const session = await prisma.tenantSession.findUnique({
    where: { tokenHash },
    include: {
      tenantAuth: {
        include: {
          sessions: false,
        },
      },
    },
  });

  if (!session || session.expiresAt < new Date()) {
    return next(new UnauthorizedError("Session expired or invalid"));
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantAuth.tenantId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      propertyId: true,
      roomId: true,
    },
  });

  if (!tenant) {
    return next(new NotFoundError("Tenant profile not found"));
  }

  req.tenantUser = {
    id: session.tenantAuth.id,
    tenantId: tenant.id,
    phone: session.tenantAuth.phone,
    tenant,
  };

  next();
}

export function enforceTenantIsolation(req: Request, targetTenantId: string) {
  if (!req.tenantUser) {
    throw new UnauthorizedError("Authentication required");
  }
  if (req.tenantUser.tenantId !== targetTenantId) {
    throw new ForbiddenError("Access denied: Tenant data isolation enforced");
  }
}

export async function changeTenantPassword(tenantAuthId: string, currentPass: string, newPass: string) {
  if (!newPass || newPass.length < 4) {
    throw new BadRequestError("Password must be at least 4 characters long");
  }

  const auth = await prisma.tenantAuth.findUnique({ where: { id: tenantAuthId } });
  if (!auth) throw new NotFoundError("Tenant auth not found");

  const valid = await bcrypt.compare(currentPass, auth.passwordHash);
  if (!valid) throw new UnauthorizedError("Current password incorrect");

  const newHash = await bcrypt.hash(newPass, 10);
  await prisma.tenantAuth.update({
    where: { id: tenantAuthId },
    data: { passwordHash: newHash },
  });
  return { success: true };
}
