import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../api";
import type { ApiSuccess } from "../../types/auth";
import type { CreateSessionInput, TeacherSession, TeacherSessionSummary, UpdateSessionSettingsInput } from "../../types/session";
import { dashboardKeys } from "./dashboard";
import { reportKeys } from "./reports";

type SessionResponse = {
  session: TeacherSession;
};

type SessionsResponse = {
  sessions: TeacherSessionSummary[];
};

type DeleteSessionResponse = {
  id: string;
};

export const sessionKeys = {
  all: ["sessions"] as const,
  lists: () => [...sessionKeys.all, "list"] as const,
  detail: (id: string) => [...sessionKeys.all, "detail", id] as const
};

export async function createSession(input: CreateSessionInput) {
  const response = await api.post<ApiSuccess<SessionResponse>>("/sessions", input);
  return response.data.data.session;
}

export async function fetchSession(id: string) {
  const response = await api.get<ApiSuccess<SessionResponse>>(`/sessions/${id}`);
  return response.data.data.session;
}

export async function fetchSessions() {
  const response = await api.get<ApiSuccess<SessionsResponse>>("/sessions");
  return response.data.data.sessions;
}

export async function endSession(id: string) {
  const response = await api.patch<ApiSuccess<SessionResponse>>(`/sessions/${id}/end`);
  return response.data.data.session;
}

export async function deleteSession(id: string) {
  const response = await api.delete<ApiSuccess<DeleteSessionResponse>>(`/sessions/${id}`);
  return response.data.data;
}

export async function updateSessionSettings(id: string, input: UpdateSessionSettingsInput) {
  const response = await api.patch<ApiSuccess<SessionResponse>>(`/sessions/${id}/settings`, input);
  return response.data.data.session;
}

export function useCreateSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSession,
    onSuccess: async (session) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: sessionKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: sessionKeys.detail(session.id) }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.summary() })
      ]);
    }
  });
}

export function useSessionsQuery() {
  return useQuery({
    queryKey: sessionKeys.lists(),
    queryFn: fetchSessions
  });
}

export function useSessionQuery(id: string | undefined) {
  return useQuery({
    queryKey: id ? sessionKeys.detail(id) : [...sessionKeys.all, "detail", "missing"],
    queryFn: () => fetchSession(id ?? ""),
    enabled: Boolean(id)
  });
}

export function useEndSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: endSession,
    onSuccess: async (session) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: sessionKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: sessionKeys.detail(session.id) }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.summary() })
      ]);
    }
  });
}

export function useDeleteSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSession,
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: sessionKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: sessionKeys.detail(result.id) }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.summary() }),
        queryClient.invalidateQueries({ queryKey: reportKeys.teacher(result.id) })
      ]);
    }
  });
}

export function useUpdateSessionSettingsMutation(id: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateSessionSettingsInput) => updateSessionSettings(id ?? "", input),
    onSuccess: async (session) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: sessionKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: sessionKeys.detail(session.id) })
      ]);
    }
  });
}
