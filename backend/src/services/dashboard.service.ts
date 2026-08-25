import { prisma } from "../config/prisma";
import { numberMoney, add, zero } from "../utils/money";
import { getPeriodFinancialSummary } from "./financial.service";

export async function getDashboard() {
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;

  // Batch 1: Property & Tenant Counts (Sequential batch to stay under Supabase max client pool limit of 15)
  const [
    totalProperties,
    totalHouses,
    totalPgs,
    occupiedHouses,
    vacantHouses,
    maintenanceHouses,
    totalTenants,
    activeTenants,
  ] = await Promise.all([
    prisma.property.count({ where: { archived: false } }),
    prisma.property.count({ where: { archived: false, type: "HOUSE" } }),
    prisma.property.count({ where: { archived: false, type: "PG" } }),
    prisma.property.count({ where: { archived: false, type: "HOUSE", status: "OCCUPIED" } }),
    prisma.property.count({ where: { archived: false, type: "HOUSE", status: "AVAILABLE" } }),
    prisma.property.count({ where: { archived: false, type: "HOUSE", status: "MAINTENANCE" } }),
    prisma.tenant.count(),
    prisma.tenant.count({ where: { status: "ACTIVE" } }),
  ]);

  // Batch 2: Period Financial Summaries using Shared Financial Service
  const [currentFinancials, prevFinancials] = await Promise.all([
    getPeriodFinancialSummary({ billingMonth: currentMonthStr }),
    getPeriodFinancialSummary({ billingMonth: prevMonthStr }),
  ]);

  // Batch 3: Recent feeds & upcoming items
  const [
    recentPayments,
    recentTenants,
    recentProperties,
    upcomingDues,
    expiringAgreements,
    pendingNotifications,
  ] = await Promise.all([
    prisma.payment.findMany({
      take: 8,
      orderBy: { paymentDate: "desc" },
      include: { tenant: { select: { id: true, name: true } } },
    }),
    prisma.tenant.findMany({ take: 6, orderBy: { createdAt: "desc" } }),
    prisma.property.findMany({ take: 6, orderBy: { createdAt: "desc" } }),
    prisma.rentRecord.findMany({
      take: 8,
      where: { status: { in: ["PENDING", "PARTIAL"] }, tenant: { status: "ACTIVE" } },
      orderBy: { dueDate: "asc" },
      include: { tenant: { select: { id: true, name: true, phone: true } } },
    }),
    prisma.agreement.findMany({
      take: 8,
      where: {
        status: "ACTIVE",
        endDate: { gte: now, lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { endDate: "asc" },
      include: { tenant: { select: { id: true, name: true } }, property: { select: { id: true, name: true } } },
    }),
    prisma.notification.count({ where: { status: "PENDING" } }),
  ]);

  // Fetch all active properties with hierarchy to compute real-time capacity and occupancy
  const propertiesAll = await prisma.property.findMany({
    where: { archived: false },
    include: {
      homes: { where: { archived: false } },
      rooms: { where: { archived: false }, include: { beds: { where: { archived: false } } } },
      tenants: { where: { status: "ACTIVE" } },
    },
  });

  let totalPgBeds = 0;
  let occupiedPgBeds = 0;
  let totalPropertyHomes = 0;
  let occupiedPropertyHomes = 0;
  let totalHouseCapacity = 0;
  let occupiedHouseCapacity = 0;

  for (const p of propertiesAll) {
    const activeTenantCount = p.tenants.length;

    if (p.type === "PG") {
      let pgBedsInProp = 0;
      let pgOccupiedInProp = 0;
      for (const r of p.rooms) {
        for (const b of r.beds) {
          pgBedsInProp += 1;
          if (b.status === "OCCUPIED" || !!b.tenantId) pgOccupiedInProp += 1;
        }
      }
      if (pgBedsInProp === 0) {
        pgBedsInProp = p.maxCapacity || 1;
        pgOccupiedInProp = Math.min(activeTenantCount, pgBedsInProp);
      }
      totalPgBeds += pgBedsInProp;
      occupiedPgBeds += pgOccupiedInProp;
    } else if (p.homes && p.homes.length > 0) {
      let homesInProp = 0;
      let homesOccupiedInProp = 0;
      for (const h of p.homes) {
        homesInProp += 1;
        if (h.status === "OCCUPIED" || p.tenants.some((t) => t.homeId === h.id)) homesOccupiedInProp += 1;
      }
      totalPropertyHomes += homesInProp;
      occupiedPropertyHomes += homesOccupiedInProp;
    } else {
      const cap = Math.max(1, p.maxCapacity || 1);
      const isOccupied = p.status === "OCCUPIED" || activeTenantCount > 0;
      const occ = isOccupied ? Math.min(cap, Math.max(1, activeTenantCount)) : 0;

      totalHouseCapacity += cap;
      occupiedHouseCapacity += occ;
    }
  }

  const availablePgBeds = Math.max(0, totalPgBeds - occupiedPgBeds);
  const availablePropertyHomes = Math.max(0, totalPropertyHomes - occupiedPropertyHomes);
  const availableHouseCapacity = Math.max(0, totalHouseCapacity - occupiedHouseCapacity);

  const totalCapacity = totalPgBeds + totalHouseCapacity + totalPropertyHomes;
  const occupiedCapacity = occupiedPgBeds + occupiedHouseCapacity + occupiedPropertyHomes;
  const availableCapacity = Math.max(0, totalCapacity - occupiedCapacity);
  const occupancyRate = totalCapacity > 0 ? Math.round((occupiedCapacity / totalCapacity) * 100) : 0;

  const monthlyCollectionValue = currentFinancials.collected;
  const previousMonthValue = prevFinancials.collected;
  const momChange =
    previousMonthValue > 0 ? ((monthlyCollectionValue - previousMonthValue) / previousMonthValue) * 100 : 0;

  return {
    summary: {
      totalProperties,
      totalHouses,
      totalPgs,
      occupied: occupiedCapacity,
      vacant: availableCapacity,
      maintenance: maintenanceHouses,
      totalTenants,
      activeTenants,
      monthlyCollection: monthlyCollectionValue,
      previousMonthCollection: previousMonthValue,
      momChange: Math.round(momChange * 10) / 10,
      outstanding: currentFinancials.allTimeOutstanding,
      periodOutstanding: currentFinancials.periodOutstanding,
      pendingRent: currentFinancials.pending,
      overdue: currentFinancials.overdue,
      totalBilled: currentFinancials.netBilled,
      potentialRevenue: currentFinancials.potentialRevenue,
      totalPaymentsReceived: currentFinancials.totalPaymentsReceived,
      collectionRate: currentFinancials.collectionRate,
      occupancyRate,
      periodOperatingExpenses: currentFinancials.periodOperatingExpenses,
      allTimeExpenses: currentFinancials.allTimeExpenses,
      netOperatingProfit: currentFinancials.netOperatingProfit,
      tenantsWithDuesCount: currentFinancials.tenantsWithDuesCount,
    },
    occupancy: {
      totalPgBeds,
      occupiedPgBeds,
      availablePgBeds,
      totalHouseCapacity,
      occupiedHouseCapacity,
      availableHouseCapacity,
      totalPropertyHomes,
      occupiedPropertyHomes,
      availablePropertyHomes,
      totalCapacity,
      occupiedCapacity,
      availableCapacity,
      occupancyRate,
    },
    charts: {
      monthlyCollection: await getMonthlyCollectionSeries(12),
      outstandingByMonth: await getOutstandingSeries(6),
      occupancyByType: await getOccupancyBreakdown(),
    },
    recentActivity: {
      payments: recentPayments.map((p) => ({
        id: p.id,
        tenant: p.tenant.name,
        amount: numberMoney(p.amount),
        method: p.paymentMethod,
        status: p.paymentStatus,
        date: p.paymentDate,
      })),
      newTenants: recentTenants.map((t) => ({
        id: t.id,
        name: t.name,
        phone: t.phone,
        createdAt: t.createdAt,
      })),
      newProperties: recentProperties.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        createdAt: p.createdAt,
      })),
      upcomingDues: upcomingDues.map((r) => ({
        id: r.id,
        tenant: r.tenant.name,
        phone: r.tenant.phone,
        billingMonth: r.billingMonth,
        dueDate: r.dueDate,
        outstanding: numberMoney(r.outstanding),
        status: r.status,
      })),
      expiringAgreements: expiringAgreements.map((a) => ({
        id: a.id,
        tenant: a.tenant.name,
        property: a.property.name,
        endDate: a.endDate,
      })),
      pendingNotifications,
    },
  };
}

