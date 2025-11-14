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

  const grouped = React.useMemo(() => {
    const map = new Map<string, CalendarAppointment[]>();
    if (!data?.appointments) {
      return map;
    }

    for (const appt of data.appointments) {
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
  }, [data]);

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
        Loading calendar…
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
            {formatDay(firstDay)} – {formatDay(lastDay)}
          </h2>
        </div>
        <p className="text-xs text-slate-500">Auto-refreshes every 5 minutes</p>
      </header>

      <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-xl shadow-slate-200/60 md:grid-cols-2 lg:grid-cols-4">
        {days.map((day) => {
          const key = day.toISOString().split("T")[0];
          const entries = grouped.get(key) ?? [];
          return (
            <article key={key} className="flex flex-col rounded-2xl border border-slate-100 bg-white/80 p-3">
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
                          <span className="font-semibold">
                            {appt.contact?.name ?? "Unassigned"}
                          </span>
                          <span className="text-[10px] uppercase tracking-[0.15em]">
                            {appt.status.replace("_", " ")}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-600">
                          {formatTime(startAt)} · {appt.property?.city ?? "On-site"}
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
    </section>
  );
}
