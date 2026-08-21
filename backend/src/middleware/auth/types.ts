import type { Permission, Role, Session, User } from "@prisma/client";

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Request {
      user?: User & {
        roles: (Role & { permissions: { permission: Permission }[] })[];
      };
      session?: Session;
    }
  }
}

export {};

export type AuthUser = NonNullable<Express.Request["user"]>;

export const SESSION_COOKIE = "rm_session";
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === "production" ? ("none" as const) : ("strict" as const),
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
