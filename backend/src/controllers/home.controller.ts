import { Request, Response, NextFunction } from "express";
import { HomeService } from "../services/home.service";
import { createHomeSchema, updateHomeSchema } from "../validators/home.validator";

export class HomeController {
  static async listHomesByProperty(req: Request, res: Response, next: NextFunction) {
    try {
      const { propertyId } = req.params;
      const result = await HomeService.listHomesByProperty(propertyId);
      return res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getHomeById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const home = await HomeService.getHomeById(id);
      return res.json({
        success: true,
        data: home,
      });
    } catch (err) {
      next(err);
    }
  }

  static async createHome(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createHomeSchema.parse(req.body);
      const userId = (req as any).user?.id;
      const home = await HomeService.createHome(input, userId);

      return res.status(201).json({
        success: true,
        message: "Home/Unit created successfully",
        data: home,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateHome(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const input = updateHomeSchema.parse(req.body);
      const userId = (req as any).user?.id;
      const updated = await HomeService.updateHome(id, input, userId);

      return res.json({
        success: true,
        message: "Home/Unit updated successfully",
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteHome(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      const archived = await HomeService.deleteHome(id, userId);

      return res.json({
        success: true,
        message: "Home/Unit deleted successfully",
        data: archived,
      });
    } catch (err) {
      next(err);
    }
  }
}
