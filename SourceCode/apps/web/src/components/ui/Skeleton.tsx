import { cn } from "../../utils/cn";

type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("animate-pulse rounded-lg bg-slate-200", className)} aria-hidden="true" />;
}
