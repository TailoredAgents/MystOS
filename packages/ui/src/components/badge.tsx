import * as React from "react";
import { cn } from "../utils/cn";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: "default" | "highlight" | "neutral";
}

const toneClasses = {
  default: "bg-accent-500/15 text-accent-600 ring-1 ring-accent-500/30",
  highlight: "bg-primary-800 text-sand-100 ring-0",
  neutral: "bg-neutral-100 text-neutral-700 ring-1 ring-neutral-300/60"
} as const;

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, tone = "default", ...props },
  ref
) {
  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-pill px-3 py-1 text-overline font-medium uppercase tracking-[0.18em]",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
});

