import { z } from "zod";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: "TEACHER" | "ADMIN";
};

export type AuthResponse = {
  user: AuthUser;
  accessToken: string;
};

export type ApiSuccess<TData> = {
  success: true;
  data: TData;
};

export type ApiErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
};

export const loginFormSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email không hợp lệ"),
  password: z.string().min(8, "Mật khẩu cần tối thiểu 8 ký tự").max(128, "Mật khẩu quá dài")
});

export const registerFormSchema = z.object({
  name: z.string().trim().min(2, "Tên cần tối thiểu 2 ký tự").max(80, "Tên quá dài"),
  email: z.string().trim().toLowerCase().email("Email không hợp lệ"),
  password: z.string().min(8, "Mật khẩu cần tối thiểu 8 ký tự").max(128, "Mật khẩu quá dài")
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;
export type RegisterFormValues = z.infer<typeof registerFormSchema>;
