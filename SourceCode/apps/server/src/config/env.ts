import "dotenv/config";
import { z } from "zod";

const unsafeSecretValues = new Set([
  "change_this_to_a_random_32_char_string",
  "change_this_to_another_random_string"
]);

function normalizeUrl(value: string) {
  return value.replace(/\/+$/, "");
}

const optionalSecretSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional()
);

const envSchema = z
  .object({
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    JWT_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    CLOUDINARY_CLOUD_NAME: optionalSecretSchema,
    CLOUDINARY_API_KEY: optionalSecretSchema,
    CLOUDINARY_API_SECRET: optionalSecretSchema,
    GEMINI_API_KEY: optionalSecretSchema,
    PORT: z.coerce.number().int().positive().default(3001),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    CLIENT_URL: z.string().url().default("http://127.0.0.1:3000").transform(normalizeUrl)
  })
  .superRefine((value, context) => {
    if (value.JWT_SECRET === value.JWT_REFRESH_SECRET) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "JWT_SECRET and JWT_REFRESH_SECRET must be different",
        path: ["JWT_REFRESH_SECRET"]
      });
    }

    if (value.NODE_ENV !== "production") {
      return;
    }

    if (!value.CLIENT_URL.startsWith("https://")) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CLIENT_URL must use HTTPS in production",
        path: ["CLIENT_URL"]
      });
    }

    if (unsafeSecretValues.has(value.JWT_SECRET)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "JWT_SECRET must be changed for production",
        path: ["JWT_SECRET"]
      });
    }

    if (unsafeSecretValues.has(value.JWT_REFRESH_SECRET)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "JWT_REFRESH_SECRET must be changed for production",
        path: ["JWT_REFRESH_SECRET"]
      });
    }
  });

export const env = envSchema.parse(process.env);
