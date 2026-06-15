import { ImagePlus, Plus, Trash2 } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import {
  useFieldArray,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue
} from "react-hook-form";

import {
  createDefaultQuestion,
  type QuestionType,
  type QuizFormValues
} from "../../types/quiz";
import { getApiErrorMessage } from "../../services/api";
import { useUploadImageMutation } from "../../services/queries/uploads";
import { cn } from "../../utils/cn";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { RichTextDisplay } from "../ui/RichTextDisplay";

type QuestionCardProps = {
  control: Control<QuizFormValues>;
  errors: FieldErrors<QuizFormValues>;
  questionIndex: number;
  register: UseFormRegister<QuizFormValues>;
  setValue: UseFormSetValue<QuizFormValues>;
  canRemove: boolean;
  onRemoveQuestion: () => void;
};

const questionTypeLabels: Record<QuestionType, string> = {
  MCQ: "Trắc nghiệm 1 lựa chọn",
  TRUE_FALSE: "Đúng / Sai nhiều mệnh đề",
  SHORT_ANSWER: "Tự luận ngắn"
};

const trueFalseLabels = ["a", "b", "c", "d"];
const acceptedImageTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"] as const;
const acceptedImageTypeSet = new Set<string>(acceptedImageTypes);
const maxImageSizeBytes = 5 * 1024 * 1024;

const optionErrorMessage = (errors: FieldErrors<QuizFormValues>, questionIndex: number) => {
  const optionsError = errors.questions?.[questionIndex]?.options;

  if (!optionsError || Array.isArray(optionsError)) {
    return undefined;
  }

  return optionsError.message;
};

