import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type {
  AnswerReceivedPayload,
  ConnectionStatus,
  JoinSessionResponse,
  LiveStudent,
  StudentAnswerValue,
  StudentSubmittedPayload,
  TeacherSession
} from "../types/session";

type SessionState = {
  session: TeacherSession | JoinSessionResponse["session"] | null;
  students: LiveStudent[];
  answerDrafts: Record<string, StudentAnswerValue>;
  participantToken: string | null;
  connectionStatus: ConnectionStatus;
  setSession: (session: TeacherSession | JoinSessionResponse["session"]) => void;
  setStudents: (students: LiveStudent[]) => void;
  upsertStudent: (student: LiveStudent) => void;
  markStudentOffline: (participantId: string, lastSeen: string | null) => void;
  recordAnswerProgress: (payload: AnswerReceivedPayload) => void;
  recordStudentSubmitted: (payload: StudentSubmittedPayload) => void;
  setAnswerDraft: (questionId: string, answer: StudentAnswerValue) => void;
  setAnswerDrafts: (drafts: Record<string, StudentAnswerValue>) => void;
  setParticipantToken: (token: string | null) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  resetSession: () => void;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      session: null,
      students: [],
      answerDrafts: {},
      participantToken: null,
      connectionStatus: "idle",
      setSession: (session) => set({ session }),
      setStudents: (students) => set({ students }),
      upsertStudent: (student) =>
        set((state) => {
          const existingIndex = state.students.findIndex((item) => item.participantId === student.participantId);

          if (existingIndex === -1) {
            return { students: [...state.students, student] };
          }

          return {
            students: state.students.map((item) =>
              item.participantId === student.participantId ? { ...item, ...student } : item
            )
          };
        }),
      markStudentOffline: (participantId, lastSeen) =>
        set((state) => ({
          students: state.students.map((student) =>
            student.participantId === participantId ? { ...student, online: false, lastSeen } : student
          )
        })),
      recordAnswerProgress: (payload) =>
        set((state) => ({
          students: state.students.map((student) =>
            student.participantId === payload.participantId
              ? {
                  ...student,
                  name: student.name || payload.displayName,
                  online: true,
                  lastSeen: null,
                  status: "WORKING",
                  progress: payload.progress
                }
              : student
          )
        })),
      recordStudentSubmitted: (payload) =>
        set((state) => ({
          students: state.students.map((student) =>
            student.participantId === payload.participantId
              ? {
                  ...student,
                  name: student.name || payload.displayName,
                  online: true,
                  lastSeen: null,
                  status: "SUBMITTED",
                  score: payload.score,
                  submittedAt: payload.submittedAt,
                  progress: {
                    answeredCount: student.progress?.totalQuestions ?? student.progress?.answeredCount ?? 0,
                    totalQuestions: student.progress?.totalQuestions ?? student.progress?.answeredCount ?? 0,
                    currentQuestionOrder: student.progress?.totalQuestions ?? student.progress?.currentQuestionOrder ?? 0
                  }
                }
              : student
          )
        })),
      setAnswerDraft: (questionId, answer) =>
        set((state) => ({
          answerDrafts: {
            ...state.answerDrafts,
            [questionId]: answer
          }
        })),
      setAnswerDrafts: (drafts) => set({ answerDrafts: drafts }),
      setParticipantToken: (token) => set({ participantToken: token }),
      setConnectionStatus: (status) => set({ connectionStatus: status }),
      resetSession: () =>
        set({
          session: null,
          students: [],
          answerDrafts: {},
          participantToken: null,
          connectionStatus: "idle"
        })
    }),
    {
      name: "classpulse-session",
      partialize: (state) => ({
        participantToken: state.participantToken,
        session: state.session,
        answerDrafts: state.answerDrafts
      }),
      storage: createJSONStorage(() => localStorage)
    }
  )
);
