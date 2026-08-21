import { JobType } from "@prisma/client";
import { prisma } from "../config/prisma";
import { logger } from "../utils/logger";
import { enqueue } from "./queue";

const SCHEDULER_INTERVAL_MS = 6 * 60 * 60 * 1000;

async function alreadyQueuedToday(type: JobType): Promise<boolean> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const existing = await prisma.job.findFirst({
    where: {
      type,
      status: { in: ["PENDING", "RUNNING"] },
      createdAt: { gte: since },
    },
  });
  return !!existing;
}

export async function runScheduler() {
  try {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    if (!(await alreadyQueuedToday("BILL_GENERATION" as JobType))) {
      await enqueue("BILL_GENERATION" as JobType, { billingMonth: month });
      logger.info(`Scheduler: queued BILL_GENERATION for ${month}`);
    }

    if (!(await alreadyQueuedToday("APPLY_PENALTIES" as JobType))) {
      await enqueue("APPLY_PENALTIES" as JobType, {});
      logger.info("Scheduler: queued APPLY_PENALTIES");
    }

    if (!(await alreadyQueuedToday("RENT_REMINDERS" as JobType))) {
      await enqueue("RENT_REMINDERS" as JobType, {});
      await enqueue("AGREEMENT_REMINDERS" as JobType, {});
      logger.info("Scheduler: queued reminder jobs");
    }
  } catch (err) {
    logger.error("Scheduler run failed", { err: String(err) });
  }
}

export function startScheduler(intervalMs = SCHEDULER_INTERVAL_MS) {
  const tick = () => {
    runScheduler().catch((err) => logger.error("Scheduler error", { err: String(err) }));
  };
  tick();
  const id = setInterval(tick, intervalMs);
  id.unref?.();
  return id;
}
