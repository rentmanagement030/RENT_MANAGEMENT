import { Prisma } from "@prisma/client";
import crypto from "node:crypto";
import PDFDocument from "pdfkit";
import { prisma } from "../config/prisma";
import { NotFoundError, ConflictError } from "../utils/http";
import { buildPagination, parsePagination } from "../utils/pagination";
import { writeAuditLog } from "../utils/audit";
import { nanoid } from "nanoid";
import { signDownloadToken, deleteFile, savePrivate, readStored } from "../utils/storage";
import { numberMoney } from "../utils/money";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { sendWhatsAppMessage, agreementSigningBody } from "./whatsapp.service";
import type { Request } from "express";

const agreementInclude = {
  tenant: {
    select: {
      id: true,
      name: true,
      phone: true,
      room: { select: { id: true, roomNumber: true } },
      bed: { select: { id: true, bedNumber: true } },
    },
  },
  property: { select: { id: true, name: true, number: true, type: true } },
} satisfies Prisma.AgreementInclude;

export interface AgreementInput {
  tenantId: string;
  propertyId: string;
  startDate: Date;
  endDate: Date;
  rent: number;
  advance?: number;
  deposit?: number;
  status?: "ACTIVE" | "EXPIRED" | "TERMINATED" | "RENEWED";
  documentStorageKey?: string;
  documentName?: string;
  documentMimeType?: string;
  documentSize?: number;
}

export interface AgreementDocumentInput {
  storageKey: string;
  originalName: string;
  mimeType: string;
  size: number;
}

function toAgreementView(a: {
  id: string;
  documentStorageKey: string | null;
  documentName: string | null;
  documentMimeType: string | null;
  documentSize: number | null;
  signedPdfUrl: string | null;
  status: string;
  isLocked: boolean;
  [key: string]: unknown;
}) {
  const { documentStorageKey, documentName, documentMimeType, documentSize, signedPdfUrl, token, ...rest } = a;
  const id = a.id;
  const isSigned = a.isLocked || a.status === "SIGNED" || a.status === "COMPLETED";

  return {
    ...rest,
    document: (documentStorageKey || id)
      ? {
          name: documentName ?? `Agreement-${rest.agreementNumber ?? id}.pdf`,
          mimeType: documentMimeType ?? "application/pdf",
          size: documentSize ?? 0,
          url: documentStorageKey ? `/api/files/${signDownloadToken(documentStorageKey, 300)}` : `/api/rent/agreements/${id}/document`,
        }
      : null,
    signedPdf: (signedPdfUrl || isSigned)
      ? {
          name: `Signed-Agreement-${rest.agreementNumber ?? "v" + rest.version}.pdf`,
          url: signedPdfUrl ? `/api/files/${signDownloadToken(signedPdfUrl, 300)}` : `/api/rent/agreements/${id}/signed-document`,
        }
      : null,
  };
}

function toISODate(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 10);
}

function calculateDurationMonths(startDateStr: string, endDateStr: string): string {
  if (!startDateStr || !endDateStr) return "";
  const s = new Date(startDateStr);
  const e = new Date(endDateStr);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return "";
  const diffMs = e.getTime() - s.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const months = Math.round(diffDays / 30.4375);
  if (months <= 0) return "1 month";
  return `${months} months`;
}

/**
 * Build the final signed PDF for an agreement. Includes the frozen financial
 * terms, the signed agreement version, and the electronic signature metadata
 * (signature name, method, timestamp, IP address, user agent).
 */
