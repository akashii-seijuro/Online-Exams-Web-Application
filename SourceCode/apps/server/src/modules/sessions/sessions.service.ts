import { Prisma } from "@prisma/client";

import { prisma } from "../../config/database.js";
import { logger } from "../../config/logger.js";
import { redis } from "../../config/redis.js";
import { AppError } from "../../shared/middleware/error.middleware.js";
import { generateRoomCode } from "../../shared/utils/roomCode.js";
import type { CreateSessionInput, ListSessionsQuery, UpdateSessionSettingsInput } from "./sessions.schema.js";

const SESSION_TTL_SECONDS = 4 * 60 * 60;
const ROOM_CODE_RETRY_LIMIT = 8;

export type LiveStudentStatus = "WAITING" | "WORKING" | "SUBMITTED";

export type LiveProgress = {
  answeredCount: number;
  totalQuestions: number;
  currentQuestionOrder: number;
};

export type LiveStudent = {
  participantId: string;
  name: string;
  studentCode: string | null;
  joinedAt: string;
  online: boolean;
  lastSeen: string | null;
  status?: LiveStudentStatus;
  progress?: LiveProgress;
  score?: number | null;
  submittedAt?: string | null;
};

export function sessionStateKey(sessionId: string) {
  return `session:${sessionId}:state`;
}

export function sessionStudentsKey(sessionId: string) {
  return `session:${sessionId}:students`;
}

export function sessionAnswersKey(sessionId: string) {
  return `session:${sessionId}:answers`;
}

function isLiveStudent(value: unknown): value is LiveStudent {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.participantId === "string" &&
    typeof candidate.name === "string" &&
    (typeof candidate.studentCode === "string" || candidate.studentCode === null) &&
    typeof candidate.joinedAt === "string" &&
    typeof candidate.online === "boolean" &&
    (typeof candidate.lastSeen === "string" || candidate.lastSeen === null)
  );
}

function parseLiveStudent(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return isLiveStudent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeSessionState(session: {
  id: string;
  roomCode: string;
  quizId: string;
  teacherId: string;
  status: string;
  createdAt: Date;
  startedAt?: Date | null;
  endedAt?: Date | null;
  timeLimit?: number | null;
  showScore?: boolean;
  showAnswers?: boolean;
}) {
  await redis.set(
    sessionStateKey(session.id),
    JSON.stringify({
      sessionId: session.id,
      roomCode: session.roomCode,
      quizId: session.quizId,
      teacherId: session.teacherId,
      status: session.status,
      createdAt: session.createdAt.toISOString(),
      startedAt: session.startedAt ? session.startedAt.toISOString() : null,
      endedAt: session.endedAt ? session.endedAt.toISOString() : null,
      timeLimit: session.timeLimit ?? null,
      showScore: session.showScore ?? true,
      showAnswers: session.showAnswers ?? true,
      updatedAt: new Date().toISOString()
    }),
    "EX",
    SESSION_TTL_SECONDS
  );
}

export async function ensureOwnedSession(teacherId: string, sessionId: string) {
  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      teacherId
    },
    include: {
      quiz: {
        select: {
          id: true,
          title: true,
          description: true,
          _count: {
            select: {
              questions: true
            }
          }
        }
      },
      participants: {
        orderBy: { joinedAt: "asc" },
        select: {
          id: true,
          name: true,
          studentCode: true,
          joinedAt: true
        }
      }
    }
  });

  if (!session) {
    throw new AppError("SESSION_NOT_FOUND", "Phiên thi không tồn tại", 404);
  }

  return session;
}

export async function listOwnedSessions(teacherId: string, input: ListSessionsQuery) {
  const where: Prisma.SessionWhereInput = {
    teacherId,
    ...(input.status ? { status: input.status } : {})
  };

  return prisma.session.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (input.page - 1) * input.limit,
    take: input.limit,
    include: {
      quiz: {
        select: {
          id: true,
          title: true,
          description: true,
          _count: {
            select: {
              questions: true
            }
          }
        }
      },
      _count: {
        select: {
          participants: true
        }
      }
    }
  });
}

