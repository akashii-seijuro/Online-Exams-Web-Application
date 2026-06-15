import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/middleware/error.middleware.js";

type QuestionType = "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER";
type Difficulty = "EASY" | "MEDIUM" | "HARD";

function roundScore(value: number) {
  return Math.round(value * 100) / 100;
}

function clampRate(value: number) {
  return Math.min(1, Math.max(0, value));
}

function getDifficulty(correctRate: number): Difficulty {
  if (correctRate >= 0.8) {
    return "EASY";
  }

  if (correctRate >= 0.5) {
    return "MEDIUM";
  }

  return "HARD";
}

function safeParseTrueFalseChoices(value: string | null) {
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

export async function getTeacherSessionReport(sessionId: string, teacherId: string) {
  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      teacherId
    },
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
              },
              answers: {
                select: {
                  id: true,
                  participantId: true,
                  selectedOption: true,
                  textAnswer: true,
                  isCorrect: true,
                  earnedPoints: true,
                  answeredAt: true
                }
              }
            }
          }
        }
      },
      participants: {
        orderBy: [{ score: "desc" }, { submittedAt: "asc" }, { joinedAt: "asc" }],
        include: {
          answers: {
            select: {
              questionId: true,
              isCorrect: true,
              earnedPoints: true,
              selectedOption: true,
              textAnswer: true
            }
          }
        }
      }
    }
  });

  if (!session) {
    throw new AppError("REPORT_NOT_FOUND", "Không tìm thấy báo cáo phiên thi", 404);
  }

  const maxScore = session.quiz.questions.reduce((total, question) => total + question.points, 0);
  const submittedParticipants = session.participants.filter((participant) => participant.submittedAt && participant.score !== null);
  const sessionParticipantIds = new Set(session.participants.map((participant) => participant.id));
  const averageScore =
    submittedParticipants.length > 0
      ? roundScore(
          submittedParticipants.reduce((total, participant) => total + (participant.score ?? 0), 0) /
            submittedParticipants.length
        )
      : null;

  const leaderboard = session.participants.map((participant, index) => ({
    rank: index + 1,
    participantId: participant.id,
    name: participant.name,
    studentCode: participant.studentCode,
    score: participant.score,
    earnedPoints: participant.score,
    maxScore,
    submittedAt: participant.submittedAt?.toISOString() ?? null,
    timeTaken: participant.timeTaken
  }));

  const participantCount = session.participants.length;
  const questionStats = session.quiz.questions.map((question, index) => {
    const answers = question.answers.filter((answer) => sessionParticipantIds.has(answer.participantId));
    const attemptedCount = answers.length;
    const correctCount = answers.filter((answer) => answer.isCorrect === true).length;
    const incorrectCount = answers.filter((answer) => answer.isCorrect !== true).length;
    const unansweredCount = Math.max(0, participantCount - attemptedCount);
    const correctRate = participantCount > 0 ? clampRate(correctCount / participantCount) : 0;
    const averageEarnedPoints =
      attemptedCount > 0
        ? roundScore(answers.reduce((total, answer) => total + (answer.earnedPoints ?? 0), 0) / attemptedCount)
        : 0;

    const optionStats =
      question.type === "SHORT_ANSWER"
        ? []
        : question.options.map((option) => {
            let selectedCount = 0;

            if (question.type === "MCQ") {
              selectedCount = answers.filter((answer) => answer.selectedOption === option.id).length;
            }

            if (question.type === "TRUE_FALSE") {
              selectedCount = answers.filter((answer) =>
                safeParseTrueFalseChoices(answer.textAnswer).some((choice) => choice.optionId === option.id && choice.choice === true)
              ).length;
            }

            return {
              optionId: option.id,
              content: option.content,
              isCorrect: option.isCorrect,
              selectedCount
            };
          });

    return {
      questionId: question.id,
      order: index + 1,
      content: question.content,
      type: question.type as QuestionType,
      points: question.points,
      attemptedCount,
      correctCount,
      incorrectCount,
      unansweredCount,
      correctRate: roundScore(correctRate),
      averageEarnedPoints,
      difficulty: getDifficulty(correctRate),
      optionStats
    };
  });

  return {
    session: {
      id: session.id,
      roomCode: session.roomCode,
      status: session.status,
      startedAt: session.startedAt?.toISOString() ?? null,
      endedAt: session.endedAt?.toISOString() ?? null,
      createdAt: session.createdAt.toISOString(),
      timeLimit: session.timeLimit,
      showAnswers: session.showAnswers,
      quiz: {
        id: session.quiz.id,
        title: session.quiz.title,
        description: session.quiz.description
      }
    },
    summary: {
      participantCount,
      submittedCount: submittedParticipants.length,
      averageScore,
      maxScore
    },
    leaderboard,
    questionStats
  };
}
