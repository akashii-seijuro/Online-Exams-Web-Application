import { motion } from "framer-motion";
import { ArrowLeft, Copy, RefreshCw, Save, Settings, UsersRound, Wifi, WifiOff } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { useSocket } from "../../hooks/useSocket";
import {
  endSession,
  useEndSessionMutation,
  useSessionQuery,
  useUpdateSessionSettingsMutation
} from "../../services/queries/sessions";
import { useSessionStore } from "../../stores/sessionStore";
import { cn } from "../../utils/cn";

function LobbySkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card className="h-96 animate-pulse bg-slate-100" />
      <Card className="h-96 animate-pulse bg-slate-100" />
    </div>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatTimeLimit(seconds: number | null) {
  if (!seconds) {
    return "Không giới hạn";
  }

  const minutes = Math.floor(seconds / 60);
  return `${minutes} phút`;
}

export function SessionLobby() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const { data: session, isError, isLoading, refetch } = useSessionQuery(sessionId);
  const endSessionMutation = useEndSessionMutation();
  const updateSettingsMutation = useUpdateSessionSettingsMutation(sessionId);
  const students = useSessionStore((state) => state.students);
  const connectionStatus = useSessionStore((state) => state.connectionStatus);
  const setSession = useSessionStore((state) => state.setSession);
  const setStudents = useSessionStore((state) => state.setStudents);
  const joinUrl = session ? `${window.location.origin}/join/${session.roomCode}` : "";
  const onlineCount = students.filter((student) => student.online).length;
  const sessionStatusRef = useRef(session?.status ?? null);
  const sessionStartedRef = useRef(false);
  const manualLeaveRef = useRef(false);
  const connectionToastRef = useRef(connectionStatus);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showScore, setShowScore] = useState(true);
  const [showAnswers, setShowAnswers] = useState(true);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState("");
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const handleSessionStarted = useCallback(() => {
    if (sessionId) {
      sessionStartedRef.current = true;
      navigate(`/dashboard/session/${sessionId}/live`);
    }
  }, [navigate, sessionId]);

  const { emitSessionStart } = useSocket({
    clientType: "teacher",
    sessionId,
    onSessionStarted: handleSessionStarted
  });

  const handleLeaveLobby = useCallback(async () => {
    if (sessionId && session?.status !== "ENDED") {
      await endSessionMutation.mutateAsync(sessionId);
    }

    manualLeaveRef.current = true;
    navigate("/dashboard");
  }, [endSessionMutation, navigate, session?.status, sessionId]);

  useEffect(() => {
    if (!session) {
      return;
    }

    setSession(session);
    setStudents(session.students ?? []);
    sessionStatusRef.current = session.status;
    setShowScore(session.showScore);
    setShowAnswers(session.showAnswers);
    setTimeLimitMinutes(session.timeLimit ? String(Math.floor(session.timeLimit / 60)) : "");
  }, [session, setSession, setStudents]);

  const handleSaveSettings = useCallback(async () => {
    if (!sessionId) {
      return;
    }

    const trimmedMinutes = timeLimitMinutes.trim();
    const minutes = trimmedMinutes ? Number(trimmedMinutes) : null;

    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440)) {
      setSettingsError("Thời gian làm bài cần từ 1 đến 1440 phút.");
      return;
    }

    try {
      setSettingsError(null);
      await updateSettingsMutation.mutateAsync({
        timeLimit: minutes === null ? null : minutes * 60,
        showScore,
        showAnswers
      });
      toast.success("Đã lưu tùy chọn phòng");
      setShowSettingsPanel(false);
    } catch {
      toast.error("Không thể lưu tùy chọn");
      setSettingsError("Không thể lưu tùy chọn, vui lòng thử lại.");
    }
  }, [sessionId, showAnswers, showScore, timeLimitMinutes, updateSettingsMutation]);

  const handleCopyJoinUrl = useCallback(async () => {
    if (!joinUrl) {
      return;
    }

    try {
      await window.navigator.clipboard.writeText(joinUrl);
      toast.success("Đã copy mã phòng thi");
    } catch {
      toast.error("Không thể copy mã phòng");
    }
  }, [joinUrl]);

  useEffect(() => {
    if (connectionToastRef.current === connectionStatus) {
      return;
    }

    if (connectionStatus === "disconnected" || connectionStatus === "error") {
      toast.warning("Mất kết nối, đang tự động thử lại...");
    }

    if (connectionStatus === "connected" && connectionToastRef.current !== "connecting") {
      toast.success("Realtime đã kết nối lại");
    }

    connectionToastRef.current = connectionStatus;
  }, [connectionStatus]);

  useEffect(() => {
    return () => {
      if (
        sessionId &&
        sessionStatusRef.current === "WAITING" &&
        !sessionStartedRef.current &&
        !manualLeaveRef.current
      ) {
        void endSession(sessionId);
      }
    };
  }, [sessionId]);

  if (isLoading) {
    return <LobbySkeleton />;
  }

  if (isError || !session) {
    return (
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Không thể tải phòng chờ</h1>
            <p className="mt-2 text-sm text-text-secondary">Kiểm tra kết nối hoặc thử tải lại phiên thi.</p>
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Button isLoading={endSessionMutation.isPending} onClick={() => void handleLeaveLobby()} type="button" variant="secondary">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Quay lại
          </Button>
          <p className="mt-5 text-sm font-medium text-secondary">Phòng chờ realtime</p>
          <h1 className="mt-2 text-3xl font-semibold text-text-primary">{session.quiz.title}</h1>
        </div>

        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold",
            connectionStatus === "connected"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          )}
        >
          {connectionStatus === "connected" ? (
            <Wifi className="h-4 w-4" aria-hidden="true" />
          ) : (
            <WifiOff className="h-4 w-4" aria-hidden="true" />
          )}
          {connectionStatus === "connected" ? "Realtime đã kết nối" : "Đang kết nối realtime"}
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <Card className="px-4 py-3">
          <p className="text-sm font-semibold text-text-primary">Tùy chọn hiện tại</p>
          <p className="mt-1 text-sm text-text-secondary">
            {formatTimeLimit(session.timeLimit)} · {session.showScore ? "Cho xem điểm" : "Ẩn điểm"} ·{" "}
            {session.showAnswers ? "Cho xem kết quả" : "Ẩn kết quả"}
          </p>
        </Card>
        <div className="flex flex-wrap justify-end gap-3">
          <Button
            disabled={session.status !== "WAITING"}
            onClick={() => setShowSettingsPanel((value) => !value)}
            size="lg"
            type="button"
            variant="secondary"
          >
            <Settings className="h-5 w-5" aria-hidden="true" />
            Tùy chọn
          </Button>
          <Button
            disabled={connectionStatus !== "connected" || session.status === "ENDED"}
            onClick={() => sessionId && emitSessionStart(sessionId)}
            size="lg"
            type="button"
          >
            Bắt đầu làm bài
          </Button>
        </div>
      </div>

      {showSettingsPanel ? (
        <Card className="p-5">
          <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-start gap-3 rounded-lg border border-border bg-slate-50 p-4">
                <input
                  checked={showScore}
                  className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-indigo-500"
                  disabled={session.status !== "WAITING" || updateSettingsMutation.isPending}
                  onChange={(event) => setShowScore(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  <span className="block text-sm font-semibold text-text-primary">Cho phép xem điểm sau khi nộp</span>
                  <span className="mt-1 block text-sm leading-6 text-text-secondary">
                    Học sinh nhìn thấy điểm, số câu đúng và thứ hạng cá nhân.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-lg border border-border bg-slate-50 p-4">
                <input
                  checked={showAnswers}
                  className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-indigo-500"
                  disabled={session.status !== "WAITING" || updateSettingsMutation.isPending}
                  onChange={(event) => setShowAnswers(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  <span className="block text-sm font-semibold text-text-primary">Cho phép xem kết quả sau khi nộp</span>
                  <span className="mt-1 block text-sm leading-6 text-text-secondary">
                    Học sinh được mở phần xem lại bài làm và đáp án đúng.
                  </span>
                </span>
              </label>
            </div>

            <div>
              <label className="text-sm font-semibold text-text-primary" htmlFor="time-limit-minutes">
                Giới hạn thời gian làm bài
              </label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-text-primary outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                  disabled={session.status !== "WAITING" || updateSettingsMutation.isPending}
                  id="time-limit-minutes"
                  inputMode="numeric"
                  max={1440}
                  min={1}
                  onChange={(event) => setTimeLimitMinutes(event.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="Không giới hạn"
                  type="number"
                  value={timeLimitMinutes}
                />
                <span className="text-sm font-semibold text-text-secondary">phút</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-text-secondary">Bỏ trống nếu không muốn giới hạn thời gian.</p>
              {settingsError ? <p className="mt-2 text-sm font-semibold text-danger">{settingsError}</p> : null}
              <Button
                className="mt-4 w-full"
                disabled={session.status !== "WAITING"}
                isLoading={updateSettingsMutation.isPending}
                onClick={() => void handleSaveSettings()}
                type="button"
              >
                {!updateSettingsMutation.isPending ? <Save className="h-4 w-4" aria-hidden="true" /> : null}
                Lưu tùy chọn
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="p-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Mã phòng</p>
          <p className="mt-3 font-mono text-5xl font-bold tracking-normal text-primary">{session.roomCode}</p>

          <div className="mx-auto mt-6 flex w-fit rounded-xl border border-indigo-100 bg-white p-4 shadow-card">
            <QRCodeSVG value={joinUrl} size={240} />
          </div>

          <div className="mt-5 flex items-center justify-center gap-2">
            <p className="break-all font-mono text-sm text-text-secondary">{joinUrl}</p>
            <Button aria-label="Copy mã phòng thi" onClick={() => void handleCopyJoinUrl()} size="icon" type="button" variant="secondary">
              <Copy className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <p className="mt-4 text-sm leading-6 text-text-secondary">
            Học sinh quét QR hoặc nhập mã phòng trên điện thoại để vào phòng chờ.
          </p>
        </Card>

        <Card className="min-h-[460px] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Học sinh đã vào</h2>
              <p className="mt-1 text-sm text-text-secondary">
                {onlineCount}/{students.length} đang online
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-50 text-secondary">
              <UsersRound className="h-6 w-6" aria-hidden="true" />
            </div>
          </div>

          {students.length > 0 ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {students.map((student) => (
                <motion.div
                  key={student.participantId}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 transition duration-200",
                    student.online ? "border-cyan-200 bg-cyan-50" : "border-border bg-slate-50 opacity-70"
                  )}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white font-semibold text-primary shadow-card">
                    {getInitials(student.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">{student.name}</p>
                    <p className="text-xs text-text-secondary">{student.online ? "Đang chờ" : "Mất kết nối"}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-slate-50 px-6 text-center">
              <UsersRound className="h-10 w-10 text-text-muted" aria-hidden="true" />
              <h3 className="mt-4 text-base font-semibold text-text-primary">Chưa có học sinh nào</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-text-secondary">
                Danh sách sẽ cập nhật ngay khi học sinh tham gia bằng QR hoặc mã phòng.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
