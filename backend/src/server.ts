import cluster from "node:cluster";
import os from "node:os";
import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./config/prisma";
import { logger } from "./utils/logger";
import { startWorker } from "./jobs/queue";
import { startScheduler } from "./jobs/scheduler";
import "./jobs";
import { ensureRolesAndPermissions } from "./services/user.service";

// Determine concurrency: Respect WEB_CONCURRENCY (e.g. on Render/Heroku) or CPU count in production
const numWorkers = process.env.WEB_CONCURRENCY
  ? Math.max(1, parseInt(process.env.WEB_CONCURRENCY, 10))
  : env.isProduction
  ? Math.min(4, os.cpus().length || 1)
  : 1;

if (cluster.isPrimary && numWorkers > 1) {
  logger.info(`Primary process ${process.pid} initialized. Spawning ${numWorkers} load-balanced workers...`);

  // Start background job worker & scheduler on primary process only to avoid duplicates
  if (env.nodeEnv !== "test") {
    startWorker().catch((err) => logger.error("Worker failed to start", { err: String(err) }));
    startScheduler();
  }

  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  cluster.on("online", (worker) => {
    logger.info(`Worker ${worker.process.pid} is online and accepting connections.`);
  });

  cluster.on("exit", (worker, code, signal) => {
    logger.warn(`Worker ${worker.process.pid} exited (code: ${code}, signal: ${signal}). Auto-healing by spawning replacement worker...`);
    cluster.fork();
  });

  const shutdownPrimary = async () => {
    logger.info("Shutting down primary cluster and workers...");
    for (const id in cluster.workers) {
      cluster.workers[id]?.kill("SIGTERM");
    }
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", shutdownPrimary);
  process.on("SIGTERM", shutdownPrimary);
} else {
  bootstrapWorker();
}

async function bootstrapWorker() {
  try {
    await prisma.$connect();
    logger.info(`Database connected [PID ${process.pid}]`);

    // Ensure roles/permissions only if running as single process or first worker
    if (!cluster.isWorker || cluster.worker?.id === 1) {
      await ensureRolesAndPermissions();
      // Purge any premature unpaid future month bills and rent records in the database
      const now = new Date();
      const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      await prisma.bill.deleteMany({
        where: {
          billingMonth: { gt: currentMonthStr },
          paidAmount: 0,
          status: "PENDING",
        },
      }).catch(() => {});
      await prisma.rentRecord.deleteMany({
        where: {
          billingMonth: { gt: currentMonthStr },
          paidAmount: 0,
          status: "PENDING",
        },
      }).catch(() => {});
      logger.info("Roles and permissions ensured, premature future records cleaned");
    }

    const app = createApp();
    const server = app.listen(env.port, () => {
      logger.info(`API listening on http://localhost:${env.port} [Worker PID ${process.pid}]`);
    });

    // Background job worker & scheduler for single-instance / development mode
    if (numWorkers === 1 && env.nodeEnv !== "test") {
      startWorker().catch((err) => logger.error("Worker failed to start", { err: String(err) }));
      startScheduler();
    }

    const shutdown = async () => {
      logger.info(`Shutting down worker [PID ${process.pid}]...`);
      server.close();
      await prisma.$disconnect().catch(() => {});
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (err) {
    logger.error("Failed to bootstrap server worker", { err: String(err), pid: process.pid });
    process.exit(1);
  }
}
