import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../api";
import type { ApiSuccess } from "../../types/auth";
import type { Quiz, QuizFormValues, QuizSummary } from "../../types/quiz";
import { dashboardKeys } from "./dashboard";

type QuizzesResponse = {
  quizzes: QuizSummary[];
};

type QuizResponse = {
  quiz: Quiz;
};

type DeleteQuizResponse = {
  id: string;
};

type ImportPdfResponse = {
  questions: QuizFormValues["questions"];
};

export const quizKeys = {
  all: ["quizzes"] as const,
  lists: () => [...quizKeys.all, "list"] as const,
  detail: (id: string) => [...quizKeys.all, "detail", id] as const
};

export async function fetchQuizzes() {
  const response = await api.get<ApiSuccess<QuizzesResponse>>("/quizzes");
  return response.data.data.quizzes;
}

export async function fetchQuiz(id: string) {
  const response = await api.get<ApiSuccess<QuizResponse>>(`/quizzes/${id}`);
  return response.data.data.quiz;
}

export async function createQuiz(values: QuizFormValues) {
  const response = await api.post<ApiSuccess<QuizResponse>>("/quizzes", values);
  return response.data.data.quiz;
}

export async function updateQuiz(id: string, values: QuizFormValues) {
  const response = await api.put<ApiSuccess<QuizResponse>>(`/quizzes/${id}`, values);
  return response.data.data.quiz;
}

export async function deleteQuiz(id: string) {
  const response = await api.delete<ApiSuccess<DeleteQuizResponse>>(`/quizzes/${id}`);
  return response.data.data;
}

export async function importQuizPdf(file: File): Promise<QuizFormValues["questions"]> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post<ApiSuccess<ImportPdfResponse>>("/quizzes/import-pdf", formData);

  return response.data.data.questions;
}

export function useQuizzesQuery() {
  return useQuery({
    queryKey: quizKeys.lists(),
    queryFn: fetchQuizzes
  });
}

export function useQuizQuery(id: string | undefined) {
  return useQuery({
    queryKey: id ? quizKeys.detail(id) : [...quizKeys.all, "detail", "missing"],
    queryFn: () => fetchQuiz(id ?? ""),
    enabled: Boolean(id)
  });
}

export function useCreateQuizMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createQuiz,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: quizKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.summary() })
      ]);
    }
  });
}

export function useUpdateQuizMutation(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: QuizFormValues) => updateQuiz(id, values),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: quizKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: quizKeys.detail(id) }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.summary() })
      ]);
    }
  });
}

export function useDeleteQuizMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteQuiz,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: quizKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.summary() })
      ]);
    }
  });
}

export function useImportPdfMutation() {
  return useMutation({
    mutationFn: importQuizPdf
  });
}
