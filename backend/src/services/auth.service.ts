import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { hashPassword, verifyPassword } from "../utils/password";
import { generateSessionToken, hashToken, signResetToken, verifyResetToken } from "../utils/token";
import { UnauthorizedError, NotFoundError, ConflictError } from "../utils/http";
import { logger } from "../utils/logger";
import { writeAuditLog } from "../utils/audit";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "../middleware/auth/types";
import { verifyFirebaseIdToken } from "../utils/firebase";
import type { Request, Response } from "express";

const includeUserAuth = {
  userRoles: {
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  },
} satisfies Prisma.UserInclude;

export type AuthUserRecord = Prisma.UserGetPayload<{ include: typeof includeUserAuth }>;

export function serializeUser(user: AuthUserRecord) {
  const roles = user.userRoles.map((ur) => ur.role);
  const isSuperAdmin = roles.some((r) => r.name === "SUPER_ADMIN");
  const permissions = Array.from(
    new Set(roles.flatMap((r) => r.permissions.map((p) => p.permission.key))),
  );

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    roles: roles.map((r) => ({ id: r.id, name: r.name, description: r.description })),
    permissions,
    isSuperAdmin,
  };
}

export async function login(email: string, password: string, req: Request) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: includeUserAuth,
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    await writeAuditLog(req, {
      action: "auth.failed_login",
      entityType: "auth",
      metadata: { email },
    });
    throw new UnauthorizedError("Invalid email or password");
  }

  if (user.status !== "ACTIVE") {
    await writeAuditLog(req, {
      action: "auth.blocked_login",
      entityType: "auth",
      metadata: { email, status: user.status },
    });
    throw new UnauthorizedError("Account is disabled. Contact an administrator.");
  }

  const token = generateSessionToken();
  const ttlMs = env.sessionTtlHours * 60 * 60 * 1000;
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + ttlMs),
      ip: req.ip,
      userAgent: req.get("user-agent"),
    },
  });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  await writeAuditLog(req, {
    action: "auth.login",
    entityType: "auth",
    entityId: session.id,
    metadata: { email: user.email },
  }, user.id);

  return { token, session, user: serializeUser(user) };
}

export async function loginWithFirebase(idToken: string, req: Request) {
  const verifiedToken = await verifyFirebaseIdToken(idToken);
  const uid = verifiedToken.uid;
  const email = verifiedToken.email;
  const name = verifiedToken.name;

  if (!email) {
    throw new UnauthorizedError("Firebase token missing email identity");
  }

  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { firebaseUid: uid },
        { email: email.toLowerCase() },
      ],
    },
    include: includeUserAuth,
  });

  if (!user) {
    const defaultRole = await prisma.role.findFirst({
      where: { name: { in: ["STAFF", "VIEWER"] } },
    });
    const randomPwHash = await hashPassword(`FB_${uid}_${Date.now()}`);
    const newUser = await prisma.user.create({
      data: {
        name: name || email.split("@")[0],
        email: email.toLowerCase(),
        firebaseUid: uid,
        passwordHash: randomPwHash,
        status: "ACTIVE",
        ...(defaultRole ? { userRoles: { create: { roleId: defaultRole.id } } } : {}),
      },
    });
    user = (await prisma.user.findUnique({
      where: { id: newUser.id },
      include: includeUserAuth,
    })) as AuthUserRecord;
  } else if (!user.firebaseUid) {
    await prisma.user.update({
      where: { id: user.id },
      data: { firebaseUid: uid },
    });
  }

  if (user.status !== "ACTIVE") {
    await writeAuditLog(req, {
      action: "auth.blocked_login",
      entityType: "auth",
      metadata: { email: user.email, status: user.status },
    });
    throw new UnauthorizedError("Account is disabled. Contact an administrator.");
  }

  const token = generateSessionToken();
  const ttlMs = env.sessionTtlHours * 60 * 60 * 1000;
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + ttlMs),
      ip: req.ip,
      userAgent: req.get("user-agent"),
    },
  });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  await writeAuditLog(
    req,
    {
      action: "auth.google_login",
      entityType: "auth",
      entityId: session.id,
      metadata: { email: user.email, firebaseUid: uid },
    },
    user.id,
  );

  return { token, session, user: serializeUser(user) };
}

export async function logout(req: Request, res: Response) {
  const session = req.session;
  if (session) {
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    await writeAuditLog(req, {
      action: "auth.logout",
      entityType: "auth",
      entityId: session.id,
    }, session.userId);
  }
  res.clearCookie(SESSION_COOKIE, SESSION_COOKIE_OPTIONS);
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: includeUserAuth });
  if (!user) throw new NotFoundError("User not found");
  return serializeUser(user);
}

export async function listSessions(userId: string) {
  const sessions = await prisma.session.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return sessions.map((s) => ({
    id: s.id,
    ip: s.ip,
    userAgent: s.userAgent,
    createdAt: s.createdAt,
    lastSeen: s.lastSeen,
    expiresAt: s.expiresAt,
    revoked: Boolean(s.revokedAt),
    active: !s.revokedAt && s.expiresAt > new Date(),
  }));
}

export async function revokeSession(userId: string, sessionId: string, currentSessionId?: string) {
  const session = await prisma.session.findFirst({ where: { id: sessionId, userId } });
  if (!session) throw new NotFoundError("Session not found");
  if (session.id === currentSessionId) {
    throw new ConflictError("Cannot revoke the current session from here");
  }
  await prisma.session.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });
}

export async function requestPasswordReset(email: string, req: Request) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return; // Never reveal whether an account exists.
  const token = signResetToken(user.email);
  await writeAuditLog(req, {
    action: "auth.reset_requested",
    entityType: "user",
    entityId: user.id,
  }, user.id);

  if (env.nodeEnv !== "production") {
    logger.info(`Password reset token for ${user.email}: ${token}`);
  }
  return { devToken: env.nodeEnv !== "production" ? token : undefined };
}

export async function resetPassword(token: string, password: string, req: Request) {
  const payload = verifyResetToken(token);
  if (!payload) throw new UnauthorizedError("Invalid or expired reset token");

  const user = await prisma.user.findUnique({ where: { email: payload.email } });
  if (!user) throw new NotFoundError("User not found");

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password) },
  });
  await prisma.session.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await writeAuditLog(req, {
    action: "auth.reset_completed",
    entityType: "user",
    entityId: user.id,
  }, user.id);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  req: Request,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("User not found");
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new UnauthorizedError("Current password is incorrect");
  }
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });
  await writeAuditLog(req, {
    action: "auth.password_changed",
    entityType: "user",
    entityId: userId,
  }, userId);
}
