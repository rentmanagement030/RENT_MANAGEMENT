import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodSchema } from "zod";
import { ValidationError } from "../utils/http";

export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(
          new ValidationError(
            err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
          ),
        );
      }
      next(err);
    }
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.query) as Record<string, unknown>;
      req.query = { ...req.query, ...parsed } as unknown as Request["query"];
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(
          new ValidationError(
            err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
          ),
        );
      }
      next(err);
    }
  };
}
