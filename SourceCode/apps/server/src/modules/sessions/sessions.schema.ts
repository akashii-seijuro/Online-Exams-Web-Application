import { z } from "zod";

export const sessionStatusSchema = z.enum(["WAITING", "ACTIVE", "ENDED"]);

export const createSessionSchema = z
  .object({
    quizId: z.string().trim().min(1),
    timeLimit: z.coerce.number().int().positive().max(24 * 60 * 60).optional().nullable(),
    showScore: z.boolean().optional(),
    showAnswers: z.boolean().optional()
  })
  .strict();

export const updateSessionSettingsSchema = z
  .object({
    timeLimit: z.coerce.number().int().positive().max(24 * 60 * 60).optional().nullable(),
    showScore: z.boolean(),
    showAnswers: z.boolean()
  })
  .strict();

export const sessionParamsSchema = z
  .object({
    id: z.string().trim().min(1)
  })
  .strict();

export const listSessionsQuerySchema = z
  .object({
    status: sessionStatusSchema.optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50)
  })
  .strict();

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateSessionSettingsInput = z.infer<typeof updateSessionSettingsSchema>;
export type ListSessionsQuery = z.infer<typeof listSessionsQuerySchema>;
