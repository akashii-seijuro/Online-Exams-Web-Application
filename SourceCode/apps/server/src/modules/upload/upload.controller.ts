import type { Request, Response } from "express";

import { AppError } from "../../shared/middleware/error.middleware.js";
import { uploadImageBuffer } from "./upload.service.js";

type MulterRequest = Request & {
  file?: Express.Multer.File;
};

export async function uploadImageController(req: Request, res: Response) {
  const file = (req as MulterRequest).file;

  if (!file) {
    throw new AppError("UPLOAD_FILE_REQUIRED", "Vui lòng gửi ảnh trong field file", 400);
  }

  const uploadedImage = await uploadImageBuffer(file.buffer);

  res.status(200).json({
    success: true,
    data: {
      url: uploadedImage.url
    }
  });
}
