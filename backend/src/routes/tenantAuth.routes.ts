import { Router } from "express";
import { asyncHandler } from "../utils/http";
import { loginTenant, authenticateTenant, changeTenantPassword } from "../services/tenantAuth.service";
import { getTenantLedger } from "../services/financial.service";
import { prisma } from "../config/prisma";

const router = Router();

// POST /api/tenant-auth/login
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { phone, password } = req.body;
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];

    const result = await loginTenant(phone, password, userAgent, ip);
    res.json({
      success: true,
      token: result.token,
      tenant: result.tenant,
    });
  })
);

// GET /api/tenant-auth/me
router.get(
  "/me",
  authenticateTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantUser!.tenantId;

    const [tenant, ledger, payments, rentRecords, bills, maintenance] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          property: true,
          home: true,
          room: true,
          bed: true,
          agreements: { where: { status: "ACTIVE" }, take: 1 },
        },
      }),
      getTenantLedger(tenantId).catch(() => null),
      prisma.payment.findMany({
        where: { tenantId },
        include: { allocations: { include: { bill: { select: { billNumber: true, billType: true, billingMonth: true } } } } },
        orderBy: { paymentDate: "desc" },
      }),
      prisma.rentRecord.findMany({
        where: { tenantId },
        orderBy: { dueDate: "desc" },
      }),
      prisma.bill.findMany({
        where: { tenantId },
        orderBy: { dueDate: "desc" },
      }),
      prisma.maintenanceRequest.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    res.json({
      success: true,
      tenant,
      ledger,
      payments,
      rentRecords,
      bills,
      maintenance,
    });
  })
);

// POST /api/tenant-auth/maintenance
router.post(
  "/maintenance",
  authenticateTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantUser!.tenantId;
    const { description } = req.body;
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || !tenant.propertyId) {
      return res.status(400).json({ error: "Tenant has no assigned property" });
    }

    const created = await prisma.maintenanceRequest.create({
      data: {
        propertyId: tenant.propertyId,
        roomId: tenant.roomId,
        tenantId,
        description: String(description || "").trim(),
        priority: "MEDIUM",
        status: "OPEN",
      },
    });

    res.json({ success: true, item: created });
  })
);

// POST /api/tenant-auth/change-password
router.post(
  "/change-password",
  authenticateTenant,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const tenantAuthId = req.tenantUser!.id;

    const result = await changeTenantPassword(tenantAuthId, currentPassword, newPassword);
    res.json({ success: true, message: "Password updated successfully" });
  })
);

export default router;
