"use client";

import React from "react";
import useSWR from "swr";
import { cn } from "@myst-os/ui";

type CalendarAppointment = {
  id: string;
  type: string;
  status: string;
  startAt: string | null;
  durationMinutes: number | null;
  contact: {
    id: string | null;
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  property: {
    id: string | null;
    addressLine1: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
  } | null;
  quote: {
    id: string | null;
    status: string | null;
  } | null;
};

type CalendarResponse = {
  start: string;
  end: string;
  appointments: CalendarAppointment[];
};

const STATUS_STYLES: Record<string, string> = {
  confirmed: "border-emerald-300 bg-emerald-50 text-emerald-800",
  requested: "border-amber-300 bg-amber-50 text-amber-800",
  completed: "border-slate-200 bg-slate-50 text-slate-500",
  no_show: "border-rose-200 bg-rose-50 text-rose-700",
  canceled: "border-rose-200 bg-rose-50 text-rose-700"
};

const STATUS_FILTERS: Array<{ id: CalendarAppointment["status"]; label: string }> = [
  { id: "confirmed", label: "Confirmed" },
  { id: "requested", label: "Requested" },
  { id: "completed", label: "Completed" },
  { id: "no_show", label: "No Show" },
  { id: "canceled", label: "Canceled" }
];

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch calendar (${response.status})`);
  }
  return (await response.json()) as CalendarResponse;
};

function formatDay(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(date: Date | null) {
  if (!date) return "TBD";
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function CalendarSection() {
  const now = React.useMemo(() => new Date(), []);
  const start = React.useMemo(() => {
    const clone = new Date(now);
    clone.setDate(clone.getDate() - now.getDay());
    clone.setHours(0, 0, 0, 0);
    return clone;
  }, [now]);

  const end = React.useMemo(() => {
    const clone = new Date(start);
    clone.setDate(clone.getDate() + 7);
    return clone;
  }, [start]);

  const { data, error, isLoading } = useSWR(
    `/api/calendar?start=${start.toISOString()}&end=${end.toISOString()}`,
    fetcher,
    { refreshInterval: 5 * 60 * 1000 }
  );

  const [visibleStatuses, setVisibleStatuses] = React.useState<string[]>([]);
  const statusFilterActive = visibleStatuses.length > 0;

  const toggleStatus = React.useCallback((status: string) => {
    setVisibleStatuses((prev) => {
      if (prev.includes(status)) {
        return prev.filter((value) => value !== status);
      }
      return [...prev, status];
    });
  }, []);

  const clearStatusFilters = React.useCallback(() => {
    setVisibleStatuses([]);
  }, []);

  const grouped = React.useMemo(() => {
    const map = new Map<string, CalendarAppointment[]>();
    if (!data?.appointments) {
      return map;
    }

    const filterSet = new Set(visibleStatuses);
    const shouldFilter = statusFilterActive && filterSet.size > 0;

    for (const appt of data.appointments) {
      if (shouldFilter && !filterSet.has(appt.status)) {
        continue;
      }

      const day = appt.startAt ? new Date(appt.startAt) : null;
      const dayKey = day ? day.toISOString().slice(0, 10) : "unscheduled";
      const existing = map.get(dayKey) ?? [];
      existing.push(appt);
      map.set(dayKey, existing);
    }

    for (const list of map.values()) {
      list.sort((a, b) => {
        const aTime = a.startAt ? Date.parse(a.startAt) : 0;
        const bTime = b.startAt ? Date.parse(b.startAt) : 0;
        return aTime - bTime;
      });
    }

    return map;
  }, [data, statusFilterActive, visibleStatuses]);

  const unscheduledEntries = grouped.get("unscheduled") ?? [];

  if (error) {
    return (
      <section className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
        Unable to load calendar: {error.message}
      </section>
    );
  }

  if (isLoading || !data) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white/70 p-5 text-sm text-slate-600">
        Loading calendar...
      </section>
    );
  }

  const days: Date[] = [];
  for (let i = 0; i < 7; i += 1) {
    const day = new Date(start);
    day.setDate(day.getDate() + i);
    days.push(day);
  }

  const firstDay = days[0] ?? start;
  const lastDay = days[days.length - 1] ?? end;

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Week of</p>
          <h2 className="text-xl font-semibold text-slate-900">
            {formatDay(firstDay)} - {formatDay(lastDay)}
          </h2>
        </div>
        <p className="text-xs text-slate-500">Auto-refreshes every 5 minutes</p>
      </header>

      <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-4 shadow-sm shadow-slate-200/60">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={clearStatusFilters}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] transition",
              statusFilterActive
                ? "border-slate-200 text-slate-500 hover:border-slate-300"
                : "border-primary-200 bg-primary-50 text-primary-700"
            )}
          >
            All Statuses
          </button>
          {STATUS_FILTERS.map((filter) => {
            const isActive = visibleStatuses.includes(filter.id);
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => toggleStatus(filter.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] transition",
                  isActive
                    ? "border-primary-200 bg-primary-50 text-primary-700"
                    : "border-slate-200 text-slate-500 hover:border-primary-200 hover:text-primary-700"
                )}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {statusFilterActive
            ? `Filtering ${visibleStatuses.length} status${visibleStatuses.length === 1 ? "" : "es"}.`
            : "Showing all appointments."}
        </p>
      </div>

      <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-xl shadow-slate-200/60 md:grid-cols-2 lg:grid-cols-4">
        {days.map((day) => {
          const dateKey = day.toISOString().split("T")[0] ?? "unscheduled";
          const entries = grouped.get(dateKey) ?? [];
          return (
            <article key={dateKey} className="flex flex-col rounded-2xl border border-slate-100 bg-white/80 p-3">
              <header className="flex items-center justify-between text-xs text-slate-500">
                <span>{day.toLocaleDateString("en-US", { weekday: "short" })}</span>
                <span className="font-semibold text-slate-900">{formatDay(day)}</span>
              </header>
              <div className="mt-3 flex flex-col gap-2">
                {entries.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] text-slate-400">
                    No appointments scheduled.
                  </p>
                ) : (
                  entries.map((appt) => {
                    const startAt = appt.startAt ? new Date(appt.startAt) : null;
                    const style = STATUS_STYLES[appt.status] ?? "border-slate-200 bg-slate-50";
                    return (
                      <div key={appt.id} className={cn("rounded-xl border px-3 py-2 text-xs shadow-sm", style)}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">{appt.contact?.name ?? "Unassigned"}</span>
                          <span className="text-[10px] uppercase tracking-[0.15em]">
                            {appt.status.replace("_", " ")}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-600">
                          {formatTime(startAt)} - {appt.property?.city ?? "On-site"}
                        </p>
                        {appt.quote?.id ? (
                          <a
                            href={`/team?tab=quotes&q=${encodeURIComponent(appt.contact?.name ?? "")}`}
                            className="mt-2 inline-flex items-center text-[10px] font-medium text-primary-700 underline"
                          >
                            View related quote
                          </a>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </article>
          );
        })}
      </div>

      {unscheduledEntries.length > 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-4 shadow-lg shadow-slate-200/40">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-amber-500">Needs scheduling</p>
              <h3 className="text-base font-semibold text-slate-900">Unscheduled follow-ups</h3>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              {unscheduledEntries.length} job{unscheduledEntries.length === 1 ? "" : "s"}
            </span>
          </header>
          <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {unscheduledEntries.map((appt) => (
              <div
                key={appt.id}
                className="rounded-2xl border border-amber-100 bg-white/90 p-3 text-xs shadow-sm shadow-amber-100/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">{appt.contact?.name ?? "Unassigned"}</span>
                  <span className="text-[10px] uppercase tracking-[0.15em] text-amber-600">TBD</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-600">
                  {appt.property?.addressLine1 ?? "Property not set"}, {appt.property?.city ?? "City TBD"}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">Pick a calendar slot to finalize this job.</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
