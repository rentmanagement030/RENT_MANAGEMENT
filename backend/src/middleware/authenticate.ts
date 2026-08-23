import type { NextFunction, Request, Response } from "express";
import { prisma } from "../config/prisma";
import { UnauthorizedError } from "../utils/http";
import { hashToken } from "../utils/token";
import { SESSION_COOKIE } from "./auth/types";

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    let token = req.cookies?.[SESSION_COOKIE];
    
    // Fallback for Safari/Mobile cross-domain tracking prevention
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.substring(7);
    }

    if (!token) {
      throw new UnauthorizedError("Authentication required");
    }

    const tokenHash = hashToken(token);
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            userRoles: {
              include: { role: { include: { permissions: { include: { permission: true } } } } },
            },
          },
        },
      },
    });

    if (!session || session.revokedAt) {
      throw new UnauthorizedError("Session invalid or revoked");
    }
    if (session.expiresAt < new Date()) {
      throw new UnauthorizedError("Session expired");
    }
    if (session.user.status !== "ACTIVE") {
      throw new UnauthorizedError("Account is disabled. Contact an administrator.");
    }

    await prisma.session.update({
      where: { id: session.id },
      data: { lastSeen: new Date() },
    }).catch(() => {
      // Non-fatal if session lastSeen fails to update
    });

    const user = session.user as (typeof session.user) & {
      roles: (typeof session.user.userRoles)[number]["role"][];
    };
    user.roles = session.user.userRoles.map((ur) => ur.role);

    req.user = user;
    req.session = session;
    next();
  } catch (err) {
    next(err);
  }
}
