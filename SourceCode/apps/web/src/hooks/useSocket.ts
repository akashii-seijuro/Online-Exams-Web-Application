import { useCallback, useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";

import { createSocket } from "../services/socket";
import { useAuthStore } from "../stores/authStore";
import { useSessionStore } from "../stores/sessionStore";
import type {
  AnswerReceivedPayload,
  LiveStudent,
  SessionEndedPayload,
  SessionStartedPayload,
  StudentAnswerDraftPayload,
  StudentSubmittedPayload
} from "../types/session";

type UseSocketOptions =
  | {
      clientType: "teacher";
      sessionId: string | undefined;
      onSessionStarted?: (payload: SessionStartedPayload) => void;
      onSessionEnded?: (payload: SessionEndedPayload) => void;
    }
  | {
      clientType: "student";
      sessionId?: string | undefined;
      onSessionStarted?: (payload: SessionStartedPayload) => void;
      onSessionEnded?: (payload: SessionEndedPayload) => void;
    };

type SessionStudentsPayload = {
  sessionId: string;
  students: LiveStudent[];
};

type SessionJoinedPayload = {
  sessionId: string;
  student: LiveStudent;
};

type SessionLeftPayload = {
  sessionId: string;
  participantId: string;
  lastSeen: string | null;
};

type StudentJoinedPayload = {
  sessionId: string;
  participantId: string;
  status: "WAITING";
};

export function useSocket(options: UseSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const onSessionStartedRef = useRef(options.onSessionStarted);
  const onSessionEndedRef = useRef(options.onSessionEnded);
  const clientType = options.clientType;
  const sessionId = options.sessionId;
  const accessToken = useAuthStore((state) => state.accessToken);
  const participantToken = useSessionStore((state) => state.participantToken);
  const setStudents = useSessionStore((state) => state.setStudents);
  const upsertStudent = useSessionStore((state) => state.upsertStudent);
  const markStudentOffline = useSessionStore((state) => state.markStudentOffline);
  const recordAnswerProgress = useSessionStore((state) => state.recordAnswerProgress);
  const recordStudentSubmitted = useSessionStore((state) => state.recordStudentSubmitted);
  const resetSession = useSessionStore((state) => state.resetSession);
  const setConnectionStatus = useSessionStore((state) => state.setConnectionStatus);

  useEffect(() => {
    onSessionStartedRef.current = options.onSessionStarted;
    onSessionEndedRef.current = options.onSessionEnded;
  }, [options.onSessionEnded, options.onSessionStarted]);

  useEffect(() => {
    const token = clientType === "teacher" ? accessToken : participantToken;

    if (!token) {
      return undefined;
    }

    if (clientType === "teacher" && !sessionId) {
      return undefined;
    }

    let socket: Socket | null = createSocket({
      token,
      clientType
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnectionStatus("connected");

      if (clientType === "teacher") {
        socket?.emit("teacher:watch-session", { sessionId });
      }

      if (clientType === "student") {
        socket?.emit("student:join");
      }
    });

    socket.on("connect_error", () => {
      setConnectionStatus("error");
    });

    socket.on("disconnect", () => {
      setConnectionStatus("disconnected");
    });

    socket.on("session:students", (payload: SessionStudentsPayload) => {
      if (clientType === "teacher" && payload.sessionId === sessionId) {
        setStudents(payload.students);
      }
    });

    socket.on("session:joined", (payload: SessionJoinedPayload) => {
      if (clientType === "teacher" && payload.sessionId === sessionId) {
        upsertStudent(payload.student);
      }
    });

    socket.on("session:left", (payload: SessionLeftPayload) => {
      if (clientType === "teacher" && payload.sessionId === sessionId) {
        markStudentOffline(payload.participantId, payload.lastSeen);
      }
    });

    socket.on("student:joined", (_payload: StudentJoinedPayload) => {
      setConnectionStatus("connected");
    });

    socket.on("session:started", (payload: SessionStartedPayload) => {
      onSessionStartedRef.current?.(payload);
    });

    socket.on("session:ended", (payload: SessionEndedPayload) => {
      if (clientType === "student") {
        resetSession();
      }

      onSessionEndedRef.current?.(payload);
    });

    socket.on("answer:received", (payload: AnswerReceivedPayload) => {
      if (clientType === "teacher" && payload.sessionId === sessionId) {
        recordAnswerProgress(payload);
      }
    });

    socket.on("student:submitted", (payload: StudentSubmittedPayload) => {
      if (clientType === "teacher" && payload.sessionId === sessionId) {
        recordStudentSubmitted(payload);
      }
    });

    setConnectionStatus("connecting");
    socket.connect();

    return () => {
      socket?.removeAllListeners();
      socket?.disconnect();
      socket = null;
      socketRef.current = null;
    };
  }, [
    accessToken,
    clientType,
    markStudentOffline,
    participantToken,
    recordAnswerProgress,
    recordStudentSubmitted,
    resetSession,
    sessionId,
    setConnectionStatus,
    setStudents,
    upsertStudent
  ]);

  const emitSessionStart = useCallback((targetSessionId: string) => {
    socketRef.current?.emit("session:start", { sessionId: targetSessionId });
  }, []);

  const emitSessionEnd = useCallback((targetSessionId: string) => {
    socketRef.current?.emit("session:end", { sessionId: targetSessionId });
  }, []);

  const emitStudentAnswer = useCallback((payload: StudentAnswerDraftPayload) => {
    socketRef.current?.emit("student:answer", payload);
  }, []);

  return {
    emitSessionStart,
    emitSessionEnd,
    emitStudentAnswer
  };
}
