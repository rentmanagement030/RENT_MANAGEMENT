import "dotenv/config";
import { UserRole } from "@prisma/client";
import { prisma } from "../src/config/prisma";
import { ensureRolesAndPermissions } from "../src/services/user.service";
import { hashPassword } from "../src/utils/password";
import { logger } from "../src/utils/logger";

/**
 * Idempotent seed. Seeds ONLY infrastructure data:
 *   - Roles & permissions
 *   - Default admin user (used for first login)
 *   - Default settings & notification templates
 *
 * It intentionally does NOT create any properties, tenants, bills,
 * payments or other business records. Use `npm run db:clean` to
 * wipe business/demo data from an existing database.
 */
async function main() {
  logger.info("Seeding roles & permissions...");
  await ensureRolesAndPermissions();

  const roles = await prisma.role.findMany();
  const roleByName = new Map(roles.map((r) => [r.name, r.id]));

  logger.info("Creating default admin user...");
  const adminPw = await hashPassword("Admin@123");
  const superAdmin = await prisma.user.upsert({
    where: { email: "admin@c2dtech.in" },
    update: {
      passwordHash: adminPw,
      status: "ACTIVE",
    },
    create: {
      name: "Super Admin",
      email: "admin@c2dtech.in",
      phone: "9000000001",
      passwordHash: adminPw,
      status: "ACTIVE",
    },
  });

  const assignRole = async (userId: string, role: UserRole) => {
    const roleId = roleByName.get(role);
    if (!roleId) throw new Error(`Role ${role} not found`);
    const existing = await prisma.userRoleAssignment.findUnique({
      where: { userId_roleId: { userId, roleId } },
    });
    if (!existing) {
      await prisma.userRoleAssignment.create({ data: { userId, roleId } });
    }
  };

  await assignRole(superAdmin.id, UserRole.SUPER_ADMIN);
  await assignRole(superAdmin.id, UserRole.ADMIN);

  logger.info("Creating default accounts user...");
  const accountsPw = await hashPassword("Accounts@123");
  const accountsUser = await prisma.user.upsert({
    where: { email: "accounts@c2dtech.in" },
    update: {
      passwordHash: accountsPw,
      status: "ACTIVE",
    },
    create: {
      name: "Accounts Manager",
      email: "accounts@c2dtech.in",
      phone: "9000000002",
      passwordHash: accountsPw,
      status: "ACTIVE",
    },
  });
  await assignRole(accountsUser.id, UserRole.ACCOUNTANT);

  logger.info("Creating default settings...");
  await prisma.setting.upsert({
    where: { key: "company" },
    update: {},
    create: {
      key: "company",
      value: {
        name: "C2D Tech Properties",
        tagline: "Safe, affordable homes & PGs",
        phone: "",
        email: "",
        address: "",
        gstin: "",
        logoUrl: "",
      },
    },
  });
  await prisma.setting.upsert({
    where: { key: "payment" },
    update: {},
    create: {
      key: "payment",
      value: {
        dueDateDay: 5,
        lateFeeAmount: 500,
        lateFeeAfterDays: 5,
        receiptPrefix: "RC",
        reminderDays: [3, 1],
      },
    },
  });
  await prisma.setting.upsert({
    where: { key: "notification" },
    update: {},
    create: {
      key: "notification",
      value: {
        whatsappEnabled: false,
        emailEnabled: false,
        rentReminderLeadDays: 3,
        overdueReminderLeadDays: 1,
        agreementExpiryLeadDays: 30,
      },
    },
  });

  logger.info("Seeding notification templates...");
  await prisma.notificationTemplate.upsert({
    where: { key: "rent_due_whatsapp" },
    update: {},
    create: {
      key: "rent_due_whatsapp",
      channel: "WHATSAPP",
      subject: "Rent Reminder",
      body: "Dear {name}, your rent of {amount} for {month} is due on {dueDate}. Please pay via the link: {link}",
    },
  });
  await prisma.notificationTemplate.upsert({
    where: { key: "payment_confirmation_whatsapp" },
    update: {},
    create: {
      key: "payment_confirmation_whatsapp",
      channel: "WHATSAPP",
      subject: "Payment Received",
      body: "Hi {name}, we received your payment of {amount} for {month}. Receipt: {receipt}",
    },
  });

  logger.info("Seed complete. Login: admin@c2dtech.in / Admin@123 (SUPER_ADMIN + ADMIN)");
  logger.info("Change the default password immediately after first login.");
}

main()
  .catch((e) => {
    logger.error(String(e));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
