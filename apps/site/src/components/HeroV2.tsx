'use client';

import Image from "next/image";
import Link from "next/link";
import { useCallback } from "react";
import { Badge, Button, cn } from "@myst-os/ui";

const HERO_IMAGE = "/images/hero/crew-softwash.svg";
const HERO_IMAGE_SIZES = "(min-width: 1024px) 50vw, 100vw";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: Array<Record<string, unknown>>;
  }
}

type HeroCtaType = "schedule" | "call" | "text";

function trackHeroEvent(type: HeroCtaType) {
  try {
    if (typeof window === "undefined") {
      return;
    }

    const payload = {
      event_category: "hero",
      event_label: `hero_${type}_cta`
    };

    if (typeof window.gtag === "function") {
      window.gtag("event", "click", payload);
    } else if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event: "hero_cta_click", type, ...payload });
    }
  } catch (error) {
    console.warn("Hero CTA tracking failed", error);
  }
}

export function HeroV2({ className, variant = "lean" }: { className?: string; variant?: "lean" | "full" }) {
  const isLean = variant === "lean";
  const handleSchedule = useCallback(() => trackHeroEvent("schedule"), []);
  const handleCall = useCallback(() => trackHeroEvent("call"), []);
  const handleText = useCallback(() => trackHeroEvent("text"), []);

  return (
    <section className={cn("relative overflow-hidden rounded-3xl border border-neutral-300/40 bg-white shadow-float", className)}>
      <div className="absolute inset-0">
        <Image
          src={HERO_IMAGE}
          alt="Myst exterior cleaning crew soft-washing siding"
          fill
          priority
          sizes={HERO_IMAGE_SIZES}
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-white/95 via-white/85 to-[#e8f1ff]/80 backdrop-blur-[2px]" />
      </div>

      <div
        className={cn(
          "relative mx-auto items-center gap-10 px-6 py-12 md:px-12 md:py-16",
          isLean ? "grid max-w-5xl" : "grid max-w-6xl md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
        )}
      >
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-600">
              Premium Exterior Cleaning
            </p>
            <h1 className="font-display text-3xl leading-tight text-primary-900 sm:text-4xl">
              Pressure washing that protects your home and your weekend
            </h1>
            <p className="max-w-xl text-base text-neutral-700 sm:text-lg">
              On-site estimate in under 24 hours. Licensed & Insured. Serving Roswell, Alpharetta, Milton & nearby.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <Button asChild size="lg" className="shadow-soft" onClick={handleSchedule}>
              <Link href="#schedule-estimate">Get My Estimate</Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="border border-neutral-300/70" onClick={handleCall}>
              <a href="tel:17705550110">Call (770) 555-0110</a>
            </Button>
            {isLean ? null : (
              <Button asChild variant="ghost" size="lg" className="border border-neutral-300/70" onClick={handleText}>
                <a href="sms:17705550110">Text Us</a>
              </Button>
            )}
          </div>
          <p className="text-sm text-neutral-500">Takes ~60 seconds. We confirm your window by text.</p>

          {isLean ? (
            <p className="text-sm text-neutral-600">
              4.9 avg (1,247 reviews) • Licensed & Insured • Make-It-Right Guarantee
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              <Badge tone="highlight">4.9 avg (1,247 reviews)</Badge>
              <Badge tone="default">Licensed & Insured</Badge>
              <Badge tone="neutral">Make-It-Right Guarantee</Badge>
              <Badge tone="default">On-Site in &lt; 24 hrs</Badge>
            </div>
          )}
        </div>

        {isLean ? null : (
        <div className="hidden md:block">
          <div className="rounded-2xl border border-neutral-200/80 bg-white/90 p-6 shadow-soft backdrop-blur">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-700">
                  Why homeowners choose Myst
                </p>
                <h2 className="mt-2 text-xl font-semibold text-primary-900">
                  Trusted crews. Spotless finishes. Guaranteed.
                </h2>
              </div>
              <ul className="space-y-2 text-sm text-neutral-600">
                <li>- Soft-wash chemistry protects paint, siding, and landscaping.</li>
                <li>- Flexible arrival windows with proactive SMS updates.</li>
                <li>- Make-It-Right Guarantee: we fix issues within 48 hours.</li>
              </ul>
              <div className="rounded-lg bg-neutral-50 p-4 text-sm text-neutral-600">
                <p className="font-semibold text-neutral-700">&ldquo;Their crew was on time, communicative, and left everything spotless.&rdquo;</p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-neutral-500">Brianna S. - Woodstock</p>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>
    </section>
  );
}
