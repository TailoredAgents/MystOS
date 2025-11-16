"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { cn } from "@myst-os/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { ContextSummaryButton } from "./components/ContextSummaryButton";

const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const shortDateFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });

function formatHoursFromMinutes(minutes: number): string {
  return `${(minutes / 60).toFixed(1)}h`;
}

function formatLoadDate(dateStr: string): string {
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dateStr;
  }
  return shortDateFormatter.format(parsed);
}

function formatDurationEstimate(minutes: number | null | undefined): string {
  const value = typeof minutes === "number" && Number.isFinite(minutes) ? minutes : null;
  if (!value || value <= 0) {
    return "about 1 hr";
  }
  const hours = Math.floor(value / 60);
  const remainder = value % 60;
  if (hours > 0 && remainder > 0) {
    return `${hours}h ${remainder}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${value}m`;
}

type Quote = {
  id: string;
  status: string;
  services: string[];
  addOns: string[] | null;
  total: number;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  expiresAt: string | null;
  shareToken: string | null;
  contact: { id?: string | null; name: string; email: string | null };
  property: { addressLine1: string; city: string; state: string; postalCode: string };
  appointment: {
    id: string;
    status: string;
    startAt: string | null;
    durationMinutes: number | null;
    travelBufferMinutes: number | null;
    rescheduleToken: string | null;
  } | null;
  paymentSummary: {
    totalCents: number;
    paidCents: number;
    outstandingCents: number;
    hasOutstanding: boolean;
    lastPaymentAt: string | null;
    lastPaymentMethod: string | null;
  };
};

type ScheduleSuggestion = {
  window: string;
  reasoning: string;
  startAtIso?: string | null;
};

type SuggestionMeta = {
  durationMinutes: number;
  missingLocation?: boolean;
  usedFallback?: boolean;
};

type SuggestionEnvelope = {
  loading: boolean;
  error: string | null;
  items: ScheduleSuggestion[];
  meta?: SuggestionMeta | null;
  appliedWindow?: string | null;
};

type SuggestionResponse = {
  suggestions?: ScheduleSuggestion[];
  meta?: SuggestionMeta | null;
  error?: string;
};

type CalendarLoadEntry = {
  date: string;
  jobs: number;
  minutes: number;
};

type ServerAction = (formData: FormData) => void;

export function QuotesList({
  initial,
  sendAction,
  decisionAction,
  scheduleAction,
  updateStatusAction
}: {
  initial: Quote[];
  sendAction: ServerAction;
  decisionAction: ServerAction;
  scheduleAction?: ServerAction;
  updateStatusAction?: ServerAction;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, SuggestionEnvelope>>({});
  const startAtRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [loadSnapshot, setLoadSnapshot] = useState<CalendarLoadEntry[]>([]);
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "error">("idle");

  const defaultScheduleStart = useMemo(() => {
    const dt = new Date();
    dt.setHours(dt.getHours() + 24);
    return dt.toISOString().slice(0, 16);
  }, []);
  const minScheduleValue = useMemo(() => new Date().toISOString().slice(0, 16), []);

  const filtered = useMemo(() => {
    const hay = query.trim().toLowerCase();
    return initial.filter((item) => {
      if (status !== "all" && item.status !== status) {
        return false;
      }
      if (!hay) {
        return true;
      }
      const address = `${item.property.addressLine1} ${item.property.city} ${item.property.state} ${item.property.postalCode}`.toLowerCase();
      return (
        item.contact.name.toLowerCase().includes(hay) ||
        address.includes(hay) ||
        item.services.join(" ").toLowerCase().includes(hay)
      );
    });
  }, [initial, query, status]);

  function formatDisplayDate(value: string | null): string {
    if (!value) return "Unscheduled";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "Invalid date";
    }
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  }

  function toInputValue(value: string | null): string {
    if (!value) {
      return defaultScheduleStart;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return defaultScheduleStart;
    }
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  const togglePanel = (quoteId: string) => {
    setExpandedQuoteId((prev) => (prev === quoteId ? null : quoteId));
  };

  useEffect(() => {
    const loadUpcoming = async () => {
      setLoadStatus("loading");
      try {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        const url = `/api/calendar?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(
          end.toISOString()
        )}&summaryOnly=1`;
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("load_failed");
        }
        const payload = (await response.json()) as {
          summary?: { byDay?: Record<string, { jobs: number; minutes: number }> };
        };
        const entries = Object.entries(payload.summary?.byDay ?? {}).map(([date, stats]) => ({
          date,
          jobs: stats.jobs,
          minutes: stats.minutes
        }));
        entries.sort((a, b) => a.date.localeCompare(b.date));
        setLoadSnapshot(entries.slice(0, 7));
        setLoadStatus("idle");
      } catch (error) {
        console.warn("load_snapshot_failed", error);
        setLoadStatus("error");
      }
    };
    loadUpcoming();
  }, []);

  const formatCurrency = (value: number): string => currencyFormatter.format(value);
  const formatCents = (cents: number): string => currencyFormatter.format(cents / 100);
  const formatPaymentDate = (iso: string | null): string | null => {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric"
    }).format(date);
  };

  const mapSuggestionError = (code: string): string => {
    switch (code) {
      case "quote_not_found":
        return "Quote no longer exists.";
      case "quote_not_accepted":
        return "Mark the quote as accepted before requesting suggestions.";
      case "unauthorized":
        return "You need to sign in again.";
      default:
        return "Unable to fetch suggestions right now.";
    }
  };

  const requestSuggestions = async (quoteId: string) => {
    setSuggestions((prev) => ({
      ...prev,
      [quoteId]: {
        loading: true,
        error: null,
        items: prev[quoteId]?.items ?? []
      }
    }));
    try {
      const response = await fetch(`/api/quotes/${quoteId}/schedule-suggestions`, {
        method: "GET",
        cache: "no-store"
      });
      const payload = (await response.json().catch(() => null)) as SuggestionResponse | null;
      if (!response.ok || !payload || !Array.isArray(payload.suggestions)) {
        const errorCode =
          payload && typeof payload.error === "string"
            ? payload.error
            : "schedule_suggestions_unavailable";
        throw new Error(mapSuggestionError(errorCode));
      }

      setSuggestions((prev) => ({
        ...prev,
        [quoteId]: {
          loading: false,
          error: null,
          items: payload.suggestions as ScheduleSuggestion[],
          meta: payload.meta ?? null,
          appliedWindow: null
        }
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to fetch suggestions right now.";
      setSuggestions((prev) => ({
        ...prev,
        [quoteId]: {
          loading: false,
          error: message,
          items: prev[quoteId]?.items ?? [],
          meta: prev[quoteId]?.meta ?? null,
          appliedWindow: prev[quoteId]?.appliedWindow ?? null
        }
      }));
    }
  };

  const applySuggestion = (quoteId: string, suggestion: ScheduleSuggestion) => {
    const iso = suggestion.startAtIso;
    if (!iso) {
      return;
    }
    setExpandedQuoteId((prev) => (prev === quoteId ? prev : quoteId));
    const applyValue = () => {
      const targetInput = startAtRefs.current[quoteId];
      if (!targetInput) {
        return false;
      }
      const nextValue = toInputValue(iso);
      targetInput.value = nextValue;
      targetInput.dispatchEvent(new Event("input", { bubbles: true }));
      targetInput.dispatchEvent(new Event("change", { bubbles: true }));
      targetInput.focus();
      return true;
    };

    if (!applyValue()) {
      setTimeout(() => {
        applyValue();
      }, 60);
    }

    setSuggestions((prev) => {
      const current = prev[quoteId];
      if (!current) {
        return prev;
      }
      return {
        ...prev,
        [quoteId]: {
          ...current,
          appliedWindow: suggestion.window
        }
      };
    });
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, address, service"
          className="min-w-[240px] flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
        >
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="declined">Declined</option>
        </select>
      </div>
      <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-3 text-xs text-emerald-900">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold uppercase tracking-[0.2em] text-emerald-700">Next 7 days load</p>
          <span className="text-[11px] text-emerald-600">{loadSnapshot.length} days</span>
        </div>
        {loadStatus === "loading" ? (
          <p className="mt-2 text-[11px] text-emerald-700">Checking crew capacity...</p>
        ) : loadSnapshot.length === 0 ? (
          <p className="mt-2 text-[11px] text-emerald-700">
            No confirmed jobs yet. Plenty of room on the calendar.
          </p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {loadSnapshot.map((day) => (
              <div
                key={day.date}
                className={cn(
                  "rounded-md border px-3 py-2",
                  day.minutes >= 7 * 60
                    ? "border-rose-200 bg-rose-50 text-rose-800"
                    : day.minutes >= 4 * 60
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-emerald-200 bg-white text-emerald-700"
                )}
              >
                <p className="text-[11px] font-semibold">{formatLoadDate(day.date)}</p>
                <p className="text-[11px]">
                  {day.jobs} {day.jobs === 1 ? "job" : "jobs"} · {formatHoursFromMinutes(day.minutes)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-500">
          No quotes found.
        </p>
      ) : (
        filtered.map((quote) => {
          const appointment = quote.appointment;
          const hasAppointment = Boolean(appointment);
          const appointmentStatus = hasAppointment
            ? (appointment?.status ?? "pending")
            : "pending";
          const isExpanded = expandedQuoteId === quote.id;
          const displayDate = formatDisplayDate(appointment?.startAt ?? null);
          const myDayHref = appointment
            ? `/team?tab=myday&appointmentId=${encodeURIComponent(appointment.id)}`
            : null;
          const rescheduleHref =
            appointment?.rescheduleToken && appointment?.id
              ? `/schedule?appointmentId=${encodeURIComponent(appointment.id)}&token=${encodeURIComponent(
                  appointment.rescheduleToken
                )}`
              : null;
          const defaultDuration = appointment?.durationMinutes ?? 90;
          const defaultTravel = appointment?.travelBufferMinutes ?? 30;
          const suggestionState = suggestions[quote.id];
          const suggestionItems = suggestionState?.items ?? [];
          const isLoadingSuggestions = suggestionState?.loading ?? false;
          const suggestionError = suggestionState?.error ?? null;
          const suggestionMeta = suggestionState?.meta ?? null;
          const appliedWindow = suggestionState?.appliedWindow ?? null;
          const lastPaymentDisplay = formatPaymentDate(quote.paymentSummary.lastPaymentAt);

          return (
            <article key={quote.id} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-neutral-500">
                    {quote.status.toUpperCase()} - {quote.contact.name}
                  </p>
                  <p className="text-sm text-neutral-700">
                    {quote.property.addressLine1}, {quote.property.city}
                  </p>
                </div>
                <p className="text-sm font-semibold text-primary-900">
                  {quote.total.toLocaleString("en-US", { style: "currency", currency: "USD" })}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {(quote.status === "pending" || quote.status === "sent") && (
                  <form action={sendAction}>
                    <input type="hidden" name="quoteId" value={quote.id} />
                    <SubmitButton className="rounded-md bg-accent-600 px-3 py-1 text-xs font-semibold text-white" pendingLabel="Sending...">
                      Send
                    </SubmitButton>
                  </form>
                )}
                <form action={decisionAction}>
                  <input type="hidden" name="quoteId" value={quote.id} />
                  <input type="hidden" name="decision" value="accepted" />
                  <SubmitButton
                    className="rounded-md border border-emerald-400 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                    pendingLabel="Saving..."
                  >
                    Mark accepted
                  </SubmitButton>
                </form>
                <form action={decisionAction}>
                  <input type="hidden" name="quoteId" value={quote.id} />
                  <input type="hidden" name="decision" value="declined" />
                  <SubmitButton
                    className="rounded-md border border-rose-400 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700"
                    pendingLabel="Saving..."
                  >
                    Mark declined
                  </SubmitButton>
                </form>
                {quote.shareToken ? (
                  <a
                    href={`/quote/${quote.shareToken}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-neutral-300 px-3 py-1 text-xs text-neutral-700"
                  >
                    Open link
                  </a>
                ) : null}
              </div>

              {scheduleAction && quote.status === "accepted" ? (
                <div className="mt-4 space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/80 p-4 text-xs text-neutral-700">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-emerald-600">
                        {hasAppointment ? "Job scheduled" : "Job not scheduled"}
                      </p>
                      <p className="text-base font-semibold text-emerald-900">{displayDate}</p>
                      <p className="text-[11px] uppercase tracking-[0.15em] text-emerald-600">
                        Status: {appointmentStatus.replace("_", " ").toUpperCase()}
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2 text-xs">
                      {myDayHref ? (
                        <a
                          href={myDayHref}
                          className="inline-flex items-center rounded-md border border-emerald-300 bg-white px-3 py-1 font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                          View job
                        </a>
                      ) : null}
                      <a
                        href="/team?tab=calendar&view=month"
                        className="inline-flex items-center rounded-md border border-emerald-200 px-3 py-1 font-semibold text-emerald-700 hover:bg-emerald-100"
                      >
                        Open calendar
                      </a>
                      {rescheduleHref ? (
                        <a
                          href={rescheduleHref}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center rounded-md border border-emerald-200 px-3 py-1 font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                          Share reschedule link
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => togglePanel(quote.id)}
                        className="inline-flex items-center rounded-md border border-emerald-200 px-3 py-1 font-semibold text-emerald-700 hover:bg-emerald-100"
                      >
                        {isExpanded
                          ? hasAppointment
                            ? "Hide reschedule form"
                            : "Hide schedule form"
                          : hasAppointment
                            ? "Reschedule job"
                            : "Schedule job"}
                      </button>
                      {hasAppointment && appointment && updateStatusAction ? (
                        <form action={updateStatusAction}>
                          <input type="hidden" name="appointmentId" value={appointment.id} />
                          <input type="hidden" name="status" value="canceled" />
                          <SubmitButton className="rounded-md border border-rose-200 px-3 py-1 text-rose-600" pendingLabel="Canceling...">
                            Cancel job
                          </SubmitButton>
                        </form>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-lg border border-emerald-100 bg-white/80 p-3 text-[11px] text-neutral-600">
                    <p className="text-xs font-semibold text-neutral-900">
                      Payments · {formatCents(quote.paymentSummary.paidCents)} / {formatCurrency(quote.total)}
                    </p>
                    <p
                      className={`mt-1 text-[11px] ${
                        quote.paymentSummary.hasOutstanding ? "text-amber-700" : "text-emerald-700"
                      }`}
                    >
                      {quote.paymentSummary.hasOutstanding
                        ? `${formatCents(quote.paymentSummary.outstandingCents)} outstanding`
                        : "Paid in full"}
                      {quote.paymentSummary.lastPaymentMethod ? ` · ${quote.paymentSummary.lastPaymentMethod}` : ""}
                      {lastPaymentDisplay ? ` · ${lastPaymentDisplay}` : ""}
                    </p>
                  </div>

                  <div className="rounded-lg border border-emerald-100 bg-white/70 p-3 text-[11px] text-neutral-600">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-600">Need a fast slot?</p>
                        <p className="text-sm font-semibold text-emerald-900">
                          Let Myst Assist check nearby jobs for you.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => requestSuggestions(quote.id)}
                        disabled={isLoadingSuggestions}
                        className="inline-flex items-center rounded-md border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isLoadingSuggestions ? "Scanning..." : "Schedule suggestions"}
                      </button>
                    </div>
                    {suggestionMeta ? (
                      <div className="mt-2 rounded-md border border-emerald-100 bg-emerald-50/70 p-2 text-[11px] text-emerald-900">
                        <p>
                          Estimated job duration {formatDurationEstimate(suggestionMeta.durationMinutes)} based on the selected
                          services.
                        </p>
                        {suggestionMeta.missingLocation ? (
                          <p className="mt-1 text-amber-700">
                            Property is missing map coordinates, so distances are approximate. Update the property pin for
                            route-aware picks.
                          </p>
                        ) : null}
                        {suggestionMeta.usedFallback ? (
                          <p className="mt-1 text-neutral-600">
                            Using backup suggestions from calendar data while the AI helper is unavailable.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {suggestionError ? (
                      <p className="mt-2 text-xs text-rose-600">{suggestionError}</p>
                    ) : null}
                    {suggestionItems.length > 0 ? (
                      <ul className="mt-2 space-y-2 text-neutral-700">
                        {suggestionItems.map((item, idx) => (
                          <li
                            key={`${quote.id}-suggestion-${idx}`}
                            className="rounded-md border border-emerald-100 bg-white/90 p-2"
                          >
                            <p className="text-sm font-semibold text-emerald-900">{item.window}</p>
                            <p className="text-xs text-neutral-600">{item.reasoning}</p>
                            <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                              <button
                                type="button"
                                onClick={() => applySuggestion(quote.id, item)}
                                disabled={!item.startAtIso}
                                className="inline-flex items-center rounded border border-emerald-300 px-2 py-0.5 font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Apply to form
                              </button>
                              {!item.startAtIso ? (
                                <span className="text-neutral-500">Start time estimate unavailable</span>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-neutral-500">
                        Suggestions will appear here after you click the button.
                      </p>
                    )}
                    {appliedWindow ? (
                      <p className="mt-2 text-xs text-emerald-700">
                        Applied <span className="font-semibold">{appliedWindow}</span> to the schedule form below.
                      </p>
                    ) : null}
                  </div>
                  {quote.contact?.id ? (
                    <ContextSummaryButton
                      contactId={quote.contact.id ?? undefined}
                      quoteId={quote.id}
                      appointmentId={quote.appointment?.id}
                      className="text-[11px]"
                      label="AI customer summary"
                    />
                  ) : null}

                  {isExpanded ? (
                    <form action={scheduleAction} className="space-y-3 rounded-lg border border-emerald-200 bg-white/90 p-4 text-neutral-700">
                      <input type="hidden" name="quoteId" value={quote.id} />
                      <label className="flex flex-col gap-1 text-xs text-neutral-600">
                        <span>Start date & time</span>
                        <input
                          type="datetime-local"
                          name="startAt"
                          required
                          defaultValue={appointment ? toInputValue(appointment.startAt) : defaultScheduleStart}
                          min={minScheduleValue}
                          ref={(el) => {
                            startAtRefs.current[quote.id] = el;
                          }}
                          className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-200"
                        />
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="flex flex-col gap-1 text-xs text-neutral-600">
                          <span>Duration (minutes)</span>
                          <input
                            type="number"
                            name="durationMinutes"
                            min={15}
                            step={15}
                            defaultValue={defaultDuration}
                            className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-200"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-neutral-600">
                          <span>Travel buffer (minutes)</span>
                          <input
                            type="number"
                            name="travelBufferMinutes"
                            min={0}
                            step={5}
                            defaultValue={defaultTravel}
                            className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-200"
                          />
                        </label>
                      </div>
                      <label className="flex flex-col gap-1 text-xs text-neutral-600">
                        <span>Internal notes (optional)</span>
                        <textarea
                          name="notes"
                          rows={3}
                          placeholder="Crew instructions or customer preferences"
                          className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-200"
                        />
                      </label>
                      <div className="flex items-center justify-between text-[11px] text-neutral-500">
                        <span>
                          {appointment
                            ? "Updates this job immediately and syncs Google Calendar."
                            : "Creates a confirmed job synced to Google Calendar."}
                        </span>
                        <SubmitButton
                          className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
                          pendingLabel={appointment ? "Updating..." : "Scheduling..."}
                        >
                          {appointment ? "Update job" : "Schedule job"}
                        </SubmitButton>
                      </div>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })
      )}
    </section>
  );
}
