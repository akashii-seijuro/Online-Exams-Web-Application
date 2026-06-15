import { z } from "zod";

import { normalizeText } from "../../shared/utils/scoring.js";

const questionTypes = ["MCQ", "TRUE_FALSE", "SHORT_ANSWER"] as const;

const optionSchema = z
  .object({
    content: z.string().trim().min(1).max(500),
    isCorrect: z.boolean().default(false)
  })
  .strict();

function requireNonEmptyOptions(
  options: z.infer<typeof optionSchema>[],
  ctx: z.RefinementCtx,
  message: string
) {
  options.forEach((option, optionIndex) => {
    if (!option.content.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message,
        path: ["options", optionIndex, "content"]
      });
    }
  });
}

function addOptionsIssue(ctx: z.RefinementCtx, message: string) {
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message,
    path: ["options"]
  });
}

const questionSchema = z
  .object({
    content: z.string().trim().min(1).max(2_000),
    type: z.enum(questionTypes),
    points: z.coerce.number().positive().max(100).default(1),
    imageUrl: z.string().trim().url().max(2_000).optional().or(z.literal("")),
    options: z.array(optionSchema).default([])
  })
  .strict()
  .superRefine((question, ctx) => {
    if (question.type === "MCQ") {
      if (question.options.length < 2) {
        addOptionsIssue(ctx, "Câu hỏi MCQ cần tối thiểu 2 đáp án");
      }

      requireNonEmptyOptions(question.options, ctx, "Đáp án không được để trống");

      const correctCount = question.options.filter((option) => option.isCorrect).length;
      if (correctCount !== 1) {
        addOptionsIssue(ctx, "Câu hỏi MCQ cần chính xác 1 đáp án đúng");
      }
    }

    if (question.type === "TRUE_FALSE") {
      if (question.options.length !== 4) {
        addOptionsIssue(ctx, "Câu hỏi Đúng/Sai cần đúng 4 mệnh đề");
      }

      requireNonEmptyOptions(question.options, ctx, "Mệnh đề không được để trống");
    }

    if (question.type === "SHORT_ANSWER") {
      if (question.options.length < 1) {
        addOptionsIssue(ctx, "Câu hỏi tự luận ngắn cần ít nhất 1 đáp án chấp nhận được");
      }

      requireNonEmptyOptions(question.options, ctx, "Đáp án chấp nhận được không được để trống");

      if (question.options.some((option) => !option.isCorrect)) {
        addOptionsIssue(ctx, "Mọi đáp án chấp nhận được phải được đánh dấu đúng");
      }

      const seenAnswers = new Set<string>();
      question.options.forEach((option, optionIndex) => {
        const normalizedAnswer = normalizeText(option.content);

        if (seenAnswers.has(normalizedAnswer)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Đáp án chấp nhận được bị trùng sau khi chuẩn hóa",
            path: ["options", optionIndex, "content"]
          });
        }

        seenAnswers.add(normalizedAnswer);
      });
    }
  });

export const quizPayloadSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(1_000).optional().nullable(),
    questions: z.array(questionSchema).min(1).max(100)
  })
  .strict();

export const quizParamsSchema = z
  .object({
    id: z.string().min(1)
  })
  .strict();

export type QuizPayloadInput = z.infer<typeof quizPayloadSchema>;
export type CreateQuizInput = QuizPayloadInput;
export type UpdateQuizInput = QuizPayloadInput;
