import { Bell, LogOut, Settings } from "lucide-react";
import { Outlet } from "react-router-dom";

import { useAuthStore } from "../../stores/authStore";
import { Button } from "../ui/Button";

function getInitials(name: string) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return initials || "GV";
}

export function TeacherLayout() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const initials = getInitials(user?.name ?? "Giáo viên");

  return (
    <div className="min-h-screen bg-neutral text-text-primary">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-base font-bold text-white shadow-qr">
              CP
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-text-primary">ClassPulse</p>
              <p className="truncate text-xs font-medium text-text-secondary">Cổng giáo viên</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button aria-label="Thông báo" size="icon" type="button" variant="secondary">
              <Bell className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button aria-label="Cài đặt" size="icon" type="button" variant="secondary">
              <Settings className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button aria-label="Đăng xuất" onClick={logout} size="icon" type="button" variant="secondary">
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </Button>
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-indigo-50 text-sm font-semibold text-primary">
              {initials}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
