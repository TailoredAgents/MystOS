import * as React from "react";
import { cn } from "../utils/cn";

export interface HeroProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  media?: React.ReactNode;
  align?: "left" | "center";
  variant?: "light" | "dark";
}

export function Hero({
  className,
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryAction,
  media,
  align = "left",
  variant = "light",
  ...props
}: HeroProps) {
  const isDark = variant === "dark";
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border border-neutral-200 shadow-soft",
        isDark
          ? "bg-primary-950 text-neutral-50"
          : "bg-gradient-to-br from-white via-neutral-50 to-neutral-100 text-neutral-900",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "relative z-10 mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:px-10 md:py-20",
          align === "center" && "text-center md:text-left"
        )}
      >
        <div className="flex flex-col justify-center gap-6 text-left">
          {eyebrow ? (
            <span
              className={cn(
                "text-overline uppercase tracking-[0.22em]",
                isDark ? "text-accent-200/80" : "text-accent-600"
              )}
            >
              {eyebrow}
            </span>
          ) : null}
          <h1
            className={cn(
              "font-display text-display leading-tight",
              isDark ? "text-neutral-50" : "text-primary-900"
            )}
          >
            {title}
          </h1>
          {description ? (
            <p
              className={cn(
                "max-w-xl text-body",
                isDark ? "text-neutral-100/80" : "text-neutral-600"
              )}
            >
              {description}
            </p>
          ) : null}
          {(primaryAction || secondaryAction) && (
            <div className="flex flex-col items-start gap-3 sm:flex-row">
              {primaryAction}
              {secondaryAction}
            </div>
          )}
        </div>
        {media ? (
          <div className="relative flex items-center justify-center">
            <div className="relative h-full w-full max-w-lg">{media}</div>
          </div>
        ) : null}
      </div>
      {isDark ? (
        <>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-900/40 via-primary-950/60 to-primary-950/70" />
          <div className="pointer-events-none absolute inset-y-0 right-[-15%] w-[45%] rounded-full bg-accent-500/15 blur-xl" />
        </>
      ) : (
        <>
          <div className="pointer-events-none absolute inset-x-[-20%] top-[-30%] h-[60%] rounded-full bg-accent-400/15 blur-xl" />
          <div className="pointer-events-none absolute inset-x-[-25%] bottom-[-35%] h-[55%] rounded-full bg-primary-200/15 blur-xl" />
        </>
      )}
    </section>
  );
}
