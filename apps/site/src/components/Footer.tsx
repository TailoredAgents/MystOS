﻿import Link from "next/link";
import { Button, Cta } from "@myst-os/ui";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-neutral-300/60 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-16 md:px-10">
        <Cta
          eyebrow="Book Today"
          title="Ready to see your exterior glow again?"
          description="Schedule an on-site estimate or call the crew now. We are standing by with premium service windows across North Metro Atlanta."
          primaryAction={
            <Button asChild>
              <Link href="#schedule-estimate">Schedule Estimate</Link>
            </Button>
          }
          secondaryAction={
            <Button variant="secondary" asChild>
              <a href="tel:14044453408">Call (404) 445-3408</a>
            </Button>
          }
        />
        <div className="mt-12 grid gap-6 text-sm text-neutral-500 md:grid-cols-3">
          <div>
            <p className="font-semibold text-neutral-700">Myst Pressure Washing</p>
            <p className="mt-2">
              Woodstock HQ - Serving Cherokee, Cobb, and North Fulton Counties
            </p>
          </div>
          <div>
            <p className="font-semibold text-neutral-700">Contact</p>
            <ul className="mt-2 space-y-1">
              <li>
                <a href="tel:14044453408" className="text-neutral-600 hover:text-primary-700">
                  (404) 445-3408
                </a>
              </li>
              <li>
                <a
                  href="sms:14044453408"
                  className="text-neutral-600 hover:text-primary-700"
                >
                  Text the crew
                </a>
              </li>
              <li>
                <a
                  href="mailto:Alex@MystWashing.com"
                  className="text-neutral-600 hover:text-primary-700"
                >
                  Alex@MystWashing.com
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-neutral-700">Hours</p>
            <p className="mt-2">Mon - Sat: 8:00 AM - 6:00 PM</p>
            <p>Sunday: On-call for emergencies</p>
          </div>
        </div>
        <p className="mt-12 text-xs text-neutral-400">
          Copyright {new Date().getFullYear()} Myst Pressure Washing. Licensed & insured. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

