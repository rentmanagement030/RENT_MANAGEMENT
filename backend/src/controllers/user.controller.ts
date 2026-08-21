import type { Request, Response } from "express";
import { asyncHandler, ok } from "../utils/http";
import * as userService from "../services/user.service";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.listUsers(req.query);
  return ok(res, result);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.createUser(req.body, req, req.user!.id);
  return ok(res, { user }, 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.updateUser(req.params.id, req.body, req, req.user!.id);
  return ok(res, { user });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await userService.deleteUser(req.params.id, req, req.user!.id);
  return ok(res, { message: "User deactivated" });
});

export const roles = asyncHandler(async (_req: Request, res: Response) => {
  const roles = await userService.listRoles();
  return ok(res, { roles });
});

export const permissions = asyncHandler(async (_req: Request, res: Response) => {
  const permissions = await userService.listAllPermissions();
  return ok(res, { permissions });
});
