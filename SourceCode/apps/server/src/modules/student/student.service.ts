import sanitizeHtml from "sanitize-html";

import { prisma } from "../../config/database.js";
import { redis } from "../../config/redis.js";
import { AppError } from "../../shared/middleware/error.middleware.js";
import type { ParticipantTokenPayload } from "../../shared/utils/jwt.js";
import { signParticipantToken } from "../../shared/utils/jwt.js";
import {
  markLiveStudentSubmitted,
  sessionAnswersKey,
  upsertLiveStudent,
  type LiveStudent
} from "../sessions/sessions.service.js";
import {
  scoreMcqAnswer,
  scoreShortAnswer,
  scoreTrueFalseAnswer,
  sumScore,
  type ScoredAnswer
} from "../../shared/utils/scoring.js";
import type { JoinSessionInput, StudentAnswerInput, SubmitPlayInput } from "./student.schema.js";

function cleanText(value: string) {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).trim();
}

function cleanOptionalText(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const cleaned = cleanText(value);
  return cleaned.length > 0 ? cleaned : null;
}

function cleanAnswerText(value: string) {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).trim();
}

async function getJoinableSession(roomCode: string) {
  const session = await prisma.session.findUnique({
    where: { roomCode },
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
      }
    }
  });

  if (!session) {
    throw new AppError("SESSION_NOT_FOUND", "Mã phòng không đúng hoặc không tồn tại", 404);
  }

  if (session.status !== "WAITING") {
    throw new AppError("SESSION_NOT_WAITING", "Phòng thi không còn ở trạng thái chờ", 409);
  }

  return session;
}

export async function checkJoinRoom(roomCode: string) {
  const session = await getJoinableSession(roomCode);

  return {
    session: {
      id: session.id,
      roomCode: session.roomCode,
      status: session.status,
      quiz: session.quiz
    }
  };
}

export async function joinSession(roomCode: string, input: JoinSessionInput) {
  const session = await getJoinableSession(roomCode);
  const name = cleanText(input.name);
  const studentCode = cleanOptionalText(input.studentCode);

  const participant = await prisma.participant.upsert({
    where: {
      sessionId_name: {
        sessionId: session.id,
        name
      }
    },
    create: {
      sessionId: session.id,
      name,
      studentCode
    },
    update: {
      studentCode
    }
  });

  const liveStudent: LiveStudent = {
    participantId: participant.id,
    name: participant.name,
    studentCode: participant.studentCode,
    joinedAt: participant.joinedAt.toISOString(),
    online: true,
    lastSeen: null
  };

  await upsertLiveStudent(session.id, liveStudent);

  const participantToken = signParticipantToken({
    type: "participant",
    sub: participant.id,
    sessionId: session.id,
    name: participant.name
  });

  return {
    participant,
    participantToken,
    session: {
      id: session.id,
      roomCode: session.roomCode,
      status: session.status,
      quiz: session.quiz
    }
  };
}

function assertParticipantSession(auth: ParticipantTokenPayload, sessionId: string) {
  if (auth.sessionId !== sessionId) {
    throw new AppError("SESSION_MISMATCH", "Phiên làm bài không khớp với học sinh hiện tại", 403);
  }
}

function sanitizeStudentAnswer(answer: StudentAnswerInput): StudentAnswerInput {
  if (answer.kind === "SHORT_ANSWER") {
    return {
      ...answer,
      textAnswer: cleanAnswerText(answer.textAnswer)
    };
  }

  return answer;
}

type StoredDraftAnswer = {
  participantId: string;
  questionId: string;
  questionOrder: number;
  answer: StudentAnswerInput;
  answeredAt: string;
};

function isStoredDraftAnswer(value: unknown): value is StoredDraftAnswer {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.participantId === "string" &&
    typeof candidate.questionId === "string" &&
    typeof candidate.questionOrder === "number" &&
    typeof candidate.answeredAt === "string" &&
    Boolean(candidate.answer)
  );
}

function parseStoredDraft(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return isStoredDraftAnswer(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseTrueFalseChoices(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is { optionId: string; choice: boolean | null } => {
        if (!item || typeof item !== "object") {
          return false;
        }

        const candidate = item as Record<string, unknown>;
        return (
          typeof candidate.optionId === "string" &&
          (typeof candidate.choice === "boolean" || candidate.choice === null)
        );
      })
      .map((item) => ({
        optionId: item.optionId,
        choice: item.choice
      }));
  } catch {
    return [];
  }
}

