"use client";

import React from "react";
import useSWR from "swr";
import { cn } from "@myst-os/ui";

type CalendarAppointment = {
  id: string;
  status: string;
  type: string;
  startAt: string | null;
  durationMinutes: number | null;
  contact: {
    id: string | null;
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
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

type CalendarViewMode = "week" | "month";

const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

const VIEW_MODE_OPTIONS: Array<{ id: CalendarViewMode; label: string }> = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" }
];

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

function formatDateLabel(date: Date, options: Intl.DateTimeFormatOptions) {
  return date.toLocaleDateString("en-US", options);
}

function getDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfWeek(anchor: Date) {
  const weekStart = new Date(anchor);
  const day = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - day);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

function startOfMonth(anchor: Date) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  first.setHours(0, 0, 0, 0);
  return first;
}

function endOfMonth(anchor: Date) {
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return end;
}

function buildMonthMatrix(anchor: Date) {
  const matrix: Date[][] = [];
  const firstDayOfMonth = startOfMonth(anchor);
  const offset = firstDayOfMonth.getDay();
  const cursor = new Date(firstDayOfMonth);
  cursor.setDate(cursor.getDate() - offset);

  for (let week = 0; week < 6; week += 1) {
    const row: Date[] = [];
    for (let day = 0; day < 7; day += 1) {
      row.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    matrix.push(row);
  }
  return matrix;
}

function getPeriod(reference: Date, view: CalendarViewMode) {
  if (view === "week") {
    const start = startOfWeek(reference);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  return {
    start: startOfMonth(reference),
    end: endOfMonth(reference)
  };
}

export function useCalendarFeed(start: Date, end: Date) {
  const key = React.useMemo(
    () => `/api/calendar?start=${start.toISOString()}&end=${end.toISOString()}`,
    [start, end]
  );
  return useSWR<CalendarResponse>(key, fetcher, {
    refreshInterval: REFRESH_INTERVAL_MS
  });
}

export function CalendarFullView({ initialViewMode }: { initialViewMode?: CalendarViewMode }) {
  const [viewMode, setViewMode] = React.useState<CalendarViewMode>(initialViewMode ?? "week");
  const [referenceDate, setReferenceDate] = React.useState<Date>(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  });

  React.useEffect(() => {
    if (initialViewMode && initialViewMode !== viewMode) {
      setViewMode(initialViewMode);
    }
  }, [initialViewMode, viewMode]);

  const period = React.useMemo(() => getPeriod(referenceDate, viewMode), [referenceDate, viewMode]);
  const { data, error, isLoading } = useCalendarFeed(period.start, period.end);

  const appointments = data?.appointments ?? [];
  const grouped = React.useMemo(() => {
    const map = new Map<string, CalendarAppointment[]>();
    for (const appt of appointments) {
      if (!appt) {
        continue;
      }
      const day = appt.startAt ? new Date(appt.startAt) : null;
      const key = day ? getDayKey(day) : "unscheduled";
      const list = map.get(key) ?? [];
      list.push(appt);
      map.set(key, list);
    }
    return map;
  }, [appointments]);

  const unscheduledEntries = grouped.get("unscheduled") ?? [];
  grouped.delete("unscheduled");

  const weekDays = React.useMemo(() => {
    const days: Date[] = [];
    const cursor = new Date(period.start);
    cursor.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i += 1) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [period.start]);

  const monthMatrix = React.useMemo(() => buildMonthMatrix(referenceDate), [referenceDate]);

  const weekLabel = React.useMemo(() => {
    if (viewMode === "week") {
      const startLabel = formatDateLabel(period.start, { month: "short", day: "numeric" });
      const endLabel = formatDateLabel(period.end, { month: "short", day: "numeric" });
      return `${startLabel} – ${endLabel}`;
    }
    return "";
  }, [period.end, period.start, viewMode]);

  const monthLabel = React.useMemo(
    () => formatDateLabel(referenceDate, { month: "long", year: "numeric" }),
    [referenceDate]
  );

  const handleShift = (direction: 1 | -1) => {
    setReferenceDate((current) => {
      const next = new Date(current);
      if (viewMode === "week") {
        next.setDate(next.getDate() + direction * 7);
      } else {
        next.setMonth(next.getMonth() + direction);
      }
      return next;
    });
  };

  const handleToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setReferenceDate(today);
  };

  if (error) {
    return (
      <section className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        Unable to load calendar: {error.message}
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Calendar</p>
          <h2 className="text-2xl font-semibold text-slate-900">
            {viewMode === "week" ? weekLabel : monthLabel}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
            {VIEW_MODE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setViewMode(option.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition",
                  viewMode === option.id
                    ? "bg-primary-100 text-primary-800 shadow-sm"
                    : "text-slate-500 hover:text-primary-700"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex rounded-full border border-slate-200 bg-white text-xs font-semibold">
            <button
              type="button"
              className="rounded-l-full px-3 py-1 hover:bg-slate-100"
              onClick={() => handleShift(-1)}
            >
              Prev
            </button>
            <button
              type="button"
              className="border-x border-slate-200 px-3 py-1 hover:bg-slate-100"
              onClick={handleToday}
            >
              Today
            </button>
            <button
              type="button"
              className="rounded-r-full px-3 py-1 hover:bg-slate-100"
              onClick={() => handleShift(1)}
            >
              Next
            </button>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-10 text-center text-sm text-slate-500 shadow-lg shadow-slate-200/50">
          Loading calendar...
        </div>
      ) : viewMode === "week" ? (
        <WeeklyView days={weekDays} grouped={grouped} />
      ) : (
        <MonthlyView weeks={monthMatrix} grouped={grouped} referenceDate={referenceDate} />
      )}

      {unscheduledEntries.length > 0 ? (
        <div className="rounded-3xl border border-dashed border-amber-200 bg-amber-50/50 p-5 shadow-sm shadow-amber-100/60">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-amber-600">Needs scheduling</p>
              <h3 className="text-base font-semibold text-slate-900">Unscheduled follow-ups</h3>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700">
              {unscheduledEntries.length} job{unscheduledEntries.length === 1 ? "" : "s"}
            </span>
          </header>
          <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {unscheduledEntries.map((appt) => (
              <article
                key={appt.id}
                className="rounded-2xl border border-amber-100 bg-white/90 p-3 text-xs text-slate-700 shadow-sm shadow-amber-100/50"
              >
                <h4 className="font-semibold text-slate-900">
                  {appt.contact?.name ?? "Unassigned contact"}
                </h4>
                <p className="mt-1 text-[11px] text-slate-500">
                  {appt.property?.addressLine1 ?? "Property TBD"}, {appt.property?.city ?? "City TBD"}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Add this job to the calendar once a time is confirmed.
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function WeeklyView({
  days,
  grouped
}: {
  days: Date[];
  grouped: Map<string, CalendarAppointment[]>;
}) {
  return (
    <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-xl shadow-slate-200/60 md:grid-cols-2 lg:grid-cols-4">
      {days.map((day) => {
        const key = getDayKey(day);
        const entries = grouped.get(key) ?? [];
        return (
          <article key={key} className="flex flex-col rounded-2xl border border-slate-100 bg-white/80 p-3">
            <header className="flex items-center justify-between text-xs text-slate-500">
              <span>{day.toLocaleDateString("en-US", { weekday: "short" })}</span>
              <span className="font-semibold text-slate-900">{formatDateLabel(day, { month: "short", day: "numeric" })}</span>
            </header>
            <div className="mt-3 flex flex-col gap-2">
              {entries.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] text-slate-400">
                  No appointments scheduled.
                </p>
              ) : (
                entries.map((appt) => (
                  <div
                    key={appt.id}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-xs shadow-sm",
                      STATUS_STYLES[appt.status] ?? "border-slate-200 bg-slate-50 text-slate-700"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">
                        {appt.contact?.name ?? "Unassigned"}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.15em]">
                        {appt.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-600">
                      {appt.startAt
                        ? formatDateLabel(new Date(appt.startAt), {
                            hour: "numeric",
                            minute: "2-digit"
                          })
                        : "TBD"}{" "}
                      • {appt.property?.city ?? "On-site"}
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
                ))
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function MonthlyView({
  weeks,
  grouped,
  referenceDate
}: {
  weeks: Date[][];
  grouped: Map<string, CalendarAppointment[]>;
  referenceDate: Date;
}) {
  const currentMonth = referenceDate.getMonth();
  return (
    <div className="space-y-2 rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-xl shadow-slate-200/60">
      <div className="grid grid-cols-7 gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <span key={day} className="text-center">
            {day}
          </span>
        ))}
      </div>
      {weeks.map((week, index) => (
        <div key={`week-${index}`} className="grid grid-cols-7 gap-2">
          {week.map((day) => {
            const key = getDayKey(day);
            const entries = grouped.get(key) ?? [];
            const inMonth = day.getMonth() === currentMonth;
            const limited = entries.slice(0, 3);
            const remainder = entries.length - limited.length;
            return (
              <article
                key={key}
                className={cn(
                  "rounded-xl border border-slate-100 bg-white/80 p-2 text-xs shadow-inner",
                  !inMonth && "opacity-50"
                )}
              >
                <header className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                  <span>{day.getDate()}</span>
                  {entries.length ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                      {entries.length}
                    </span>
                  ) : null}
                </header>
                <div className="mt-2 space-y-1">
                  {limited.map((appt) => {
                    const startLabel = appt.startAt
                      ? formatDateLabel(new Date(appt.startAt), {
                          hour: "numeric",
                          minute: "2-digit"
                        })
                      : "TBD";
                    return (
                      <div
                        key={appt.id}
                        className={cn(
                          "rounded-lg border px-2 py-1 text-[11px]",
                          STATUS_STYLES[appt.status] ?? "border-slate-200 bg-slate-50 text-slate-600"
                        )}
                      >
                        <p className="font-semibold leading-tight">
                          {appt.contact?.name ?? "Unassigned"}
                        </p>
                        <p className="text-[10px]">
                          {startLabel} • {appt.property?.city ?? "On-site"}
                        </p>
                      </div>
                    );
                  })}
                  {remainder > 0 ? (
                    <p className="text-[10px] text-slate-500">+{remainder} more</p>
                  ) : null}
                  {entries.length === 0 ? (
                    <p className="rounded border border-dashed border-slate-200 px-2 py-3 text-center text-[10px] text-slate-400">
                      Open
                    </p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ))}
    </div>
  );
}
