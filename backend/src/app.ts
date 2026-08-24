import path from "node:path";
import type { IncomingMessage } from "node:http";

import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env";
import { apiLimiter } from "./middleware/rateLimit";
import { errorHandler, notFound } from "./middleware/errorHandler";
import routes from "./routes";

export function createApp(): Express {
  const app = express();

  // Trust reverse proxy (e.g., Render, Heroku) so secure cookies work over HTTPS
  app.set("trust proxy", 1);

  // ------------------------------------------------------------
  // Security
  // ------------------------------------------------------------

  app.use(
    helmet({
      contentSecurityPolicy: false,

      // Needed for frontend/backend running on different
      // localhost ports during development.
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: {
        policy: "same-origin-allow-popups",
      },

      // Allow public property images from the backend
      // to be displayed by the frontend.
      crossOriginResourcePolicy: {
        policy: "cross-origin",
      },
    }),
  );

  // ------------------------------------------------------------
  // CORS
  // ------------------------------------------------------------

  app.use(
    cors({
      origin(origin, callback) {
        // Allow requests without an Origin header.
        // Useful for server-to-server requests and webhooks.
        if (!origin) {
          return callback(null, true);
        }

        // Allow configured frontend origins or any local dev port.
        if (env.corsOrigins.includes(origin) || (!env.isProduction && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) {
          return callback(null, true);
        }

        console.error(
          `[CORS] Request blocked from: ${origin}`,
        );

        console.error(
          `[CORS] Allowed origins: ${env.corsOrigins.join(
            ", ",
          )}`,
        );

        return callback(
          new Error("Not allowed by CORS"),
        );
      },

      credentials: true,

      methods: [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
      ],

      allowedHeaders: [
        "Origin",
        "X-Requested-With",
        "Content-Type",
        "Accept",
        "Authorization",
        "Cache-Control",
        "Pragma",
      ],
    }),
  );

  // ------------------------------------------------------------
  // Logging
  // ------------------------------------------------------------

  app.use(
    morgan(
      env.nodeEnv === "production"
        ? "combined"
        : "dev",
    ),
  );

  // ------------------------------------------------------------
  // Body parsing
  // ------------------------------------------------------------

  app.use(
    express.json({
      limit: "1mb",

      verify: (req, _res, buf) => {
        (
          req as IncomingMessage & {
            rawBody?: Buffer;
          }
        ).rawBody = buf;
      },
    }),
  );

  app.use(
    express.urlencoded({
      extended: true,
      limit: "1mb",
    }),
  );

  // ------------------------------------------------------------
  // Cookies
  // ------------------------------------------------------------

  app.use(cookieParser());

  // ------------------------------------------------------------
  // API rate limiting
  // ------------------------------------------------------------

  app.use("/api", apiLimiter);

  // ------------------------------------------------------------
  // API routes
  // ------------------------------------------------------------

  app.use("/api", routes);

  // ------------------------------------------------------------
  // Public property images
  // ------------------------------------------------------------

  app.use(
    "/uploads/public",
    express.static(
      path.join(
        process.cwd(),
        "uploads",
        "public",
      ),
    ),
  );

  // ------------------------------------------------------------
  // Root API Information
  app.get("/", (_req, res) => {
    res.json({
      success: true,
      name: "C2D Rentals Management SaaS API",
      version: "1.0.0",
      status: "online",
      frontend: env.clientUrl,
    });
  });

  // ------------------------------------------------------------
  // Health check & Load Balancer Probe (/health & /api/health)
  // ------------------------------------------------------------

  const healthHandler = async (_req: express.Request, res: express.Response) => {
    const { prisma } = await import("./config/prisma");

    let database = "ok";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      database = "error";
    }

    const isHealthy = database === "ok";
    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      status: isHealthy ? "healthy" : "unhealthy",
      database,
      workerId: process.pid,
      uptime: Math.floor(process.uptime()),
      memory: {
        rssMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
        heapUsedMb: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
      },
      timestamp: new Date().toISOString(),
    });
  };

  app.get("/health", healthHandler);
  app.get("/api/health", healthHandler);

  // ------------------------------------------------------------
  // 404
  // ------------------------------------------------------------

  app.use(notFound);

  // ------------------------------------------------------------
  // Error handler
  // ------------------------------------------------------------

  app.use(errorHandler);

  return app;
}