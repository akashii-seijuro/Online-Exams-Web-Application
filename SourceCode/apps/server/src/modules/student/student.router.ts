import { Router } from "express";
import type { Request } from "express";
import jwt from "jsonwebtoken";
import type { Server as SocketServer } from "socket.io";

import { joinRateLimiter } from "../../shared/middleware/rateLimit.middleware.js";
import { AppError } from "../../shared/middleware/error.middleware.js";
import { verifyParticipantToken } from "../../shared/utils/jwt.js";
import {
  joinSessionSchema,
  playSessionParamsSchema,
  roomCodeParamsSchema,
  submitPlaySchema
} from "./student.schema.js";
import {
  checkJoinRoom,
  getPlaySession,
  getStudentResult,
  joinSession,
  studentServiceStatus,
  submitPlay
} from "./student.service.js";

export const studentRouter = Router();

function getParticipantAuth(req: Request) {
  const authorization = req.header("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new AppError("UNAUTHORIZED", "Bạn cần tham gia phòng trước khi làm bài", 401);
  }

  const token = authorization.slice("Bearer ".length).trim();

  try {
    return verifyParticipantToken(token);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError("TOKEN_EXPIRED", "Phiên làm bài đã hết hạn", 401);
    }

    throw new AppError("UNAUTHORIZED", "Phiên làm bài không hợp lệ", 401);
  }
}

function getSocketServer(req: Request) {
  const io: unknown = req.app.get("io");
  return io && typeof io === "object" ? (io as SocketServer) : null;
}

studentRouter.get("/join/status", (_req, res) => {
  res.json({ success: true, data: studentServiceStatus() });
});

studentRouter.get("/join/:roomCode", joinRateLimiter, async (req, res, next) => {
  try {
    const params = roomCodeParamsSchema.parse(req.params);
    const data = await checkJoinRoom(params.roomCode);

    res.json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

studentRouter.post("/join/:roomCode", joinRateLimiter, async (req, res, next) => {
  try {
    const params = roomCodeParamsSchema.parse(req.params);
    const input = joinSessionSchema.parse(req.body);
    const data = await joinSession(params.roomCode, input);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/play/:sessionId", async (req, res, next) => {
  try {
    const params = playSessionParamsSchema.parse(req.params);
    const auth = getParticipantAuth(req);
    const data = await getPlaySession(params.sessionId, auth);

    res.json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/play/:sessionId/result", async (req, res, next) => {
  try {
    const params = playSessionParamsSchema.parse(req.params);
    const auth = getParticipantAuth(req);
    const data = await getStudentResult(params.sessionId, auth);

    res.json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

studentRouter.post("/play/:sessionId/submit", async (req, res, next) => {
  try {
    const params = playSessionParamsSchema.parse(req.params);
    const auth = getParticipantAuth(req);
    const input = submitPlaySchema.parse(req.body);
    const data = await submitPlay(params.sessionId, auth, input);
    const io = getSocketServer(req);

    io?.to(`teacher:session:${params.sessionId}`).emit("student:submitted", {
      sessionId: params.sessionId,
      participantId: auth.sub,
      displayName: data.participantName,
      score: data.teacherResult.score,
      maxScore: data.teacherResult.maxScore,
      submittedAt: data.result.submittedAt,
      timeTaken: data.result.timeTaken
    });

    res.json({
      success: true,
      data: data.result
    });
  } catch (error) {
    next(error);
  }
});
