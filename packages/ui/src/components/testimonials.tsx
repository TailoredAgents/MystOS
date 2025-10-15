import * as React from "react";
import { cn } from "../utils/cn";

export interface Testimonial {
  quote: string;
  name: string;
  location?: string;
  highlight?: boolean;
}

export interface TestimonialsProps extends React.HTMLAttributes<HTMLDivElement> {
  items: Testimonial[];
}

export function Testimonials({ items, className, ...props }: TestimonialsProps) {
  return (
    <div
      className={cn(
        "grid gap-6 md:grid-cols-2 lg:grid-cols-3",
        className
      )}
      {...props}
    >
      {items.map((testimonial) => (
        <article
          key={`${testimonial.name}-${testimonial.quote.slice(0, 16)}`}
          className={cn(
            "flex h-full flex-col gap-4 rounded-xl border border-neutral-300/50 bg-white p-6 shadow-soft",
            testimonial.highlight && "border-2 border-accent-500/60 shadow-float"
          )}
        >
          <p className="text-body text-neutral-700">"{testimonial.quote}"</p>
          <div className="mt-auto">
            <p className="text-sm font-semibold text-primary-800">{testimonial.name}</p>
            {testimonial.location ? (
              <p className="text-xs text-neutral-500">{testimonial.location}</p>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