export function QuestionCard({
  control,
  errors,
  questionIndex,
  register,
  setValue,
  canRemove,
  onRemoveQuestion
}: QuestionCardProps) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [imageUploadError, setImageUploadError] = useState<string | undefined>();
  const uploadImageMutation = useUploadImageMutation();
  const questionType = useWatch({
    control,
    name: `questions.${questionIndex}.type`
  });
  const questionContent =
    useWatch({
      control,
      name: `questions.${questionIndex}.content`
    }) ?? "";
  const watchedOptions =
    useWatch({
      control,
      name: `questions.${questionIndex}.options`
    }) ?? [];
  const imageUrl =
    useWatch({
      control,
      name: `questions.${questionIndex}.imageUrl`
    }) ?? "";

  const {
    fields: optionFields,
    append: appendOption,
    remove: removeOption
  } = useFieldArray({
    control,
    name: `questions.${questionIndex}.options`
  });

  const questionErrors = errors.questions?.[questionIndex];
  const groupOptionError = optionErrorMessage(errors, questionIndex);

  const handleTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextType = event.target.value as QuestionType;
    const nextQuestion = createDefaultQuestion(nextType);

    setValue(`questions.${questionIndex}.type`, nextType, { shouldDirty: true, shouldValidate: true });
    setValue(`questions.${questionIndex}.options`, nextQuestion.options, {
      shouldDirty: true,
      shouldValidate: true
    });
  };

  const setMcqCorrectOption = (correctIndex: number) => {
    const nextOptions = watchedOptions.map((option, optionIndex) => ({
      content: option.content,
      isCorrect: optionIndex === correctIndex
    }));

    setValue(`questions.${questionIndex}.options`, nextOptions, {
      shouldDirty: true,
      shouldValidate: true
    });
  };

  const appendMcqOption = () => {
    appendOption({ content: "", isCorrect: false });
  };

  const appendShortAnswerOption = () => {
    appendOption({ content: "", isCorrect: true });
  };

  const openImagePicker = () => {
    imageInputRef.current?.click();
  };

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setImageUploadError(undefined);

    if (!acceptedImageTypeSet.has(file.type)) {
      setImageUploadError("Chỉ hỗ trợ ảnh PNG, JPG, JPEG hoặc WEBP.");
      return;
    }

    if (file.size > maxImageSizeBytes) {
      setImageUploadError("Ảnh cần nhỏ hơn hoặc bằng 5MB.");
      return;
    }

    try {
      const uploadedUrl = await uploadImageMutation.mutateAsync(file);
      setValue(`questions.${questionIndex}.imageUrl`, uploadedUrl, {
        shouldDirty: true,
        shouldValidate: true
      });
    } catch (error) {
      setImageUploadError(getApiErrorMessage(error, "Không thể upload ảnh. Vui lòng thử lại."));
    }
  };

  const removeImage = () => {
    setImageUploadError(undefined);
    setValue(`questions.${questionIndex}.imageUrl`, "", {
      shouldDirty: true,
      shouldValidate: true
    });

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  const optionContentError = (optionIndex: number) => questionErrors?.options?.[optionIndex]?.content?.message;
  const renderPreview = (content: string | undefined, className?: string) =>
    content?.trim() ? (
      <div className={cn("mt-2 rounded-lg border border-dashed border-border bg-slate-50 px-3 py-2", className)}>
        <RichTextDisplay className="text-sm text-text-secondary" content={content} />
      </div>
    ) : null;

  const renderMcqOptions = () => (
    <div className="mt-5">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-text-primary">Đáp án</h3>
          <p className="mt-1 text-sm text-text-secondary">Chọn chính xác một đáp án đúng.</p>
        </div>
        <Button onClick={appendMcqOption} type="button" variant="secondary">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Thêm đáp án
        </Button>
      </div>

      <div className="space-y-3" role="radiogroup" aria-label={`Đáp án đúng cho câu ${questionIndex + 1}`}>
        {optionFields.map((optionField, optionIndex) => {
          const optionError = optionContentError(optionIndex);
          const isCorrect = watchedOptions[optionIndex]?.isCorrect ?? false;

          return (
            <div key={optionField.id}>
              <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-text-primary transition hover:bg-slate-50 active:bg-slate-100">
                  <input
                    checked={isCorrect}
                    className="h-4 w-4 border-border text-primary focus:ring-2 focus:ring-indigo-500"
                    name={`question-${questionIndex}-mcq-correct`}
                    onChange={() => setMcqCorrectOption(optionIndex)}
                    type="radio"
                  />
                  Đúng
                </label>

                <input
                  className={cn(
                    "h-10 rounded-lg border bg-surface px-3 text-sm text-text-primary shadow-sm transition",
                    "placeholder:text-text-muted hover:border-slate-300 focus:border-primary focus:outline-none focus:ring-2 focus:ring-indigo-500",
                    optionError && "border-red-300 focus:border-red-500 focus:ring-red-500"
                  )}
                  placeholder={`Đáp án ${optionIndex + 1}`}
                  {...register(`questions.${questionIndex}.options.${optionIndex}.content`)}
                />

                <Button
                  aria-label={`Xóa đáp án ${optionIndex + 1}`}
                  className="border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200 focus-visible:ring-red-500"
                  disabled={optionFields.length <= 2}
                  onClick={() => removeOption(optionIndex)}
                  size="icon"
                  type="button"
                  variant="secondary"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
              {optionError ? <span className="mt-1 block text-sm text-red-600">{optionError}</span> : null}
              {renderPreview(watchedOptions[optionIndex]?.content)}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderTrueFalseOptions = () => (
    <div className="mt-5">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-text-primary">Mệnh đề Đúng/Sai</h3>
        <p className="mt-1 text-sm text-text-secondary">Thiết lập trạng thái đúng hoặc sai cho từng mệnh đề.</p>
      </div>

      <div className="space-y-3">
        {optionFields.map((optionField, optionIndex) => {
          const optionError = optionContentError(optionIndex);
          const isCorrect = watchedOptions[optionIndex]?.isCorrect ?? true;
          const label = trueFalseLabels[optionIndex] ?? String(optionIndex + 1);

          return (
            <div key={optionField.id}>
              <div className="grid gap-3 lg:grid-cols-[88px_1fr_auto] lg:items-center">
                <div className="font-mono text-sm font-semibold text-primary">Ý {label}</div>

                <input
                  className={cn(
                    "h-10 rounded-lg border bg-surface px-3 text-sm text-text-primary shadow-sm transition",
                    "placeholder:text-text-muted hover:border-slate-300 focus:border-primary focus:outline-none focus:ring-2 focus:ring-indigo-500",
                    optionError && "border-red-300 focus:border-red-500 focus:ring-red-500"
                  )}
                  placeholder={`Nội dung mệnh đề ${label}`}
                  {...register(`questions.${questionIndex}.options.${optionIndex}.content`)}
                />

                <div
                  className="grid h-10 grid-cols-2 rounded-lg border border-border bg-slate-50 p-1"
                  role="radiogroup"
                  aria-label={`Đáp án đúng sai cho mệnh đề ${label}`}
                >
                  <button
                    className={cn(
                      "rounded-md px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                      isCorrect ? "bg-emerald-500 text-white shadow-sm" : "text-text-secondary hover:bg-surface"
                    )}
                    onClick={() =>
                      setValue(`questions.${questionIndex}.options.${optionIndex}.isCorrect`, true, {
                        shouldDirty: true,
                        shouldValidate: true
                      })
                    }
                    type="button"
                  >
                    Đúng
                  </button>
                  <button
                    className={cn(
                      "rounded-md px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                      !isCorrect ? "bg-red-500 text-white shadow-sm" : "text-text-secondary hover:bg-surface"
                    )}
                    onClick={() =>
                      setValue(`questions.${questionIndex}.options.${optionIndex}.isCorrect`, false, {
                        shouldDirty: true,
                        shouldValidate: true
                      })
                    }
                    type="button"
                  >
                    Sai
                  </button>
                </div>
              </div>
              {optionError ? <span className="mt-1 block text-sm text-red-600">{optionError}</span> : null}
              {renderPreview(watchedOptions[optionIndex]?.content, "lg:ml-[88px]")}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderShortAnswerOptions = () => (
    <div className="mt-5">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-text-primary">Đáp án chấp nhận được</h3>
          <p className="mt-1 text-sm text-text-secondary">Hệ thống sẽ so khớp sau khi bỏ dấu, lowercase và chuẩn hóa khoảng trắng.</p>
        </div>
        <Button onClick={appendShortAnswerOption} type="button" variant="secondary">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Thêm đáp án
        </Button>
      </div>

      <div className="space-y-3">
        {optionFields.map((optionField, optionIndex) => {
          const optionError = optionContentError(optionIndex);

          return (
            <div key={optionField.id}>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <input
                  className={cn(
                    "h-10 rounded-lg border bg-surface px-3 text-sm text-text-primary shadow-sm transition",
                    "placeholder:text-text-muted hover:border-slate-300 focus:border-primary focus:outline-none focus:ring-2 focus:ring-indigo-500",
                    optionError && "border-red-300 focus:border-red-500 focus:ring-red-500"
                  )}
                  placeholder={`Đáp án chấp nhận được ${optionIndex + 1}`}
                  {...register(`questions.${questionIndex}.options.${optionIndex}.content`)}
                />

                <Button
                  aria-label={`Xóa đáp án chấp nhận được ${optionIndex + 1}`}
                  className="border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200 focus-visible:ring-red-500"
                  disabled={optionFields.length <= 1}
                  onClick={() => removeOption(optionIndex)}
                  size="icon"
                  type="button"
                  variant="secondary"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
              {optionError ? <span className="mt-1 block text-sm text-red-600">{optionError}</span> : null}
              {renderPreview(watchedOptions[optionIndex]?.content)}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <Card className="p-5 transition duration-200 hover:shadow-hover">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Câu {questionIndex + 1}</p>
          <p className="mt-1 text-sm text-text-secondary">Nhập nội dung, loại câu hỏi và điểm số.</p>
        </div>

        <Button
          aria-label={`Xóa câu ${questionIndex + 1}`}
          className="border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200 focus-visible:ring-red-500"
          disabled={!canRemove}
          onClick={onRemoveQuestion}
          size="md"
          type="button"
          variant="secondary"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Xóa câu
        </Button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_240px_120px]">
        <label className="block">
          <span className="text-sm font-medium text-text-primary">Nội dung câu hỏi</span>
          <textarea
            className={cn(
              "mt-2 min-h-28 w-full resize-y rounded-lg border bg-surface px-3 py-2 text-sm text-text-primary shadow-sm transition",
              "placeholder:text-text-muted hover:border-slate-300 focus:border-primary focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50",
              questionErrors?.content && "border-red-300 focus:border-red-500 focus:ring-red-500"
            )}
            placeholder="Ví dụ: Chọn đáp án đúng hoặc đánh giá các mệnh đề sau."
            {...register(`questions.${questionIndex}.content`)}
          />
          {questionErrors?.content?.message ? (
            <span className="mt-1 block text-sm text-red-600">{questionErrors.content.message}</span>
          ) : null}
          {renderPreview(questionContent)}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-text-primary">Loại câu hỏi</span>
          <select
            className="mt-2 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary shadow-sm transition hover:border-slate-300 focus:border-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={questionType}
            onChange={handleTypeChange}
          >
            {Object.entries(questionTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-text-primary">Điểm</span>
          <input
            className={cn(
              "mt-2 h-10 w-full rounded-lg border bg-surface px-3 text-sm text-text-primary shadow-sm transition",
              "hover:border-slate-300 focus:border-primary focus:outline-none focus:ring-2 focus:ring-indigo-500",
              questionErrors?.points && "border-red-300 focus:border-red-500 focus:ring-red-500"
            )}
            min="0.25"
            step="0.25"
            type="number"
            {...register(`questions.${questionIndex}.points`, { valueAsNumber: true })}
          />
          {questionErrors?.points?.message ? (
            <span className="mt-1 block text-sm text-red-600">{questionErrors.points.message}</span>
          ) : null}
        </label>
      </div>

      <div className="mt-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-sm font-medium text-text-primary">Hình ảnh câu hỏi</span>
            <p className="mt-1 text-sm text-text-secondary">PNG, JPG, JPEG hoặc WEBP. Tối đa 5MB.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={imageInputRef}
              accept={acceptedImageTypes.join(",")}
              className="sr-only"
              onChange={handleImageChange}
              type="file"
            />
            <Button
              aria-label={`Upload ảnh cho câu ${questionIndex + 1}`}
              isLoading={uploadImageMutation.isPending}
              onClick={openImagePicker}
              type="button"
              variant="secondary"
            >
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
              {imageUrl ? "Thay ảnh" : "Upload ảnh"}
            </Button>
            {imageUrl ? (
              <Button
                aria-label={`Xóa ảnh của câu ${questionIndex + 1}`}
                className="border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200 focus-visible:ring-red-500"
                disabled={uploadImageMutation.isPending}
                onClick={removeImage}
                type="button"
                variant="secondary"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Xóa ảnh
              </Button>
            ) : null}
          </div>
        </div>

        {imageUrl ? (
          <div className="mt-3 overflow-hidden rounded-lg border border-border bg-slate-50">
            <img
              alt={`Hình minh họa cho câu ${questionIndex + 1}`}
              className="max-h-72 w-full object-contain"
              src={imageUrl}
            />
          </div>
        ) : null}

        {imageUploadError ? <span className="mt-2 block text-sm text-red-600">{imageUploadError}</span> : null}
        {questionErrors?.imageUrl?.message ? (
          <span className="mt-1 block text-sm text-red-600">{questionErrors.imageUrl.message}</span>
        ) : null}
      </div>

      {questionType === "MCQ" ? renderMcqOptions() : null}
      {questionType === "TRUE_FALSE" ? renderTrueFalseOptions() : null}
      {questionType === "SHORT_ANSWER" ? renderShortAnswerOptions() : null}
      {groupOptionError ? <p className="mt-3 text-sm text-red-600">{groupOptionError}</p> : null}
    </Card>
  );
}
