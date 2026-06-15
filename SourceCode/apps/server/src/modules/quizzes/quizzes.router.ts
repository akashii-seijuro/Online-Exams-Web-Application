import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";

import { requireTeacher, type AuthenticatedRequest } from "../../shared/middleware/auth.middleware.js";
import { AppError } from "../../shared/middleware/error.middleware.js";
import { importPdfQuestions } from "./quizzes.importPdf.service.js";
import { quizParamsSchema, quizPayloadSchema } from "./quizzes.schema.js";
import {
  createQuiz,
  deleteQuiz,
  getQuizById,
  listQuizzes,
  quizzesServiceStatus,
  updateQuiz
} from "./quizzes.service.js";

export const quizzesRouter = Router();
const MAX_PDF_SIZE_BYTES = 15 * 1024 * 1024;

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_PDF_SIZE_BYTES,
    files: 1
  },
  fileFilter(_req, file, callback) {
    if (file.mimetype !== "application/pdf") {
      callback(new AppError("PDF_INVALID_FILE_TYPE", "Chỉ hỗ trợ file PDF", 400));
      return;
    }

    callback(null, true);
  }
});

function asyncHandler(handler: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

function getTeacherId(req: Request) {
  return (req as AuthenticatedRequest).user.id;
}

function normalizePdfUploadError(error: unknown) {
  if (!error) {
    return null;
  }

  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return new AppError("PDF_FILE_TOO_LARGE", "File PDF không được vượt quá 15MB", 413);
    }

    if (error.code === "LIMIT_UNEXPECTED_FILE" || error.code === "LIMIT_FILE_COUNT") {
      return new AppError("PDF_INVALID_UPLOAD", "Vui lòng gửi đúng một file PDF trong field file", 400);
    }

    return new AppError("PDF_INVALID_UPLOAD", "File PDF tải lên không hợp lệ", 400, { code: error.code });
  }

  return error;
}

function uploadSinglePdf(req: Request, res: Response, next: NextFunction) {
  pdfUpload.single("file")(req, res, (error: unknown) => {
    next(normalizePdfUploadError(error));
  });
}

quizzesRouter.use(requireTeacher);

quizzesRouter.get("/status", (_req, res) => {
  res.json({ success: true, data: quizzesServiceStatus() });
});

quizzesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const quizzes = await listQuizzes(getTeacherId(req));

    res.json({
      success: true,
      data: { quizzes }
    });
  })
);

quizzesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const quiz = await createQuiz(getTeacherId(req), quizPayloadSchema.parse(req.body));

    res.status(201).json({
      success: true,
      data: { quiz }
    });
  })
);

quizzesRouter.post(
  "/import-pdf",
  uploadSinglePdf,
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError("PDF_FILE_REQUIRED", "Vui lòng gửi file PDF trong field file", 400);
    }

    const questions = await importPdfQuestions(req.file);

    res.status(200).json({
      success: true,
      data: {
        questions
      }
    });
  })
);

quizzesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = quizParamsSchema.parse(req.params);
    const quiz = await getQuizById(getTeacherId(req), id);

    res.json({
      success: true,
      data: { quiz }
    });
  })
);

quizzesRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = quizParamsSchema.parse(req.params);
    const quiz = await updateQuiz(getTeacherId(req), id, quizPayloadSchema.parse(req.body));

    res.json({
      success: true,
      data: { quiz }
    });
  })
);

quizzesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = quizParamsSchema.parse(req.params);
    const result = await deleteQuiz(getTeacherId(req), id);

    res.json({
      success: true,
      data: result
    });
  })
);
