import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";

import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { registerSessionHandlers } from "./handlers/session.handler.js";
import { registerStudentHandlers } from "./handlers/student.handler.js";
import { socketAuthMiddleware } from "./middleware/socket.auth.js";

function normalizeOrigin(origin: string) {
  return origin.replace(/\/+$/, "");
}

function isAllowedOrigin(origin: string | undefined) {
  return !origin || normalizeOrigin(origin) === env.CLIENT_URL;
}

export function createSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        callback(null, isAllowedOrigin(origin));
      },
      credentials: true
    },
    transports: ["websocket", "polling"]
  });

  io.use(socketAuthMiddleware);
  io.on("connection", (socket) => {
    logger.info("Socket connected", { socketId: socket.id, source: "socket" });

    registerSessionHandlers(io, socket);
    registerStudentHandlers(io, socket);

    socket.on("disconnect", (reason) => {
      logger.info("Socket disconnected", {
        reason,
        socketId: socket.id,
        source: "socket"
      });
    });
  });

  return io;
}
