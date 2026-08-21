import { Prisma } from "@prisma/client";
import { formatINR, numberMoney } from "./money";

type PropertyWithRelations = Prisma.PropertyGetPayload<{
  include: {
    images: true;
    rooms: { include: { beds: true } };
    homes: true;
  };
}>;

/**
 * Public DTO for property listings.
 * Never exposes tenant data, admin data, balances, or internal notes.
 */
export function serializePublicProperty(p: PropertyWithRelations) {
  const roomCounts = p.rooms.reduce(
    (acc, room) => {
      acc.total += room.beds.length;
      acc.available += room.beds.filter((b) => b.status === "AVAILABLE").length;
      return acc;
    },
    { total: 0, available: 0 },
  );

  return {
    id: p.id,
    type: p.type,
    name: p.name,
    number: p.number,
    address: p.address,
    city: p.city,
    area: p.area,
    rent: numberMoney(p.rent),
    rentDisplay: formatINR(p.rent),
    advance: numberMoney(p.advance),
    advanceDisplay: formatINR(p.advance),
    deposit: numberMoney(p.deposit),
    depositDisplay: formatINR(p.deposit),
    description: p.description,
    amenities: p.amenities,
    contactPhone: p.contactPhone,
    images: p.images
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
      .map((img) => img.url),
    homes: p.homes.map((home) => ({
      id: home.id,
      floor: home.floor,
      homeNumber: home.homeNumber,
      homeType: home.homeType,
      rent: home.rent ? numberMoney(home.rent) : null,
      advance: home.advance ? numberMoney(home.advance) : null,
      deposit: home.deposit ? numberMoney(home.deposit) : null,
      status: home.status,
      imageUrls: home.imageUrls || [],
    })),
    rooms: p.rooms.map((room) => ({
      id: room.id,
      floor: room.floor,
      roomNumber: room.roomNumber,
      capacity: room.capacity,
      rent: room.rent ? numberMoney(room.rent) : null,
      advance: room.advance ? numberMoney(room.advance) : null,
      deposit: room.deposit ? numberMoney(room.deposit) : null,
      // Public DTO: beds must be an ARRAY (consistent with the admin/Prisma shape).
      // Only occupancy-safe fields are exposed — never tenant/bed occupant data.
      beds: room.beds.map((b) => ({
        id: b.id,
        bedNumber: b.bedNumber,
        rent: b.rent ? numberMoney(b.rent) : null,
        advance: b.advance ? numberMoney(b.advance) : null,
        deposit: b.deposit ? numberMoney(b.deposit) : null,
        status: b.status,
      })),
    })),
    roomCounts,
  };
}

/**
 * Admin DTO for properties.
 * Normalizes Prisma Decimal values into numbers and ensures rooms/beds are clean arrays.
 */
