import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, FileUp, Plus, RefreshCw, Save } from "lucide-react";
import { type ChangeEvent, useEffect, useRef } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { QuestionCard } from "../../components/teacher/QuestionCard";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { getApiErrorMessage } from "../../services/api";
import {
  useCreateQuizMutation,
  useImportPdfMutation,
  useQuizQuery,
  useUpdateQuizMutation
} from "../../services/queries/quizzes";
import {
  createDefaultQuestion,
  defaultQuizValues,
  quizFormSchema,
  type Quiz,
  type QuizFormValues
} from "../../types/quiz";
import { cn } from "../../utils/cn";

function normalizeQuizPayload(values: QuizFormValues): QuizFormValues {
  return {
    title: values.title.trim(),
    description: values.description?.trim() ?? "",
    questions: values.questions.map((question) => {
      return {
        ...question,
        content: question.content.trim(),
        imageUrl: question.imageUrl?.trim() ?? "",
        options: question.options.map((option) => ({
          content: option.content.trim(),
          isCorrect: question.type === "SHORT_ANSWER" ? true : option.isCorrect
        }))
      };
    })
  };
}

function mapQuizToFormValues(quiz: Quiz): QuizFormValues {
  return {
    title: quiz.title,
    description: quiz.description ?? "",
    questions: [...quiz.questions]
      .sort((left, right) => left.order - right.order)
      .map((question) => ({
        content: question.content,
        type: question.type,
        points: question.points,
        imageUrl: question.imageUrl ?? "",
        options: [...question.options]
          .sort((left, right) => left.order - right.order)
          .map((option) => ({
            content: option.content,
            isCorrect: question.type === "SHORT_ANSWER" ? true : option.isCorrect
          }))
      }))
  };
}

function QuizBuilderSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-40 rounded bg-slate-200" />
          <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <div className="h-11 rounded bg-slate-100" />
            <div className="h-11 rounded bg-slate-100" />
          </div>
        </div>
      </Card>
      {[0, 1].map((item) => (
        <Card key={item} className="p-5">
          <div className="animate-pulse space-y-3">
            <div className="h-5 w-36 rounded bg-slate-200" />
            <div className="h-24 rounded bg-slate-100" />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="h-10 rounded bg-slate-100" />
              <div className="h-10 rounded bg-slate-100" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function QuizBuilder() {
  const navigate = useNavigate();
  const { quizId } = useParams();
  const isEditing = Boolean(quizId);
  const loadedQuizIdRef = useRef<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const createQuizMutation = useCreateQuizMutation();
  const importPdfMutation = useImportPdfMutation();
  const updateQuizMutation = useUpdateQuizMutation(quizId ?? "");
  const quizQuery = useQuizQuery(quizId);

  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setError,
    setValue
  } = useForm<QuizFormValues>({
    defaultValues: defaultQuizValues,
    resolver: zodResolver(quizFormSchema)
  });

  const {
    fields: questionFields,
    append: appendQuestion,
    remove: removeQuestion
  } = useFieldArray({
    control,
    name: "questions"
  });

  useEffect(() => {
    if (!quizQuery.data || loadedQuizIdRef.current === quizQuery.data.id) {
      return;
    }

    reset(mapQuizToFormValues(quizQuery.data));
    loadedQuizIdRef.current = quizQuery.data.id;
  }, [quizQuery.data, reset]);

  const isSaving = isSubmitting || createQuizMutation.isPending || updateQuizMutation.isPending;
  const isLoadingEdit = isEditing && quizQuery.isLoading;
  const isImportingPdf = importPdfMutation.isPending;
  const submitLabel = isEditing ? "Lưu thay đổi" : "Lưu nháp";

  const handlePdfFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const questions = await importPdfMutation.mutateAsync(file);
      questions.forEach((question: QuizFormValues["questions"][number]) => appendQuestion(question));
      toast.success(`Đã import ${questions.length} câu hỏi từ PDF`);
    } catch (error) {
      toast.error("Không thể import PDF");
      setError("root", {
        message: getApiErrorMessage(error, "Không thể bóc tách file PDF. Vui lòng thử lại.")
      });
    } finally {
      event.target.value = "";
    }
  };

  const onSubmit = async (values: QuizFormValues) => {
    try {
      const payload = normalizeQuizPayload(values);

      if (isEditing) {
        await updateQuizMutation.mutateAsync(payload);
        toast.success("Cập nhật đề thi thành công");
      } else {
        await createQuizMutation.mutateAsync(payload);
        toast.success("Lưu Quiz thành công");
      }

      navigate("/dashboard");
    } catch (error) {
      toast.error(isEditing ? "Không thể cập nhật đề thi" : "Không thể lưu Quiz");
      setError("root", {
        message: getApiErrorMessage(error, "Không thể lưu đề thi. Vui lòng thử lại.")
      });
    }
  };

  if (isEditing && quizQuery.isError) {
    return (
      <div className="space-y-6">
        <Button onClick={() => navigate("/dashboard")} type="button" variant="secondary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Quay lại dashboard
        </Button>
        <Card className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-text-primary">Không thể tải đề thi</h1>
              <p className="mt-1 text-sm text-text-secondary">
                Đề thi có thể không tồn tại, không thuộc tài khoản này hoặc kết nối đang gián đoạn.
              </p>
            </div>
            <Button onClick={() => void quizQuery.refetch()} type="button" variant="secondary">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Thử lại
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
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
            <p className="text-sm font-medium text-secondary">Quiz Builder</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-text-primary sm:text-3xl">
              {isEditing ? "Chỉnh sửa đề thi" : "Tạo bài test mới"}
            </h1>
          </div>
        </div>

        <Button disabled={isLoadingEdit} isLoading={isSaving} size="lg" type="submit">
          {!isSaving ? <Save className="h-5 w-5" aria-hidden="true" /> : null}
          {submitLabel}
        </Button>
      </section>

      {isLoadingEdit ? <QuizBuilderSkeleton /> : null}

      {!isLoadingEdit ? (
        <>
          <Card className="p-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
              <label className="block">
                <span className="text-sm font-medium text-text-primary">Tiêu đề</span>
                <input
                  className={cn(
                    "mt-2 h-11 w-full rounded-lg border bg-surface px-3 text-sm text-text-primary shadow-sm transition",
                    "placeholder:text-text-muted hover:border-slate-300 focus:border-primary focus:outline-none focus:ring-2 focus:ring-indigo-500",
                    errors.title && "border-red-300 focus:border-red-500 focus:ring-red-500"
                  )}
                  placeholder="Ví dụ: Ôn tập đạo hàm 10 phút"
                  type="text"
                  {...register("title")}
                />
                {errors.title?.message ? (
                  <span className="mt-1 block text-sm text-red-600">{errors.title.message}</span>
                ) : null}
              </label>

              <label className="block">
                <span className="text-sm font-medium text-text-primary">Mô tả</span>
                <input
                  className={cn(
                    "mt-2 h-11 w-full rounded-lg border bg-surface px-3 text-sm text-text-primary shadow-sm transition",
                    "placeholder:text-text-muted hover:border-slate-300 focus:border-primary focus:outline-none focus:ring-2 focus:ring-indigo-500",
                    errors.description && "border-red-300 focus:border-red-500 focus:ring-red-500"
                  )}
                  placeholder="Ghi chú ngắn cho giáo viên"
                  type="text"
                  {...register("description")}
                />
                {errors.description?.message ? (
                  <span className="mt-1 block text-sm text-red-600">{errors.description.message}</span>
                ) : null}
              </label>
            </div>
          </Card>

          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-text-primary">Câu hỏi</h2>
                {errors.questions?.message ? (
                  <p className="mt-1 text-sm text-red-600">{errors.questions.message}</p>
                ) : (
                  <p className="mt-1 text-sm text-text-secondary">{questionFields.length} câu trong đề thi này</p>
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  ref={pdfInputRef}
                  accept="application/pdf"
                  className="hidden"
                  onChange={(event) => void handlePdfFileChange(event)}
                  type="file"
                />
                <Button
                  disabled={isImportingPdf}
                  isLoading={isImportingPdf}
                  onClick={() => pdfInputRef.current?.click()}
                  type="button"
                  variant="secondary"
                >
                  {!isImportingPdf ? <FileUp className="h-4 w-4" aria-hidden="true" /> : null}
                  Import từ PDF
                </Button>
                <Button onClick={() => appendQuestion(createDefaultQuestion())} type="button" variant="secondary">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Thêm câu hỏi
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {questionFields.map((field, questionIndex) => (
                <QuestionCard
                  key={field.id}
                  canRemove={questionFields.length > 1}
                  control={control}
                  errors={errors}
                  onRemoveQuestion={() => removeQuestion(questionIndex)}
                  questionIndex={questionIndex}
                  register={register}
                  setValue={setValue}
                />
              ))}
            </div>
          </section>
        </>
      ) : null}

      {errors.root?.message ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errors.root.message}
        </div>
      ) : null}

      <div className="sticky bottom-4 flex justify-end">
        <Button className="shadow-hover" disabled={isLoadingEdit} isLoading={isSaving} size="lg" type="submit">
          {!isSaving ? <Save className="h-5 w-5" aria-hidden="true" /> : null}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
