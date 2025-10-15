import * as React from "react";
import { cn } from "../utils/cn";

export type CardProps = React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>> & {
  tone?: "elevated" | "outline" | "subtle";
};

const toneVariants = {
  elevated: "bg-white shadow-soft transition-transform hover:-translate-y-0.5 hover:shadow-float",
  outline: "bg-white border border-neutral-300/60",
  subtle: "bg-neutral-100"
} as const;

export function Card({ className, tone = "elevated", ...props }: CardProps) {
  return (
    <div
      className={cn("rounded-xl p-8 transition-all duration-300", toneVariants[tone], className)}
      {...props}
    />
  );
}


