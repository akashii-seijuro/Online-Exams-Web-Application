import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import type { ApiSuccess } from "../../types/auth";
import type { StudentResultResponse, TeacherReportResponse } from "../../types/session";

export const reportKeys = {
  teacher: (sessionId: string) => ["teacher-report", sessionId] as const,
  student: (sessionId: string) => ["student-result", sessionId] as const
};

export async function fetchTeacherReport(sessionId: string) {
  const response = await api.get<ApiSuccess<TeacherReportResponse>>(`/reports/sessions/${sessionId}`);
  return response.data.data;
}

export function useTeacherReportQuery(sessionId: string | undefined) {
  return useQuery({
    queryKey: sessionId ? reportKeys.teacher(sessionId) : ["teacher-report", "missing"],
    queryFn: () => fetchTeacherReport(sessionId ?? ""),
    enabled: Boolean(sessionId)
  });
}

export async function fetchStudentResult(sessionId: string, participantToken: string) {
  const response = await api.get<ApiSuccess<StudentResultResponse>>(`/play/${sessionId}/result`, {
    headers: {
      Authorization: `Bearer ${participantToken}`
    }
  });

  return response.data.data;
}

export function useStudentResultQuery(sessionId: string | undefined, participantToken: string | null) {
  return useQuery({
    queryKey: sessionId ? reportKeys.student(sessionId) : ["student-result", "missing"],
    queryFn: () => fetchStudentResult(sessionId ?? "", participantToken ?? ""),
    enabled: Boolean(sessionId && participantToken),
    retry: 1
  });
}