export function serializeAdminProperty(p: any) {
  if (!p) return p;
  const rooms = Array.isArray(p.rooms) ? p.rooms : [];
  let totalBeds = 0;
  let occupiedBeds = 0;
  let availableBeds = 0;
  let maintenanceBeds = 0;

  const propRent = p.rent !== undefined && p.rent !== null ? numberMoney(p.rent) : 0;

  let potentialRevenue = 0;
  let occupiedRevenue = 0;
  let vacantRevenue = 0;
  const bedRents: number[] = [];

  const homes = Array.isArray(p.homes) ? p.homes : [];

  if (p.type === "VILLA" || p.type === "MULTI_UNIT_HOUSE" || p.type === "APARTMENT" || homes.length > 0) {
    // Multi-Unit Property: calculate revenue based on Home pricing hierarchy HOME -> PROPERTY
    homes.forEach((h: any) => {
      if (h.archived) return;
      totalBeds++;
      const homeRentVal = h.rent !== undefined && h.rent !== null && Number(h.rent) > 0 ? numberMoney(h.rent) : propRent;
      potentialRevenue += homeRentVal;
      bedRents.push(homeRentVal);

      const isOccupied = h.status === "OCCUPIED" || (Array.isArray(h.tenants) && h.tenants.length > 0);
      if (isOccupied) {
        occupiedBeds++;
        occupiedRevenue += homeRentVal;
      } else if (h.status === "AVAILABLE") {
        availableBeds++;
        vacantRevenue += homeRentVal;
      } else if (h.status === "MAINTENANCE") {
        maintenanceBeds++;
      }
    });

    if (homes.length === 0) {
      potentialRevenue = propRent;
    }
  } else if (p.type === "HOUSE") {
    potentialRevenue = propRent;
    const isOccupied = p.status === "OCCUPIED" || (Array.isArray(p.tenants) && p.tenants.length > 0);
    if (isOccupied) {
      occupiedRevenue = propRent;
      occupiedBeds = 1;
    } else {
      vacantRevenue = propRent;
      availableBeds = 1;
    }
    totalBeds = 1;
  } else {
    // PG property: calculate bed-wise revenue using hierarchy BED -> ROOM -> PROPERTY
    rooms.forEach((r: any) => {
      const roomRent = r.rent !== undefined && r.rent !== null && Number(r.rent) > 0 ? numberMoney(r.rent) : null;
      const beds = Array.isArray(r.beds) ? r.beds : [];

      beds.forEach((b: any) => {
        if (b.archived) return;
        totalBeds++;
        const bedRentVal = b.rent !== undefined && b.rent !== null && Number(b.rent) > 0 ? numberMoney(b.rent) : null;
        const effectiveRent = bedRentVal ?? roomRent ?? propRent;

        potentialRevenue += effectiveRent;
        bedRents.push(effectiveRent);

        const isOccupied = b.status === "OCCUPIED" || Boolean(b.tenantId);
        if (isOccupied) {
          occupiedBeds++;
          occupiedRevenue += effectiveRent;
        } else if (b.status === "AVAILABLE") {
          availableBeds++;
          vacantRevenue += effectiveRent;
        } else if (b.status === "MAINTENANCE") {
          maintenanceBeds++;
        }
      });
    });

    if (totalBeds === 0) {
      potentialRevenue = propRent;
    }
  }

  let bedRentRange: string | null = null;
  if (bedRents.length > 0) {
    const minRent = Math.min(...bedRents);
    const maxRent = Math.max(...bedRents);
    bedRentRange = minRent === maxRent
      ? formatINR(minRent)
      : `${formatINR(minRent)} – ${formatINR(maxRent)}`;
  }

  return {
    ...p,
    rent: propRent,
    advance: p.advance !== undefined && p.advance !== null ? numberMoney(p.advance) : 0,
    deposit: p.deposit !== undefined && p.deposit !== null ? numberMoney(p.deposit) : 0,
    potentialRevenue,
    occupiedRevenue,
    vacantRevenue,
    bedRentRange,
    homes: homes.map((h: any) => ({
      ...h,
      rent: h.rent !== undefined && h.rent !== null ? numberMoney(h.rent) : 0,
      advance: h.advance !== undefined && h.advance !== null ? numberMoney(h.advance) : 0,
      deposit: h.deposit !== undefined && h.deposit !== null ? numberMoney(h.deposit) : 0,
      imageUrls: Array.isArray(h.imageUrls) ? h.imageUrls : [],
    })),
    rooms: rooms.map((r: any) => ({
      ...r,
      rent: r.rent !== undefined && r.rent !== null ? numberMoney(r.rent) : null,
      advance: r.advance !== undefined && r.advance !== null ? numberMoney(r.advance) : null,
      deposit: r.deposit !== undefined && r.deposit !== null ? numberMoney(r.deposit) : null,
      beds: Array.isArray(r.beds)
        ? r.beds.map((b: any) => ({
            ...b,
            rent: b.rent !== undefined && b.rent !== null ? numberMoney(b.rent) : null,
            advance: b.advance !== undefined && b.advance !== null ? numberMoney(b.advance) : null,
            deposit: b.deposit !== undefined && b.deposit !== null ? numberMoney(b.deposit) : null,
          }))
        : [],
    })),
    roomCounts: p.roomCounts ?? {
      total: totalBeds || (p.type === "HOUSE" ? 1 : 0),
      occupied: occupiedBeds,
      available: availableBeds,
      maintenance: maintenanceBeds,
    },
  };
}
