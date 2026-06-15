import { GoogleGenAI, type Part } from "@google/genai";
import { z } from "zod";

import { env } from "../../config/env.js";
import { AppError } from "../../shared/middleware/error.middleware.js";
import { uploadImageBuffer } from "../upload/upload.service.js";
import { importPdfSystemPrompt } from "./quizzes.importPdf.prompt.js";
import { quizPayloadSchema, type CreateQuizInput } from "./quizzes.schema.js";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const allowedImageMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

const aiImageSchema = z
  .object({
    mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
    dataBase64: z.string().min(1),
    alt: z.string().max(500).optional()
  })
  .strict();

const aiOptionSchema = z
  .object({
    content: z.string().trim().min(1).max(500),
    isCorrect: z.boolean().default(false)
  })
  .strict();

const aiQuestionSchema = z
  .object({
    type: z.enum(["MCQ", "TRUE_FALSE", "SHORT_ANSWER"]).default("MCQ"),
    content: z.string().trim().min(1).max(2_000),
    points: z.coerce.number().positive().max(100).default(1),
    image: aiImageSchema.nullable().optional(),
    options: z.array(aiOptionSchema).min(1).max(10)
  })
  .strict();

const aiImportPdfResponseSchema = z
  .object({
    questions: z.array(aiQuestionSchema).min(1).max(100)
  })
  .strict();

type AiQuestion = z.infer<typeof aiQuestionSchema>;

export type ImportedPdfQuestion = CreateQuizInput["questions"][number];

let geminiClient: GoogleGenAI | null = null;

function getGeminiClient() {
  if (!env.GEMINI_API_KEY) {
    throw new AppError(
      "AI_IMPORT_NOT_CONFIGURED",
      "Chức năng import PDF bằng AI chưa được cấu hình. Vui lòng thiết lập GEMINI_API_KEY.",
      503
    );
  }

  geminiClient ??= new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

  return geminiClient;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Lỗi không xác định";
}

function parseJsonObject(value: string) {
  try {
    return JSON.parse(value.trim()) as unknown;
  } catch {
    const startIndex = value.indexOf('{');
    const endIndex = value.lastIndexOf('}');

    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      const extractedJson = value.slice(startIndex, endIndex + 1); 
      
      try {
        return JSON.parse(extractedJson) as unknown;
      } catch {
        throw new AppError("AI_IMPORT_INVALID_JSON", "Cấu trúc JSON bị hỏng (có thể do lỗi escape ký tự LaTeX)", 422);
      }
    }

    throw new AppError("AI_IMPORT_INVALID_JSON", "AI không trả về JSON hợp lệ", 422);
  }
}

function normalizeQuestionAnswers(question: AiQuestion): AiQuestion {
  if (question.type === "MCQ") {
    let correctSeen = false;

    return {
      ...question,
      options: question.options.map((option) => {
        const isCorrect = option.isCorrect && !correctSeen;
        correctSeen = correctSeen || isCorrect;

        return {
          ...option,
          isCorrect
        };
      }).map((option, optionIndex, options) => {
        if (options.some((candidate) => candidate.isCorrect)) {
          return option;
        }

        return {
          ...option,
          isCorrect: optionIndex === 0
        };
      })
    };
  }

  if (question.type === "SHORT_ANSWER") {
    return {
      ...question,
      options: question.options.map((option) => ({
        ...option,
        isCorrect: true
      }))
    };
  }

  return question;
}

function decodeBase64Image(dataBase64: string, mimeType: string) {
  if (!allowedImageMimeTypes.has(mimeType)) {
    throw new AppError("PDF_IMAGE_EXTRACTION_FAILED", "Ảnh trong PDF không đúng định dạng hỗ trợ", 422);
  }

  const normalized = dataBase64.replace(/^data:[^;]+;base64,/i, "").trim();
  const buffer = Buffer.from(normalized, "base64");

  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
    throw new AppError("PDF_IMAGE_EXTRACTION_FAILED", "Ảnh trong PDF bị rỗng hoặc vượt quá 5MB", 422);
  }

  return buffer;
}

async function mapQuestion(question: AiQuestion): Promise<ImportedPdfQuestion> {
  const normalizedQuestion = normalizeQuestionAnswers(question);
  let imageUrl = "";

  if (normalizedQuestion.image) {
    const imageBuffer = decodeBase64Image(normalizedQuestion.image.dataBase64, normalizedQuestion.image.mimeType);
    const uploadedImage = await uploadImageBuffer(imageBuffer);
    imageUrl = uploadedImage.url;
  }

  return {
    content: normalizedQuestion.content,
    type: normalizedQuestion.type,
    points: normalizedQuestion.points,
    imageUrl,
    options: normalizedQuestion.options.map((option) => ({
      content: option.content,
      isCorrect: option.isCorrect
    }))
  };
}

export async function importPdfQuestions(file: Express.Multer.File) {
  if (file.mimetype !== "application/pdf") {
    throw new AppError("PDF_INVALID_FILE_TYPE", "Chỉ hỗ trợ file PDF", 400);
  }

  const pdfPart: Part = {
    inlineData: {
      data: file.buffer.toString("base64"),
      mimeType: "application/pdf",
      //displayName: file.originalname
    }
  };

  const ai = getGeminiClient();
  const response = await ai.models
    .generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          text:
            "Hãy bóc tách file PDF này thành JSON questions theo schema đã được chỉ định. Chỉ trả JSON hợp lệ."
        },
        pdfPart
      ],
      config: {
        systemInstruction: importPdfSystemPrompt,
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 8192
      }
    })
    .catch((error) => {
      throw new AppError(
        "AI_IMPORT_FAILED", 
        `Lỗi từ AI: ${getErrorMessage(error)}`, 
        502
      );
    });

  const text = response.text;

  if (!text) {
    throw new AppError("AI_IMPORT_INVALID_JSON", "AI không trả về nội dung JSON", 422);
  }

  const parsed = aiImportPdfResponseSchema.safeParse(parseJsonObject(text));

  if (!parsed.success) {
    throw new AppError("AI_IMPORT_SCHEMA_MISMATCH", "Dữ liệu AI trả về không khớp cấu trúc câu hỏi", 422, {
      issues: parsed.error.flatten()
    });
  }

  const questions = await Promise.all(parsed.data.questions.map(mapQuestion));
  const finalPayload = quizPayloadSchema.parse({
    title: "Imported PDF",
    description: "",
    questions
  });

  return finalPayload.questions;
}
