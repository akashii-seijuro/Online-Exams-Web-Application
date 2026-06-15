import { prisma } from "../../config/database.js";

export async function getTeacherDashboardSummary(teacherId: string) {
  const [quizCount, sessionCount, studentCount, recentQuizzes, recentSessions] = await Promise.all([
    prisma.quiz.count({
      where: { teacherId }
    }),
    prisma.session.count({
      where: { teacherId }
    }),
    prisma.participant.count({
      where: {
        session: {
          teacherId
        }
      }
    }),
    prisma.quiz.findMany({
      where: { teacherId },
      orderBy: { updatedAt: "desc" },
      take: 5,
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
    }),
    prisma.session.findMany({
      where: { teacherId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        roomCode: true,
        status: true,
        createdAt: true,
        quiz: {
          select: {
            id: true,
            title: true
          }
        },
        _count: {
          select: {
            participants: true
          }
        }
      }
    })
  ]);

  return {
    quizCount,
    sessionCount,
    studentCount,
    recentQuizzes,
    recentSessions
  };
}
