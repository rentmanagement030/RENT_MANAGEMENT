import type { Request, Response } from "express";
import { asyncHandler, ok } from "../utils/http";
import * as propertyService from "../services/property.service";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await propertyService.listProperties(req.query);
  return ok(res, result);
});

export const get = asyncHandler(async (req: Request, res: Response) => {
  const property = await propertyService.getProperty(req.params.id);
  return ok(res, { property });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const property = await propertyService.createProperty(req.body, req, req.user!.id);
  return ok(res, { property }, 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const property = await propertyService.updateProperty(req.params.id, req.body, req, req.user!.id);
  return ok(res, { property });
});

export const archive = asyncHandler(async (req: Request, res: Response) => {
  const property = await propertyService.archiveProperty(req.params.id, req, req.user!.id);
  return ok(res, { property });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const result = await propertyService.deleteProperty(req.params.id, req, req.user!.id);
  return ok(res, { message: "Property deleted or archived", result });
});

export const setImages = asyncHandler(async (req: Request, res: Response) => {
  await propertyService.setPropertyImages(req.params.id, req.body.images, req, req.user!.id);
  return ok(res, { message: "Images updated" });
});

export const listRooms = asyncHandler(async (req: Request, res: Response) => {
  const rooms = await propertyService.listRooms(req.params.propertyId);
  return ok(res, { rooms });
});

export const createRoom = asyncHandler(async (req: Request, res: Response) => {
  const room = await propertyService.createRoom(req.body, req, req.user!.id);
  return ok(res, { room }, 201);
});

export const updateRoom = asyncHandler(async (req: Request, res: Response) => {
  const room = await propertyService.updateRoom(req.params.id, req.body, req, req.user!.id);
  return ok(res, { room });
});

export const deleteRoom = asyncHandler(async (req: Request, res: Response) => {
  const result = await propertyService.deleteRoom(req.params.id, req, req.user!.id);
  return ok(res, result);
});

export const createBeds = asyncHandler(async (req: Request, res: Response) => {
  const beds = await propertyService.createBeds(
    req.params.roomId,
    Array.isArray(req.body.bedNumbers) ? req.body.bedNumbers : [req.body.bedNumber].filter(Boolean),
    req,
    req.user!.id,
  );
  return ok(res, { beds }, 201);
});

export const updateBed = asyncHandler(async (req: Request, res: Response) => {
  const bed = await propertyService.updateBed(req.params.id, req.body, req, req.user!.id);
  return ok(res, { bed });
});
