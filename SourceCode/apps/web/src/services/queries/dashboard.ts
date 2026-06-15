import { useQuery } from "@tanstack/react-query";

import type { ApiSuccess } from "../../types/auth";
import type { DashboardSummary } from "../../types/dashboard";
import { api } from "../api";

type DashboardSummaryResponse = {
  summary: DashboardSummary;
};

export const dashboardKeys = {
  all: ["dashboard"] as const,
  summary: () => [...dashboardKeys.all, "summary"] as const
};

export async function fetchDashboardSummary() {
  const response = await api.get<ApiSuccess<DashboardSummaryResponse>>("/dashboard/summary");
  return response.data.data.summary;
}

export function useDashboardSummaryQuery() {
  return useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: fetchDashboardSummary
  });
}
