export type ReportJobPayload = {
  sessionId: string;
};

export function createReportPlaceholder(payload: ReportJobPayload) {
  return {
    sessionId: payload.sessionId,
    status: "queued" as const
  };
}
