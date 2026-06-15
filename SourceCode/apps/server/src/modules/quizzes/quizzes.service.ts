import { Prisma } from "@prisma/client";
import sanitizeHtml from "sanitize-html";

import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/middleware/error.middleware.js";
import type { CreateQuizInput, UpdateQuizInput } from "./quizzes.schema.js";

type QuizQuestionInput = CreateQuizInput["questions"][number];

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

function normalizeQuestions(questions: QuizQuestionInput[]) {
  return questions.map((question, questionIndex) => {
    const baseQuestion: Prisma.QuestionCreateWithoutQuizInput = {
      content: cleanText(question.content),
      type: question.type,
      points: question.points,
      order: questionIndex,
      imageUrl: question.imageUrl ? question.imageUrl : null
    };

    return {
      ...baseQuestion,
      options: {
        create: question.options.map((option, optionIndex) => ({
          content: cleanText(option.content),
          isCorrect: question.type === "SHORT_ANSWER" ? true : option.isCorrect,
          order: optionIndex
        }))
      }
    };
  });
}

const quizDetailInclude = {
  questions: {
    orderBy: { order: "asc" },
    include: {
      options: {
        orderBy: { order: "asc" }
      }
    }
  }
} satisfies Prisma.QuizInclude;

async function ensureOwnedQuiz(teacherId: string, quizId: string) {
  const quiz = await prisma.quiz.findFirst({
    where: {
      id: quizId,
      teacherId
    },
    select: {
      id: true,
      _count: {
        select: {
          sessions: true
        }
      }
    }
  });

  if (!quiz) {
    throw new AppError("QUIZ_NOT_FOUND", "Đề thi không tồn tại", 404);
  }

  return quiz;
}

function assertQuizCanBeRewritten(sessionCount: number) {
  if (sessionCount > 0) {
    throw new AppError(
      "QUIZ_HAS_SESSIONS",
      "Không thể chỉnh sửa hoặc xóa đề đã có phiên làm bài",
      409
    );
  }
}

export async function listQuizzes(teacherId: string) {
  return prisma.quiz.findMany({
    where: { teacherId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          questions: true,
          sessions: true
        }
      }
    }
  });
}

export async function getQuizById(teacherId: string, quizId: string) {
  const quiz = await prisma.quiz.findFirst({
    where: {
      id: quizId,
      teacherId
    },
    include: quizDetailInclude
  });

  if (!quiz) {
    throw new AppError("QUIZ_NOT_FOUND", "Đề thi không tồn tại", 404);
  }

  return quiz;
}

export async function createQuiz(teacherId: string, input: CreateQuizInput) {
  return prisma.quiz.create({
    data: {
      title: cleanText(input.title),
      description: cleanOptionalText(input.description),
      teacherId,
      questions: {
        create: normalizeQuestions(input.questions)
      }
    },
    include: quizDetailInclude
  });
}

export async function updateQuiz(teacherId: string, quizId: string, input: UpdateQuizInput) {
  const ownedQuiz = await ensureOwnedQuiz(teacherId, quizId);
  assertQuizCanBeRewritten(ownedQuiz._count.sessions);

  return prisma.$transaction(async (tx) => {
    await tx.question.deleteMany({
      where: { quizId }
    });

    await tx.quiz.update({
      where: { id: quizId },
      data: {
        title: cleanText(input.title),
        description: cleanOptionalText(input.description),
        questions: {
          create: normalizeQuestions(input.questions)
        }
      }
    });

    const updatedQuiz = await tx.quiz.findUnique({
      where: { id: quizId },
      include: quizDetailInclude
    });

    if (!updatedQuiz) {
      throw new AppError("QUIZ_NOT_FOUND", "Đề thi không tồn tại", 404);
    }

    return updatedQuiz;
  });
}

export async function deleteQuiz(teacherId: string, quizId: string) {
  const ownedQuiz = await ensureOwnedQuiz(teacherId, quizId);
  assertQuizCanBeRewritten(ownedQuiz._count.sessions);

  try {
    await prisma.quiz.delete({
      where: { id: quizId }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      throw new AppError(
        "QUIZ_HAS_SESSIONS",
        "Không thể xóa đề đã có dữ liệu phiên làm bài",
        409
      );
    }

    throw error;
  }

  return { id: quizId };
}

export function quizzesServiceStatus() {
  return { module: "quizzes", status: "ready" };
}
