import {
  ArrowLeft,
  BarChart3,
  ClipboardList,
  Play,
  RefreshCw,
  Trash2,
  UsersRound,
  X
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { getApiErrorMessage } from "../../services/api";
import { useDeleteSessionMutation, useSessionsQuery } from "../../services/queries/sessions";
import type { SessionStatus, TeacherSessionSummary } from "../../types/session";
import { cn } from "../../utils/cn";

type DeleteTarget = {
  id: string;
  roomCode: string;
  quizTitle: string;
  status: SessionStatus;
  participantCount: number;
};

type DeleteSessionDialogProps = {
  target: DeleteTarget;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

function formatDateTime(value: string | null) {
  return value ? dateTimeFormatter.format(new Date(value)) : "--";
}

function getStatusLabel(status: SessionStatus) {
  if (status === "WAITING") {
    return "Phòng chờ";
  }

  if (status === "ACTIVE") {
    return "Đang diễn ra";
  }

  return "Đã kết thúc";
}

function getStatusClasses(status: SessionStatus) {
  if (status === "WAITING") {
    return "border-cyan-200 bg-cyan-50 text-cyan-700";
  }

  if (status === "ACTIVE") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function getPrimarySessionAction(session: TeacherSessionSummary) {
  if (session.status === "WAITING") {
    return {
      label: "Mở lobby",
      icon: ClipboardList,
      to: `/dashboard/session/${session.id}/lobby`
    };
  }

  if (session.status === "ACTIVE") {
    return {
      label: "Theo dõi live",
      icon: Play,
      to: `/dashboard/session/${session.id}/live`
    };
  }

  return {
    label: "Xem report",
    icon: BarChart3,
    to: `/dashboard/session/${session.id}/report`
  };
}

function SessionListSkeleton() {
  return (
    <div className="divide-y divide-border">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="px-5 py-4">
          <div className="animate-pulse space-y-3">
            <div className="h-5 w-2/3 rounded bg-slate-200" />
            <div className="h-4 w-1/2 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DeleteSessionDialog({ target, isDeleting, onCancel, onConfirm }: DeleteSessionDialogProps) {
  const isActive = target.status === "ACTIVE";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
      <div
        aria-describedby="delete-session-description"
        aria-labelledby="delete-session-title"
        aria-modal="true"
        className="w-full max-w-md rounded-lg bg-surface p-5 shadow-card"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p id="delete-session-title" className="text-lg font-semibold text-text-primary">
              Xóa phiên lịch sử?
            </p>
            <p id="delete-session-description" className="mt-2 text-sm leading-6 text-text-secondary">
              Phiên <span className="font-mono font-semibold text-text-primary">{target.roomCode}</span> của đề{" "}
              <span className="font-semibold text-text-primary">"{target.quizTitle}"</span> sẽ bị xóa khỏi lịch sử.
            </p>
          </div>
          <Button
            aria-label="Đóng hộp thoại xóa phiên"
            disabled={isDeleting}
            onClick={onCancel}
            size="icon"
            type="button"
            variant="secondary"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        {isActive ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
            Không thể xóa phiên đang diễn ra. Hãy kết thúc phiên trước khi xóa.
          </p>
        ) : (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            Hành động này sẽ xóa {target.participantCount} học sinh tham gia, toàn bộ câu trả lời và report của phiên.
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button disabled={isDeleting} onClick={onCancel} type="button" variant="secondary">
            Hủy
          </Button>
          <Button
            className="border border-red-600 bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-500"
            disabled={isActive}
            isLoading={isDeleting}
            onClick={onConfirm}
            type="button"
          >
            {!isDeleting ? <Trash2 className="h-4 w-4" aria-hidden="true" /> : null}
            Xóa phiên
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Sessions() {
  const navigate = useNavigate();
  const sessionsQuery = useSessionsQuery();
  const deleteSessionMutation = useDeleteSessionMutation();
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  async function handleConfirmDelete() {
    if (!deleteTarget || deleteTarget.status === "ACTIVE") {
      return;
    }

    try {
      await deleteSessionMutation.mutateAsync(deleteTarget.id);
      toast.success("Đã xóa phiên lịch sử");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể xóa phiên này"));
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <Button
            aria-label="Quay lại dashboard"
            onClick={() => navigate("/dashboard")}
            size="icon"
            type="button"
            variant="secondary"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Button>
          <div>
            <p className="text-sm font-medium text-secondary">Lịch sử phiên</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-text-primary sm:text-3xl">
              Quản lý phiên đã tạo
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
              Xem lại report, tiếp tục theo dõi phiên đang mở hoặc xóa các phiên lịch sử không còn cần lưu trữ.
            </p>
          </div>
        </div>

        <Button onClick={() => void sessionsQuery.refetch()} type="button" variant="secondary">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Tải lại
        </Button>
      </section>

      {sessionsQuery.isError ? (
        <Card className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Không thể tải lịch sử phiên</h2>
              <p className="mt-1 text-sm text-text-secondary">Kiểm tra kết nối và thử tải lại.</p>
            </div>
            <Button onClick={() => void sessionsQuery.refetch()} type="button" variant="secondary">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Thử lại
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        {sessionsQuery.isLoading ? <SessionListSkeleton /> : null}

        {!sessionsQuery.isLoading && sessionsQuery.data && sessionsQuery.data.length > 0 ? (
          <div className="divide-y divide-border">
            {sessionsQuery.data.map((session) => {
              const action = getPrimarySessionAction(session);
              const ActionIcon = action.icon;

              return (
                <div
                  key={session.id}
                  className="flex w-full flex-col gap-4 px-5 py-4 transition duration-200 hover:bg-slate-50 xl:flex-row xl:items-center xl:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-base font-semibold text-text-primary">{session.quiz.title}</p>
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs font-semibold",
                          getStatusClasses(session.status)
                        )}
                      >
                        {getStatusLabel(session.status)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
                      <span className="font-mono font-semibold text-text-primary">{session.roomCode}</span>
                      <span>{session.quiz._count.questions} câu hỏi</span>
                      <span className="inline-flex items-center gap-1">
                        <UsersRound className="h-4 w-4" aria-hidden="true" />
                        {session._count.participants} học sinh
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-medium text-text-muted">
                      Tạo {formatDateTime(session.createdAt)} - Bắt đầu {formatDateTime(session.startedAt)} - Kết thúc{" "}
                      {formatDateTime(session.endedAt)}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
                    <Button onClick={() => navigate(action.to)} type="button" variant="secondary">
                      <ActionIcon className="h-4 w-4" aria-hidden="true" />
                      {action.label}
                    </Button>
                    <Button
                      aria-label={`Xóa phiên ${session.roomCode}`}
                      className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200 focus-visible:ring-red-500"
                      onClick={() =>
                        setDeleteTarget({
                          id: session.id,
                          roomCode: session.roomCode,
                          quizTitle: session.quiz.title,
                          status: session.status,
                          participantCount: session._count.participants
                        })
                      }
                      type="button"
                      variant="secondary"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Xóa
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {!sessionsQuery.isLoading && sessionsQuery.data && sessionsQuery.data.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <h2 className="text-base font-semibold text-text-primary">Chưa có phiên nào</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-secondary">
              Tạo phiên từ một đề thi để lịch sử làm bài và report xuất hiện tại đây.
            </p>
            <Button className="mt-4" onClick={() => navigate("/dashboard/quizzes")} type="button">
              Mở kho đề thi
            </Button>
          </div>
        ) : null}
      </Card>

      {deleteTarget ? (
        <DeleteSessionDialog
          isDeleting={deleteSessionMutation.isPending}
          onCancel={() => {
            if (!deleteSessionMutation.isPending) {
              setDeleteTarget(null);
            }
          }}
          onConfirm={() => void handleConfirmDelete()}
          target={deleteTarget}
        />
      ) : null}
    </div>
  );
}
