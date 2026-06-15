import { Router } from "express";
import type { Request } from "express";
import type { Server as SocketServer } from "socket.io";

import { requireTeacher, type AuthenticatedUser } from "../../shared/middleware/auth.middleware.js";
import { AppError } from "../../shared/middleware/error.middleware.js";
import {
  createSessionSchema,
  listSessionsQuerySchema,
  sessionParamsSchema,
  updateSessionSettingsSchema
} from "./sessions.schema.js";
import {
  createSession,
  deleteOwnedSession,
  endOwnedSession,
  getSessionForTeacher,
  listOwnedSessions,
  sessionsServiceStatus,
  updateOwnedSessionSettings
} from "./sessions.service.js";

export const sessionsRouter = Router();

function getAuthenticatedUser(req: Request) {
  const candidate = req as Request & { user?: AuthenticatedUser };

  if (!candidate.user) {
    throw new AppError("UNAUTHORIZED", "Bạn cần đăng nhập để tiếp tục", 401);
  }

  return candidate.user;
}

function getSocketServer(req: Request) {
  const io: unknown = req.app.get("io");
  return io && typeof io === "object" ? (io as SocketServer) : null;
}

sessionsRouter.use(requireTeacher);

sessionsRouter.get("/status", (_req, res) => {
  res.json({ success: true, data: sessionsServiceStatus() });
});

sessionsRouter.get("/", async (req, res, next) => {
  try {
    const input = listSessionsQuerySchema.parse(req.query);
    const sessions = await listOwnedSessions(getAuthenticatedUser(req).id, input);

    res.json({
      success: true,
      data: {
        sessions
      }
    });
  } catch (error) {
    next(error);
  }
});

sessionsRouter.post("/", async (req, res, next) => {
  try {
    const input = createSessionSchema.parse(req.body);
    const session = await createSession(getAuthenticatedUser(req).id, input);

    res.status(201).json({
      success: true,
      data: {
        session
      }
    });
  } catch (error) {
    next(error);
  }
});

sessionsRouter.get("/:id", async (req, res, next) => {
  try {
    const params = sessionParamsSchema.parse(req.params);
    const session = await getSessionForTeacher(getAuthenticatedUser(req).id, params.id);

    res.json({
      success: true,
      data: {
        session
      }
    });
  } catch (error) {
    next(error);
  }
});

sessionsRouter.patch("/:id/settings", async (req, res, next) => {
  try {
    const params = sessionParamsSchema.parse(req.params);
    const input = updateSessionSettingsSchema.parse(req.body);
    const session = await updateOwnedSessionSettings(getAuthenticatedUser(req).id, params.id, input);

    res.json({
      success: true,
      data: {
        session
      }
    });
  } catch (error) {
    next(error);
  }
});

sessionsRouter.patch("/:id/end", async (req, res, next) => {
  try {
    const params = sessionParamsSchema.parse(req.params);
    const session = await endOwnedSession(getAuthenticatedUser(req).id, params.id);
    const eventPayload = {
      sessionId: session.id,
      status: "ENDED" as const,
      endedAt: session.endedAt?.toISOString() ?? new Date().toISOString()
    };
    const io = getSocketServer(req);

    io?.to(`session:${session.id}:students`).emit("session:ended", eventPayload);
    io?.to(`teacher:session:${session.id}`).emit("session:ended", eventPayload);

    res.json({
      success: true,
      data: {
        session
      }
    });
  } catch (error) {
    next(error);
  }
});

sessionsRouter.delete("/:id", async (req, res, next) => {
  try {
    const params = sessionParamsSchema.parse(req.params);
    const result = await deleteOwnedSession(getAuthenticatedUser(req).id, params.id);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});