export async function buildSignedAgreementPdf(
  agreement: {
    agreementNumber: string;
    version: number;
    startDate: Date;
    endDate: Date;
    rent: Prisma.Decimal;
    advance: Prisma.Decimal;
    deposit: Prisma.Decimal;
    signatureName: string | null;
    signatureUrl?: string | null;
    signatureMethod: string | null;
    signedAt: Date | null;
    signedIp: string | null;
    signedUserAgent: string | null;
    status?: string;
    isLocked?: boolean;
    tenant?: { name: string; phone: string; email?: string | null } | null;
    property?: { name: string; number: string | null; type: string; address?: string | null } | null;
    room?: { roomNumber: string } | null;
    bed?: { bedNumber: string } | null;
  },
): Promise<Buffer> {
  const settings = await prisma.setting.findMany();
  const get = (key: string) => {
    const s = settings.find((x) => x.key === key);
    return s ? String(JSON.stringify(s.value)).replace(/^"|"$/g, "") : "";
  };
  const businessName = get("businessName") || "C2D Rentals";
  const businessPhone = get("businessPhone") || "+91 98765 43210";
  const businessEmail = get("businessEmail") || "support@c2drentals.com";
  const businessAddress = get("businessAddress") || "Property Management Office, City Center";
  const currency = get("currency") || "₹";

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));

  // Header Banner
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#0f172a").text(businessName.toUpperCase(), { align: "center" });
  doc.font("Helvetica").fontSize(9).fillColor("#475569");
  if (businessAddress) doc.text(businessAddress, { align: "center" });
  doc.text(`Contact: ${businessPhone} | Email: ${businessEmail}`, { align: "center" });
  
  doc.moveDown(0.5);
  doc.strokeColor("#cbd5e1").lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.6);

  // Document Title
  const isSigned = agreement.isLocked || agreement.status === "SIGNED" || agreement.status === "COMPLETED" || agreement.status === "ACTIVE" || !!agreement.signedAt;
  doc.font("Helvetica-Bold").fontSize(14).fillColor("#1e293b").text("RESIDENTIAL LEASE AGREEMENT", { align: "center" });
  doc.font("Helvetica").fontSize(9).fillColor("#64748b").text(`Agreement Reference: AGR-${agreement.agreementNumber || "DRAFT"} | Date: ${toISODate(agreement.startDate)}`, { align: "center" });
  doc.moveDown(0.8);

  const drawSectionHeader = (title: string) => {
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#1e3a8a").text(title.toUpperCase());
    doc.moveDown(0.2);
    doc.strokeColor("#93c5fd").lineWidth(0.75).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.4);
    doc.font("Helvetica").fontSize(9.5).fillColor("#334155");
  };

  // 1. PARTIES
  drawSectionHeader("1. Parties to the Agreement");
  doc.text(`This Lease Agreement is entered into on ${toISODate(agreement.startDate)}, by and between:`);
  doc.moveDown(0.3);
  doc.font("Helvetica-Bold").text("LANDLORD / PROPERTY MANAGER:");
  doc.font("Helvetica").text(`${businessName} (${businessPhone}, ${businessEmail})`);
  doc.moveDown(0.3);
  doc.font("Helvetica-Bold").text("TENANT / OCCUPANT:");
  doc.font("Helvetica").text(`Name: ${agreement.tenant?.name ?? "N/A"}`);
  doc.text(`Phone: ${agreement.tenant?.phone ?? "N/A"}${agreement.tenant?.email ? ` | Email: ${agreement.tenant.email}` : ""}`);
  doc.moveDown(0.8);

  // 2. PROPERTY DETAILS
  drawSectionHeader("2. Premises & Occupancy");
  doc.text(`Property Name: ${agreement.property?.name ?? "N/A"} (${agreement.property?.type === "HOUSE" ? "Independent House / Flat" : "Paying Guest / PG"})`);
  if ((agreement as any).room || (agreement as any).bed) {
    const roomStr = (agreement as any).room ? `Room No: ${(agreement as any).room.roomNumber}` : "";
    const bedStr = (agreement as any).bed ? `Bed No: ${(agreement as any).bed.bedNumber}` : "";
    doc.text(`Allocated Space: ${[roomStr, bedStr].filter(Boolean).join(" · ")}`);
  }
  if (agreement.property?.number) doc.text(`Property Unit No: ${agreement.property.number}`);
  doc.moveDown(0.8);

  // 3. TENANCY PERIOD & FINANCIAL TERMS
  drawSectionHeader("3. Term & Financial Details");
  const durationStr = calculateDurationMonths(toISODate(agreement.startDate), toISODate(agreement.endDate));
  doc.text(`Lease Term: ${toISODate(agreement.startDate)} to ${toISODate(agreement.endDate)} (${durationStr})`);
  doc.text(`Monthly Rent Amount: ${currency}${numberMoney(agreement.rent).toLocaleString("en-IN")} per month`);
  doc.text(`Advance Amount: ${currency}${numberMoney(agreement.advance).toLocaleString("en-IN")}`);
  doc.text(`Security Deposit: ${currency}${numberMoney(agreement.deposit).toLocaleString("en-IN")}`);
  doc.text(`Payment Due Date: 1st of each calendar month`);
  doc.moveDown(0.8);

  // 4. TERMS AND CONDITIONS
  drawSectionHeader("4. General Terms & Operating Conditions");
  const terms = [
    "1. RENT PAYMENT: Rent is payable on or before the due date. Late payments may attract standard administrative charges.",
    "2. SECURITY DEPOSIT: Deposit is held as security against damages or unpaid utility bills and is refundable upon tenancy termination.",
    "3. PREMISES USE: The premises shall be used exclusively for residential lodging. Commercial activities or subletting are strictly prohibited.",
    "4. MAINTENANCE & HYGIENE: The occupant shall maintain cleanliness and report any fixture or structural damage immediately.",
    "5. NOTICE PERIOD: A mandatory written notice period of 30 days is required prior to vacating or terminating this agreement.",
    "6. UTILITIES: Utility charges (Electricity, Water, Internet) shall be settled directly by the occupant as per meter readings or fixed terms.",
  ];
  terms.forEach((t) => {
    doc.text(t);
    doc.moveDown(0.2);
  });
  doc.moveDown(0.6);

  // 5. SIGNATURE & VERIFICATION RECORD
  drawSectionHeader("5. Execution & Electronic Signature Record");
  if (isSigned) {
    doc.font("Helvetica-Bold").fillColor("#166534").text(`STATUS: SIGNED & LOCKED`);
    doc.font("Helvetica").fillColor("#334155");
    doc.text(`Signed By: ${agreement.signatureName ?? agreement.tenant?.name ?? "Tenant"}`);
    doc.text(`Signature Method: ${agreement.signatureMethod === "TYPED" ? "Typed Electronic Signature" : "Drawn Electronic Signature"}`);
    doc.text(`Signed At: ${agreement.signedAt ? new Date(agreement.signedAt).toLocaleString("en-IN") : "N/A"}`);
    if (agreement.signedIp) doc.text(`Signer IP: ${agreement.signedIp}`);
    doc.text(`Verification Ref: AGR-${agreement.agreementNumber || "SIG"}-${(agreement.signedAt ? new Date(agreement.signedAt).getTime() : 0).toString(36).toUpperCase()}`);
    
    // Render Drawn Signature Image or Typed Signature Text
    doc.moveDown(0.4);
    if (agreement.signatureUrl && agreement.signatureUrl.startsWith("data:image/")) {
      try {
        const base64Data = agreement.signatureUrl.replace(/^data:image\/\w+;base64,/, "");
        const imgBuffer = Buffer.from(base64Data, "base64");
        doc.image(imgBuffer, { fit: [160, 45] });
        doc.moveDown(0.4);
      } catch (_imgErr) {
        // fallback if image fails
      }
    } else if (agreement.signatureName) {
      doc.font("Helvetica-BoldOblique").fontSize(13).fillColor("#0f172a").text(`"${agreement.signatureName}"`);
      doc.font("Helvetica").fontSize(7.5).fillColor("#64748b").text("(Typed Electronic Signature)");
      doc.moveDown(0.4);
    }
  } else {
    doc.font("Helvetica-Bold").fillColor("#9a3412").text(`STATUS: AWAITING SIGNATURE`);
    doc.font("Helvetica").fillColor("#334155");
    doc.text("Landlord Signature: _______________________      Tenant Signature: _______________________");
  }

  doc.moveDown(0.8);
  doc.font("Helvetica-Oblique").fontSize(8).fillColor("#94a3b8").text(
    `Electronically signed through ${businessName}. Agreement Ref: AGR-${agreement.agreementNumber || "N/A"}`,
    { align: "center" }
  );

  doc.end();
  return new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

