import type { Server, Socket } from "socket.io";

import { prisma } from "../../config/database.js";
import { endOwnedSession, getLiveStudents, startOwnedSession } from "../../modules/sessions/sessions.service.js";
import { getSocketAuthData } from "../middleware/socket.auth.js";

const autoEndTimers = new Map<string, NodeJS.Timeout>();

function scheduleSessionAutoEnd(io: Server, teacherId: string, sessionId: string, timeLimit: number | null) {
  const existingTimer = autoEndTimers.get(sessionId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    autoEndTimers.delete(sessionId);
  }

  if (!timeLimit) {
    return;
  }

  const timer = setTimeout(() => {
    void (async () => {
      const activeSession = await prisma.session.findFirst({
        where: {
          id: sessionId,
          teacherId,
          status: "ACTIVE"
        },
        select: {
          id: true
        }
      });

      if (!activeSession) {
        autoEndTimers.delete(sessionId);
        return;
      }

      const session = await endOwnedSession(teacherId, sessionId);
      const eventPayload = {
        sessionId: session.id,
        status: "ENDED" as const,
        endedAt: session.endedAt?.toISOString() ?? new Date().toISOString()
      };

      io.to(`session:${sessionId}:students`).emit("session:ended", eventPayload);
      io.to(`teacher:session:${sessionId}`).emit("session:ended", eventPayload);
      autoEndTimers.delete(sessionId);
    })();
  }, timeLimit * 1000);

  autoEndTimers.set(sessionId, timer);
}

export function registerSessionHandlers(io: Server, socket: Socket) {
  socket.on("teacher:watch-session", async (payload: { sessionId?: string }) => {
    const auth = getSocketAuthData(socket);

    if (auth?.kind !== "teacher") {
      socket.emit("session:error", {
        code: "SOCKET_FORBIDDEN",
        message: "Bạn không có quyền theo dõi phiên thi này"
      });
      return;
    }

    const sessionId = payload.sessionId;
    if (!sessionId) {
      socket.emit("session:error", {
        code: "SESSION_ID_REQUIRED",
        message: "Thiếu mã phiên thi"
      });
      return;
    }

    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        teacherId: auth.teacherId
      },
      select: {
        id: true
      }
    });

    if (!session) {
      socket.emit("session:error", {
        code: "SESSION_NOT_FOUND",
        message: "Phiên thi không tồn tại"
      });
      return;
    }

    await socket.join(`teacher:session:${sessionId}`);
    const students = await getLiveStudents(sessionId);
    socket.emit("session:students", {
      sessionId,
      students
    });
  });

  socket.on("session:start", async (payload: { sessionId?: string }) => {
    const auth = getSocketAuthData(socket);

    if (auth?.kind !== "teacher") {
      socket.emit("session:error", {
        code: "SOCKET_FORBIDDEN",
        message: "Bạn không có quyền bắt đầu phiên thi này"
      });
      return;
    }

    if (!payload.sessionId) {
      socket.emit("session:error", {
        code: "SESSION_ID_REQUIRED",
        message: "Thiếu mã phiên thi"
      });
      return;
    }

    try {
      const session = await startOwnedSession(auth.teacherId, payload.sessionId);
      scheduleSessionAutoEnd(io, auth.teacherId, session.id, session.timeLimit);
      const eventPayload = {
        sessionId: session.id,
        status: "ACTIVE" as const,
        startedAt: session.startedAt?.toISOString() ?? new Date().toISOString(),
        timeLimit: session.timeLimit,
        totalQuestions: session.quiz._count.questions
      };

      io.to(`session:${payload.sessionId}:students`).emit("session:started", eventPayload);
      io.to(`teacher:session:${payload.sessionId}`).emit("session:started", eventPayload);
    } catch (error) {
      socket.emit("session:error", {
        code: "SESSION_START_FAILED",
        message: error instanceof Error ? error.message : "Không thể bắt đầu phiên thi"
      });
    }
  });

  socket.on("session:end", async (payload: { sessionId?: string }) => {
    const auth = getSocketAuthData(socket);

    if (auth?.kind !== "teacher") {
      socket.emit("session:error", {
        code: "SOCKET_FORBIDDEN",
        message: "Bạn không có quyền kết thúc phiên thi này"
      });
      return;
    }

    if (!payload.sessionId) {
      socket.emit("session:error", {
        code: "SESSION_ID_REQUIRED",
        message: "Thiếu mã phiên thi"
      });
      return;
    }

    try {
      const session = await endOwnedSession(auth.teacherId, payload.sessionId);
      const existingTimer = autoEndTimers.get(session.id);
      if (existingTimer) {
        clearTimeout(existingTimer);
        autoEndTimers.delete(session.id);
      }
      const eventPayload = {
        sessionId: session.id,
        status: "ENDED" as const,
        endedAt: session.endedAt?.toISOString() ?? new Date().toISOString()
      };

      io.to(`session:${payload.sessionId}:students`).emit("session:ended", eventPayload);
      io.to(`teacher:session:${payload.sessionId}`).emit("session:ended", eventPayload);
    } catch (error) {
      socket.emit("session:error", {
        code: "SESSION_END_FAILED",
        message: error instanceof Error ? error.message : "Không thể kết thúc phiên thi"
      });
    }
  });
}
