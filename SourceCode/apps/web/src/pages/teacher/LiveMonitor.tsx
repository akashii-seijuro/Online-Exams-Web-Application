import { BarChart3, FileText, RefreshCw, Square, UsersRound, Wifi, WifiOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { useSocket } from "../../hooks/useSocket";
import { useEndSessionMutation, useSessionQuery } from "../../services/queries/sessions";
import { useSessionStore } from "../../stores/sessionStore";
import { cn } from "../../utils/cn";

function formatScore(score: number | null | undefined) {
  return typeof score === "number" ? score.toFixed(2) : "--";
}

function buildScoreBuckets(scores: number[]) {
  const buckets = [
    { label: "0-4", count: 0 },
    { label: "4-6", count: 0 },
    { label: "6-8", count: 0 },
    { label: "8-10", count: 0 }
  ];

  scores.forEach((score) => {
    if (score < 4) {
      const bucket = buckets[0];
      if (bucket) {
        bucket.count += 1;
      }
    } else if (score < 6) {
      const bucket = buckets[1];
      if (bucket) {
        bucket.count += 1;
      }
    } else if (score < 8) {
      const bucket = buckets[2];
      if (bucket) {
        bucket.count += 1;
      }
    } else {
      const bucket = buckets[3];
      if (bucket) {
        bucket.count += 1;
      }
    }
  });

  return buckets;
}

export function LiveMonitor() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const { data: session, isError, isLoading, refetch } = useSessionQuery(sessionId);
  const endSessionMutation = useEndSessionMutation();
  const students = useSessionStore((state) => state.students);
  const connectionStatus = useSessionStore((state) => state.connectionStatus);
  const setSession = useSessionStore((state) => state.setSession);
  const setStudents = useSessionStore((state) => state.setStudents);
  const [endedAt, setEndedAt] = useState<string | null>(null);

  const handleEnded = useCallback((payload: { endedAt: string }) => {
    setEndedAt(payload.endedAt);
  }, []);

  useSocket({
    clientType: "teacher",
    sessionId,
    onSessionEnded: handleEnded
  });

  const handleEndSession = useCallback(async () => {
    if (!sessionId || endSessionMutation.isPending) {
      return;
    }

    try {
      const endedSession = await endSessionMutation.mutateAsync(sessionId);
      toast.success("Đã kết thúc phiên");
      setEndedAt(endedSession.endedAt ?? new Date().toISOString());
      navigate(`/dashboard/session/${sessionId}/report`);
    } catch {
      toast.error("Không thể kết thúc phiên");
    }
  }, [endSessionMutation, navigate, sessionId]);

  useEffect(() => {
    if (!session) {
      return;
    }

    setSession(session);
    setStudents(session.students ?? []);
    if (session.endedAt) {
      setEndedAt(session.endedAt);
    }
  }, [session, setSession, setStudents]);

  const totalStudents = students.length;
  const submittedStudents = students.filter((student) => student.status === "SUBMITTED" || student.submittedAt).length;
  const workingStudents = students.filter((student) => student.status === "WORKING" && !student.submittedAt).length;
  const onlineStudents = students.filter((student) => student.online).length;
  const progressPercent = totalStudents > 0 ? Math.round((submittedStudents / totalStudents) * 100) : 0;
  const scores = students.map((student) => student.score).filter((score): score is number => typeof score === "number");
  const buckets = useMemo(() => buildScoreBuckets(scores), [scores]);
  const maxBucket = Math.max(1, ...buckets.map((bucket) => bucket.count));
  const averageScore = scores.length > 0 ? scores.reduce((total, score) => total + score, 0) / scores.length : null;

  if (isLoading) {
    return <Card className="h-[560px] animate-pulse bg-slate-100" />;
  }

  if (isError || !session) {
    return (
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Không thể tải bảng theo dõi</h1>
            <p className="mt-2 text-sm text-text-secondary">Kiểm tra kết nối hoặc tải lại phiên thi.</p>
          </div>
          <Button onClick={() => void refetch()} type="button" variant="secondary">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Thử lại
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-medium text-secondary">Theo dõi trực tiếp</p>
          <h1 className="mt-2 text-3xl font-semibold text-text-primary">{session.quiz.title}</h1>
          <p className="mt-2 text-sm text-text-secondary">
            {endedAt ? "Phiên thi đã kết thúc" : "Đang diễn ra"} - {submittedStudents}/{totalStudents} đã nộp
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold",
              connectionStatus === "connected"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            )}
          >
            {connectionStatus === "connected" ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {connectionStatus === "connected" ? "Realtime đã kết nối" : "Đang kết nối lại"}
          </div>
          <Button
            disabled={Boolean(endedAt)}
            isLoading={endSessionMutation.isPending}
            onClick={() => void handleEndSession()}
            type="button"
          >
            {!endSessionMutation.isPending ? <Square className="h-4 w-4" aria-hidden="true" /> : null}
            Kết thúc
          </Button>
          {endedAt ? (
            <Button onClick={() => navigate(`/dashboard/session/${session.id}/report`)} type="button" variant="secondary">
              <FileText className="h-4 w-4" aria-hidden="true" />
              Xem báo cáo
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Tiến độ lớp</h2>
              <p className="mt-1 text-sm text-text-secondary">{progressPercent}% đã nộp bài</p>
            </div>
            <UsersRound className="h-8 w-8 text-secondary" aria-hidden="true" />
          </div>

          <div className="mt-6 h-4 rounded-full bg-slate-200">
            <div className="h-4 rounded-full bg-success transition-all duration-200" style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            {[
              { label: "Đang online", value: onlineStudents },
              { label: "Đang làm", value: workingStudents },
              { label: "Đã nộp", value: submittedStudents },
              { label: "Tổng số", value: totalStudents }
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-border bg-slate-50 p-4">
                <p className="text-sm text-text-secondary">{item.label}</p>
                <p className="mt-2 font-mono text-3xl font-bold text-text-primary">{item.value}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Phổ điểm</h2>
              <p className="mt-1 text-sm text-text-secondary">Điểm TB: {averageScore === null ? "--" : averageScore.toFixed(2)}</p>
            </div>
            <BarChart3 className="h-8 w-8 text-primary" aria-hidden="true" />
          </div>

          <div className="mt-6 space-y-4">
            {buckets.map((bucket) => (
              <div key={bucket.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-semibold text-text-primary">{bucket.label}</span>
                  <span className="text-text-secondary">{bucket.count}</span>
                </div>
                <div className="h-3 rounded-full bg-slate-200">
                  <div
                    className="h-3 rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${(bucket.count / maxBucket) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-text-primary">Học sinh</h2>
          <Button onClick={() => navigate(`/dashboard/session/${session.id}/lobby`)} type="button" variant="secondary">
            Về lobby
          </Button>
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-[1.4fr_1fr_120px] bg-slate-50 px-4 py-3 text-sm font-semibold text-text-secondary">
            <span>Tên</span>
            <span>Trạng thái</span>
            <span className="text-right">Điểm</span>
          </div>
          {students.length > 0 ? (
            students.map((student) => (
              <div
                key={student.participantId}
                className="grid grid-cols-[1.4fr_1fr_120px] items-center border-t border-border px-4 py-3 text-sm transition duration-200 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-text-primary">{student.name}</p>
                  <p className="text-xs text-text-secondary">{student.online ? "Online" : "Mất kết nối"}</p>
                </div>
                <div className="text-text-secondary">
                  {student.status === "SUBMITTED" || student.submittedAt
                    ? "Đã nộp"
                    : `Đang làm - Câu ${student.progress?.currentQuestionOrder ?? 0}/${student.progress?.totalQuestions ?? session.quiz._count.questions}`}
                </div>
                <div className="text-right font-mono text-lg font-bold text-text-primary">{formatScore(student.score)}</div>
              </div>
            ))
          ) : (
            <div className="border-t border-border px-4 py-10 text-center text-sm text-text-secondary">
              Chưa có học sinh nào trong phiên.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