async function getParticipantDrafts(sessionId: string, participantId: string) {
  const stored = await redis.hgetall(sessionAnswersKey(sessionId));
  const drafts: Record<string, StoredDraftAnswer> = {};

  for (const [field, value] of Object.entries(stored)) {
    if (!field.startsWith(`${participantId}:`)) {
      continue;
    }

    const draft = parseStoredDraft(value);
    if (draft) {
      drafts[draft.questionId] = draft;
    }
  }

  return drafts;
}

export async function getPlaySession(sessionId: string, auth: ParticipantTokenPayload) {
  assertParticipantSession(auth, sessionId);

  const participant = await prisma.participant.findFirst({
    where: {
      id: auth.sub,
      sessionId
    },
    select: {
      id: true,
      submittedAt: true,
      score: true
    }
  });

  if (!participant) {
    throw new AppError("PARTICIPANT_NOT_FOUND", "Không tìm thấy học sinh trong phiên này", 404);
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      quiz: {
        include: {
          questions: {
            orderBy: { order: "asc" },
            include: {
              options: {
                orderBy: { order: "asc" },
                select: {
                  id: true,
                  content: true,
                  order: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!session) {
    throw new AppError("SESSION_NOT_FOUND", "Phiên thi không tồn tại", 404);
  }

  if (session.status === "WAITING") {
    throw new AppError("SESSION_NOT_ACTIVE", "Giáo viên chưa bắt đầu phiên thi", 409);
  }

  if (session.status === "ENDED") {
    throw new AppError("SESSION_ENDED", "Phiên thi đã kết thúc", 410);
  }

  const drafts = await getParticipantDrafts(sessionId, auth.sub);

  return {
    session: {
      id: session.id,
      roomCode: session.roomCode,
      status: session.status,
      timeLimit: session.timeLimit,
      startedAt: session.startedAt?.toISOString() ?? null,
      showScore: session.showScore,
      showAnswers: session.showAnswers
    },
    participant: {
      id: participant.id,
      submittedAt: participant.submittedAt?.toISOString() ?? null,
      score: participant.score
    },
    quiz: {
      id: session.quiz.id,
      title: session.quiz.title,
      description: session.quiz.description,
      questions: session.quiz.questions.map((question) => ({
        id: question.id,
        content: question.content,
        type: question.type,
        points: question.points,
        order: question.order,
        imageUrl: question.imageUrl,
        options: question.type === "SHORT_ANSWER" ? [] : question.options
      }))
    },
    drafts
  };
}

type ScoringQuestion = {
  id: string;
  type: "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER";
  points: number;
  options: {
    id: string;
    content: string;
    isCorrect: boolean;
  }[];
};

function answerToDbFields(answer: StudentAnswerInput) {
  const sanitizedAnswer = sanitizeStudentAnswer(answer);

  if (sanitizedAnswer.kind === "MCQ") {
    return {
      selectedOption: sanitizedAnswer.selectedOptionId,
      textAnswer: null
    };
  }

  if (sanitizedAnswer.kind === "TRUE_FALSE") {
    return {
      selectedOption: null,
      textAnswer: JSON.stringify(sanitizedAnswer.choices)
    };
  }

  return {
    selectedOption: null,
    textAnswer: sanitizedAnswer.textAnswer
  };
}

function scoreAnswer(question: ScoringQuestion, answer: StudentAnswerInput | undefined): ScoredAnswer {
  if (!answer) {
    return { earnedPoints: 0, isCorrect: false };
  }

  if (question.type === "MCQ" && answer.kind === "MCQ") {
    return scoreMcqAnswer(question, answer.selectedOptionId);
  }

  if (question.type === "TRUE_FALSE" && answer.kind === "TRUE_FALSE") {
    if (answer.choices.some((choice) => choice.choice === null)) {
      return { earnedPoints: 0, isCorrect: false };
    }

    return scoreTrueFalseAnswer(question, JSON.stringify(answer.choices));
  }

  if (question.type === "SHORT_ANSWER" && answer.kind === "SHORT_ANSWER") {
    return scoreShortAnswer(question, cleanAnswerText(answer.textAnswer));
  }

  return { earnedPoints: 0, isCorrect: false };
}

function isWithinTimedAutoEndGrace(session: { endedAt: Date | null; startedAt: Date | null; timeLimit: number | null }) {
  if (!session.startedAt || !session.endedAt || !session.timeLimit) {
    return false;
  }

  const expectedEndAt = session.startedAt.getTime() + session.timeLimit * 1000;
  const endedNearTimeLimit = session.endedAt.getTime() >= expectedEndAt - 2000;
  const withinSubmitGrace = Date.now() <= session.endedAt.getTime() + 30_000;

  return endedNearTimeLimit && withinSubmitGrace;
}

export async function submitPlay(sessionId: string, auth: ParticipantTokenPayload, input: SubmitPlayInput) {
  assertParticipantSession(auth, sessionId);

  const participant = await prisma.participant.findFirst({
    where: {
      id: auth.sub,
      sessionId
    },
    select: {
      id: true,
      submittedAt: true,
      score: true
    }
  });

  if (!participant) {
    throw new AppError("PARTICIPANT_NOT_FOUND", "Không tìm thấy học sinh trong phiên này", 404);
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      quiz: {
        include: {
          questions: {
            orderBy: { order: "asc" },
            include: {
              options: {
                orderBy: { order: "asc" },
                select: {
                  id: true,
                  content: true,
                  isCorrect: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!session) {
    throw new AppError("SESSION_NOT_FOUND", "Phiên thi không tồn tại", 404);
  }

  if (session.status === "WAITING") {
    throw new AppError("SESSION_NOT_ACTIVE", "Giáo viên chưa bắt đầu phiên thi", 409);
  }

  if (session.status === "ENDED" && !participant.submittedAt && !isWithinTimedAutoEndGrace(session)) {
    throw new AppError("SESSION_ENDED", "Phiên thi đã kết thúc", 410);
  }

  if (participant.submittedAt && participant.score !== null) {
    const maxScore = session.quiz.questions.reduce((total, question) => total + question.points, 0);
    return {
      result: {
        score: session.showScore ? participant.score : null,
        maxScore: session.showScore ? maxScore : null,
        correctCount: session.showScore ? 0 : null,
        totalQuestions: session.quiz.questions.length,
        timeTaken: null,
        submittedAt: participant.submittedAt.toISOString(),
        alreadySubmitted: true
      },
      teacherResult: {
        score: participant.score,
        maxScore
      },
      participantName: auth.name
    };
  }

  const redisDrafts = await getParticipantDrafts(sessionId, auth.sub);
  const answersByQuestionId: Record<string, StudentAnswerInput> = {};

  for (const [questionId, draft] of Object.entries(redisDrafts)) {
    answersByQuestionId[questionId] = draft.answer;
  }

  for (const [questionId, answer] of Object.entries(input.answers)) {
    answersByQuestionId[questionId] = sanitizeStudentAnswer(answer);
  }

  const scoredAnswers = session.quiz.questions.map((question) => {
    const answer = answersByQuestionId[question.id];
    const scored = scoreAnswer(question, answer);
    const dbFields = answer ? answerToDbFields(answer) : { selectedOption: null, textAnswer: null };

    return {
      question,
      answer,
      scored,
      dbFields
    };
  });

  const score = sumScore(scoredAnswers.map((answer) => ({ earnedPoints: answer.scored.earnedPoints })));
  const maxScore = session.quiz.questions.reduce((total, question) => total + question.points, 0);
  const correctCount = scoredAnswers.filter((answer) => answer.scored.isCorrect).length;
  const submittedAt = new Date();
  const timeTaken = session.startedAt ? Math.max(0, Math.round((submittedAt.getTime() - session.startedAt.getTime()) / 1000)) : null;

  await prisma.$transaction([
    ...scoredAnswers.map(({ question, scored, dbFields }) =>
      prisma.answer.upsert({
        where: {
          participantId_questionId: {
            participantId: auth.sub,
            questionId: question.id
          }
        },
        create: {
          participantId: auth.sub,
          questionId: question.id,
          selectedOption: dbFields.selectedOption,
          textAnswer: dbFields.textAnswer,
          isCorrect: scored.isCorrect,
          earnedPoints: scored.earnedPoints
        },
        update: {
          selectedOption: dbFields.selectedOption,
          textAnswer: dbFields.textAnswer,
          isCorrect: scored.isCorrect,
          earnedPoints: scored.earnedPoints,
          answeredAt: submittedAt
        }
      })
    ),
    prisma.participant.update({
      where: { id: auth.sub },
      data: {
        score,
        timeTaken,
        submittedAt
      }
    })
  ]);

  await markLiveStudentSubmitted(sessionId, auth.sub, score, submittedAt.toISOString(), session.quiz.questions.length);

  return {
    result: {
      score: session.showScore ? score : null,
      maxScore: session.showScore ? maxScore : null,
      correctCount: session.showScore ? correctCount : null,
      totalQuestions: session.quiz.questions.length,
      timeTaken,
      submittedAt: submittedAt.toISOString(),
      alreadySubmitted: false
    },
    teacherResult: {
      score,
      maxScore
    },
    participantName: auth.name
  };
}

export async function getStudentResult(sessionId: string, auth: ParticipantTokenPayload) {
  assertParticipantSession(auth, sessionId);

  const participant = await prisma.participant.findFirst({
    where: {
      id: auth.sub,
      sessionId
    },
    include: {
      session: {
        include: {
          quiz: {
            include: {
              questions: {
                orderBy: { order: "asc" },
                include: {
                  options: {
                    orderBy: { order: "asc" },
                    select: {
                      id: true,
                      content: true,
                      isCorrect: true,
                      order: true
                    }
                  }
                }
              }
            }
          },
          participants: {
            where: {
              submittedAt: {
                not: null
              }
            },
            orderBy: [{ score: "desc" }, { submittedAt: "asc" }, { joinedAt: "asc" }],
            select: {
              id: true,
              score: true,
              submittedAt: true,
              joinedAt: true
            }
          }
        }
      },
      answers: {
        select: {
          questionId: true,
          selectedOption: true,
          textAnswer: true,
          isCorrect: true,
          earnedPoints: true,
          answeredAt: true
        }
      }
    }
  });

  if (!participant) {
    throw new AppError("PARTICIPANT_NOT_FOUND", "Không tìm thấy học sinh trong phiên này", 404);
  }

  if (!participant.submittedAt || participant.score === null) {
    throw new AppError("RESULT_NOT_READY", "Kết quả bài làm chưa sẵn sàng", 409);
  }

  const questions = participant.session.quiz.questions;
  const maxScore = questions.reduce((total, question) => total + question.points, 0);
  const answersByQuestionId = new Map(participant.answers.map((answer) => [answer.questionId, answer]));
  const rankedParticipantIds = participant.session.participants.map((item) => item.id);
  const rankIndex = rankedParticipantIds.indexOf(participant.id);
  const rank = rankIndex >= 0 ? rankIndex + 1 : null;

  const reviewQuestions = questions.map((question) => {
    const answer = answersByQuestionId.get(question.id);
    const correctOptions = question.options.filter((option) => option.isCorrect);
    const selectedOption = question.options.find((option) => option.id === answer?.selectedOption) ?? null;
    const trueFalseChoices = parseTrueFalseChoices(answer?.textAnswer ?? null);

    return {
      questionId: question.id,
      order: question.order,
      content: question.content,
      type: question.type,
      points: question.points,
      earnedPoints: answer?.earnedPoints ?? 0,
      isCorrect: answer?.isCorrect ?? false,
      answeredAt: answer?.answeredAt.toISOString() ?? null,
      studentAnswer:
        question.type === "MCQ"
          ? {
              kind: "MCQ" as const,
              selectedOption: selectedOption
                ? {
                    id: selectedOption.id,
                    content: selectedOption.content
                  }
                : null
            }
          : question.type === "TRUE_FALSE"
            ? {
                kind: "TRUE_FALSE" as const,
                choices: question.options.map((option) => {
                  const choice = trueFalseChoices.find((item) => item.optionId === option.id);

                  return {
                    optionId: option.id,
                    content: option.content,
                    choice: choice?.choice ?? null,
                    correctChoice: option.isCorrect
                  };
                })
              }
            : {
                kind: "SHORT_ANSWER" as const,
                text: answer?.textAnswer ?? ""
              },
      correctAnswer:
        question.type === "MCQ"
          ? {
              kind: "MCQ" as const,
              options: correctOptions.map((option) => ({
                id: option.id,
                content: option.content
              }))
            }
          : question.type === "TRUE_FALSE"
            ? {
                kind: "TRUE_FALSE" as const,
                choices: question.options.map((option) => ({
                  optionId: option.id,
                  content: option.content,
                  correctChoice: option.isCorrect
                }))
              }
            : {
                kind: "SHORT_ANSWER" as const,
                acceptedAnswers: correctOptions.map((option) => option.content)
              }
    };
  });

  const correctCount = reviewQuestions.filter((question) => question.isCorrect).length;

  return {
    session: {
      id: participant.session.id,
      roomCode: participant.session.roomCode,
      status: participant.session.status,
      showScore: participant.session.showScore,
      showAnswers: participant.session.showAnswers
    },
    participant: {
      id: participant.id,
      name: participant.name,
      studentCode: participant.studentCode
    },
    result: {
      score: participant.session.showScore ? participant.score : null,
      maxScore: participant.session.showScore ? maxScore : null,
      rank: participant.session.showScore ? rank : null,
      totalParticipants: participant.session.participants.length,
      correctCount: participant.session.showScore ? correctCount : null,
      totalQuestions: questions.length,
      timeTaken: participant.timeTaken,
      submittedAt: participant.submittedAt.toISOString()
    },
    review: {
      questions: participant.session.showAnswers ? reviewQuestions : []
    }
  };
}

export function studentServiceStatus() {
  return { module: "student", status: "ready" };
}
