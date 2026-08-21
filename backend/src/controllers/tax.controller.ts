import { Request, Response, NextFunction } from "express";
import { TaxService } from "../services/tax.service";
import {
  createTaxRecordSchema,
  recordTaxPaymentSchema,
  updateTaxRecordSchema,
  updateTaxSettingsSchema,
} from "../validators/tax.validator";

export class TaxController {
  static async listTaxRecords(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;
      const search = req.query.search as string;
      const propertyId = req.query.propertyId as string;
      const homeId = req.query.homeId as string;
      const taxType = req.query.taxType as string;
      const status = req.query.status as string;

      const result = await TaxService.listTaxRecords({
        page,
        pageSize,
        search,
        propertyId,
        homeId,
        taxType,
        status,
      });

      return res.json({
        success: true,
        data: {
          items: result.items,
          pagination: result.pagination,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getTaxStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await TaxService.getTaxStats(req.query as any);
      return res.json({
        success: true,
        data: stats,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getTaxRecordById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const record = await TaxService.getTaxRecordById(id);
      return res.json({
        success: true,
        data: record,
      });
    } catch (err) {
      next(err);
    }
  }

  static async createTaxRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createTaxRecordSchema.parse(req.body);
      const userId = (req as any).user?.id;
      const record = await TaxService.createTaxRecord(input, userId);

      return res.status(201).json({
        success: true,
        message: "Tax record created successfully",
        data: record,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateTaxRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const input = updateTaxRecordSchema.parse(req.body);
      const userId = (req as any).user?.id;
      const updated = await TaxService.updateTaxRecord(id, input, userId);

      return res.json({
        success: true,
        message: "Tax record updated successfully",
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  static async recordTaxPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const input = recordTaxPaymentSchema.parse(req.body);
      const userId = (req as any).user?.id;
      const result = await TaxService.recordTaxPayment(input, userId);

      return res.status(201).json({
        success: true,
        message: result.isFullyPaid
          ? `Tax payment recorded. Tax period advanced to ${result.nextTaxPeriod} and next due date is ${new Date(result.nextDueDate).toLocaleDateString("en-IN")}.`
          : "Partial tax payment recorded successfully.",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getTaxSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await TaxService.getTaxSettings();
      return res.json({
        success: true,
        data: settings,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateTaxSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const input = updateTaxSettingsSchema.parse(req.body);
      const userId = (req as any).user?.id;
      const updated = await TaxService.updateTaxSettings(input, userId);

      return res.json({
        success: true,
        message: "Tax & utility settings updated successfully",
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  static async downloadTaxReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      const { paymentId } = req.params;
      const pdfBuffer = await TaxService.generateTaxReceiptPdf(paymentId);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="tax-receipt-${paymentId}.pdf"`);
      return res.send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }
}
