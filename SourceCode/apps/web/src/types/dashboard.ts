export type DashboardRecentQuiz = {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    questions: number;
    sessions: number;
  };
};

export type DashboardRecentSession = {
  id: string;
  roomCode: string;
  status: "WAITING" | "ACTIVE" | "ENDED";
  createdAt: string;
  quiz: {
    id: string;
    title: string;
  };
  _count: {
    participants: number;
  };
};

export type DashboardSummary = {
  quizCount: number;
  sessionCount: number;
  studentCount: number;
  recentQuizzes: DashboardRecentQuiz[];
  recentSessions: DashboardRecentSession[];
};
