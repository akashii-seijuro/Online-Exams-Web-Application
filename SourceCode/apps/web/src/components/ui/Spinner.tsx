import { Loader2 } from "lucide-react";

import { cn } from "../../utils/cn";

type SpinnerSize = "sm" | "md" | "lg";

type SpinnerProps = {
  className?: string;
  size?: SpinnerSize;
};

const sizeClasses: Record<SpinnerSize, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6"
};

export function Spinner({ className, size = "md" }: SpinnerProps) {
  return <Loader2 className={cn("animate-spin", sizeClasses[size], className)} aria-hidden="true" />;
}