export async function startOwnedSession(teacherId: string, sessionId: string) {
  const session = await ensureOwnedSession(teacherId, sessionId);

  if (session.status === "ENDED") {
    throw new AppError("SESSION_ALREADY_ENDED", "Phiên thi đã kết thúc", 409);
  }

  if (session.status === "ACTIVE") {
    return session;
  }

  const startedAt = new Date();
  const updatedSession = await prisma.session.update({
    where: { id: session.id },
    data: {
      status: "ACTIVE",
      startedAt
    },
    include: {
      quiz: {
        select: {
          id: true,
          title: true,
          description: true,
          _count: {
            select: {
              questions: true
            }
          }
        }
      },
      participants: {
        orderBy: { joinedAt: "asc" },
        select: {
          id: true,
          name: true,
          studentCode: true,
          joinedAt: true
        }
      }
    }
  });

  await writeSessionState(updatedSession);
  return updatedSession;
}

export async function endOwnedSession(teacherId: string, sessionId: string) {
  const session = await ensureOwnedSession(teacherId, sessionId);

  if (session.status === "ENDED") {
    return session;
  }

  const endedAt = new Date();
  const updatedSession = await prisma.session.update({
    where: { id: session.id },
    data: {
      status: "ENDED",
      endedAt
    },
    include: {
      quiz: {
        select: {
          id: true,
          title: true,
          description: true,
          _count: {
            select: {
              questions: true
            }
          }
        }
      },
      participants: {
        orderBy: { joinedAt: "asc" },
        select: {
          id: true,
          name: true,
          studentCode: true,
          joinedAt: true
        }
      }
    }
  });

  await writeSessionState(updatedSession);
  return updatedSession;
}

export async function createSession(teacherId: string, input: CreateSessionInput) {
  const quiz = await prisma.quiz.findFirst({
    where: {
      id: input.quizId,
      teacherId
    },
    select: {
      id: true,
      _count: {
        select: {
          questions: true
        }
      }
    }
  });

  if (!quiz) {
    throw new AppError("QUIZ_NOT_FOUND", "Đề thi không tồn tại", 404);
  }

  if (quiz._count.questions < 1) {
    throw new AppError("QUIZ_EMPTY", "Đề thi cần ít nhất 1 câu hỏi để mở phòng", 409);
  }

  for (let attempt = 0; attempt < ROOM_CODE_RETRY_LIMIT; attempt += 1) {
    try {
      const session = await prisma.session.create({
        data: {
          quizId: quiz.id,
          teacherId,
      roomCode: generateRoomCode(),
      timeLimit: input.timeLimit ?? null,
      showScore: input.showScore ?? true,
      showAnswers: input.showAnswers ?? true
    },
        include: {
          quiz: {
            select: {
              id: true,
              title: true,
              description: true,
              _count: {
                select: {
                  questions: true
                }
              }
            }
          },
          participants: true
        }
      });

      await writeSessionState(session);
      return session;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        attempt < ROOM_CODE_RETRY_LIMIT - 1
      ) {
        continue;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError(
          "ROOM_CODE_GENERATION_FAILED",
          "Không thể tạo mã phòng duy nhất, vui lòng thử lại",
          500
        );
      }

      throw error;
    }
  }

  throw new AppError("ROOM_CODE_GENERATION_FAILED", "Không thể tạo mã phòng duy nhất, vui lòng thử lại", 500);
}

export async function updateOwnedSessionSettings(
  teacherId: string,
  sessionId: string,
  input: UpdateSessionSettingsInput
) {
  const session = await ensureOwnedSession(teacherId, sessionId);

  if (session.status !== "WAITING") {
    throw new AppError("SESSION_SETTINGS_LOCKED", "Chỉ có thể chỉnh tùy chọn khi phiên còn ở phòng chờ", 409);
  }

  const updatedSession = await prisma.session.update({
    where: { id: session.id },
    data: {
      timeLimit: input.timeLimit ?? null,
      showScore: input.showScore,
      showAnswers: input.showAnswers
    },
    include: {
      quiz: {
        select: {
          id: true,
          title: true,
          description: true,
          _count: {
            select: {
              questions: true
            }
          }
        }
      },
      participants: {
        orderBy: { joinedAt: "asc" },
        select: {
          id: true,
          name: true,
          studentCode: true,
          joinedAt: true
        }
      }
    }
  });

  await writeSessionState(updatedSession);
  return updatedSession;
}

export async function getSessionForTeacher(teacherId: string, sessionId: string) {
  const session = await ensureOwnedSession(teacherId, sessionId);
  const students = await getLiveStudents(sessionId);

  return {
    ...session,
    students
  };
}

