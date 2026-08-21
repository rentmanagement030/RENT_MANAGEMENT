import { prisma } from "../config/prisma";
import { AppError } from "../utils/http";
import { CreateHomeInput, UpdateHomeInput } from "../validators/home.validator";

export class HomeService {
  /**
   * Lists all homes for a property grouped by floor.
   */
  static async listHomesByProperty(propertyId: string) {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
    });
    if (!property) {
      throw new AppError(404, "Property not found");
    }

    const homes = await prisma.propertyHome.findMany({
      where: { propertyId, archived: false },
      include: {
        tenants: {
          where: { status: "ACTIVE" },
          select: { id: true, name: true, phone: true, joiningDate: true, rent: true },
        },
        agreements: {
          where: { status: "ACTIVE" },
          take: 1,
        },
        taxRecords: {
          select: { id: true, taxType: true, status: true, nextDueDate: true, outstandingAmount: true },
        },
      },
      orderBy: [{ floor: "asc" }, { homeNumber: "asc" }],
    });

    const formattedHomes = homes.map((h: any) => ({
      ...h,
      rent: Number(h.rent),
      advance: Number(h.advance),
      deposit: Number(h.deposit),
      latePenalty: Number(h.latePenalty),
      activeTenant: h.tenants[0] || null,
      activeAgreement: h.agreements[0] || null,
    }));

    // Group homes by floor
    const floorsMap: Record<string, typeof formattedHomes> = {};
    formattedHomes.forEach((home: any) => {
      const floorName = home.floor || "Ground Floor";
      if (!floorsMap[floorName]) {
        floorsMap[floorName] = [];
      }
      floorsMap[floorName].push(home);
    });

    const floors = Object.keys(floorsMap).map((floorName) => ({
      floor: floorName,
      homes: floorsMap[floorName],
    }));

    return {
      propertyId,
      propertyName: property.name,
      totalHomes: homes.length,
      occupiedHomes: homes.filter((h: any) => h.status === "OCCUPIED" || h.tenants.length > 0).length,
      availableHomes: homes.filter((h: any) => h.status === "AVAILABLE" && h.tenants.length === 0).length,
      floors,
    };
  }

  /**
   * Gets a single home by ID with full 360° detail.
   */
  static async getHomeById(id: string) {
    const home = await prisma.propertyHome.findUnique({
      where: { id },
      include: {
        property: true,
        tenants: {
          include: {
            documents: true,
          },
          orderBy: { createdAt: "desc" },
        },
        agreements: {
          orderBy: { createdAt: "desc" },
        },
        rentRecords: {
          orderBy: { billingMonth: "desc" },
          take: 12,
        },
        taxRecords: {
          include: {
            payments: { orderBy: { paymentDate: "desc" } },
          },
        },
        transfersFrom: {
          include: { tenant: { select: { name: true } }, toProperty: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        },
        transfersTo: {
          include: { tenant: { select: { name: true } }, fromProperty: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!home) {
      throw new AppError(404, "Home/Unit not found");
    }

    const activeTenant = home.tenants.find((t: any) => t.status === "ACTIVE") || home.tenants[0] || null;
    const activeAgreement = home.agreements.find((a: any) => a.status === "ACTIVE") || home.agreements[0] || null;

    return {
      ...home,
      rent: Number(home.rent),
      advance: Number(home.advance),
      deposit: Number(home.deposit),
      latePenalty: Number(home.latePenalty),
      activeTenant,
      activeAgreement,
    };
  }

  /**
   * Creates a new PropertyHome.
   */
  static async createHome(data: CreateHomeInput, createdById?: string) {
    const property = await prisma.property.findUnique({ where: { id: data.propertyId } });
    if (!property) {
      throw new AppError(404, "Property not found");
    }

    const existingNumber = await prisma.propertyHome.findUnique({
      where: {
        propertyId_homeNumber: {
          propertyId: data.propertyId,
          homeNumber: data.homeNumber.trim(),
        },
      },
    });

    if (existingNumber) {
      throw new AppError(400, `Home number ${data.homeNumber} already exists in this property`);
    }

    const home = await prisma.propertyHome.create({
      data: {
        propertyId: data.propertyId,
        floor: data.floor.trim(),
        homeNumber: data.homeNumber.trim(),
        homeType: data.homeType || "2 BHK",
        builtUpArea: data.builtUpArea || null,
        bedrooms: data.bedrooms || null,
        bathrooms: data.bathrooms || null,
        rent: data.rent,
        advance: data.advance || 0,
        deposit: data.deposit || 0,
        dueDay: data.dueDay || 5,
        latePenalty: data.latePenalty || 50,
        status: (data.status as any) || "AVAILABLE",

        ebConnectionType: data.ebConnectionType || "INDIVIDUAL",
        ebNumber: data.ebNumber || null,
        ebMeterNumber: data.ebMeterNumber || null,
        ebConnectionName: data.ebConnectionName || null,
        ebCurrentReading: data.ebCurrentReading || null,

        waterConnectionType: data.waterConnectionType || "INDIVIDUAL",
        waterConsumerNumber: data.waterConsumerNumber || null,
        waterMeterNumber: data.waterMeterNumber || null,
        waterConnectionName: data.waterConnectionName || null,
        waterCurrentReading: data.waterCurrentReading || null,
        imageUrls: data.imageUrls || [],
      },
      include: {
        property: true,
      },
    });

    if (createdById) {
      await prisma.auditLog.create({
        data: {
          userId: createdById,
          action: "HOME_CREATED",
          entityType: "PropertyHome",
          entityId: home.id,
          metadata: { homeNumber: home.homeNumber, floor: home.floor, rent: data.rent },
        },
      });
    }

    return home;
  }

  /**
   * Updates a PropertyHome.
   */
  static async updateHome(id: string, data: UpdateHomeInput, updatedById?: string) {
    const existing = await prisma.propertyHome.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, "Home/Unit not found");
    }

    const updateData: any = {};
    if (data.floor !== undefined) updateData.floor = data.floor.trim();
    if (data.homeNumber !== undefined) updateData.homeNumber = data.homeNumber.trim();
    if (data.homeType !== undefined) updateData.homeType = data.homeType;
    if (data.builtUpArea !== undefined) updateData.builtUpArea = data.builtUpArea;
    if (data.bedrooms !== undefined) updateData.bedrooms = data.bedrooms;
    if (data.bathrooms !== undefined) updateData.bathrooms = data.bathrooms;
    if (data.rent !== undefined) updateData.rent = data.rent;
    if (data.advance !== undefined) updateData.advance = data.advance;
    if (data.deposit !== undefined) updateData.deposit = data.deposit;
    if (data.dueDay !== undefined) updateData.dueDay = data.dueDay;
    if (data.latePenalty !== undefined) updateData.latePenalty = data.latePenalty;
    if (data.status !== undefined) updateData.status = data.status as any;
    if (data.imageUrls !== undefined) updateData.imageUrls = data.imageUrls;

    if (data.ebConnectionType !== undefined) updateData.ebConnectionType = data.ebConnectionType;
    if (data.ebNumber !== undefined) updateData.ebNumber = data.ebNumber;
    if (data.ebMeterNumber !== undefined) updateData.ebMeterNumber = data.ebMeterNumber;
    if (data.ebConnectionName !== undefined) updateData.ebConnectionName = data.ebConnectionName;
    if (data.ebCurrentReading !== undefined) updateData.ebCurrentReading = data.ebCurrentReading;

    if (data.waterConnectionType !== undefined) updateData.waterConnectionType = data.waterConnectionType;
    if (data.waterConsumerNumber !== undefined) updateData.waterConsumerNumber = data.waterConsumerNumber;
    if (data.waterMeterNumber !== undefined) updateData.waterMeterNumber = data.waterMeterNumber;
    if (data.waterConnectionName !== undefined) updateData.waterConnectionName = data.waterConnectionName;
    if (data.waterCurrentReading !== undefined) updateData.waterCurrentReading = data.waterCurrentReading;

    const updated = await prisma.propertyHome.update({
      where: { id },
      data: updateData,
      include: { property: true },
    });

    if (updatedById) {
      await prisma.auditLog.create({
        data: {
          userId: updatedById,
          action: "HOME_UPDATED",
          entityType: "PropertyHome",
          entityId: id,
          metadata: { oldRent: existing.rent, oldStatus: existing.status, updates: updateData },
        },
      });
    }

    return updated;
  }

  /**
   * Deletes (archives) a PropertyHome.
   */
  static async deleteHome(id: string, deletedById?: string) {
    const existing = await prisma.propertyHome.findUnique({
      where: { id },
      include: { tenants: { where: { status: "ACTIVE" } } },
    });

    if (!existing) {
      throw new AppError(404, "Home/Unit not found");
    }

    if (existing.tenants.length > 0) {
      throw new AppError(400, "Cannot delete home with an active tenant. Transfer or vacate tenant first.");
    }

    const archived = await prisma.propertyHome.update({
      where: { id },
      data: { archived: true, status: "MAINTENANCE" },
    });

    if (deletedById) {
      await prisma.auditLog.create({
        data: {
          userId: deletedById,
          action: "HOME_DELETED",
          entityType: "PropertyHome",
          entityId: id,
        },
      });
    }

    return archived;
  }
}
