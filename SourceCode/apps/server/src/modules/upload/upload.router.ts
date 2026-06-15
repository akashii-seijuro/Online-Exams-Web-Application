import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";

import { requireTeacher } from "../../shared/middleware/auth.middleware.js";
import { AppError } from "../../shared/middleware/error.middleware.js";
import { uploadImageController } from "./upload.controller.js";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const allowedImageMimeTypes = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
    files: 1
  },
  fileFilter(_req, file, callback) {
    if (!allowedImageMimeTypes.has(file.mimetype)) {
      callback(new AppError("UPLOAD_INVALID_FILE_TYPE", "Chỉ hỗ trợ ảnh PNG, JPG, JPEG hoặc WEBP", 400));
      return;
    }

    callback(null, true);
  }
});

export const uploadRouter = Router();

function normalizeUploadError(error: unknown) {
  if (!error) {
    return null;
  }

  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return new AppError("UPLOAD_FILE_TOO_LARGE", "Ảnh tải lên không được vượt quá 5MB", 413);
    }

    if (error.code === "LIMIT_UNEXPECTED_FILE" || error.code === "LIMIT_FILE_COUNT") {
      return new AppError("UPLOAD_INVALID_FILE", "Vui lòng gửi đúng một ảnh trong field file", 400);
    }

    return new AppError("UPLOAD_INVALID_FILE", "Tệp tải lên không hợp lệ", 400, { code: error.code });
  }

  return error;
}

function uploadSingleImage(req: Request, res: Response, next: NextFunction) {
  imageUpload.single("file")(req, res, (error: unknown) => {
    next(normalizeUploadError(error));
  });
}

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res).catch(next);
  };
}

uploadRouter.use(requireTeacher);

uploadRouter.post("/image", uploadSingleImage, asyncHandler(uploadImageController));
