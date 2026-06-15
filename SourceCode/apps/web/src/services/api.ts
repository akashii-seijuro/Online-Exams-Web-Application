import axios, { AxiosError, AxiosHeaders } from "axios";

import { useAuthStore } from "../stores/authStore";
import type { ApiErrorBody } from "../types/auth";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3001";

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    "Content-Type": "application/json"
  }
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;

  if (config.data instanceof FormData && config.headers instanceof AxiosHeaders) {
    config.headers.delete("Content-Type");
  }

  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    if (error.response?.status === 401) {
      const isStudentFlow = window.location.pathname.startsWith("/join") || window.location.pathname.startsWith("/play");

      if (!isStudentFlow) {
        useAuthStore.getState().logout();
      }

      if (!isStudentFlow && window.location.pathname !== "/login" && window.location.pathname !== "/register") {
        window.location.assign("/login");
      }
    }

    return Promise.reject(error);
  }
);

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data.error.message ?? fallback;
  }

  return fallback;
}
