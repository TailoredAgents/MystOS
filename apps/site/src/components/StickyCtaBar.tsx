'use client';

import Link from "next/link";
import { Button, cn } from "@myst-os/ui";

interface StickyCtaBarProps {
  className?: string;
}

export function StickyCtaBar({ className }: StickyCtaBarProps) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t border-neutral-300/50 bg-white/95 px-4 py-3 shadow-[0_-10px_24px_rgba(15,23,42,0.10)] md:hidden",
        className
      )}
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <Button asChild variant="ghost" className="flex-1 rounded-md border border-neutral-300/70">
          <a href="tel:17705550110">Call</a>
        </Button>
        <Button asChild variant="ghost" className="flex-1 rounded-md border border-neutral-300/70">
          <a href="sms:17705550110">Text</a>
        </Button>
        <Button asChild className="flex-1 rounded-md">
          <Link href="#schedule-estimate">Schedule Estimate</Link>
        </Button>
      </div>
    </div>
  );
}

