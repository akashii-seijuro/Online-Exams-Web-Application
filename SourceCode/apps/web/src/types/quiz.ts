import { z } from "zod";

export type QuestionType = "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER";

export type QuizOption = {
  id: string;
  content: string;
  isCorrect: boolean;
  order: number;
};

export type QuizQuestion = {
  id: string;
  content: string;
  type: QuestionType;
  points: number;
  order: number;
  imageUrl: string | null;
  options: QuizOption[];
};

export type Quiz = {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  questions: QuizQuestion[];
};

export type QuizSummary = {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    questions: number;
    sessions: number;
  };
};

const optionSchema = z.object({
  content: z.string().trim().max(500, "Nội dung quá dài"),
  isCorrect: z.boolean()
});

export function normalizeTextForValidation(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

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
    content: z
      .string()
      .trim()
      .min(1, "Nội dung câu hỏi không được để trống")
      .max(2_000, "Câu hỏi quá dài"),
    type: z.enum(["MCQ", "TRUE_FALSE", "SHORT_ANSWER"]),
    points: z.coerce.number().positive("Điểm phải lớn hơn 0").max(100, "Điểm quá lớn"),
    imageUrl: z.string().trim().url("URL hình ảnh không hợp lệ").optional().or(z.literal("")),
    options: z.array(optionSchema)
  })
  .superRefine((question, ctx) => {
    if (question.type === "MCQ") {
      if (question.options.length < 2) {
        addOptionsIssue(ctx, "Cần tối thiểu 2 đáp án");
      }

      requireNonEmptyOptions(question.options, ctx, "Đáp án không được để trống");

      const correctCount = question.options.filter((option) => option.isCorrect).length;
      if (correctCount !== 1) {
        addOptionsIssue(ctx, "Cần chọn chính xác 1 đáp án đúng");
      }
    }

    if (question.type === "TRUE_FALSE") {
      if (question.options.length !== 4) {
        addOptionsIssue(ctx, "Câu Đúng/Sai cần đúng 4 mệnh đề");
      }

      requireNonEmptyOptions(question.options, ctx, "Mệnh đề không được để trống");
    }

    if (question.type === "SHORT_ANSWER") {
      if (question.options.length < 1) {
        addOptionsIssue(ctx, "Cần ít nhất 1 đáp án chấp nhận được");
      }

      requireNonEmptyOptions(question.options, ctx, "Đáp án chấp nhận được không được để trống");

      if (question.options.some((option) => !option.isCorrect)) {
        addOptionsIssue(ctx, "Mọi đáp án chấp nhận được đều phải là đáp án đúng");
      }

      const seenAnswers = new Set<string>();
      question.options.forEach((option, optionIndex) => {
        const normalizedAnswer = normalizeTextForValidation(option.content);

        if (seenAnswers.has(normalizedAnswer)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Đáp án bị trùng sau khi chuẩn hóa",
            path: ["options", optionIndex, "content"]
          });
        }

        seenAnswers.add(normalizedAnswer);
      });
    }
  });

export const quizFormSchema = z.object({
  title: z.string().trim().min(1, "Tiêu đề không được để trống").max(160, "Tiêu đề quá dài"),
  description: z.string().trim().max(1_000, "Mô tả quá dài").optional(),
  questions: z.array(questionSchema).min(1, "Đề thi cần ít nhất 1 câu hỏi")
});

export type QuizFormValues = z.infer<typeof quizFormSchema>;

export function createMcqOptions(): QuizFormValues["questions"][number]["options"] {
  return [
    { content: "", isCorrect: true },
    { content: "", isCorrect: false },
    { content: "", isCorrect: false },
    { content: "", isCorrect: false }
  ];
}

export function createTrueFalseOptions(): QuizFormValues["questions"][number]["options"] {
  return [
    { content: "Mệnh đề a", isCorrect: true },
    { content: "Mệnh đề b", isCorrect: true },
    { content: "Mệnh đề c", isCorrect: true },
    { content: "Mệnh đề d", isCorrect: true }
  ];
}

export function createShortAnswerOptions(): QuizFormValues["questions"][number]["options"] {
  return [{ content: "", isCorrect: true }];
}

export function createDefaultQuestion(type: QuestionType = "MCQ"): QuizFormValues["questions"][number] {
  const optionFactories: Record<QuestionType, () => QuizFormValues["questions"][number]["options"]> = {
    MCQ: createMcqOptions,
    TRUE_FALSE: createTrueFalseOptions,
    SHORT_ANSWER: createShortAnswerOptions
  };

  return {
    content: "",
    type,
    points: 1,
    imageUrl: "",
    options: optionFactories[type]()
  };
}

export const defaultQuestion: QuizFormValues["questions"][number] = createDefaultQuestion();

export const defaultQuizValues: QuizFormValues = {
  title: "",
  description: "",
  questions: [createDefaultQuestion()]
};
