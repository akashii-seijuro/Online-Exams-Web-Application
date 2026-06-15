import { z } from "zod";

export const reportSessionParamsSchema = z
  .object({
    sessionId: z.string().trim().min(1)
  })
  .strict();
