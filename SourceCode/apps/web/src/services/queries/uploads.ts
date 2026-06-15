import { useMutation } from "@tanstack/react-query";

import type { ApiSuccess } from "../../types/auth";
import { api } from "../api";

type UploadImageResponse = {
  url: string;
};

export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post<ApiSuccess<UploadImageResponse>>("/upload/image", formData);

  return response.data.data.url;
}

export function useUploadImageMutation() {
  return useMutation({
    mutationFn: uploadImage
  });
}
