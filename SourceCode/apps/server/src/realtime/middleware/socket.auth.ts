import type { ExtendedError, Socket } from "socket.io";
import jwt from "jsonwebtoken";

import { verifyAccessToken, verifyParticipantToken } from "../../shared/utils/jwt.js";

export type TeacherSocketData = {
  kind: "teacher";
  teacherId: string;
  email: string;
  role: "TEACHER" | "ADMIN";
};

export type StudentSocketData = {
  kind: "student";
  participantId: string;
  sessionId: string;
  name: string;
};

export type AuthenticatedSocketData = TeacherSocketData | StudentSocketData;

function createSocketError(code: string, message: string) {
  const error = new Error(message) as ExtendedError & { data?: { code: string } };
  error.data = { code };
  return error;
}

export function getSocketAuthData(socket: Socket): AuthenticatedSocketData | null {
  const authData: unknown = socket.data.auth;

  if (!authData || typeof authData !== "object") {
    return null;
  }

  const candidate = authData as Record<string, unknown>;

  if (candidate.kind === "teacher" && typeof candidate.teacherId === "string" && typeof candidate.email === "string") {
    return {
      kind: "teacher",
      teacherId: candidate.teacherId,
      email: candidate.email,
      role: candidate.role === "ADMIN" ? "ADMIN" : "TEACHER"
    };
  }

  if (
    candidate.kind === "student" &&
    typeof candidate.participantId === "string" &&
    typeof candidate.sessionId === "string" &&
    typeof candidate.name === "string"
  ) {
    return {
      kind: "student",
      participantId: candidate.participantId,
      sessionId: candidate.sessionId,
      name: candidate.name
    };
  }

  return null;
}

export function socketAuthMiddleware(socket: Socket, next: (err?: ExtendedError) => void) {
  const token: unknown = socket.handshake.auth.token;
  const clientType: unknown = socket.handshake.auth.clientType;

  if (typeof token !== "string" || !token.trim()) {
    next(createSocketError("SOCKET_UNAUTHORIZED", "Thiếu token kết nối realtime"));
    return;
  }

  try {
    if (clientType === "teacher") {
      const payload = verifyAccessToken(token);

      if (payload.role !== "TEACHER") {
        next(createSocketError("SOCKET_FORBIDDEN", "Bạn không có quyền theo dõi phiên thi này"));
        return;
      }

      socket.data.auth = {
        kind: "teacher",
        teacherId: payload.sub,
        email: payload.email,
        role: payload.role
      } satisfies TeacherSocketData;
      next();
      return;
    }

    if (clientType === "student") {
      const payload = verifyParticipantToken(token);
      socket.data.auth = {
        kind: "student",
        participantId: payload.sub,
        sessionId: payload.sessionId,
        name: payload.name
      } satisfies StudentSocketData;
      next();
      return;
    }

    next(createSocketError("SOCKET_CLIENT_TYPE_INVALID", "Loại client realtime không hợp lệ"));
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(createSocketError("SOCKET_TOKEN_EXPIRED", "Phiên realtime đã hết hạn"));
      return;
    }

    next(createSocketError("SOCKET_UNAUTHORIZED", "Token realtime không hợp lệ"));
  }
}
