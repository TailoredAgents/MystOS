import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../utils/cn";

const buttonVariants = {
  primary:
    "bg-primary-700 text-white shadow-soft hover:bg-primary-600 hover:shadow-float active:bg-primary-900 focus-visible:ring-offset-primary-900",
  secondary:
    "bg-sand-100 text-primary-800 border border-neutral-300/60 hover:bg-sand-200 hover:border-neutral-400 active:bg-sand-300 focus-visible:ring-offset-sand-100",
  ghost:
    "bg-transparent text-primary-800 hover:bg-sand-100/90 hover:text-primary-900 active:bg-sand-200/70 focus-visible:ring-offset-white"
} as const;

const buttonSizes = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-6 text-base",
  lg: "h-12 px-7 text-lg"
} as const;

const ringOffsetPresets = {
  light: "focus-visible:ring-offset-white",
  dark: "focus-visible:ring-offset-primary-900",
  sand: "focus-visible:ring-offset-sand-100",
  transparent: "focus-visible:ring-offset-transparent"
} as const;

const defaultRingOffset = {
  primary: "dark",
  secondary: "sand",
  ghost: "light"
} as const satisfies Record<keyof typeof buttonVariants, keyof typeof ringOffsetPresets>;

export type ButtonVariant = keyof typeof buttonVariants;
export type ButtonSize = keyof typeof buttonSizes;
export type ButtonTone = keyof typeof ringOffsetPresets;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
  tone?: ButtonTone;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", asChild = false, tone, ...props },
  ref
) {
  const Comp = asChild ? Slot : "button";
  const toneKey = tone ?? defaultRingOffset[variant];
  const ringOffsetClass = ringOffsetPresets[toneKey];

  return (
    <Comp
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill font-medium tracking-tight transition-colors transition-transform duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5 motion-safe:active:translate-y-0 disabled:pointer-events-none disabled:opacity-60 disabled:shadow-none disabled:hover:translate-y-0 disabled:focus-visible:translate-y-0 will-change-transform",
        buttonVariants[variant],
        buttonSizes[size],
        ringOffsetClass,
        className
      )}
      ref={ref as React.Ref<HTMLButtonElement>}
      {...props}
    />
  );
});
