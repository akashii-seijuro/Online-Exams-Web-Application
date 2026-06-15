import { Home } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "../components/ui/Button";

export function NotFound() {
  const location = useLocation();
  const navigate = useNavigate();
  const isStudentRoute = location.pathname.startsWith("/join") || location.pathname.startsWith("/play");
  const homePath = isStudentRoute ? "/join" : "/dashboard";

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral px-5 py-10">
      <section className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 text-center shadow-card">
        <p className="font-mono text-5xl font-bold text-primary">404</p>
        <h1 className="mt-4 text-2xl font-semibold text-text-primary">Không tìm thấy trang</h1>
        <p className="mt-3 text-sm leading-6 text-text-secondary">
          Đường dẫn bạn nhập không tồn tại hoặc đã được di chuyển.
        </p>
        <Button className="mt-6" onClick={() => navigate(homePath)} type="button">
          <Home className="h-4 w-4" aria-hidden="true" />
          Quay lại trang chủ
        </Button>
      </section>
    </main>
  );
}
