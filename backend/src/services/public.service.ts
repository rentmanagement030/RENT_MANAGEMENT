import { Prisma, PropertyType, JobType } from "@prisma/client";
import { prisma } from "../config/prisma";
import { NotFoundError } from "../utils/http";
import { serializePublicProperty } from "../utils/serializers";
import { buildPagination, parsePagination } from "../utils/pagination";
import { getSettings } from "./settings.service";
import { writeAuditLog } from "../utils/audit";
import { enqueue } from "../jobs/queue";
import type { Request } from "express";

const publicWhere: Prisma.PropertyWhereInput = {
  publicVisibility: true,
  status: "AVAILABLE",
  archived: false,
};

export async function listPublicProperties(query: Record<string, unknown>) {
  const { page, pageSize } = parsePagination(query);
  const type = query.type ? String(query.type) : undefined;
  const city = query.city ? String(query.city) : undefined;
  const search = String(query.search ?? "").trim();

  const where: Prisma.PropertyWhereInput = {
    ...publicWhere,
    ...(type 
        ? type === "HOUSE" 
          ? { type: { in: ["HOUSE", "VILLA", "MULTI_UNIT_HOUSE", "APARTMENT"] } }
          : { type: type as PropertyType } 
        : {}),
    ...(city ? { city: { contains: city, mode: "insensitive" } } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { address: { contains: search, mode: "insensitive" } },
            { city: { contains: search, mode: "insensitive" } },
            { area: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, properties] = await Promise.all([
    prisma.property.count({ where }),
    prisma.property.findMany({
      where,
      include: { images: true, rooms: { include: { beds: true } }, homes: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return buildPagination(properties.map(serializePublicProperty), total, { page, pageSize });
}

export async function getPublicProperty(id: string) {
  const property = await prisma.property.findFirst({
    where: { ...publicWhere, id },
    include: { images: true, rooms: { include: { beds: true } }, homes: true },
  });
  if (!property) throw new NotFoundError("Property not found");
  return serializePublicProperty(property);
}

export async function getPublicCities() {
  const cities = await prisma.property.findMany({
    where: publicWhere,
    distinct: ["city"],
    select: { city: true },
  });
  return cities.map((c) => c.city);
}

export async function getPublicInfo() {
  return getSettings(true);
}

export async function submitContactForm(
  data: { name: string; phone: string; email?: string; message: string },
  req: Request,
) {
  await prisma.notification.create({
    data: {
      channel: "EMAIL",
      type: "GENERAL",
      to: data.email || "contact",
      subject: `Contact form: ${data.name}`,
      body: `Name: ${data.name}\nPhone: ${data.phone}\nEmail: ${data.email ?? "-"}\n\n${data.message}`,
      status: "SENT",
      sentAt: new Date(),
    },
  });
  await writeAuditLog(req, {
    action: "public.contact",
    entityType: "contact",
    metadata: { name: data.name, phone: data.phone },
  });
  return { ok: true };
}

export async function createPublicEnquiry(
  data: {
    name: string;
    phone: string;
    whatsappPhone?: string;
    email?: string;
    propertyId: string;
    roomId?: string;
    bedId?: string;
    preferredMoveInDate?: string;
    message?: string;
  },
  req: Request,
) {
  const property = await prisma.property.findUnique({ where: { id: data.propertyId } });
  if (!property) throw new NotFoundError("Property not found");

  const cleanPhone = data.phone.trim();
  const moveInDate = data.preferredMoveInDate ? new Date(data.preferredMoveInDate) : undefined;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Rule 10: Deduplication check for active lead within 30 days
  const existingLead = await prisma.lead.findFirst({
    where: {
      phone: cleanPhone,
      propertyId: data.propertyId,
      status: { notIn: ["CONVERTED", "LOST"] },
      createdAt: { gte: thirtyDaysAgo },
    },
  });

  let leadId = "";

  if (existingLead) {
    leadId = existingLead.id;
    // Append enquiry activity note without creating duplicate lead row
    await prisma.leadActivity.create({
      data: {
        leadId: existingLead.id,
        action: "WEBSITE_ENQUIRY",
        notes: `New Website Enquiry: ${data.message || "Interested in property"} (Move-in: ${data.preferredMoveInDate || "ASAP"})`,
      },
    });

    await prisma.lead.update({
      where: { id: existingLead.id },
      data: {
        email: data.email || existingLead.email,
        moveInDate: moveInDate || existingLead.moveInDate,
        roomId: data.roomId || existingLead.roomId,
        bedId: data.bedId || existingLead.bedId,
        updatedAt: new Date(),
      },
    });
  } else {
    const newLead = await prisma.lead.create({
      data: {
        name: data.name,
        phone: cleanPhone,
        email: data.email || null,
        propertyId: data.propertyId,
        roomId: data.roomId || null,
        bedId: data.bedId || null,
        moveInDate: moveInDate || null,
        source: "WEBSITE",
        status: "NEW",
        notes: data.message || `Website enquiry for ${property.name}`,
      },
    });
    leadId = newLead.id;

    await prisma.leadActivity.create({
      data: {
        leadId: newLead.id,
        action: "WEBSITE_ENQUIRY",
        notes: `Submitted website enquiry for ${property.name}`,
      },
    });
  }

  // Create Admin Notification
  await prisma.notification.create({
    data: {
      channel: "WHATSAPP",
      type: "GENERAL",
      to: cleanPhone,
      subject: "New Website Lead",
      body: `New website enquiry received from ${data.name} (${cleanPhone}) for ${property.name}`,
      status: "PENDING",
    },
  });

  await writeAuditLog(req, {
    action: "public.enquiry_submitted",
    entityType: "lead",
    entityId: leadId,
    metadata: { propertyId: data.propertyId, leadId },
  });

  return { ok: true, leadId };
}

export async function triggerReminderJobs(req: Request, actorId: string) {
  await enqueue("RENT_REMINDERS" as JobType, {}, new Date());
  await enqueue("AGREEMENT_REMINDERS" as JobType, {}, new Date());
  await writeAuditLog(req, {
    action: "notifications.reminders_triggered",
    entityType: "notification",
  }, actorId);
  return { ok: true };
}
