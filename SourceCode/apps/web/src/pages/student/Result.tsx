import axios from "axios";
import { CheckCircle2, ChevronDown, ChevronUp, RotateCcw, Trophy, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "../../components/ui/Button";
import { RichTextDisplay } from "../../components/ui/RichTextDisplay";
import { getApiErrorMessage } from "../../services/api";
import { useStudentResultQuery } from "../../services/queries/reports";
import { useSessionStore } from "../../stores/sessionStore";
import type { StudentReviewQuestion } from "../../types/session";
import { cn } from "../../utils/cn";

function formatScore(value: number | null) {
  return value === null ? "--" : value.toFixed(2);
}

function formatDuration(seconds: number | null) {
  if (seconds === null) {
    return "--";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}p ${remainingSeconds.toString().padStart(2, "0")}s`;
}

function formatBoolean(value: boolean | null) {
  if (value === null) {
    return "Chưa chọn";
  }

  return value ? "Đúng" : "Sai";
}

type ReviewQuestionCardProps = {
  question: StudentReviewQuestion;
  showAnswers: boolean;
};

function ReviewQuestionCard({ question, showAnswers }: ReviewQuestionCardProps) {
  return (
    <section
      className={cn(
        "rounded-xl border p-4 shadow-card",
        question.isCorrect ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
      )}
    >
      <div className="flex items-start gap-3">
        {question.isCorrect ? (
          <CheckCircle2 className="mt-1 h-5 w-5 flex-none text-emerald-600" aria-hidden="true" />
        ) : (
          <XCircle className="mt-1 h-5 w-5 flex-none text-danger" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-text-secondary">Câu {question.order+1}</p>
          <h3 className="mt-1 text-base font-semibold leading-7 text-text-primary">
            <RichTextDisplay content={question.content} />
          </h3>
          <p className="mt-2 font-mono text-sm font-bold text-text-primary">
            {formatScore(question.earnedPoints)} / {formatScore(question.points)} điểm
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-white/80 p-3 text-sm">
        <p className="font-semibold text-text-primary">Bài làm của bạn</p>
        {question.studentAnswer.kind === "MCQ" ? (
          question.studentAnswer.selectedOption ? (
            <RichTextDisplay className="mt-1 text-text-secondary" content={question.studentAnswer.selectedOption.content} />
          ) : (
            <p className="mt-1 text-text-secondary">Chưa chọn đáp án</p>
          )
        ) : null}
        {question.studentAnswer.kind === "TRUE_FALSE" ? (
          <div className="mt-2 space-y-2">
            {question.studentAnswer.choices.map((choice) => (
              <div key={choice.optionId} className="flex items-start justify-between gap-3">
                <RichTextDisplay className="text-text-secondary" content={choice.content} />
                <span className="font-semibold text-text-primary">{formatBoolean(choice.choice)}</span>
              </div>
            ))}
          </div>
        ) : null}
        {question.studentAnswer.kind === "SHORT_ANSWER" ? (
          question.studentAnswer.text ? (
            <RichTextDisplay className="mt-1 text-text-secondary" content={question.studentAnswer.text} />
          ) : (
            <p className="mt-1 text-text-secondary">Chưa nhập câu trả lời</p>
          )
        ) : null}
      </div>

      {showAnswers ? (
        <div className="mt-3 rounded-lg bg-white/80 p-3 text-sm">
          <p className="font-semibold text-text-primary">Đáp án đúng</p>
          {question.correctAnswer.kind === "MCQ" ? (
            question.correctAnswer.options.length > 0 ? (
              <RichTextDisplay
                className="mt-1 text-text-secondary"
                content={question.correctAnswer.options.map((option) => option.content).join(", ")}
              />
            ) : (
              <p className="mt-1 text-text-secondary">--</p>
            )
          ) : null}
          {question.correctAnswer.kind === "TRUE_FALSE" ? (
            <div className="mt-2 space-y-2">
              {question.correctAnswer.choices.map((choice) => (
                <div key={choice.optionId} className="flex items-start justify-between gap-3">
                  <RichTextDisplay className="text-text-secondary" content={choice.content} />
                  <span className="font-semibold text-text-primary">{formatBoolean(choice.correctChoice)}</span>
                </div>
              ))}
            </div>
          ) : null}
          {question.correctAnswer.kind === "SHORT_ANSWER" ? (
            question.correctAnswer.acceptedAnswers.length > 0 ? (
              <RichTextDisplay className="mt-1 text-text-secondary" content={question.correctAnswer.acceptedAnswers.join(", ")} />
            ) : (
              <p className="mt-1 text-text-secondary">--</p>
            )
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function Result() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const participantToken = useSessionStore((state) => state.participantToken);
  const resetSession = useSessionStore((state) => state.resetSession);
  const [showReview, setShowReview] = useState(false);
  const resultQuery = useStudentResultQuery(sessionId, participantToken);

  useEffect(() => {
    if (!participantToken && sessionId) {
      navigate("/join", { replace: true });
    }
  }, [navigate, participantToken, sessionId]);

  useEffect(() => {
    if (!resultQuery.error || !axios.isAxiosError(resultQuery.error)) {
      return;
    }

    const status = resultQuery.error.response?.status;
    const code = resultQuery.error.response?.data?.error?.code;

    if (status === 401 || code === "TOKEN_EXPIRED") {
      resetSession();
      navigate("/join", { replace: true });
      return;
    }

    if (code === "RESULT_NOT_READY" && sessionId) {
      navigate(`/play/${sessionId}`, { replace: true });
    }
  }, [navigate, resetSession, resultQuery.error, sessionId]);

  if (resultQuery.isLoading) {
    return (
      <main className="mx-auto min-h-screen max-w-[480px] bg-neutral px-4 py-6">
        <div className="h-[560px] animate-pulse rounded-xl bg-slate-100" />
      </main>
    );
  }

  if (resultQuery.isError || !resultQuery.data) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[480px] flex-col justify-center bg-neutral px-5 py-8">
        <section className="rounded-xl border border-border bg-surface p-6 text-center shadow-card">
          <h1 className="text-xl font-semibold text-text-primary">Không thể tải điểm</h1>
          <p className="mt-2 text-sm text-text-secondary">
            {getApiErrorMessage(resultQuery.error, "Vui lòng thử lại hoặc quay về màn hình tham gia.")}
          </p>
          <div className="mt-6 grid grid-cols-1 gap-3">
            <Button onClick={() => void resultQuery.refetch()} type="button" variant="secondary">
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Thử lại
            </Button>
            <Button onClick={() => navigate("/join")} type="button">
              Về màn hình tham gia
            </Button>
          </div>
        </section>
      </main>
    );
  }

  const data = resultQuery.data;
  const canShowScore = data.session.showScore && data.result.score !== null && data.result.maxScore !== null;
  const canShowReview = data.session.showAnswers && data.review.questions.length > 0;
  const percent =
    canShowScore && data.result.maxScore && data.result.maxScore > 0
      ? Math.round(((data.result.score ?? 0) / data.result.maxScore) * 100)
      : null;

  return (
    <main className="mx-auto min-h-screen max-w-[480px] bg-neutral px-4 py-6">
      <section className="animate-[fadeIn_200ms_ease-out] rounded-xl border border-border bg-surface p-6 text-center shadow-card">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-success">
          <Trophy className="h-8 w-8" aria-hidden="true" />
        </div>
        <p className="mt-5 text-sm font-semibold text-success">Hoàn thành</p>
        {canShowScore ? (
          <>
            <h1 className="mt-3 font-mono text-4xl font-bold text-text-primary">
              {formatScore(data.result.score)} / {formatScore(data.result.maxScore)}
            </h1>
            <p className="mt-2 text-sm text-text-secondary">{percent}% tổng điểm</p>
          </>
        ) : (
          <p className="mt-3 text-sm leading-6 text-text-secondary">
            Bài làm đã được ghi nhận. Giáo viên chưa cho xem điểm sau khi nộp.
          </p>
        )}

        {canShowScore ? (
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border bg-slate-50 p-3">
              <p className="font-mono text-xl font-bold text-text-primary">{data.result.correctCount ?? "--"}</p>
              <p className="mt-1 text-xs text-text-secondary">Đúng</p>
            </div>
            <div className="rounded-lg border border-border bg-slate-50 p-3">
              <p className="font-mono text-xl font-bold text-text-primary">
                {data.result.rank ? `#${data.result.rank}` : "--"}
              </p>
              <p className="mt-1 text-xs text-text-secondary">Hạng</p>
            </div>
            <div className="rounded-lg border border-border bg-slate-50 p-3">
              <p className="font-mono text-xl font-bold text-text-primary">{formatDuration(data.result.timeTaken)}</p>
              <p className="mt-1 text-xs text-text-secondary">Thời gian</p>
            </div>
          </div>
        ) : null}

        {canShowReview ? (
          <Button className="mt-6 w-full" onClick={() => setShowReview((value) => !value)} size="lg" type="button">
            {showReview ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            {showReview ? "Ẩn bài làm" : "Xem lại bài làm"}
          </Button>
        ) : (
          <p className="mt-6 rounded-lg bg-slate-50 px-4 py-3 text-sm text-text-secondary">
            Giáo viên chưa cho xem kết quả chi tiết sau khi nộp.
          </p>
        )}
      </section>

      {showReview && canShowReview ? (
        <div className="mt-5 space-y-4">
          {data.review.questions.map((question) => (
            <ReviewQuestionCard key={question.questionId} question={question} showAnswers={data.session.showAnswers} />
          ))}
        </div>
      ) : null}
    </main>
  );
}
