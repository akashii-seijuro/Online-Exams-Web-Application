import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "../ui/Button";

type GlobalErrorBoundaryProps = {
  children: ReactNode;
};

type GlobalErrorBoundaryState = {
  hasError: boolean;
};

export class GlobalErrorBoundary extends Component<GlobalErrorBoundaryProps, GlobalErrorBoundaryState> {
  state: GlobalErrorBoundaryState = {
    hasError: false
  };

  static getDerivedStateFromError(): GlobalErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    // Reserved for production error tracking integration.
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.assign("/");
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral px-5 py-10">
        <section className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 text-center shadow-card">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-red-50 text-danger">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-text-primary">Đã có lỗi xảy ra</h1>
          <p className="mt-3 text-sm leading-6 text-text-secondary">
            Vui lòng tải lại trang. Nếu lỗi vẫn tiếp diễn, hãy quay lại trang chủ và thử lại thao tác.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button onClick={this.handleReload} type="button">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Tải lại trang
            </Button>
            <Button onClick={this.handleGoHome} type="button" variant="secondary">
              <Home className="h-4 w-4" aria-hidden="true" />
              Quay lại trang chủ
            </Button>
          </div>
        </section>
      </main>
    );
  }
}
