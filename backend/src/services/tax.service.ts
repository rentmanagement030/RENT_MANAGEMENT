import { prisma } from "../config/prisma";
import { AppError } from "../utils/http";
import { computeTaxAndUtilityFinancials } from "../financial/tax.engine";
import {
  calculateNextDueDate,
  calculateNextTaxPeriod,
  deriveTaxStatus,
} from "../utils/taxCalculator";
import {
  CreateTaxRecordInput,
  RecordTaxPaymentInput,
  UpdateTaxRecordInput,
  UpdateTaxSettingsInput,
} from "../validators/tax.validator";
import PDFDocument from "pdfkit";

export class TaxService {
  /**
   * Lists all tax records with search, filter, and dynamic status derivation.
   */
  static async listTaxRecords(query: {
    page?: number;
    pageSize?: number;
    search?: string;
    propertyId?: string;
    homeId?: string;
    taxType?: string;
    status?: string;
  }) {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 20));
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (query.propertyId) {
      where.propertyId = query.propertyId;
    }
    if (query.homeId) {
      where.homeId = query.homeId;
    }
    if (query.taxType) {
      where.taxType = query.taxType;
    }

    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { assessmentNumber: { contains: term, mode: "insensitive" } },
        { consumerNumber: { contains: term, mode: "insensitive" } },
        { billNumber: { contains: term, mode: "insensitive" } },
        { assesseeName: { contains: term, mode: "insensitive" } },
        { property: { name: { contains: term, mode: "insensitive" } } },
        { home: { homeNumber: { contains: term, mode: "insensitive" } } },
      ];
    }

    const [totalRecords, items] = await Promise.all([
      prisma.taxRecord.count({ where }),
      prisma.taxRecord.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          property: { select: { id: true, name: true, city: true } },
          home: { select: { id: true, homeNumber: true, floor: true } },
          payments: {
            orderBy: { paymentDate: "desc" },
            take: 1,
          },
        },
        orderBy: { nextDueDate: "asc" },
      }),
    ]);

    const formattedItems = items.map((item: any) => {
      const annualAmt = Number(item.annualTaxAmount);
      const outAmt = Number(item.outstandingAmount);
      const { status, reminderStatus } = deriveTaxStatus(outAmt, annualAmt, item.nextDueDate);

      return {
        ...item,
        annualTaxAmount: annualAmt,
        lastPaidAmount: item.lastPaidAmount ? Number(item.lastPaidAmount) : 0,
        outstandingAmount: outAmt,
        derivedStatus: status,
        reminderStatus,
      };
    });

    // If filtering by status, perform filter in memory over derivedStatus
    let finalItems = formattedItems;
    if (query.status) {
      finalItems = formattedItems.filter((i: any) => i.derivedStatus === query.status);
    }

    return {
      items: finalItems,
      pagination: {
        page,
        pageSize,
        totalItems: totalRecords,
        totalPages: Math.ceil(totalRecords / pageSize),
      },
    };
  }

  /**
   * Returns tax summary statistics for dashboard cards.
   */
  static async getTaxStats(query?: string | Record<string, unknown>) {
    const filter = typeof query === "string" ? { propertyId: query } : (query ?? {});
    const financials = await computeTaxAndUtilityFinancials(filter);

    return {
      propertyTaxDue: financials.propertyTaxDue,
      waterTaxDue: financials.waterTaxDue,
      dueSoonCount: financials.dueSoonCount,
      overdueCount: financials.overdueCount,
      paidThisMonth: financials.taxPaidInPeriod,
      ownerUtilityExpense: financials.ownerUtilityExpense,
      tenantUtilityRecovery: financials.tenantUtilityRecovery,
    };
  }

  /**
   * Gets a single tax record with payment history.
   */
  static async getTaxRecordById(id: string) {
    const record = await prisma.taxRecord.findUnique({
      where: { id },
      include: {
        property: true,
        home: true,
        payments: {
          include: {
            recordedBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { paymentDate: "desc" },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!record) {
      throw new AppError(404, "Tax record not found");
    }

    const totalAmt = Number(record.annualTaxAmount);
    const outAmt = Number(record.outstandingAmount);
    const { status, reminderStatus } = deriveTaxStatus(outAmt, totalAmt, record.nextDueDate);

    return {
      ...record,
      annualTaxAmount: totalAmt,
      lastPaidAmount: record.lastPaidAmount ? Number(record.lastPaidAmount) : 0,
      outstandingAmount: outAmt,
      derivedStatus: status,
      reminderStatus,
      payments: record.payments.map((p: any) => ({
        ...p,
        amount: Number(p.amount),
      })),
    };
  }

  /**
   * Creates a new tax record.
   */
  static async createTaxRecord(data: CreateTaxRecordInput, createdById?: string) {
    const property = await prisma.property.findUnique({ where: { id: data.propertyId } });
    if (!property) {
      throw new AppError(404, "Property not found");
    }

    if (data.homeId) {
      const home = await prisma.propertyHome.findUnique({ where: { id: data.homeId } });
      if (!home) {
        throw new AppError(404, "Home/Unit not found");
      }
    }

    const nextDueDate = new Date(data.nextDueDate);
    const annualAmt = data.annualTaxAmount;

    const { status } = deriveTaxStatus(annualAmt, annualAmt, nextDueDate);

    const record = await prisma.taxRecord.create({
      data: {
        taxType: data.taxType,
        taxOwnership: data.taxOwnership,
        propertyId: data.propertyId,
        homeId: data.homeId || null,
        assessmentNumber: data.assessmentNumber || null,
        zone: data.zone || null,
        division: data.division || null,
        billNumber: data.billNumber || null,
        subNumber: data.subNumber || null,
        assesseeName: data.assesseeName || null,
        consumerNumber: data.consumerNumber || null,
        frequency: data.frequency,
        annualTaxAmount: annualAmt,
        currentTaxPeriod: data.currentTaxPeriod,
        nextDueDate,
        outstandingAmount: annualAmt,
        status,
        notes: data.notes || null,
        createdById: createdById || null,
      },
      include: {
        property: true,
        home: true,
      },
    });

    if (createdById) {
      await prisma.auditLog.create({
        data: {
          userId: createdById,
          action: "TAX_RECORD_CREATED",
          entityType: "TaxRecord",
          entityId: record.id,
          metadata: { taxType: data.taxType, amount: annualAmt, period: data.currentTaxPeriod },
        },
      });
    }

    return record;
  }

  /**
   * Updates an existing tax record.
   */
  static async updateTaxRecord(id: string, data: UpdateTaxRecordInput, updatedById?: string) {
    const existing = await prisma.taxRecord.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, "Tax record not found");
    }

    const updateData: any = {};

    if (data.assessmentNumber !== undefined) updateData.assessmentNumber = data.assessmentNumber;
    if (data.zone !== undefined) updateData.zone = data.zone;
    if (data.division !== undefined) updateData.division = data.division;
    if (data.billNumber !== undefined) updateData.billNumber = data.billNumber;
    if (data.subNumber !== undefined) updateData.subNumber = data.subNumber;
    if (data.assesseeName !== undefined) updateData.assesseeName = data.assesseeName;
    if (data.consumerNumber !== undefined) updateData.consumerNumber = data.consumerNumber;
    if (data.frequency !== undefined) updateData.frequency = data.frequency;
    if (data.currentTaxPeriod !== undefined) updateData.currentTaxPeriod = data.currentTaxPeriod;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.nextDueDate !== undefined) updateData.nextDueDate = new Date(data.nextDueDate);

    if (data.annualTaxAmount !== undefined) {
      updateData.annualTaxAmount = data.annualTaxAmount;
      // Adjust outstanding if tax hasn't been paid yet
      if (Number(existing.outstandingAmount) === Number(existing.annualTaxAmount)) {
        updateData.outstandingAmount = data.annualTaxAmount;
      }
    }

    const updated = await prisma.taxRecord.update({
      where: { id },
      data: updateData,
      include: { property: true, home: true },
    });

    if (updatedById) {
      await prisma.auditLog.create({
        data: {
          userId: updatedById,
          action: "TAX_RECORD_UPDATED",
          entityType: "TaxRecord",
          entityId: id,
          metadata: { oldAmount: existing.annualTaxAmount, oldFrequency: existing.frequency, updates: updateData },
        },
      });
    }

    return updated;
  }

  /**
   * Records a tax payment, enforces overpayment protection,
   * advances tax period and due date on 100% settlement,
   * and creates a single P&L expense entry.
   */
  static async recordTaxPayment(input: RecordTaxPaymentInput, recordedById?: string) {
    const taxRecord = await prisma.taxRecord.findUnique({
      where: { id: input.taxRecordId },
      include: { property: true, home: true },
    });

    if (!taxRecord) {
      throw new AppError(404, "Tax record not found");
    }

    const currentOutstanding = Number(taxRecord.outstandingAmount);

    // OVERPAYMENT PROTECTION: Payment cannot exceed outstanding balance
    if (input.amount > currentOutstanding + 0.001) {
      throw new AppError(400, "Payment cannot exceed the outstanding tax amount.");
    }

    const paymentDate = input.paymentDate ? new Date(input.paymentDate) : new Date();
    const prefix = taxRecord.taxType === "WATER_TAX" ? "WT" : "PT";
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const receiptNumber = `${prefix}-${paymentDate.getFullYear()}-${randNum}`;

    const newOutstanding = Math.max(0, currentOutstanding - input.amount);
    const isFullyPaid = newOutstanding <= 0.001;

    let nextDueDate = taxRecord.nextDueDate;
    let nextTaxPeriod = taxRecord.currentTaxPeriod;
    let newStatus = "PARTIAL";

    if (isFullyPaid) {
      newStatus = "PAID";
      nextDueDate = calculateNextDueDate(taxRecord.nextDueDate, taxRecord.frequency);
      nextTaxPeriod = calculateNextTaxPeriod(taxRecord.currentTaxPeriod, taxRecord.frequency);
    }

    return await prisma.$transaction(async (tx: any) => {
      // 1. Single-entry P&L Expense Record
      const expenseCategory = taxRecord.taxType === "WATER_TAX" ? "WATER_TAX" : "PROPERTY_TAX";
      const homeSuffix = taxRecord.home ? ` (Home: ${taxRecord.home.homeNumber})` : "";
      const expenseDescription = `${taxRecord.taxType === "WATER_TAX" ? "Water" : "Property"} Tax Payment - ${taxRecord.property.name}${homeSuffix} [Period: ${taxRecord.currentTaxPeriod}]`;

      const expense = await tx.expense.create({
        data: {
          propertyId: taxRecord.propertyId,
          category: expenseCategory,
          description: expenseDescription,
          amount: input.amount,
          expenseDate: paymentDate,
          recordedById: recordedById || null,
        },
      });

      // 2. Tax Payment Record
      const paymentRecord = await tx.taxPaymentRecord.create({
        data: {
          taxRecordId: taxRecord.id,
          taxType: taxRecord.taxType,
          propertyId: taxRecord.propertyId,
          homeId: taxRecord.homeId,
          amount: input.amount,
          paymentDate,
          paymentMethod: input.paymentMethod,
          receiptNumber,
          referenceNumber: input.referenceNumber || null,
          taxPeriod: taxRecord.currentTaxPeriod,
          notes: input.notes || null,
          recordedById: recordedById || null,
          expenseId: expense.id,
        },
      });

      // 3. Update Tax Record status, outstanding, period, and next due date
      const updatedTaxRecord = await tx.taxRecord.update({
        where: { id: taxRecord.id },
        data: {
          lastPaidDate: paymentDate,
          lastPaidAmount: input.amount,
          outstandingAmount: isFullyPaid ? Number(taxRecord.annualTaxAmount) : newOutstanding,
          status: newStatus,
          currentTaxPeriod: isFullyPaid ? nextTaxPeriod : taxRecord.currentTaxPeriod,
          nextDueDate: isFullyPaid ? nextDueDate : taxRecord.nextDueDate,
        },
      });

      // 4. Audit log
      if (recordedById) {
        await tx.auditLog.create({
          data: {
            userId: recordedById,
            action: isFullyPaid ? "TAX_PAYMENT_SETTLED" : "TAX_PAYMENT_PARTIAL",
            entityType: "TaxPaymentRecord",
            entityId: paymentRecord.id,
            metadata: {
              amount: input.amount,
              receiptNumber,
              isFullyPaid,
              nextDueDate: isFullyPaid ? nextDueDate : undefined,
              nextTaxPeriod: isFullyPaid ? nextTaxPeriod : undefined,
            },
          },
        });
      }

      return {
        paymentRecord,
        updatedTaxRecord,
        receiptNumber,
        isFullyPaid,
        nextDueDate,
        nextTaxPeriod,
      };
    });
  }

  /**
   * Gets Tax & Utility global settings from Setting model.
   */
  static async getTaxSettings() {
    const setting = await prisma.setting.findUnique({
      where: { key: "tax_utility_settings" },
    });

    if (!setting) {
      return {
        defaultPropertyTaxFrequency: "ANNUAL",
        defaultWaterTaxFrequency: "BI_MONTHLY",
        reminderDays: [30, 15, 7, 3, 1],
        enablePropertyTaxReminders: true,
        enableWaterTaxReminders: true,
        enableEbReminders: true,
        defaultLatePenalty: 50,
      };
    }

    const val = setting.value;
    return typeof val === "string" ? JSON.parse(val) : (val as any);
  }

  /**
   * Updates Tax & Utility settings.
   */
  static async updateTaxSettings(input: UpdateTaxSettingsInput, userId?: string) {
    const current = await this.getTaxSettings();
    const updated = { ...current, ...input };

    await prisma.setting.upsert({
      where: { key: "tax_utility_settings" },
      update: { value: JSON.stringify(updated) },
      create: {
        key: "tax_utility_settings",
        value: JSON.stringify(updated),
      },
    });

    if (userId) {
      await prisma.auditLog.create({
        data: {
          userId,
          action: "TAX_SETTINGS_UPDATED",
          entityType: "Setting",
          metadata: updated as any,
        },
      });
    }

    return updated;
  }

  /**
   * Generates a PDF Tax Payment Receipt buffer using pdfkit.
   */
  static async generateTaxReceiptPdf(paymentId: string): Promise<Buffer> {
    const payment = await prisma.taxPaymentRecord.findUnique({
      where: { id: paymentId },
      include: {
        property: true,
        home: true,
        taxRecord: true,
        recordedBy: { select: { name: true, email: true } },
      },
    });

    if (!payment) {
      throw new AppError(404, "Tax payment record not found");
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      const buffers: Buffer[] = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      // Header Banner
      doc.fillColor("#1E293B").fontSize(22).text("C2D RENTALS", { align: "center" });
      doc.fontSize(10).fillColor("#64748B").text("OFFICIAL TAX PAYMENT RECEIPT", { align: "center" });
      doc.moveDown(1.5);

      // Line divider
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#CBD5E1").stroke();
      doc.moveDown(1);

      // Receipt details box
      doc.fillColor("#0F172A").fontSize(12).text(`Receipt No: ${payment.receiptNumber}`, { underline: true });
      doc.fontSize(10).text(`Date: ${new Date(payment.paymentDate).toLocaleDateString("en-IN")}`);
      doc.text(`Payment Method: ${payment.paymentMethod}`);
      if (payment.referenceNumber) {
        doc.text(`Reference No: ${payment.referenceNumber}`);
      }
      doc.moveDown(1);

      // Property & Tax Details Table
      doc.fillColor("#1E293B").fontSize(12).text("Tax & Property Information", { bold: true } as any);
      doc.moveDown(0.5);

      doc.fontSize(10).fillColor("#334155");
      doc.text(`Property Name: ${payment.property.name}`);
      doc.text(`Address: ${payment.property.address}, ${payment.property.city}`);
      if (payment.home) {
        doc.text(`Home / Unit: ${payment.home.homeNumber} (${payment.home.floor})`);
      }
      doc.text(`Tax Type: ${payment.taxType === "WATER_TAX" ? "Water Tax" : "Property Tax"}`);
      if (payment.taxRecord.assessmentNumber) {
        doc.text(`Assessment No: ${payment.taxRecord.assessmentNumber}`);
      }
      if (payment.taxRecord.consumerNumber) {
        doc.text(`Consumer No: ${payment.taxRecord.consumerNumber}`);
      }
      doc.text(`Tax Period: ${payment.taxPeriod}`);
      doc.moveDown(1);

      // Payment Breakdown
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#CBD5E1").stroke();
      doc.moveDown(1);

      doc.fontSize(14).fillColor("#0F172A").text(`Amount Paid: Rs. ${Number(payment.amount).toLocaleString("en-IN")}`, { bold: true } as any);
      doc.moveDown(1.5);

      if (payment.recordedBy) {
        doc.fontSize(9).fillColor("#64748B").text(`Recorded By: ${payment.recordedBy.name} (${payment.recordedBy.email})`);
      }

      doc.moveDown(2);
      doc.fontSize(8).fillColor("#94A3B8").text("This is an electronically generated receipt by C2D Rentals Property Management System.", { align: "center" });

      doc.end();
    });
  }
}
