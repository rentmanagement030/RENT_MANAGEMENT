import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./config/prisma";
import { logger } from "./utils/logger";
import { startWorker } from "./jobs/queue";
import { startScheduler } from "./jobs/scheduler";
import "./jobs";
import { ensureRolesAndPermissions } from "./services/user.service";

async function bootstrap() {
  try {
    await prisma.$connect();
    logger.info("Database connected");

    await ensureRolesAndPermissions();
    logger.info("Roles and permissions ensured");

    const app = createApp();
    const server = app.listen(env.port, () => {
      logger.info(`API listening on http://localhost:${env.port}`);
    });

    // Background job worker (graceful in dev; can be scaled separately in prod).
    if (env.nodeEnv !== "test") {
      startWorker().catch((err) => logger.error("Worker failed to start", { err: String(err) }));
      startScheduler();
    }

    const shutdown = async () => {
      logger.info("Shutting down...");
      server.close();
      await prisma.$disconnect();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (err) {
    logger.error("Failed to bootstrap server", { err: String(err) });
    process.exit(1);
  }
}

bootstrap();