export async function getAgreementStats(params?: { propertyId?: string; tenantId?: string }) {
  const where: Prisma.AgreementWhereInput = {
    ...(params?.propertyId ? { propertyId: params.propertyId } : {}),
    ...(params?.tenantId ? { tenantId: params.tenantId } : {}),
  };
  const [all, active, signed, expired, terminated, cancelled, notSigned] = await Promise.all([
    prisma.agreement.count({ where: { ...where, status: { not: "CANCELLED" } } }),
    prisma.agreement.count({ where: { ...where, status: "ACTIVE" } }),
    prisma.agreement.count({ where: { ...where, status: "SIGNED" } }),
    prisma.agreement.count({ where: { ...where, status: "EXPIRED" } }),
    prisma.agreement.count({ where: { ...where, status: "TERMINATED" } }),
    prisma.agreement.count({ where: { ...where, status: "CANCELLED" } }),
    prisma.agreement.count({ where: { ...where, status: { in: ["DRAFT", "SENT", "VIEWED"] } } }),
  ]);

  return { all, active, signed, expired, terminated, cancelled, notSigned };
}

export async function listAgreements(query: Record<string, unknown>) {
  const { page, pageSize } = parsePagination(query);
  const search = String(query.search ?? "").trim();
  const rawStatus = query.status ? String(query.status).trim() : "ALL";
  const propertyId = query.propertyId ? String(query.propertyId) : undefined;
  const tenantId = query.tenantId ? String(query.tenantId) : undefined;
  const expiringSoon = query.expiringSoon === "true";

  let statusFilter: Prisma.AgreementWhereInput = {};
  if (rawStatus === "ALL" || !query.status) {
    // Exclude CANCELLED in default list
    statusFilter = { status: { not: "CANCELLED" } };
  } else if (rawStatus === "NOT_SIGNED") {
    statusFilter = { status: { in: ["DRAFT", "SENT", "VIEWED"] } };
  } else {
    statusFilter = { status: rawStatus as any };
  }

  const where: Prisma.AgreementWhereInput = {
    ...statusFilter,
    ...(search
      ? {
          OR: [
            { agreementNumber: { contains: search, mode: "insensitive" } },
            { tenant: { name: { contains: search, mode: "insensitive" } } },
            { tenant: { phone: { contains: search } } },
            { tenant: { email: { contains: search, mode: "insensitive" } } },
            { property: { name: { contains: search, mode: "insensitive" } } },
            { tenant: { room: { roomNumber: { contains: search, mode: "insensitive" } } } },
            { tenant: { bed: { bedNumber: { contains: search, mode: "insensitive" } } } },
          ],
        }
      : {}),
    ...(propertyId ? { propertyId } : {}),
    ...(tenantId ? { tenantId } : {}),
    ...(expiringSoon
      ? {
          status: "ACTIVE",
          endDate: { gte: new Date(), lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        }
      : {}),
  };

  const [total, agreements] = await Promise.all([
    prisma.agreement.count({ where }),
    prisma.agreement.findMany({
      where,
      include: agreementInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  // Ensure all agreement records have a valid secure token
  for (const ag of agreements) {
    if (!ag.token) {
      const newToken = `sign_${crypto.randomBytes(32).toString("base64url")}`;
      await prisma.agreement.update({ where: { id: ag.id }, data: { token: newToken } });
      ag.token = newToken;
    }
  }

  return buildPagination(agreements.map(toAgreementView), total, { page, pageSize });
}

export async function getAgreement(id: string) {
  const agreement = await prisma.agreement.findUnique({ where: { id }, include: agreementInclude });
  if (!agreement) throw new NotFoundError("Agreement not found");

  if (!agreement.token) {
    const newToken = `sign_${crypto.randomBytes(32).toString("base64url")}`;
    await prisma.agreement.update({ where: { id: agreement.id }, data: { token: newToken } });
    agreement.token = newToken;
  }

  return toAgreementView(agreement);
}

function getClientBaseUrl(req?: Request): string {
  const origin = req?.headers.origin || (req?.headers.referer ? new URL(req.headers.referer).origin : undefined);
  if (origin && !origin.includes("localhost") && !origin.includes("127.0.0.1")) {
    return origin;
  }
  if (env.clientUrl && !env.clientUrl.includes("localhost") && !env.clientUrl.includes("127.0.0.1")) {
    return env.clientUrl;
  }
  return origin || env.clientUrl || "https://rent-management-frontend-tawny.vercel.app";
}

export async function createAgreement(input: AgreementInput, req: Request, actorId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId } });
  if (!tenant) throw new NotFoundError("Tenant not found");
  const property = await prisma.property.findUnique({ where: { id: input.propertyId } });
  if (!property) throw new NotFoundError("Property not found");

  if (input.endDate <= input.startDate) {
    throw new ConflictError("End date must be after start date");
  }

  const token = `sign_${crypto.randomBytes(32).toString("base64url")}`;
  const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const agreement = await prisma.agreement.create({
    data: {
      agreementNumber: `AGR-${nanoid(8).toUpperCase()}`,
      token,
      tokenExpiresAt,
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      startDate: input.startDate,
      endDate: input.endDate,
      rent: new Prisma.Decimal(input.rent),
      advance: new Prisma.Decimal(input.advance ?? 0),
      deposit: new Prisma.Decimal(input.deposit ?? 0),
      documentStorageKey: input.documentStorageKey ?? null,
      documentName: input.documentName ?? null,
      documentMimeType: input.documentMimeType ?? null,
      documentSize: input.documentSize ?? null,
      status: input.status ?? "SENT",
      sentAt: new Date(),
      createdById: actorId,
    },
    include: agreementInclude,
  });

  // Construct full signing link
  const baseUrl = getClientBaseUrl(req);
  const fullSignUrl = `${baseUrl.replace(/\/$/, "")}/agreements/sign/${token}`;

  // Automatically send digital signature invitation via WhatsApp API
  if (tenant.phone) {
    const rentAmount = `₹${Number(agreement.rent).toLocaleString("en-IN")}`;
    const msg = agreementSigningBody({
      tenantName: tenant.name,
      propertyName: property.name,
      agreementNumber: agreement.agreementNumber,
      signUrl: fullSignUrl,
      rentAmount,
      expiresDays: 7,
    });
    await sendWhatsAppMessage(tenant.phone, msg).catch((err) => {
      logger.error("Failed to automatically dispatch WhatsApp agreement signing link on creation", { err, phone: tenant.phone });
    });
  }

  await writeAuditLog(req, {
    action: "agreement.created",
    entityType: "agreement",
    entityId: agreement.id,
    metadata: { agreementNumber: agreement.agreementNumber, autoSentWhatsApp: true, signUrl: fullSignUrl },
  }, actorId);

  return toAgreementView(agreement);
}

export async function updateAgreement(
  id: string,
  input: Partial<Omit<AgreementInput, "tenantId" | "propertyId">>,
  req: Request,
  actorId: string,
) {
  const existing = await prisma.agreement.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Agreement not found");

  if (existing.isLocked) {
    if (input.rent !== undefined || input.advance !== undefined || input.deposit !== undefined || input.startDate !== undefined || input.endDate !== undefined) {
      throw new ConflictError("Agreement terms are locked after tenant signing and cannot be edited. Please create a new agreement version.");
    }
    if (input.status && ["DRAFT", "SENT", "VIEWED"].includes(input.status)) {
      throw new ConflictError("Cannot revert a signed agreement back to Draft, Sent, or Viewed.");
    }
  }

  const agreement = await prisma.agreement.update({
    where: { id },
    data: {
      startDate: input.startDate,
      endDate: input.endDate,
      rent: input.rent !== undefined ? new Prisma.Decimal(input.rent) : undefined,
      advance: input.advance !== undefined ? new Prisma.Decimal(input.advance) : undefined,
      deposit: input.deposit !== undefined ? new Prisma.Decimal(input.deposit) : undefined,
      documentStorageKey:
        input.documentStorageKey !== undefined ? input.documentStorageKey : undefined,
      documentName: input.documentName !== undefined ? input.documentName : undefined,
      documentMimeType: input.documentMimeType !== undefined ? input.documentMimeType : undefined,
      documentSize: input.documentSize !== undefined ? input.documentSize : undefined,
      status: input.status,
    },
  });

  await writeAuditLog(req, {
    action: "agreement.updated",
    entityType: "agreement",
    entityId: id,
  }, actorId);
  return toAgreementView(agreement);
}

export async function sendAgreementForSigning(id: string, expiresDays = 7, req?: Request, actorId?: string) {
  const existing = await prisma.agreement.findUnique({
    where: { id },
    include: {
      tenant: true,
      property: true,
    },
  });
  if (!existing) throw new NotFoundError("Agreement not found");

  // Cryptographically secure signing token (256 bits of randomness).
  const token = `sign_${crypto.randomBytes(32).toString("base64url")}`;
  const tokenExpiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);

  const agreement = await prisma.agreement.update({
    where: { id },
    data: {
      token,
      tokenExpiresAt,
      tokenRevoked: false,
      sentAt: new Date(),
      status: existing.status === "DRAFT" ? "SENT" : existing.status,
    },
    include: agreementInclude,
  });

  const baseUrl = getClientBaseUrl(req);
  const fullSignUrl = `${baseUrl.replace(/\/$/, "")}/agreements/sign/${token}`;

  // Automatically dispatch WhatsApp notification to the tenant
  if (existing.tenant?.phone) {
    const rentAmount = `₹${Number(existing.rent).toLocaleString("en-IN")}`;
    const msg = agreementSigningBody({
      tenantName: existing.tenant.name,
      propertyName: existing.property?.name || "Rental Property",
      agreementNumber: agreement.agreementNumber || id.slice(-6).toUpperCase(),
      signUrl: fullSignUrl,
      rentAmount,
      expiresDays,
    });
    await sendWhatsAppMessage(existing.tenant.phone, msg).catch((err) => {
      logger.error("Failed to dispatch WhatsApp agreement signing link", { err, phone: existing.tenant?.phone });
    });
  }

  if (req) {
    await writeAuditLog(req, {
      action: "agreement.sent_for_signing",
      entityType: "agreement",
      entityId: id,
      metadata: { agreementNumber: agreement.agreementNumber, tokenExpiresAt, signUrl: fullSignUrl },
    }, actorId);
  }

  return {
    agreement: toAgreementView(agreement),
    token,
    signUrl: `/agreements/sign/${token}`,
    fullSignUrl,
  };
}

export async function getAgreementByToken(token: string) {
  const agreement = await prisma.agreement.findUnique({
    where: { token },
    include: agreementInclude,
  });
  if (!agreement) throw new NotFoundError("Agreement signing link not found");

  if (agreement.tokenRevoked) {
    throw new ConflictError("Agreement signing link has been revoked");
  }
  if (agreement.tokenExpiresAt && agreement.tokenExpiresAt < new Date()) {
    throw new ConflictError("Agreement signing link has expired");
  }

  if (agreement.status === "DRAFT" || agreement.status === "SENT") {
    await prisma.agreement.update({
      where: { id: agreement.id },
      data: { status: "VIEWED", viewedAt: new Date() },
    });
    agreement.status = "VIEWED";
  }

  return {
    id: agreement.id,
    agreementNumber: agreement.agreementNumber,
    tenantName: agreement.tenant.name,
    tenantPhone: agreement.tenant.phone,
    propertyName: agreement.property.name,
    rent: numberMoney(agreement.rent),
    advance: numberMoney(agreement.advance),
    deposit: numberMoney(agreement.deposit),
    startDate: toISODate(agreement.startDate),
    endDate: toISODate(agreement.endDate),
    status: agreement.status,
    isLocked: agreement.isLocked,
    tokenExpiresAt: agreement.tokenExpiresAt ? agreement.tokenExpiresAt.toISOString() : null,
  };
}

export async function signAgreementByToken(
  token: string,
  input: { signatureName: string; signatureUrl?: string; signatureMethod?: string },
  req: Request,
) {
  const agreement = await prisma.agreement.findUnique({
    where: { token },
    include: agreementInclude,
  });
  if (!agreement) throw new NotFoundError("Agreement signing link not found");

  if (agreement.tokenRevoked) {
    throw new ConflictError("Agreement signing link has been revoked");
  }
  if (agreement.tokenExpiresAt && agreement.tokenExpiresAt < new Date()) {
    throw new ConflictError("Agreement signing link has expired");
  }
  if (agreement.isLocked || agreement.status === "SIGNED" || agreement.status === "COMPLETED") {
    throw new ConflictError("Agreement has already been signed and locked");
  }

  if (!input.signatureName || input.signatureName.trim().length === 0) {
    throw new ConflictError("Signature name is required");
  }

  // Generate the final signed PDF before committing so a failure cannot leave
  // the agreement marked signed without its frozen document.
  const signedPdf = await buildSignedAgreementPdf({
    agreementNumber: agreement.agreementNumber,
    version: agreement.version,
    startDate: agreement.startDate,
    endDate: agreement.endDate,
    rent: agreement.rent,
    advance: agreement.advance,
    deposit: agreement.deposit,
    status: "SIGNED",
    isLocked: true,
    signatureName: input.signatureName.trim(),
    signatureUrl: input.signatureUrl || null,
    signatureMethod: input.signatureMethod || "DRAWN",
    signedAt: new Date(),
    signedIp: req.ip || "127.0.0.1",
    signedUserAgent: req.get("user-agent") || "Browser",
    tenant: agreement.tenant,
    property: agreement.property,
  });
  const stored = savePrivate(signedPdf, `signed-agreement-${agreement.agreementNumber}.pdf`);

  const updated = await prisma.agreement.update({
    where: { id: agreement.id },
    data: {
      status: "SIGNED",
      signedAt: new Date(),
      signatureName: input.signatureName.trim(),
      signatureUrl: input.signatureUrl || null,
      signatureMethod: input.signatureMethod || "DRAWN",
      signedIp: req.ip || "127.0.0.1",
      signedUserAgent: req.get("user-agent") || "Browser",
      isLocked: true,
      signedPdfUrl: stored.storageKey,
    },
    include: agreementInclude,
  });

  await writeAuditLog(req, {
    action: "agreement.signed_by_tenant",
    entityType: "agreement",
    entityId: agreement.id,
    metadata: { agreementNumber: updated.agreementNumber, signatureName: input.signatureName },
  });

  return toAgreementView(updated);
}

export async function revokeAgreementSigning(id: string, req: Request, actorId: string) {
  const existing = await prisma.agreement.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Agreement not found");

  if (existing.isLocked || existing.status === "SIGNED" || existing.status === "COMPLETED") {
    throw new ConflictError("A signed agreement's signing link cannot be revoked");
  }

  const agreement = await prisma.agreement.update({
    where: { id },
    data: { tokenRevoked: true },
  });

  await writeAuditLog(req, {
    action: "agreement.signing_revoked",
    entityType: "agreement",
    entityId: id,
    metadata: { agreementNumber: existing.agreementNumber },
  }, actorId);

  return toAgreementView(agreement);
}

export async function cancelAgreement(id: string, reason: string, req: Request, actorId: string) {
  const existing = await prisma.agreement.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Agreement not found");

  if (existing.status === "CANCELLED") {
    throw new ConflictError("Agreement is already cancelled");
  }

  const agreement = await prisma.agreement.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancellationReason: reason.trim(),
      cancelledAt: new Date(),
      cancelledById: actorId,
    },
    include: agreementInclude,
  });

  await writeAuditLog(req, {
    action: "agreement.cancelled",
    entityType: "agreement",
    entityId: id,
    metadata: { agreementNumber: existing.agreementNumber, reason: reason.trim() },
  }, actorId);

  return toAgreementView(agreement);
}

