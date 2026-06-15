import { useMutation, useQuery } from "@tanstack/react-query";

import { api } from "../api";
import type { ApiSuccess } from "../../types/auth";
import type {
  JoinFormValues,
  JoinSessionResponse,
  PlaySessionResponse,
  StudentAnswerValue,
  SubmitPlayResponse
} from "../../types/session";

export async function joinSession(values: JoinFormValues) {
  const response = await api.post<ApiSuccess<JoinSessionResponse>>(`/join/${values.roomCode}`, {
    name: values.name,
    studentCode: values.studentCode
  });

  return response.data.data;
}

export function useJoinSessionMutation() {
  return useMutation({
    mutationFn: joinSession
  });
}

export async function getPlaySession(sessionId: string, participantToken: string) {
  const response = await api.get<ApiSuccess<PlaySessionResponse>>(`/play/${sessionId}`, {
    headers: {
      Authorization: `Bearer ${participantToken}`
    }
  });

  return response.data.data;
}

export function usePlaySessionQuery(sessionId: string | undefined, participantToken: string | null) {
  return useQuery({
    queryKey: ["play-session", sessionId],
    queryFn: () => getPlaySession(sessionId ?? "", participantToken ?? ""),
    enabled: Boolean(sessionId && participantToken),
    retry: 1
  });
}

export type SubmitPlayInput = {
  answers: Record<string, StudentAnswerValue>;
  clientSubmittedAt?: string;
};

export async function submitPlay(sessionId: string, participantToken: string, input: SubmitPlayInput) {
  const response = await api.post<ApiSuccess<SubmitPlayResponse>>(`/play/${sessionId}/submit`, input, {
    headers: {
      Authorization: `Bearer ${participantToken}`
    }
  });

  return response.data.data;
}

export function useSubmitPlayMutation(sessionId: string | undefined, participantToken: string | null) {
  return useMutation({
    mutationFn: (input: SubmitPlayInput) => submitPlay(sessionId ?? "", participantToken ?? "", input)
  });
}
