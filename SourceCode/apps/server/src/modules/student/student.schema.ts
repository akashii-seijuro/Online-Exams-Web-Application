import { z } from "zod";

export const roomCodeParamsSchema = z
  .object({
    roomCode: z
      .string()
      .trim()
      .min(6)
      .max(8)
      .transform((value) => value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
  })
  .strict();

export const joinSessionSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    studentCode: z.string().trim().max(40).optional().nullable()
  })
  .strict();

export const playSessionParamsSchema = z
  .object({
    sessionId: z.string().trim().min(1)
  })
  .strict();

const trueFalseChoiceSchema = z
  .object({
    optionId: z.string().trim().min(1),
    choice: z.boolean().nullable()
  })
  .strict();

export const studentAnswerSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("MCQ"),
      selectedOptionId: z.string().trim().min(1).nullable()
    })
    .strict(),
  z
    .object({
      kind: z.literal("TRUE_FALSE"),
      choices: z.array(trueFalseChoiceSchema).length(4)
    })
    .strict(),
  z
    .object({
      kind: z.literal("SHORT_ANSWER"),
      textAnswer: z.string().trim().max(2_000)
    })
    .strict()
]);

export const studentAnswerDraftSchema = z
  .object({
    sessionId: z.string().trim().min(1),
    questionId: z.string().trim().min(1),
    questionOrder: z.number().int().positive(),
    totalQuestions: z.number().int().positive(),
    answer: studentAnswerSchema
  })
  .strict();

export const submitPlaySchema = z
  .object({
    answers: z.record(z.string().trim().min(1), studentAnswerSchema),
    clientSubmittedAt: z.string().datetime().optional()
  })
  .strict();

export type JoinSessionInput = z.infer<typeof joinSessionSchema>;
export type StudentAnswerInput = z.infer<typeof studentAnswerSchema>;
export type StudentAnswerDraftInput = z.infer<typeof studentAnswerDraftSchema>;
export type SubmitPlayInput = z.infer<typeof submitPlaySchema>;
