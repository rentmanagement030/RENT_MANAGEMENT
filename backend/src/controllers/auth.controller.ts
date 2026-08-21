import type { Request, Response } from "express";
import { asyncHandler, ok } from "../utils/http";
import * as authService from "../services/auth.service";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "../middleware/auth/types";
import { env } from "../config/env";

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };
  const { token, user } = await authService.login(email, password, req);
  res.cookie(SESSION_COOKIE, token, {
    ...SESSION_COOKIE_OPTIONS,
    secure: env.cookieSecure,
    maxAge: env.sessionTtlHours * 60 * 60 * 1000,
  });
  return ok(res, { user });
});

export const firebaseLogin = asyncHandler(async (req: Request, res: Response) => {
  const { idToken } = req.body as { idToken: string };
  const { token, user } = await authService.loginWithFirebase(idToken, req);
  res.cookie(SESSION_COOKIE, token, {
    ...SESSION_COOKIE_OPTIONS,
    secure: env.cookieSecure,
    maxAge: env.sessionTtlHours * 60 * 60 * 1000,
  });
  return ok(res, { user });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await authService.logout(req, res);
  return ok(res, { message: "Logged out" });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getMe(req.user!.id);
  return ok(res, { user });
});

export const sessions = asyncHandler(async (req: Request, res: Response) => {
  const sessions = await authService.listSessions(req.user!.id);
  return ok(res, { sessions });
});

export const revokeSession = asyncHandler(async (req: Request, res: Response) => {
  await authService.revokeSession(req.user!.id, req.params.id, req.session?.id);
  return ok(res, { message: "Session revoked" });
});

export const requestReset = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };
  const result = await authService.requestPasswordReset(email, req);
  return ok(res, result ?? { message: "If an account exists, a reset link has been sent." });
});

export const confirmReset = asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body as { token: string; password: string };
  await authService.resetPassword(token, password, req);
  return ok(res, { message: "Password reset successful. Please login." });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  await authService.changePassword(req.user!.id, currentPassword, newPassword, req);
  return ok(res, { message: "Password changed" });
});