export async function deleteOwnedSession(teacherId: string, sessionId: string) {
  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      teacherId
    },
    select: {
      id: true,
      status: true
    }
  });

  if (!session) {
    throw new AppError("SESSION_NOT_FOUND", "PhiÃªn thi khÃ´ng tá»“n táº¡i", 404);
  }

  if (session.status === "ACTIVE") {
    throw new AppError(
      "SESSION_ACTIVE_DELETE_BLOCKED",
      "KhÃ´ng thá»ƒ xÃ³a phiÃªn Ä‘ang diá»…n ra, vui lÃ²ng káº¿t thÃºc phiÃªn trÆ°á»›c",
      409
    );
  }

  const participants = await prisma.participant.findMany({
    where: { sessionId: session.id },
    select: { id: true }
  });
  const participantIds = participants.map((participant) => participant.id);

  await prisma.$transaction([
    prisma.answer.deleteMany({
      where: {
        participantId: {
          in: participantIds
        }
      }
    }),
    prisma.participant.deleteMany({
      where: { sessionId: session.id }
    }),
    prisma.session.delete({
      where: { id: session.id }
    })
  ]);

  try {
    await redis.del(sessionStateKey(session.id), sessionStudentsKey(session.id), sessionAnswersKey(session.id));
  } catch (error) {
    logger.warn("Failed to clean deleted session Redis keys", {
      sessionId: session.id,
      error
    });
  }

  return { id: session.id };
}

export async function getLiveStudents(sessionId: string): Promise<LiveStudent[]> {
  const storedStudents = await redis.hvals(sessionStudentsKey(sessionId));
  const redisStudents = storedStudents.map(parseLiveStudent).filter((student): student is LiveStudent => Boolean(student));

  if (redisStudents.length > 0) {
    return redisStudents.sort((first, second) => first.joinedAt.localeCompare(second.joinedAt));
  }

  const participants = await prisma.participant.findMany({
    where: { sessionId },
    orderBy: { joinedAt: "asc" },
    select: {
      id: true,
      name: true,
      studentCode: true,
      joinedAt: true
    }
  });

  return participants.map((participant) => ({
    participantId: participant.id,
    name: participant.name,
    studentCode: participant.studentCode,
    joinedAt: participant.joinedAt.toISOString(),
    online: false,
    lastSeen: null,
    status: "WAITING" as const,
    score: null,
    submittedAt: null
  }));
}

export async function upsertLiveStudent(sessionId: string, student: LiveStudent) {
  const key = sessionStudentsKey(sessionId);
  await redis.hset(key, student.participantId, JSON.stringify(student));
  await redis.expire(key, SESSION_TTL_SECONDS);
  return student;
}

export async function updateLiveStudentProgress(
  sessionId: string,
  participantId: string,
  progress: LiveProgress
) {
  const students = await getLiveStudents(sessionId);
  const existingStudent = students.find((student) => student.participantId === participantId);

  if (!existingStudent) {
    return null;
  }

  const updatedStudent: LiveStudent = {
    ...existingStudent,
    online: true,
    lastSeen: null,
    status: "WORKING",
    progress
  };

  await upsertLiveStudent(sessionId, updatedStudent);
  return updatedStudent;
}

export async function markLiveStudentSubmitted(
  sessionId: string,
  participantId: string,
  score: number,
  submittedAt: string,
  totalQuestions: number
) {
  const students = await getLiveStudents(sessionId);
  const existingStudent = students.find((student) => student.participantId === participantId);

  if (!existingStudent) {
    return null;
  }

  const updatedStudent: LiveStudent = {
    ...existingStudent,
    online: true,
    lastSeen: null,
    status: "SUBMITTED",
    progress: {
      answeredCount: totalQuestions,
      totalQuestions,
      currentQuestionOrder: totalQuestions
    },
    score,
    submittedAt
  };

  await upsertLiveStudent(sessionId, updatedStudent);
  return updatedStudent;
}

export async function markLiveStudentOffline(sessionId: string, participantId: string) {
  const key = sessionStudentsKey(sessionId);
  const storedStudent = await redis.hget(key, participantId);
  const currentStudent = storedStudent ? parseLiveStudent(storedStudent) : null;

  if (!currentStudent) {
    return null;
  }

  const updatedStudent: LiveStudent = {
    ...currentStudent,
    online: false,
    lastSeen: new Date().toISOString()
  };

  await redis.hset(key, participantId, JSON.stringify(updatedStudent));
  await redis.expire(key, SESSION_TTL_SECONDS);
  return updatedStudent;
}

export function sessionsServiceStatus() {
  return { module: "sessions", status: "ready" };
}
