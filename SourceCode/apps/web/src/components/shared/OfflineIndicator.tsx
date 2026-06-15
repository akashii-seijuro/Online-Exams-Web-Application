import { WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(() => !window.navigator.onLine);
  const wasOfflineRef = useRef(isOffline);

  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);

      if (!wasOfflineRef.current) {
        toast.warning("Mất kết nối, đang tự động thử lại...");
      }

      wasOfflineRef.current = true;
    };

    const handleOnline = () => {
      setIsOffline(false);

      if (wasOfflineRef.current) {
        toast.success("Đã kết nối lại");
      }

      wasOfflineRef.current = false;
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!isOffline) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-0 z-50 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-700 shadow-card">
      <span className="inline-flex items-center gap-2">
        <WifiOff className="h-4 w-4" aria-hidden="true" />
        Mất kết nối, đang tự động thử lại...
      </span>
    </div>
  );
}
