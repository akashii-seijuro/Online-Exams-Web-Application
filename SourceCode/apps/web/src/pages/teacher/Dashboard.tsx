import { ArrowRight, BookOpen, CalendarDays, Edit3, Play, Plus, RefreshCw, UsersRound } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { getApiErrorMessage } from "../../services/api";
import { useDashboardSummaryQuery } from "../../services/queries/dashboard";
import { useCreateSessionMutation } from "../../services/queries/sessions";
import { useAuthStore } from "../../stores/authStore";

type StatItem = {
  label: string;
  value: number;
  icon: typeof CalendarDays;
  tone: string;
};

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function StatSkeleton() {
  return (
    <Card className="p-5">
      <div className="animate-pulse">
        <div className="h-4 w-28 rounded bg-slate-200" />
        <div className="mt-4 h-10 w-16 rounded bg-slate-200" />
      </div>
    </Card>
  );
}

function RecentQuizSkeleton() {
  return (
    <div className="space-y-1 px-5 py-4">
      <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const teacherName = user?.name ?? "Giáo viên";
  const { data: summary, isError, isLoading, refetch } = useDashboardSummaryQuery();
  const createSessionMutation = useCreateSessionMutation();
  const [openSessionError, setOpenSessionError] = useState<string | null>(null);

  async function handleOpenSession(quizId: string) {
    try {
      setOpenSessionError(null);
      const session = await createSessionMutation.mutateAsync({ quizId });
      navigate(`/dashboard/session/${session.id}/lobby`);
    } catch (error) {
      toast.error("Không thể mở phòng");
      setOpenSessionError(getApiErrorMessage(error, "Không thể mở phòng cho đề thi này"));
    }
  }

  const stats: StatItem[] = [
    {
      label: "Phiên đã tạo",
      value: summary?.sessionCount ?? 0,
      icon: CalendarDays,
      tone: "bg-indigo-50 text-primary"
    },
    {
      label: "Đề đã tạo",
      value: summary?.quizCount ?? 0,
      icon: BookOpen,
      tone: "bg-cyan-50 text-secondary"
    },
    {
      label: "Học sinh tham gia",
      value: summary?.studentCount ?? 0,
      icon: UsersRound,
      tone: "bg-emerald-50 text-success"
    }
  ];

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-secondary">Dashboard</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal text-text-primary sm:text-3xl">
            Xin chào, {teacherName}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
            Theo dõi dữ liệu lớp học, đề thi đã tạo và các phiên làm bài gần đây.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={() => navigate("/dashboard/sessions")} size="lg" type="button" variant="secondary">
            <CalendarDays className="h-5 w-5" aria-hidden="true" />
            Lịch sử phiên
          </Button>
          <Button onClick={() => navigate("/dashboard/quiz/new")} size="lg" type="button">
            <Plus className="h-5 w-5" aria-hidden="true" />
            Tạo bài test mới
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {isLoading
          ? [0, 1, 2].map((item) => <StatSkeleton key={item} />)
          : stats.map((stat) => {
              const Icon = stat.icon;

              return (
                <Card key={stat.label} className="p-5 transition duration-200 hover:shadow-hover">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-text-secondary">{stat.label}</p>
                      <p className="mt-3 font-mono text-4xl font-semibold text-text-primary">{stat.value}</p>
                    </div>
                    <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${stat.tone}`}>
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                  </div>
                </Card>
              );
            })}
      </section>

      {isError ? (
        <Card className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Không thể tải dữ liệu dashboard</h2>
              <p className="mt-1 text-sm text-text-secondary">Kiểm tra kết nối và thử tải lại.</p>
            </div>
            <Button onClick={() => void refetch()} type="button" variant="secondary">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Thử lại
            </Button>
          </div>
        </Card>
      ) : null}

      <section>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-text-primary">Đề thi gần đây</h2>
          <Button
            className="hidden sm:inline-flex"
            onClick={() => navigate("/dashboard/quizzes")}
            type="button"
            variant="secondary"
          >
            Xem tất cả
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        {openSessionError ? <p className="mb-3 text-sm font-medium text-danger">{openSessionError}</p> : null}

        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="divide-y divide-border">
              {[0, 1, 2].map((item) => (
                <RecentQuizSkeleton key={item} />
              ))}
            </div>
          ) : summary && summary.recentQuizzes.length > 0 ? (
            <div className="divide-y divide-border">
              {summary.recentQuizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className="flex w-full flex-col gap-4 px-5 py-4 text-left transition duration-200 hover:bg-slate-50 active:bg-slate-100 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-text-primary">{quiz.title}</p>
                    <p className="mt-1 truncate text-sm text-text-secondary">
                      {quiz.description ?? "Chưa có mô tả"} • {quiz._count.questions} câu hỏi • {quiz._count.sessions} phiên
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2 text-sm text-text-secondary sm:flex-row sm:items-center">
                    <span className="hidden sm:inline">{formatDate(quiz.updatedAt)}</span>
                    <Button onClick={() => navigate(`/dashboard/quiz/${quiz.id}/edit`)} type="button" variant="secondary">
                      <Edit3 className="h-4 w-4" aria-hidden="true" />
                      Chỉnh sửa
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
          ) : (
            <div className="px-5 py-8 text-center">
              <h3 className="text-base font-semibold text-text-primary">Chưa có đề thi nào</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-secondary">
                Tạo đề đầu tiên để dashboard bắt đầu hiển thị dữ liệu từ hệ thống.
              </p>
              <Button className="mt-4" onClick={() => navigate("/dashboard/quiz/new")} type="button">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Tạo bài test mới
              </Button>
            </div>
          )}
        </Card>

        <Button className="mt-3 w-full sm:hidden" onClick={() => navigate("/dashboard/quizzes")} type="button" variant="secondary">
          Xem tất cả
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </section>
    </div>
  );
}
