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

  const [
    totalPgBeds,
    occupiedPgBeds,
    availablePgBeds,
    totalHouseCapacity,
    occupiedHouseCapacity,
    availableHouseCapacity,
    totalPropertyHomes,
    occupiedPropertyHomes,
    availablePropertyHomes,
  ] = await Promise.all([
    prisma.pgBed.count({ where: { archived: false } }),
    prisma.pgBed.count({ where: { archived: false, status: "OCCUPIED" } }),
    prisma.pgBed.count({ where: { archived: false, status: "AVAILABLE" } }),
    prisma.property.count({ where: { archived: false, type: "HOUSE" } }),
    prisma.property.count({ where: { archived: false, type: "HOUSE", status: "OCCUPIED" } }),
    prisma.property.count({ where: { archived: false, type: "HOUSE", status: "AVAILABLE" } }),
    prisma.propertyHome.count({ where: { archived: false, property: { type: "VILLA" } } }),
    prisma.propertyHome.count({ where: { archived: false, status: "OCCUPIED", property: { type: "VILLA" } } }),
    prisma.propertyHome.count({ where: { archived: false, status: "AVAILABLE", property: { type: "VILLA" } } }),
  ]);

  const totalCapacity = totalPgBeds + totalHouseCapacity + totalPropertyHomes;
  const occupiedCapacity = occupiedPgBeds + occupiedHouseCapacity + occupiedPropertyHomes;
  const availableCapacity = availablePgBeds + availableHouseCapacity + availablePropertyHomes;
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
      occupied: currentFinancials.occupiedCapacity || occupiedCapacity,
      vacant: currentFinancials.vacantCapacity || availableCapacity,
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
      occupancyRate: currentFinancials.occupancyRate || occupancyRate,
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
  const houses = await prisma.property.findMany({
    where: { archived: false, type: "HOUSE" },
    select: { status: true },
  });
  const rooms = await prisma.pgRoom.findMany({
    where: { archived: false },
    include: { beds: { where: { archived: false } } },
  });
  let bedsOccupied = 0;
  let bedsTotal = 0;
  rooms.forEach((room) => {
    bedsTotal += room.beds.length;
    bedsOccupied += room.beds.filter((b) => b.status === "OCCUPIED").length;
  });
  const housesOccupied = houses.filter((h) => h.status === "OCCUPIED").length;
  return {
    houses: {
      total: houses.length,
      occupied: housesOccupied,
      available: houses.filter((h) => h.status === "AVAILABLE").length,
      maintenance: houses.filter((h) => h.status === "MAINTENANCE").length,
    },
    beds: { total: bedsTotal, occupied: bedsOccupied },
  };
}
