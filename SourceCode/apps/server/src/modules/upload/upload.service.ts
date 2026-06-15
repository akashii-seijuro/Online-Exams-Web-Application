import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import streamifier from "streamifier";

import { env } from "../../config/env.js";
import { AppError } from "../../shared/middleware/error.middleware.js";

export type UploadedImage = {
  url: string;
};

function configureCloudinary() {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new AppError(
      "UPLOAD_PROVIDER_NOT_CONFIGURED",
      "Chức năng upload ảnh chưa được cấu hình. Vui lòng thiết lập CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY và CLOUDINARY_API_SECRET.",
      503
    );
  }

  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET
  });
}

export function uploadImageBuffer(buffer: Buffer): Promise<UploadedImage> {
  if (buffer.length === 0) {
    throw new AppError("UPLOAD_FILE_REQUIRED", "Vui lòng chọn một tệp ảnh để tải lên", 400);
  }

  configureCloudinary();

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "classpulse-assets",
        resource_type: "image"
      },
      (error, result: UploadApiResponse | undefined) => {
        if (error || !result?.secure_url) {
          reject(new AppError("UPLOAD_FAILED", "Không thể tải ảnh lên Cloudinary", 502));
          return;
        }

        resolve({ url: result.secure_url });
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}