async function getMonthlyCollectionSeries(months: number) {
  const now = new Date();
  const monthList = Array.from({ length: months }, (_, idx) => {
    const i = months - 1 - idx;
    return {
      start: new Date(now.getFullYear(), now.getMonth() - i, 1),
      end: new Date(now.getFullYear(), now.getMonth() - i + 1, 1),
    };
  });

  const aggregates = await Promise.all(
    monthList.map(({ start, end }) =>
      prisma.payment.aggregate({
        where: {
          paymentDate: { gte: start, lt: end },
          paymentStatus: { in: ["SUCCESS", "VERIFIED"] },
        },
        _sum: { amount: true },
      })
    )
  );

  return monthList.map(({ start }, idx) => ({
    month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
    total: numberMoney(aggregates[idx]._sum.amount ?? zero()),
  }));
}

async function getOutstandingSeries(months: number) {
  const now = new Date();
  const ymList = Array.from({ length: months }, (_, idx) => {
    const i = months - 1 - idx;
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
  });

  const summaries = await Promise.all(ymList.map((ym) => getPeriodFinancialSummary({ billingMonth: ym })));

  return ymList.map((ym, idx) => ({
    month: ym,
    total: summaries[idx].outstanding,
  }));
}

async function getOccupancyBreakdown() {
  const propertiesAll = await prisma.property.findMany({
    where: { archived: false },
    include: {
      homes: { where: { archived: false } },
      rooms: { where: { archived: false }, include: { beds: { where: { archived: false } } } },
      tenants: { where: { status: "ACTIVE" } },
    },
  });

  let totalPgBeds = 0;
  let occupiedPgBeds = 0;
  let totalPropertyHomes = 0;
  let occupiedPropertyHomes = 0;
  let totalHouseCapacity = 0;
  let occupiedHouseCapacity = 0;

  for (const p of propertiesAll) {
    const activeTenantCount = p.tenants.length;

    if (p.type === "PG") {
      let pgBedsInProp = 0;
      let pgOccupiedInProp = 0;
      for (const r of p.rooms) {
        for (const b of r.beds) {
          pgBedsInProp += 1;
          if (b.status === "OCCUPIED" || !!b.tenantId) pgOccupiedInProp += 1;
        }
      }
      if (pgBedsInProp === 0) {
        pgBedsInProp = p.maxCapacity || 1;
        pgOccupiedInProp = Math.min(activeTenantCount, pgBedsInProp);
      }
      totalPgBeds += pgBedsInProp;
      occupiedPgBeds += pgOccupiedInProp;
    } else if (p.homes && p.homes.length > 0) {
      let homesInProp = 0;
      let homesOccupiedInProp = 0;
      for (const h of p.homes) {
        homesInProp += 1;
        if (h.status === "OCCUPIED" || p.tenants.some((t) => t.homeId === h.id)) homesOccupiedInProp += 1;
      }
      totalPropertyHomes += homesInProp;
      occupiedPropertyHomes += homesOccupiedInProp;
    } else {
      const cap = Math.max(1, p.maxCapacity || 1);
      const isOccupied = p.status === "OCCUPIED" || activeTenantCount > 0;
      const occ = isOccupied ? Math.min(cap, Math.max(1, activeTenantCount)) : 0;

      totalHouseCapacity += cap;
      occupiedHouseCapacity += occ;
    }
  }

  return {
    houses: {
      total: totalHouseCapacity,
      occupied: occupiedHouseCapacity,
      available: Math.max(0, totalHouseCapacity - occupiedHouseCapacity),
      maintenance: 0,
    },
    homes: {
      total: totalPropertyHomes,
      occupied: occupiedPropertyHomes,
      available: Math.max(0, totalPropertyHomes - occupiedPropertyHomes),
    },
    beds: {
      total: totalPgBeds,
      occupied: occupiedPgBeds,
      available: Math.max(0, totalPgBeds - occupiedPgBeds),
    },
  };
}
