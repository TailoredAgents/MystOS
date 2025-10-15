import Link from "next/link";
import type { Route } from "next";
import { Button } from "@myst-os/ui";

const navItems = [
  { href: "/services", label: "Services" },
  { href: "/areas", label: "Service Areas" },
  { href: "/pricing", label: "Pricing" },
  { href: "/reviews", label: "Reviews" },
  { href: "/gallery", label: "Gallery" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" }
] satisfies Array<{ href: Route; label: string }>;

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-neutral-300/50 bg-white/95">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 md:px-10">
        <Link href="/" className="flex items-center gap-2 text-primary-800">
          <span className="text-xl font-semibold tracking-tight">Myst Pressure Washing</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-neutral-600 transition hover:text-primary-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden md:flex">
          <Button asChild>
            <Link href="#schedule-estimate">Schedule Estimate</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

