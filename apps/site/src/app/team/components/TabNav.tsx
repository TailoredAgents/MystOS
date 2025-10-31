"use client";

import React from "react";
import { cn } from "@myst-os/ui";
import { usePathname, useRouter } from "next/navigation";

type AccessRequirement = "owner" | "crew";

export interface TabNavItem {
  id: string;
  label: string;
  href: string;
  requires?: AccessRequirement;
}

export const teamTabTokens = {
  container:
    "hidden grid-cols-1 gap-2 rounded-2xl border border-slate-200/80 bg-white/80 p-2 shadow-sm shadow-slate-200/50 backdrop-blur supports-[backdrop-filter]:bg-white/60 sm:auto-cols-fr sm:grid-flow-col sm:grid-cols-none sm:grid sm:sticky sm:top-4 sm:z-30",
  item: {
    base:
      "relative flex min-h-[44px] items-center justify-center rounded-xl border border-transparent px-4 py-2 text-sm font-medium leading-tight transition duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
    active:
      "border-primary-200 bg-white text-primary-700 shadow-[0_10px_24px_rgba(15,23,42,0.12)] ring-1 ring-primary-200",
    inactive:
      "text-slate-600 hover:bg-white/80 hover:text-primary-700 focus-visible:bg-white focus-visible:text-primary-700",
    disabled: "opacity-45"
  },
  label: "relative z-10 whitespace-nowrap"
};

interface TabNavProps {
  items: TabNavItem[];
  activeId: string;
  hasOwner: boolean;
  hasCrew: boolean;
  "aria-label"?: string;
}

export function TabNav({ items, activeId, hasCrew, hasOwner, "aria-label": ariaLabel }: TabNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = React.useTransition();

  const resolveAllowed = (requires?: AccessRequirement): boolean => {
    if (requires === "owner") {
      return hasOwner;
    }
    if (requires === "crew") {
      return hasCrew || hasOwner;
    }
    return true;
  };

  const resolvedActiveHref =
    items.find((item) => item.id === activeId)?.href ??
    (activeId ? `${pathname}?tab=${activeId}` : items[0]?.href ?? "");

  return (
    <div className="flex flex-col gap-3">
      <div className="sm:hidden">
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          <span>Choose a section</span>
          <select
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-200"
            value={resolvedActiveHref}
            aria-label={ariaLabel ?? "Team console sections"}
            onChange={(event) => {
              const nextHref = event.target.value;
              if (!nextHref) {
                return;
              }

              startTransition(() => {
                router.push(nextHref);
              });
            }}
          >
            {items.map((item) => {
              const allowed = resolveAllowed(item.requires);
              return (
                <option key={item.id} value={item.href} disabled={!allowed}>
                  {item.label}
                  {!allowed
                    ? item.requires === "owner"
                      ? " (owner only)"
                      : " (crew required)"
                    : ""}
                </option>
              );
            })}
          </select>
        </label>
        {isPending ? (
          <p className="mt-1 text-xs text-slate-500">Loading section...</p>
        ) : null}
      </div>

      <nav className={teamTabTokens.container} aria-label={ariaLabel ?? "Team console sections"}>
        {items.map((item) => {
          const allowed = resolveAllowed(item.requires);
          const isRestricted =
            item.requires === "owner"
              ? !hasOwner
              : item.requires === "crew"
                ? !hasCrew && !hasOwner
                : false;
          const isActive = item.id === activeId;
          const className = cn(
            teamTabTokens.item.base,
            isActive ? teamTabTokens.item.active : teamTabTokens.item.inactive,
            isRestricted && teamTabTokens.item.disabled
          );

          return (
            <a
              key={item.id}
              href={item.href}
              className={className}
              aria-current={isActive ? "page" : undefined}
              aria-disabled={isRestricted ? "true" : undefined}
              data-state={isActive ? "active" : "inactive"}
              data-access={item.requires ?? "all"}
              title={
                !allowed
                  ? item.requires === "owner"
                    ? "Owner access required"
                    : "Crew access required"
                  : undefined
              }
            >
              <span className={teamTabTokens.label}>{item.label}</span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}




