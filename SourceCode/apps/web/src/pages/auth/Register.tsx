import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { api, getApiErrorMessage } from "../../services/api";
import { useAuthStore } from "../../stores/authStore";
import type { ApiSuccess, AuthResponse, RegisterFormValues } from "../../types/auth";
import { registerFormSchema } from "../../types/auth";
import { cn } from "../../utils/cn";

export function Register() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: ""
    }
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      const response = await api.post<ApiSuccess<AuthResponse>>("/auth/register", values);
      setAuth(response.data.data);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setFormError(getApiErrorMessage(error, "Không thể đăng ký. Vui lòng thử lại."));
    }
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral px-4 py-10">
      <Card className="w-full max-w-md p-6 shadow-card sm:p-8">
        <div className="mb-8">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-white shadow-qr">
            CP
          </div>
          <p className="text-sm font-medium text-secondary">Cổng giáo viên</p>
          <h1 className="mt-2 text-2xl font-semibold text-text-primary">Tạo tài khoản giáo viên</h1>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            Tạo tài khoản để bắt đầu quản lý bài test nhanh trên lớp.
          </p>
        </div>

        <form className="space-y-5" onSubmit={onSubmit} noValidate>
          <div>
            <label className="text-sm font-medium text-text-primary" htmlFor="name">
              Họ tên
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              className={cn(
                "mt-2 h-11 w-full rounded-lg border bg-surface px-3 text-sm text-text-primary outline-none transition",
                "hover:border-slate-300 focus:border-primary focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50",
                errors.name ? "border-danger" : "border-border"
              )}
              disabled={isSubmitting}
              {...register("name")}
            />
            {errors.name ? <p className="mt-2 text-sm text-danger">{errors.name.message}</p> : null}
          </div>

          <div>
            <label className="text-sm font-medium text-text-primary" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className={cn(
                "mt-2 h-11 w-full rounded-lg border bg-surface px-3 text-sm text-text-primary outline-none transition",
                "hover:border-slate-300 focus:border-primary focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50",
                errors.email ? "border-danger" : "border-border"
              )}
              disabled={isSubmitting}
              {...register("email")}
            />
            {errors.email ? <p className="mt-2 text-sm text-danger">{errors.email.message}</p> : null}
          </div>

          <div>
            <label className="text-sm font-medium text-text-primary" htmlFor="password">
              Mật khẩu
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              className={cn(
                "mt-2 h-11 w-full rounded-lg border bg-surface px-3 text-sm text-text-primary outline-none transition",
                "hover:border-slate-300 focus:border-primary focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50",
                errors.password ? "border-danger" : "border-border"
              )}
              disabled={isSubmitting}
              {...register("password")}
            />
            {errors.password ? <p className="mt-2 text-sm text-danger">{errors.password.message}</p> : null}
          </div>

          {formError ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{formError}</p> : null}

          <Button className="w-full" disabled={isSubmitting} size="lg" type="submit">
            {isSubmitting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <UserPlus className="h-5 w-5" aria-hidden="true" />
            )}
            Đăng ký
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-text-secondary">
          Đã có tài khoản?{" "}
          <Link
            className="font-semibold text-primary hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            to="/login"
          >
            Đăng nhập
          </Link>
        </p>
      </Card>
    </main>
  );
}
