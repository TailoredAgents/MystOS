'use client';

import * as React from "react";
import Image from "next/image";
import { cn } from "../utils/cn";

export interface BeforeAfterSliderProps extends React.HTMLAttributes<HTMLDivElement> {
  beforeImage: string;
  afterImage: string;
  alt: string;
  initialPosition?: number;
}

export function BeforeAfterSlider({
  beforeImage,
  afterImage,
  alt,
  initialPosition = 50,
  className,
  ...props
}: BeforeAfterSliderProps) {
  const [position, setPosition] = React.useState(initialPosition);

  const handlePointer = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPosition(Number(event.target.value));
  };

  return (
    <div className={cn("w-full", className)} {...props}>
      <div className="relative aspect-[16/9] overflow-hidden rounded-xl shadow-soft">
        <Image
          src={afterImage}
          alt={`${alt} after cleaning`}
          fill
          className="object-cover"
          sizes="(min-width: 768px) 640px, 100vw"
          priority={false}
        />
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${position}%` }}
          aria-hidden="true"
        >
          <Image
            src={beforeImage}
            alt={`${alt} before cleaning`}
            fill
            className="object-cover"
            sizes="(min-width: 768px) 640px, 100vw"
            priority={false}
          />
        </div>
        <div
          className="pointer-events-none absolute inset-y-0"
          style={{ left: `calc(${position}% - 1px)` }}
        >
          <div className="h-full w-0.5 bg-white/80 shadow-[0_0_12px_rgba(15,23,42,0.35)]" />
        </div>
        <div className="absolute inset-x-0 bottom-4 flex items-center justify-center">
          <label className="sr-only" htmlFor="before-after-slider">
            Compare before and after image
          </label>
          <input
            id="before-after-slider"
            type="range"
            min="0"
            max="100"
            step="1"
            value={position}
            onChange={handlePointer}
            className="w-11/12 accent-accent-500"
          />
        </div>
      </div>
      <div className="mt-3 flex justify-between text-xs uppercase tracking-[0.25em] text-neutral-500">
        <span>Before</span>
        <span>After</span>
      </div>
    </div>
  );
}