export async function setAgreementDocument(id: string, input: AgreementDocumentInput, req: Request, actorId: string) {
  const existing = await prisma.agreement.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Agreement not found");

  if (existing.documentStorageKey && existing.documentStorageKey !== input.storageKey) {
    deleteFile(existing.documentStorageKey);
  }

  const agreement = await prisma.agreement.update({
    where: { id },
    data: {
      documentStorageKey: input.storageKey,
      documentName: input.originalName,
      documentMimeType: input.mimeType,
      documentSize: input.size,
    },
  });

  await writeAuditLog(req, {
    action: "agreement.document_uploaded",
    entityType: "agreement",
    entityId: id,
    metadata: { name: input.originalName },
  }, actorId);
  return toAgreementView(agreement);
}

export async function removeAgreementDocument(id: string, req: Request, actorId: string) {
  const existing = await prisma.agreement.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Agreement not found");

  if (existing.documentStorageKey) deleteFile(existing.documentStorageKey);

  const agreement = await prisma.agreement.update({
    where: { id },
    data: { documentStorageKey: null, documentName: null, documentMimeType: null, documentSize: null },
  });

  await writeAuditLog(req, {
    action: "agreement.document_removed",
    entityType: "agreement",
    entityId: id,
  }, actorId);
  return toAgreementView(agreement);
}

