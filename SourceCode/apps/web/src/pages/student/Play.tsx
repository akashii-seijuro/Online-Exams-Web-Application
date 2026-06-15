import axios from "axios";
import { Send, Wifi, WifiOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "../../components/ui/Button";
import { RichTextDisplay } from "../../components/ui/RichTextDisplay";
import { Skeleton } from "../../components/ui/Skeleton";
import { useSocket } from "../../hooks/useSocket";
import { getApiErrorMessage } from "../../services/api";
import { usePlaySessionQuery, useSubmitPlayMutation } from "../../services/queries/student";
import { useSessionStore } from "../../stores/sessionStore";
import type { PlayQuestion, StudentAnswerValue, SubmitPlayResponse } from "../../types/session";
import { cn } from "../../utils/cn";

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function getDefaultAnswer(question: PlayQuestion): StudentAnswerValue {
  if (question.type === "MCQ") {
    return { kind: "MCQ", selectedOptionId: null };
  }

  if (question.type === "TRUE_FALSE") {
    return {
      kind: "TRUE_FALSE",
      choices: question.options.map((option) => ({
        optionId: option.id,
        choice: null
      }))
    };
  }

  return { kind: "SHORT_ANSWER", textAnswer: "" };
}

type AnswerInputProps = {
  answer: StudentAnswerValue;
  disabled: boolean;
  onChange: (answer: StudentAnswerValue) => void;
  question: PlayQuestion;
};

function AnswerInput({ answer, disabled, onChange, question }: AnswerInputProps) {
  if (question.type === "MCQ" && answer.kind === "MCQ") {
    return (
      <div className="space-y-3">
        {question.options.map((option) => {
          const selected = answer.selectedOptionId === option.id;

          return (
            <button
              key={option.id}
              className={cn(
                "w-full rounded-lg border p-4 text-left text-base font-semibold transition duration-200",
                "hover:border-indigo-300 hover:bg-indigo-50 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60",
                selected ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-border bg-white text-text-primary"
              )}
              disabled={disabled}
              onClick={() => onChange({ kind: "MCQ", selectedOptionId: option.id })}
              type="button"
            >
              <RichTextDisplay content={option.content} />
            </button>
          );
        })}
      </div>
    );
  }

  if (question.type === "TRUE_FALSE" && answer.kind === "TRUE_FALSE") {
    return (
      <div className="space-y-3">
        {question.options.map((option) => {
          const currentChoice = answer.choices.find((choice) => choice.optionId === option.id)?.choice ?? null;

          return (
            <div key={option.id} className="rounded-lg border border-border bg-white p-4">
              <RichTextDisplay className="text-sm font-semibold text-text-primary" content={option.content} />
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  { label: "Đúng", value: true },
                  { label: "Sai", value: false }
                ].map((choice) => (
                  <button
                    key={choice.label}
                    className={cn(
                      "h-11 rounded-lg border text-sm font-semibold transition duration-200",
                      "hover:border-indigo-300 hover:bg-indigo-50 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60",
                      currentChoice === choice.value
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                        : "border-border bg-white text-text-secondary"
                    )}
                    disabled={disabled}
                    onClick={() =>
                      onChange({
                        kind: "TRUE_FALSE",
                        choices: answer.choices.map((item) =>
                          item.optionId === option.id ? { ...item, choice: choice.value } : item
                        )
                      })
                    }
                    type="button"
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (question.type === "SHORT_ANSWER" && answer.kind === "SHORT_ANSWER") {
    return (
      <textarea
        className="min-h-32 w-full resize-none rounded-lg border border-border bg-white px-4 py-3 text-base text-text-primary outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
        disabled={disabled}
        maxLength={2000}
        onChange={(event) => onChange({ kind: "SHORT_ANSWER", textAnswer: event.target.value })}
        placeholder="Nhập câu trả lời"
        value={answer.textAnswer}
      />
    );
  }

  return null;
}

export function Play() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const participantToken = useSessionStore((state) => state.participantToken);
  const connectionStatus = useSessionStore((state) => state.connectionStatus);
  const answerDrafts = useSessionStore((state) => state.answerDrafts);
  const setAnswerDraft = useSessionStore((state) => state.setAnswerDraft);
  const setAnswerDrafts = useSessionStore((state) => state.setAnswerDrafts);
  const resetSession = useSessionStore((state) => state.resetSession);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [result, setResult] = useState<SubmitPlayResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const connectionToastRef = useRef(connectionStatus);

  const { emitStudentAnswer } = useSocket({
    clientType: "student",
    sessionId,
    onSessionEnded: () => setErrorMessage("Phiên thi đã kết thúc")
  });

  const playQuery = usePlaySessionQuery(sessionId, participantToken);
  const submitMutation = useSubmitPlayMutation(sessionId, participantToken);
  const questions = playQuery.data?.quiz.questions ?? [];
  const currentQuestion = questions[currentIndex];
  const currentAnswer = currentQuestion
    ? answerDrafts[currentQuestion.id] ?? getDefaultAnswer(currentQuestion)
    : null;

  useEffect(() => {
    if (!participantToken && sessionId) {
      navigate("/join", { replace: true });
    }
  }, [navigate, participantToken, sessionId]);

  useEffect(() => {
    if (!playQuery.error || !axios.isAxiosError(playQuery.error)) {
      return;
    }

    const status = playQuery.error.response?.status;
    const code = playQuery.error.response?.data?.error?.code;

    if (status === 401 || status === 410 || code === "SESSION_ENDED" || code === "TOKEN_EXPIRED") {
      resetSession();
      navigate("/join", { replace: true });
    }
  }, [navigate, playQuery.error, resetSession]);

  useEffect(() => {
    if (!playQuery.data) {
      return;
    }

    const drafts: Record<string, StudentAnswerValue> = {};
    for (const [questionId, draft] of Object.entries(playQuery.data.drafts)) {
      drafts[questionId] = draft.answer;
    }

    setAnswerDrafts({
      ...drafts,
      ...useSessionStore.getState().answerDrafts
    });
  }, [playQuery.data, setAnswerDrafts]);

  useEffect(() => {
    const session = playQuery.data?.session;

    if (!session?.startedAt || !session.timeLimit) {
      setRemainingSeconds(null);
      return undefined;
    }

    const timeLimit = session.timeLimit;
    const updateRemaining = () => {
      const elapsed = Math.floor((Date.now() - new Date(session.startedAt ?? "").getTime()) / 1000);
      setRemainingSeconds(Math.max(0, timeLimit - elapsed));
    };

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [playQuery.data?.session]);

  const handleSubmit = useCallback(async () => {
    if (!sessionId || !participantToken || submitMutation.isPending) {
      return;
    }

    try {
      setErrorMessage(null);
      const data = await submitMutation.mutateAsync({
        answers: answerDrafts,
        clientSubmittedAt: new Date().toISOString()
      });
      setResult(data);
      toast.success("Nộp bài thành công");
      navigate(`/play/${sessionId}/result`, { replace: true });
    } catch (error) {
      toast.error("Không thể nộp bài");
      setErrorMessage(getApiErrorMessage(error, "Không thể nộp bài, vui lòng thử lại"));
    }
  }, [answerDrafts, navigate, participantToken, sessionId, submitMutation]);

  useEffect(() => {
    if (connectionToastRef.current === connectionStatus) {
      return;
    }

    if (connectionStatus === "disconnected" || connectionStatus === "error") {
      toast.warning("Mất kết nối, bài làm vẫn được lưu tạm");
    }

    if (connectionStatus === "connected" && connectionToastRef.current !== "connecting") {
      toast.success("Realtime đã kết nối lại");
    }

    connectionToastRef.current = connectionStatus;
  }, [connectionStatus]);

  useEffect(() => {
    if (remainingSeconds === 0 && !result && !submitMutation.isPending) {
      void handleSubmit();
    }
  }, [handleSubmit, remainingSeconds, result, submitMutation.isPending]);

  const answeredCount = useMemo(
    () =>
      questions.filter((question) => {
        const answer = answerDrafts[question.id];
        if (!answer) {
          return false;
        }

        if (answer.kind === "MCQ") {
          return Boolean(answer.selectedOptionId);
        }

        if (answer.kind === "TRUE_FALSE") {
          return answer.choices.some((choice) => choice.choice !== null);
        }

        return answer.textAnswer.trim().length > 0;
      }).length,
    [answerDrafts, questions]
  );

  const handleAnswerChange = (answer: StudentAnswerValue) => {
    if (!sessionId || !currentQuestion) {
      return;
    }

    setAnswerDraft(currentQuestion.id, answer);
    emitStudentAnswer({
      sessionId,
      questionId: currentQuestion.id,
      questionOrder: currentQuestion.order,
      totalQuestions: questions.length,
      answer
    });
  };

  if (result) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[480px] flex-col justify-center bg-neutral px-5 py-8">
        <section className="rounded-xl border border-border bg-surface p-6 text-center shadow-card">
          <p className="text-sm font-semibold text-success">Hoàn thành</p>
          {result.score !== null && result.maxScore !== null ? (
            <>
              <h1 className="mt-3 font-mono text-4xl font-bold text-text-primary">
                {result.score.toFixed(2)} / {result.maxScore.toFixed(2)}
              </h1>
              <p className="mt-3 text-sm text-text-secondary">
                Đúng {result.correctCount ?? 0}/{result.totalQuestions} câu
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm leading-6 text-text-secondary">
              Bài làm đã được nộp. Giáo viên chưa cho xem điểm sau khi nộp.
            </p>
          )}
          <Button className="mt-6 w-full" onClick={() => navigate("/join")} variant="secondary">
            Về màn hình tham gia
          </Button>
        </section>
      </main>
    );
  }

  if (playQuery.isLoading) {
    return (
      <main className="mx-auto min-h-screen max-w-[480px] bg-neutral px-4 py-5">
        <div className="sticky top-0 -mx-4 border-b border-border bg-neutral px-4 pb-4 pt-1">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-12 w-24" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="mt-3 h-2 w-full rounded-full" />
        </div>
        <section className="mt-6 rounded-xl border border-border bg-surface p-5 shadow-card">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-4 h-7 w-full" />
          <Skeleton className="mt-2 h-7 w-4/5" />
          <div className="mt-6 space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </section>
      </main>
    );
  }

  if (playQuery.isError || !currentQuestion || !playQuery.data) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[480px] flex-col justify-center bg-neutral px-5 py-8">
        <section className="rounded-xl border border-border bg-surface p-6 text-center shadow-card">
          <h1 className="text-xl font-semibold text-text-primary">Không thể tải bài làm</h1>
          <p className="mt-2 text-sm text-text-secondary">Vui lòng quay lại phòng chờ hoặc thử lại.</p>
          <Button className="mt-6 w-full" onClick={() => navigate("/join")} variant="secondary">
            Quay lại
          </Button>
        </section>
      </main>
    );
  }

  const progressPercent = Math.round(((currentIndex + 1) / questions.length) * 100);
  const timerWarning = remainingSeconds !== null && remainingSeconds < 30;

  return (
    <main className="mx-auto min-h-screen max-w-[480px] bg-neutral px-4 py-5">
      <div className="sticky top-0 z-10 -mx-4 border-b border-border bg-neutral/95 px-4 pb-4 pt-1 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div
            className={cn(
              "rounded-lg px-3 py-2 font-mono text-lg font-bold",
              timerWarning ? "animate-pulse bg-red-50 text-danger" : "bg-indigo-50 text-primary"
            )}
          >
            {remainingSeconds === null ? "--:--" : formatTime(remainingSeconds)}
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-text-primary">
              Câu {currentIndex + 1} / {questions.length}
            </p>
            <p className="text-xs text-text-secondary">{answeredCount} đã trả lời</p>
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-slate-200">
          <div className="h-2 rounded-full bg-primary transition-all duration-200" style={{ width: `${progressPercent}%` }} />
        </div>
        <div
          className={cn(
            "mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold",
            connectionStatus === "connected"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          )}
        >
          {connectionStatus === "connected" ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {connectionStatus === "connected" ? "Đã lưu realtime" : "Mất kết nối, đang thử lại"}
        </div>
      </div>

      <section className="mt-6 rounded-xl border border-border bg-surface p-5 shadow-card">
        <p className="text-xs font-semibold uppercase text-text-secondary">{playQuery.data.quiz.title}</p>
        <h1 className="mt-3 text-xl font-semibold leading-8 text-text-primary">
          <RichTextDisplay content={currentQuestion.content} />
        </h1>
        <div className="mt-5">
          <AnswerInput
            answer={currentAnswer ?? getDefaultAnswer(currentQuestion)}
            disabled={submitMutation.isPending || remainingSeconds === 0}
            onChange={handleAnswerChange}
            question={currentQuestion}
          />
        </div>
      </section>

      {errorMessage ? <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-danger">{errorMessage}</p> : null}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button
          disabled={currentIndex === 0 || submitMutation.isPending}
          onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
          size="lg"
          type="button"
          variant="secondary"
        >
          Trước
        </Button>
        <Button
          disabled={currentIndex === questions.length - 1 || submitMutation.isPending}
          onClick={() => setCurrentIndex((index) => Math.min(questions.length - 1, index + 1))}
          size="lg"
          type="button"
          variant="secondary"
        >
          Tiếp
        </Button>
      </div>

      <Button className="mt-3 w-full" isLoading={submitMutation.isPending} onClick={() => void handleSubmit()} size="lg">
        {!submitMutation.isPending ? <Send className="h-5 w-5" /> : null}
        Nộp bài
      </Button>
    </main>
  );
}
