"use client";

import { useMemo, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";

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
  contact: { name: string; email: string | null };
  property: { addressLine1: string; city: string; state: string; postalCode: string };
};

type ServerAction = (formData: FormData) => void;

export function QuotesList({
  initial,
  sendAction,
  decisionAction,
  scheduleAction
}: {
  initial: Quote[];
  sendAction: ServerAction;
  decisionAction: ServerAction;
  scheduleAction?: ServerAction;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const defaultScheduleStart = useMemo(() => {
    const dt = new Date();
    dt.setHours(dt.getHours() + 24);
    return dt.toISOString().slice(0, 16);
  }, []);
  const minScheduleValue = useMemo(() => new Date().toISOString().slice(0, 16), []);

  const filtered = useMemo(() => {
    const hay = q.trim().toLowerCase();
    return initial.filter((it) => {
      if (status !== "all" && it.status !== status) return false;
      if (!hay) return true;
      const addr = `${it.property.addressLine1} ${it.property.city} ${it.property.state} ${it.property.postalCode}`.toLowerCase();
      return (
        it.contact.name.toLowerCase().includes(hay) ||
        addr.includes(hay) ||
        it.services.join(" ").toLowerCase().includes(hay)
      );
    });
  }, [initial, q, status]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, address, service"
          className="min-w-[240px] flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-neutral-300 px-2 py-1 text-sm">
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="declined">Declined</option>
        </select>
      </div>
      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-500">No quotes found.</p>
      ) : (
        filtered.map((q) => (
          <article key={q.id} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">{q.status.toUpperCase()} • {q.contact.name}</p>
                <p className="text-sm text-neutral-700">{q.property.addressLine1}, {q.property.city}</p>
              </div>
              <p className="text-sm font-semibold text-primary-900">{q.total.toLocaleString("en-US", { style: "currency", currency: "USD" })}</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(q.status === "pending" || q.status === "sent") ? (
                <form action={sendAction}>
                  <input type="hidden" name="quoteId" value={q.id} />
                  <SubmitButton className="rounded-md bg-accent-600 px-3 py-1 text-xs font-semibold text-white" pendingLabel="Sending...">Send</SubmitButton>
                </form>
              ) : null}
              <form action={decisionAction}>
                <input type="hidden" name="quoteId" value={q.id} />
                <input type="hidden" name="decision" value="accepted" />
                <SubmitButton className="rounded-md border border-emerald-400 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700" pendingLabel="Saving...">Mark accepted</SubmitButton>
              </form>
              <form action={decisionAction}>
                <input type="hidden" name="quoteId" value={q.id} />
                <input type="hidden" name="decision" value="declined" />
                <SubmitButton className="rounded-md border border-rose-400 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700" pendingLabel="Saving...">Mark declined</SubmitButton>
              </form>
              {q.shareToken ? (
                <a href={`/quote/${q.shareToken}`} target="_blank" rel="noreferrer" className="rounded-md border border-neutral-300 px-3 py-1 text-xs text-neutral-700">Open link</a>
              ) : null}
            </div>
            {scheduleAction && q.status === "accepted" ? (
              <details className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 text-xs text-neutral-700">
                <summary className="cursor-pointer text-sm font-semibold text-emerald-800">Schedule job</summary>
                <form action={scheduleAction} className="mt-3 space-y-3">
                  <input type="hidden" name="quoteId" value={q.id} />
                  <label className="flex flex-col gap-1 text-xs text-neutral-600">
                    <span>Start date & time</span>
                    <input
                      type="datetime-local"
                      name="startAt"
                      required
                      defaultValue={defaultScheduleStart}
                      min={minScheduleValue}
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
                        defaultValue={90}
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
                        defaultValue={30}
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
                    <span>Creates a confirmed appointment and adds it to My Day & Google Calendar.</span>
                    <SubmitButton className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white" pendingLabel="Scheduling...">
                      Schedule job
                    </SubmitButton>
                  </div>
                </form>
              </details>
            ) : null}
          </article>
        ))
      )}
    </section>
  );
}


