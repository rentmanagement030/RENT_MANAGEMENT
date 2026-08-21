import type { NextFunction, Request, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "../utils/http";
import { PermissionKey } from "../utils/permissions";

export function authorize(...permissions: PermissionKey[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return next(new UnauthorizedError());

    const roles = user.roles ?? [];
    const isSuperAdmin = roles.some((r) => r.name === "SUPER_ADMIN");
    if (isSuperAdmin) return next();

    const granted = new Set(
      roles.flatMap((r) => r.permissions.map((p) => p.permission.key)),
    );

    const missing = permissions.filter((p) => !granted.has(p));
    if (missing.length > 0) {
      return next(new ForbiddenError(`Missing required permission: ${missing.join(", ")}`));
    }

    next();
  };
}

export function requireAny(...permissions: PermissionKey[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return next(new UnauthorizedError());

    const roles = user.roles ?? [];
    if (roles.some((r) => r.name === "SUPER_ADMIN")) return next();

    const granted = new Set(
      roles.flatMap((r) => r.permissions.map((p) => p.permission.key)),
    );
    if (!permissions.some((p) => granted.has(p))) {
      return next(new ForbiddenError("You do not have permission to perform this action"));
    }
    next();
  };
}
