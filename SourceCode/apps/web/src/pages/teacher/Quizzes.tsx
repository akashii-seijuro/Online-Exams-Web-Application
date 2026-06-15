import { ArrowLeft, Edit3, Play, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { getApiErrorMessage } from "../../services/api";
import { useDeleteQuizMutation, useQuizzesQuery } from "../../services/queries/quizzes";
import { useCreateSessionMutation } from "../../services/queries/sessions";

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function QuizListSkeleton() {
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

type DeleteTarget = {
  id: string;
  title: string;
  sessionCount: number;
};

type DeleteQuizDialogProps = {
  target: DeleteTarget;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function DeleteQuizDialog({ target, isDeleting, onCancel, onConfirm }: DeleteQuizDialogProps) {
  const isBlocked = target.sessionCount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
      <div
        aria-describedby="delete-quiz-description"
        aria-labelledby="delete-quiz-title"
        aria-modal="true"
        className="w-full max-w-md rounded-lg bg-surface p-5 shadow-card"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p id="delete-quiz-title" className="text-lg font-semibold text-text-primary">
              Xóa đề thi?
            </p>
            <p id="delete-quiz-description" className="mt-2 text-sm leading-6 text-text-secondary">
              Đề thi <span className="font-semibold text-text-primary">"{target.title}"</span> sẽ bị xóa cùng các câu hỏi và đáp án
              liên quan.
            </p>
          </div>
          <Button
            aria-label="Đóng hộp thoại xóa đề thi"
            disabled={isDeleting}
            onClick={onCancel}
            size="icon"
            type="button"
            variant="secondary"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        {isBlocked ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
            Đề thi này đã có {target.sessionCount} phiên làm bài nên không thể xóa để bảo toàn dữ liệu lịch sử.
          </p>
        ) : (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            Hành động này không thể hoàn tác.
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button disabled={isDeleting} onClick={onCancel} type="button" variant="secondary">
            Hủy
          </Button>
          <Button
            className="border border-red-600 bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-500"
            disabled={isBlocked}
            isLoading={isDeleting}
            onClick={onConfirm}
            type="button"
          >
            {!isDeleting ? <Trash2 className="h-4 w-4" aria-hidden="true" /> : null}
            Xóa đề thi
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Quizzes() {
  const navigate = useNavigate();
  const quizzesQuery = useQuizzesQuery();
  const createSessionMutation = useCreateSessionMutation();
  const deleteQuizMutation = useDeleteQuizMutation();
  const [openSessionError, setOpenSessionError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  async function handleOpenSession(quizId: string) {
    try {
      setOpenSessionError(null);
      const session = await createSessionMutation.mutateAsync({ quizId });
      navigate(`/dashboard/session/${session.id}/lobby`);
    } catch (error) {
      toast.error("Không thể tạo phòng");
      setOpenSessionError(getApiErrorMessage(error, "Không thể tạo phòng cho đề thi này"));
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || deleteTarget.sessionCount > 0) {
      return;
    }

    try {
      await deleteQuizMutation.mutateAsync(deleteTarget.id);
      toast.success("Đã xóa đề thi");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể xóa đề thi này"));
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
            <p className="text-sm font-medium text-secondary">Kho đề thi</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-text-primary sm:text-3xl">
              Tất cả đề thi
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
              Quản lý toàn bộ đề thi đã tạo, mở phòng làm bài hoặc chỉnh sửa nội dung trước khi sử dụng.
            </p>
          </div>
        </div>

        <Button onClick={() => navigate("/dashboard/quiz/new")} size="lg" type="button">
          <Plus className="h-5 w-5" aria-hidden="true" />
          Tạo bài test mới
        </Button>
      </section>

      {quizzesQuery.isError ? (
        <Card className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Không thể tải danh sách đề thi</h2>
              <p className="mt-1 text-sm text-text-secondary">Kiểm tra kết nối và thử tải lại.</p>
            </div>
            <Button onClick={() => void quizzesQuery.refetch()} type="button" variant="secondary">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Thử lại
            </Button>
          </div>
        </Card>
      ) : null}

      {openSessionError ? <p className="text-sm font-medium text-danger">{openSessionError}</p> : null}

      <Card className="overflow-hidden">
        {quizzesQuery.isLoading ? <QuizListSkeleton /> : null}

        {!quizzesQuery.isLoading && quizzesQuery.data && quizzesQuery.data.length > 0 ? (
          <div className="divide-y divide-border">
            {quizzesQuery.data.map((quiz) => (
              <div
                key={quiz.id}
                className="flex w-full flex-col gap-4 px-5 py-4 transition duration-200 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-text-primary">{quiz.title}</p>
                  <p className="mt-1 truncate text-sm text-text-secondary">
                    {quiz.description ?? "Chưa có mô tả"} • {quiz._count.questions} câu hỏi • {quiz._count.sessions} phiên
                  </p>
                  <p className="mt-2 text-xs font-medium text-text-muted">Cập nhật {formatDate(quiz.updatedAt)}</p>
                </div>

                <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
                  <Button onClick={() => navigate(`/dashboard/quiz/${quiz.id}/edit`)} type="button" variant="secondary">
                    <Edit3 className="h-4 w-4" aria-hidden="true" />
                    Chỉnh sửa
                  </Button>
                  <Button
                    aria-label={`Xóa đề thi ${quiz.title}`}
                    className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200 focus-visible:ring-red-500"
                    onClick={() => setDeleteTarget({ id: quiz.id, title: quiz.title, sessionCount: quiz._count.sessions })}
                    title={
                      quiz._count.sessions > 0
                        ? "Không thể xóa đề thi đã có phiên làm bài"
                        : `Xóa đề thi ${quiz.title}`
                    }
                    type="button"
                    variant="secondary"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Xóa
                  </Button>
                  <Button
                    isLoading={createSessionMutation.isPending}
                    onClick={() => void handleOpenSession(quiz.id)}
                    type="button"
                    variant="secondary"
                  >
                    {!createSessionMutation.isPending ? <Play className="h-4 w-4" aria-hidden="true" /> : null}
                    Tạo phòng
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {!quizzesQuery.isLoading && quizzesQuery.data && quizzesQuery.data.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <h2 className="text-base font-semibold text-text-primary">Chưa có đề thi nào</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-secondary">
              Tạo đề đầu tiên để bắt đầu mở phòng làm bài cho học sinh.
            </p>
            <Button className="mt-4" onClick={() => navigate("/dashboard/quiz/new")} type="button">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Tạo bài test mới
            </Button>
          </div>
        ) : null}
      </Card>

      {deleteTarget ? (
        <DeleteQuizDialog
          isDeleting={deleteQuizMutation.isPending}
          onCancel={() => {
            if (!deleteQuizMutation.isPending) {
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
