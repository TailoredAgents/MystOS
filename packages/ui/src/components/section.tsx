import * as React from "react";
import { cn } from "../utils/cn";

export type SectionProps = React.PropsWithChildren<React.HTMLAttributes<HTMLElement>> & {
  containerClassName?: string;
  bleed?: boolean;
};

export function Section({
  children,
  className,
  containerClassName,
  bleed = false,
  ...props
}: SectionProps) {
  return (
    <section className={cn("py-20 md:py-28", className)} {...props}>
      <div
        className={cn(
          "mx-auto flex w-full flex-col gap-12",
          bleed ? "px-6 md:px-10" : "max-w-6xl px-6 md:px-10",
          containerClassName
        )}
      >
        {children}
      </div>
    </section>
  );
}


