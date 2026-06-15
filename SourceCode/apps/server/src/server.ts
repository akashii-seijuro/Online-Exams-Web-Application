import { createServer } from "node:http";
import type { Server as HttpServer } from "node:http";
import type { Server as SocketServer } from "socket.io";

import { createApp } from "./app.js";
import { checkDatabaseConnection, disconnectDatabase } from "./config/database.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { checkRedisConnection, disconnectRedis } from "./config/redis.js";
import { createSocketServer } from "./realtime/socket.js";

const app = createApp();
const httpServer = createServer(app);
const io = createSocketServer(httpServer);
app.set("io", io);

async function checkStartupDependencies() {
  const [database, redis] = await Promise.allSettled([
    checkDatabaseConnection(),
    checkRedisConnection()
  ]);

  if (database.status === "rejected") {
    logger.warn("Database is not reachable at startup", {
      error: database.reason,
      source: "startup"
    });
  }

  if (redis.status === "rejected") {
    logger.warn("Redis is not reachable at startup", {
      error: redis.reason,
      source: "startup"
    });
  }
}

function listen(server: HttpServer) {
  server.listen(env.PORT, () => {
    logger.info("ClassPulse server listening", {
      clientUrl: env.CLIENT_URL,
      port: env.PORT,
      source: "server"
    });
  });
}

async function shutdown(server: HttpServer, socketServer: SocketServer, signal: NodeJS.Signals) {
  logger.info("Shutting down ClassPulse server", { signal, source: "server" });

  socketServer.close();
  server.close(async (error?: Error) => {
    if (error) {
      logger.error("HTTP server failed to close cleanly", { error, source: "server" });
    }

    await Promise.allSettled([disconnectDatabase(), disconnectRedis()]);
    process.exit(error ? 1 : 0);
  });
}

httpServer.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    logger.error("Server port is already in use", {
      port: env.PORT,
      source: "server"
    });
    process.exit(1);
  }

  logger.error("HTTP server error", { error, source: "server" });
  process.exit(1);
});

process.on("SIGINT", (signal) => {
  void shutdown(httpServer, io, signal);
});

process.on("SIGTERM", (signal) => {
  void shutdown(httpServer, io, signal);
});

await checkStartupDependencies();
listen(httpServer);
