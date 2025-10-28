import React from "react";
import { cn } from "@myst-os/ui";

type AccessRequirement = "owner" | "crew";

export interface TabNavItem {
  id: string;
  label: string;
  href: string;
  requires?: AccessRequirement;
}

export const teamTabTokens = {
  container:
    "grid grid-cols-1 gap-2 rounded-2xl border border-slate-200/80 bg-white/80 p-2 shadow-sm shadow-slate-200/50 backdrop-blur supports-[backdrop-filter]:bg-white/60 sm:auto-cols-fr sm:grid-flow-col sm:grid-cols-none",
  item: {
    base:
      "group relative isolate flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium leading-tight transition duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
    active:
      "bg-gradient-to-br from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-400/30",
    inactive:
      "text-slate-600 hover:bg-white/80 hover:text-primary-700 focus-visible:bg-white focus-visible:text-primary-700",
    disabled: "cursor-not-allowed opacity-40 focus-visible:ring-0 focus-visible:ring-offset-0"
  },
  indicator: "pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/20"
};

interface TabNavProps {
  items: TabNavItem[];
  activeId: string;
  hasOwner: boolean;
  hasCrew: boolean;
  "aria-label"?: string;
}

export function TabNav({ items, activeId, hasCrew, hasOwner, "aria-label": ariaLabel }: TabNavProps) {
  const canAccess = {
    owner: hasOwner,
    crew: hasCrew
  } as const;

  return (
    <nav className={teamTabTokens.container} aria-label={ariaLabel ?? "Team console sections"}>
      {items.map((item) => {
        const allowed = item.requires ? canAccess[item.requires] : true;
        const isActive = item.id === activeId;
        const className = cn(
          teamTabTokens.item.base,
          isActive ? teamTabTokens.item.active : teamTabTokens.item.inactive,
          !allowed && teamTabTokens.item.disabled
        );

        const content = (
          <>
            {isActive ? <span className={teamTabTokens.indicator} aria-hidden /> : null}
            <span className="relative z-10">{item.label}</span>
          </>
        );

        if (!allowed) {
          return (
            <span
              key={item.id}
              role="link"
              aria-disabled="true"
              data-requires={item.requires}
              className={className}
              title={
                item.requires === "owner"
                  ? "Owner access required"
                  : item.requires === "crew"
                    ? "Crew access required"
                    : undefined
              }
            >
              {content}
            </span>
          );
        }

        return (
          <a
            key={item.id}
            href={item.href}
            className={className}
            aria-current={isActive ? "page" : undefined}
            data-state={isActive ? "active" : "inactive"}
          >
            {content}
          </a>
        );
      })}
    </nav>
  );
}