export function agreementDownloadToken(storageKey: string) {
  return `/api/files/${signDownloadToken(storageKey, 300)}`;
}

export async function getAgreementDocumentFile(id: string) {
  const agreement = await prisma.agreement.findUnique({
    where: { id },
    include: { tenant: { select: { name: true, phone: true } }, property: { select: { name: true, number: true, type: true } } },
  });
  if (!agreement) throw new NotFoundError("Agreement not found");

  if (agreement.documentStorageKey) {
    try {
      const buffer = readStored(agreement.documentStorageKey);
      return {
        buffer,
        filename: agreement.documentName || `Agreement-${agreement.agreementNumber}.pdf`,
        mimeType: agreement.documentMimeType || "application/pdf",
      };
    } catch (_e) {
      // Fallback to generated PDF if physical file missing
    }
  }

  const pdfBuffer = await buildSignedAgreementPdf(agreement);
  return {
    buffer: pdfBuffer,
    filename: `Agreement-${agreement.agreementNumber}.pdf`,
    mimeType: "application/pdf",
  };
}

export async function getAgreementSignedPdfFile(id: string) {
  const agreement = await prisma.agreement.findUnique({
    where: { id },
    include: { tenant: { select: { name: true, phone: true } }, property: { select: { name: true, number: true, type: true } } },
  });
  if (!agreement) throw new NotFoundError("Agreement not found");

  const pdfBuffer = await buildSignedAgreementPdf(agreement);
  return {
    buffer: pdfBuffer,
    filename: `Signed-Agreement-${agreement.agreementNumber}.pdf`,
    mimeType: "application/pdf",
  };
}
