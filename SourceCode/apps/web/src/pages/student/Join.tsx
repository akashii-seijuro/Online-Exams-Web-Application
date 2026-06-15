import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn, Wifi, WifiOff } from "lucide-react";
import { useCallback, useEffect } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "../../components/ui/Button";
import { useSocket } from "../../hooks/useSocket";
import { getApiErrorMessage } from "../../services/api";
import { useJoinSessionMutation } from "../../services/queries/student";
import { useSessionStore } from "../../stores/sessionStore";
import { joinFormSchema, type JoinFormValues } from "../../types/session";
import { cn } from "../../utils/cn";

export function Join() {
  const navigate = useNavigate();
  const { code } = useParams();
  const joinMutation = useJoinSessionMutation();
  const session = useSessionStore((state) => state.session);
  const participantToken = useSessionStore((state) => state.participantToken);
  const connectionStatus = useSessionStore((state) => state.connectionStatus);
  const setSession = useSessionStore((state) => state.setSession);
  const setParticipantToken = useSessionStore((state) => state.setParticipantToken);
  const setConnectionStatus = useSessionStore((state) => state.setConnectionStatus);
  const resetSession = useSessionStore((state) => state.resetSession);
  const [joinedCurrentPage, setJoinedCurrentPage] = useState(false);
  const handleSessionStarted = useCallback(
    (payload: { sessionId: string }) => navigate(`/play/${payload.sessionId}`),
    [navigate]
  );
  const handleSessionEnded = useCallback(() => {
    resetSession();
    setJoinedCurrentPage(false);
    navigate("/join", { replace: true });
  }, [navigate, resetSession]);

  useSocket({
    clientType: "student",
    onSessionStarted: handleSessionStarted,
    onSessionEnded: handleSessionEnded
  });

  const {
    formState: { errors },
    handleSubmit,
    register,
    setError,
    setValue
  } = useForm<JoinFormValues>({
    resolver: zodResolver(joinFormSchema),
    defaultValues: {
      roomCode: code ?? "",
      name: "",
      studentCode: ""
    }
  });

  useEffect(() => {
    resetSession();
    setJoinedCurrentPage(false);

    if (code) {
      setValue("roomCode", code.toUpperCase());
    }
  }, [code, resetSession, setValue]);

  const isWaiting = joinedCurrentPage && Boolean(participantToken && session);

  const onSubmit = handleSubmit(async (values) => {
    try {
      setConnectionStatus("connecting");
      const data = await joinMutation.mutateAsync(values);
      setSession(data.session);
      setParticipantToken(data.participantToken);
      setJoinedCurrentPage(true);
      toast.success("Đã vào phòng thành công");
    } catch (error) {
      toast.error("Không thể vào phòng");
      setConnectionStatus("error");
      setError("roomCode", {
        message: getApiErrorMessage(error, "Không thể vào phòng, vui lòng thử lại")
      });
    }
  });

  if (isWaiting) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[480px] flex-col items-center justify-center bg-neutral px-6 py-10 text-center">
        <div className="w-full rounded-xl border border-border bg-surface p-6 shadow-card">
          <p className="text-sm font-medium text-secondary">ClassPulse</p>
          <h1 className="mt-3 text-2xl font-semibold text-text-primary">Đang chờ giáo viên bắt đầu</h1>
          <p className="mt-3 text-sm leading-6 text-text-secondary">
            Bạn đã vào phòng {session?.roomCode}. Giữ trang này mở trong lúc chờ.
          </p>

          <div
            className={cn(
              "mx-auto mt-6 inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold",
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
            {connectionStatus === "connected" ? "Đã kết nối" : "Đang kết nối lại"}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[480px] flex-col justify-center bg-neutral px-6 py-10">
      <form onSubmit={(event) => void onSubmit(event)} className="rounded-xl border border-border bg-surface p-6 shadow-card">
        <p className="text-sm font-medium text-secondary">ClassPulse</p>
        <h1 className="mt-3 text-2xl font-semibold text-text-primary">Tham gia phòng</h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary">Nhập mã phòng và tên của bạn để vào phòng chờ.</p>

        <label className="mt-6 block text-sm font-semibold text-text-primary" htmlFor="roomCode">
          Mã phòng
        </label>
        <input
          id="roomCode"
          className="mt-2 h-12 w-full rounded-lg border border-border bg-white px-4 font-mono text-lg font-semibold uppercase text-text-primary outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
          placeholder="AB12CD"
          disabled={joinMutation.isPending}
          {...register("roomCode")}
        />
        {errors.roomCode ? <p className="mt-2 text-sm text-danger">{errors.roomCode.message}</p> : null}

        <label className="mt-5 block text-sm font-semibold text-text-primary" htmlFor="name">
          Tên của bạn
        </label>
        <input
          id="name"
          className="mt-2 h-12 w-full rounded-lg border border-border bg-white px-4 text-base text-text-primary outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
          placeholder="Nguyễn Văn A"
          disabled={joinMutation.isPending}
          {...register("name")}
        />
        {errors.name ? <p className="mt-2 text-sm text-danger">{errors.name.message}</p> : null}

        <label className="mt-5 block text-sm font-semibold text-text-primary" htmlFor="studentCode">
          Mã học sinh
        </label>
        <input
          id="studentCode"
          className="mt-2 h-12 w-full rounded-lg border border-border bg-white px-4 text-base text-text-primary outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
          placeholder="Không bắt buộc"
          disabled={joinMutation.isPending}
          {...register("studentCode")}
        />
        {errors.studentCode ? <p className="mt-2 text-sm text-danger">{errors.studentCode.message}</p> : null}

        <Button className="mt-6 w-full" isLoading={joinMutation.isPending} size="lg" type="submit">
          {!joinMutation.isPending ? <LogIn className="h-5 w-5" aria-hidden="true" /> : null}
          Vào phòng
        </Button>
      </form>
    </main>
  );
}
