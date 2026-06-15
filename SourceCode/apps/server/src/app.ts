import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { checkDatabaseConnection } from "./config/database.js";
import { env } from "./config/env.js";
import { httpLogStream } from "./config/logger.js";
import { checkRedisConnection } from "./config/redis.js";
import { authRouter } from "./modules/auth/auth.router.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.router.js";
import { quizzesRouter } from "./modules/quizzes/quizzes.router.js";
import { reportsRouter } from "./modules/reports/reports.router.js";
import { sessionsRouter } from "./modules/sessions/sessions.router.js";
import { studentRouter } from "./modules/student/student.router.js";
import { uploadRouter } from "./modules/upload/upload.router.js";
import { errorMiddleware } from "./shared/middleware/error.middleware.js";

function normalizeOrigin(origin: string) {
  return origin.replace(/\/+$/, "");
}

function isAllowedOrigin(origin: string | undefined) {
  return !origin || normalizeOrigin(origin) === env.CLIENT_URL;
}

export function createApp() {
  const app = express();

  if (env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, isAllowedOrigin(origin));
      },
      credentials: true
    })
  );
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev", { stream: httpLogStream }));

  app.get("/health", async (_req, res) => {
    const [database, redis] = await Promise.allSettled([
      checkDatabaseConnection(),
      checkRedisConnection()
    ]);
    const dbStatus = database.status === "fulfilled" ? "up" : "down";
    const redisStatus = redis.status === "fulfilled" ? "up" : "down";
    const status = dbStatus === "up" && redisStatus === "up" ? "ok" : "degraded";

    res.status(status === "ok" ? 200 : 503).json({
      success: true,
      data: {
        status,
        db: dbStatus,
        redis: redisStatus,
        uptime: process.uptime()
      }
    });
  });

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/dashboard", dashboardRouter);
  app.use("/api/v1/quizzes", quizzesRouter);
  app.use("/api/v1/reports", reportsRouter);
  app.use("/api/v1/sessions", sessionsRouter);
  app.use("/api/v1/upload", uploadRouter);
  app.use("/api/v1", studentRouter);
  app.use(errorMiddleware);

  return app;
}
