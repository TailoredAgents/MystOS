import * as React from "react";
import { cn } from "../utils/cn";

export interface StatProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string;
  secondary?: string;
}

export function Stat({ label, value, secondary, className, ...props }: StatProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-md border border-neutral-200 bg-white px-4 py-3 text-left shadow-soft sm:px-5 sm:py-4",
        className
      )}
      {...props}
    >
      <span className="text-label uppercase tracking-[0.28em] text-neutral-500">{label}</span>
      <span className="text-2xl font-semibold text-primary-800">{value}</span>
      {secondary ? <span className="text-sm text-neutral-500">{secondary}</span> : null}
    </div>
  );
}

