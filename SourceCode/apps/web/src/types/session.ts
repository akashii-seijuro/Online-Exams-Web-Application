import { z } from "zod";

export type SessionStatus = "WAITING" | "ACTIVE" | "ENDED";

export type LiveStudent = {
  participantId: string;
  name: string;
  studentCode: string | null;
  joinedAt: string;
  online: boolean;
  lastSeen: string | null;
  status?: "WAITING" | "WORKING" | "SUBMITTED";
  progress?: LiveProgress;
  score?: number | null;
  submittedAt?: string | null;
};

export type SessionQuizSummary = {
  id: string;
  title: string;
  description: string | null;
  _count: {
    questions: number;
  };
};

export type TeacherSession = {
  id: string;
  roomCode: string;
  status: SessionStatus;
  timeLimit: number | null;
  showScore: boolean;
  showAnswers: boolean;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  quizId: string;
  teacherId: string;
  quiz: SessionQuizSummary;
  students?: LiveStudent[];
};

export type TeacherSessionSummary = {
  id: string;
  roomCode: string;
  status: SessionStatus;
  timeLimit: number | null;
  showScore: boolean;
  showAnswers: boolean;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  quizId: string;
  teacherId: string;
  quiz: SessionQuizSummary;
  _count: {
    participants: number;
  };
};

export type CreateSessionInput = {
  quizId: string;
  timeLimit?: number | null;
  showScore?: boolean;
  showAnswers?: boolean;
};

export type UpdateSessionSettingsInput = {
  timeLimit: number | null;
  showScore: boolean;
  showAnswers: boolean;
};

export type JoinSessionResponse = {
  participant: {
    id: string;
    name: string;
    studentCode: string | null;
    joinedAt: string;
    sessionId: string;
  };
  participantToken: string;
  session: {
    id: string;
    roomCode: string;
    status: SessionStatus;
    quiz: SessionQuizSummary;
  };
};

export const joinFormSchema = z.object({
  roomCode: z
    .string()
    .trim()
    .min(6, "Mã phòng cần 6 ký tự")
    .max(8, "Mã phòng quá dài")
    .transform((value) => value.toUpperCase().replace(/[^A-Z0-9]/g, "")),
  name: z.string().trim().min(2, "Tên cần tối thiểu 2 ký tự").max(80, "Tên quá dài"),
  studentCode: z.string().trim().max(40, "Mã học sinh quá dài").optional()
});

export type JoinFormValues = z.infer<typeof joinFormSchema>;

export type ConnectionStatus = "idle" | "connecting" | "connected" | "disconnected" | "error";

export type LiveProgress = {
  answeredCount: number;
  totalQuestions: number;
  currentQuestionOrder: number;
};

export type SessionStartedPayload = {
  sessionId: string;
  status: "ACTIVE";
  startedAt: string;
  timeLimit: number | null;
  totalQuestions: number;
};

export type SessionEndedPayload = {
  sessionId: string;
  status: "ENDED";
  endedAt: string;
};

export type AnswerReceivedPayload = {
  sessionId: string;
  participantId: string;
  displayName: string;
  progress: LiveProgress;
  status: "WORKING";
  receivedAt: string;
};

export type StudentSubmittedPayload = {
  sessionId: string;
  participantId: string;
  displayName: string;
  score: number;
  maxScore: number;
  submittedAt: string;
  timeTaken: number | null;
};

export type StudentAnswerValue =
  | { kind: "MCQ"; selectedOptionId: string | null }
  | { kind: "TRUE_FALSE"; choices: { optionId: string; choice: boolean | null }[] }
  | { kind: "SHORT_ANSWER"; textAnswer: string };

export type StudentAnswerDraftPayload = {
  sessionId: string;
  questionId: string;
  questionOrder: number;
  totalQuestions: number;
  answer: StudentAnswerValue;
};

export type PlayOption = {
  id: string;
  content: string;
  order: number;
};

export type PlayQuestion = {
  id: string;
  content: string;
  type: "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER";
  points: number;
  order: number;
  imageUrl: string | null;
  options: PlayOption[];
};

export type PlaySessionResponse = {
  session: {
    id: string;
    roomCode: string;
    status: SessionStatus;
    timeLimit: number | null;
    startedAt: string | null;
    showScore: boolean;
    showAnswers: boolean;
  };
  participant: {
    id: string;
    submittedAt: string | null;
    score: number | null;
  };
  quiz: {
    id: string;
    title: string;
    description: string | null;
    questions: PlayQuestion[];
  };
  drafts: Record<
    string,
    {
      participantId: string;
      questionId: string;
      questionOrder: number;
      answer: StudentAnswerValue;
      answeredAt: string;
    }
  >;
};

export type SubmitPlayResponse = {
  score: number | null;
  maxScore: number | null;
  correctCount: number | null;
  totalQuestions: number;
  timeTaken: number | null;
  submittedAt: string;
  alreadySubmitted: boolean;
};

export type ReportParticipant = {
  rank: number;
  participantId: string;
  name: string;
  studentCode: string | null;
  score: number | null;
  earnedPoints: number | null;
  maxScore: number;
  submittedAt: string | null;
  timeTaken: number | null;
};

export type ReportQuestionStat = {
  questionId: string;
  order: number;
  content: string;
  type: "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER";
  points: number;
  attemptedCount: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  correctRate: number;
  averageEarnedPoints: number;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  optionStats: {
    optionId: string;
    content: string;
    isCorrect: boolean;
    selectedCount: number;
  }[];
};

export type TeacherReportResponse = {
  session: {
    id: string;
    roomCode: string;
    status: SessionStatus;
    startedAt: string | null;
    endedAt: string | null;
    createdAt: string;
    timeLimit: number | null;
    showAnswers: boolean;
    quiz: {
      id: string;
      title: string;
      description: string | null;
    };
  };
  summary: {
    participantCount: number;
    submittedCount: number;
    averageScore: number | null;
    maxScore: number;
  };
  leaderboard: ReportParticipant[];
  questionStats: ReportQuestionStat[];
};

export type StudentReviewQuestion = {
  questionId: string;
  order: number;
  content: string;
  type: "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER";
  points: number;
  earnedPoints: number;
  isCorrect: boolean;
  answeredAt: string | null;
  studentAnswer:
    | {
        kind: "MCQ";
        selectedOption: { id: string; content: string } | null;
      }
    | {
        kind: "TRUE_FALSE";
        choices: {
          optionId: string;
          content: string;
          choice: boolean | null;
          correctChoice: boolean;
        }[];
      }
    | {
        kind: "SHORT_ANSWER";
        text: string;
      };
  correctAnswer:
    | {
        kind: "MCQ";
        options: { id: string; content: string }[];
      }
    | {
        kind: "TRUE_FALSE";
        choices: {
          optionId: string;
          content: string;
          correctChoice: boolean;
        }[];
      }
    | {
        kind: "SHORT_ANSWER";
        acceptedAnswers: string[];
      };
};

export type StudentResultResponse = {
  session: {
    id: string;
    roomCode: string;
    status: SessionStatus;
    showScore: boolean;
    showAnswers: boolean;
  };
  participant: {
    id: string;
    name: string;
    studentCode: string | null;
  };
  result: {
    score: number | null;
    maxScore: number | null;
    rank: number | null;
    totalParticipants: number;
    correctCount: number | null;
    totalQuestions: number;
    timeTaken: number | null;
    submittedAt: string;
  };
  review: {
    questions: StudentReviewQuestion[];
  };
};
