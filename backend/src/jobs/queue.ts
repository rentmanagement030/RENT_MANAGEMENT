import { JobType } from "@prisma/client";
import { prisma } from "../config/prisma";
import { logger } from "../utils/logger";

export interface JobPayload {
  [key: string]: unknown;
}

type JobHandler = (payload: JobPayload) => Promise<unknown>;

const handlers = new Map<JobType, JobHandler>();

export function registerHandler(type: JobType, handler: JobHandler) {
  handlers.set(type, handler);
}

export async function enqueue(
  type: JobType,
  payload: JobPayload,
  runAt?: Date,
  maxAttempts = 3,
) {
  await prisma.job.create({
    data: {
      type,
      payload: payload as object,
      runAt: runAt ?? new Date(),
      maxAttempts,
    },
  });
}

async function claimNextJob(): Promise<{ id: string; type: JobType; payload: JobPayload } | null> {
  const job = await prisma.$transaction(
    async (tx) => {
      const candidates = await tx.job.findMany({
        where: {
          status: { in: ["PENDING", "FAILED"] },
          runAt: { lte: new Date() },
          attempts: { lt: tx.job.fields.maxAttempts },
        },
        orderBy: { createdAt: "asc" },
        take: 1,
      });
      // Note: Prisma doesn't support raw row-level locks through the client easily.
      // We approximate a claim by updating the first candidate.
      const candidate = candidates[0];
      if (!candidate) return null;
      return tx.job.update({
        where: { id: candidate.id },
        data: { status: "RUNNING", startedAt: new Date(), attempts: { increment: 1 } },
      });
    },
    { timeout: 15000 }
  );
  if (!job) return null;
  return { id: job.id, type: job.type, payload: job.payload as JobPayload };
}

async function processOne(): Promise<boolean> {
  const job = await claimNextJob();
  if (!job) return false;

  const handler = handlers.get(job.type);
  try {
    if (!handler) throw new Error(`No handler registered for job type: ${job.type}`);
    await handler(job.payload);
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "DONE", finishedAt: new Date() },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Job failed`, { id: job.id, type: job.type, error: message });
    const j = await prisma.job.findUnique({ where: { id: job.id } });
    const failed =
      (j?.attempts ?? 0) >= (j?.maxAttempts ?? 3) ? "FAILED" : "PENDING";
    const retryAt = new Date(Date.now() + 30_000);
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: failed,
        error: message,
        finishedAt: failed === "FAILED" ? new Date() : null,
        runAt: failed === "FAILED" ? undefined : retryAt,
      },
    });
  }
  return true;
}

let running = false;

export async function startWorker(intervalMs = 5000) {
  if (running) return;
  running = true;
  logger.info("Background job worker started");

  const loop = async () => {
    while (true) {
      const processed = await processOne();
      if (!processed) break;
    }
  };

  const tick = async () => {
    try {
      await loop();
    } catch (err) {
      logger.error("Worker loop error", { err: String(err) });
    }
  };

  setInterval(tick, intervalMs);
  await tick();
}
