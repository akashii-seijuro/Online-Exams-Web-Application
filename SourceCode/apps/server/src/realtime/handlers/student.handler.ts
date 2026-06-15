import type { Server, Socket } from "socket.io";
import { ZodError } from "zod";

import { prisma } from "../../config/database.js";
import { redis } from "../../config/redis.js";
import {
  getLiveStudents,
  markLiveStudentOffline,
  sessionAnswersKey,
  updateLiveStudentProgress,
  upsertLiveStudent,
  type LiveStudent
} from "../../modules/sessions/sessions.service.js";
import { studentAnswerDraftSchema } from "../../modules/student/student.schema.js";
import { getSocketAuthData } from "../middleware/socket.auth.js";

type StoredDraftAnswer = {
  participantId: string;
  questionId: string;
  questionOrder: number;
  answer: unknown;
  answeredAt: string;
};

function answerHashField(participantId: string, questionId: string) {
  return `${participantId}:${questionId}`;
}

function parseQuestionIdFromField(participantId: string, field: string) {
  const prefix = `${participantId}:`;
  return field.startsWith(prefix) ? field.slice(prefix.length) : null;
}

export function registerStudentHandlers(io: Server, socket: Socket) {
  socket.on("student:join", async () => {
    const auth = getSocketAuthData(socket);

    if (auth?.kind !== "student") {
      socket.emit("session:error", {
        code: "SOCKET_FORBIDDEN",
        message: "Bạn không có quyền tham gia phòng chờ"
      });
      return;
    }

    const existingStudents = await getLiveStudents(auth.sessionId);
    const existingStudent = existingStudents.find((student) => student.participantId === auth.participantId);
    const liveStudent: LiveStudent = {
      participantId: auth.participantId,
      name: existingStudent?.name ?? auth.name,
      studentCode: existingStudent?.studentCode ?? null,
      joinedAt: existingStudent?.joinedAt ?? new Date().toISOString(),
      online: true,
      lastSeen: null,
      status: existingStudent?.status ?? "WAITING",
      score: existingStudent?.score ?? null,
      submittedAt: existingStudent?.submittedAt ?? null
    };

    if (existingStudent?.progress) {
      liveStudent.progress = existingStudent.progress;
    }

    await socket.join(`session:${auth.sessionId}:students`);
    const student = await upsertLiveStudent(auth.sessionId, liveStudent);

    io.to(`teacher:session:${auth.sessionId}`).emit("session:joined", {
      sessionId: auth.sessionId,
      student
    });

    socket.emit("student:joined", {
      sessionId: auth.sessionId,
      participantId: auth.participantId,
      status: "WAITING"
    });
  });

  socket.on("student:answer", async (rawPayload: unknown) => {
    const auth = getSocketAuthData(socket);

    if (auth?.kind !== "student") {
      socket.emit("answer:error", {
        code: "SOCKET_FORBIDDEN",
        message: "Bạn không có quyền gửi câu trả lời"
      });
      return;
    }

    try {
      const payload = studentAnswerDraftSchema.parse(rawPayload);

      if (payload.sessionId !== auth.sessionId) {
        socket.emit("answer:error", {
          code: "SESSION_MISMATCH",
          message: "Phiên làm bài không khớp"
        });
        return;
      }

      const question = await prisma.question.findFirst({
        where: {
          id: payload.questionId,
          quiz: {
            sessions: {
              some: {
                id: auth.sessionId,
                status: "ACTIVE"
              }
            }
          }
        },
        select: {
          id: true
        }
      });

      if (!question) {
        socket.emit("answer:error", {
          code: "QUESTION_NOT_ACTIVE",
          message: "Câu hỏi không hợp lệ hoặc phiên chưa bắt đầu"
        });
        return;
      }

      const key = sessionAnswersKey(auth.sessionId);
      const now = new Date().toISOString();
      const storedDraft: StoredDraftAnswer = {
        participantId: auth.participantId,
        questionId: payload.questionId,
        questionOrder: payload.questionOrder,
        answer: payload.answer,
        answeredAt: now
      };

      await redis.hset(key, answerHashField(auth.participantId, payload.questionId), JSON.stringify(storedDraft));
      await redis.expire(key, 4 * 60 * 60);

      const allAnswers = await redis.hkeys(key);
      const answeredQuestionIds = new Set<string>();

      for (const field of allAnswers) {
        const questionId = parseQuestionIdFromField(auth.participantId, field);
        if (questionId) {
          answeredQuestionIds.add(questionId);
        }
      }

      const progress = {
        answeredCount: answeredQuestionIds.size,
        totalQuestions: payload.totalQuestions,
        currentQuestionOrder: payload.questionOrder
      };
      const student = await updateLiveStudentProgress(auth.sessionId, auth.participantId, progress);

      io.to(`teacher:session:${auth.sessionId}`).emit("answer:received", {
        sessionId: auth.sessionId,
        participantId: auth.participantId,
        displayName: student?.name ?? auth.name,
        progress,
        status: "WORKING",
        receivedAt: now
      });

      socket.emit("answer:confirmed", {
        sessionId: auth.sessionId,
        questionId: payload.questionId,
        savedAt: now
      });
    } catch (error) {
      socket.emit("answer:error", {
        code: error instanceof ZodError ? "VALIDATION_ERROR" : "ANSWER_SAVE_FAILED",
        message: "Không thể lưu câu trả lời"
      });
    }
  });

  socket.on("disconnect", () => {
    const auth = getSocketAuthData(socket);

    if (auth?.kind !== "student") {
      return;
    }

    void setTimeout(async () => {
      const connectedSockets = await io.in(`session:${auth.sessionId}:students`).fetchSockets();
      const hasReplacementSocket = connectedSockets.some((connectedSocket) => {
        const connectedAuth: unknown = connectedSocket.data.auth;
        if (!connectedAuth || typeof connectedAuth !== "object") {
          return false;
        }

        const candidate = connectedAuth as Record<string, unknown>;
        return candidate.kind === "student" && candidate.participantId === auth.participantId;
      });

      if (hasReplacementSocket) {
        return;
      }

      const student = await markLiveStudentOffline(auth.sessionId, auth.participantId);
      if (!student) {
        return;
      }

      io.to(`teacher:session:${auth.sessionId}`).emit("session:left", {
        sessionId: auth.sessionId,
        participantId: auth.participantId,
        lastSeen: student.lastSeen
      });
    }, 1200);
  });
}
