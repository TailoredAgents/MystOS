"use client";

import { useEffect, useMemo, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";

type Payment = {
  id: string;
  stripeChargeId: string;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  cardBrand: string | null;
  last4: string | null;
  receiptUrl: string | null;
  createdAt: string;
  capturedAt: string | null;
  metadata: Record<string, unknown> | null;
  appointment: null | { id: string; status: string; startAt: string | null; contactName: string | null };
};

function fmtMoney(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

type ServerAction = (formData: FormData) => void;

type ApptItem = {
  id: string;
  startAt: string | null;
  contact: { name: string };
  property: { addressLine1: string; city: string };
};

export function PaymentsList({
  initial,
  summary,
  attachAction,
  detachAction,
  recordAction
}: {
  initial: Payment[];
  summary: { total: number; matched: number; unmatched: number };
  attachAction: ServerAction;
  detachAction: ServerAction;
  recordAction: ServerAction;
}) {
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<string>("all");
  const [appts, setAppts] = useState<ApptItem[]>([]);
  const [appointmentFilter, setAppointmentFilter] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/appointments?status=all", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { ok: boolean; data: ApptItem[] };
        setAppts(data.data ?? []);
      } catch {
        // ignore
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const hay = q.trim().toLowerCase();
    return initial.filter((it) => {
      if (scope === "matched" && !it.appointment) return false;
      if (scope === "unmatched" && it.appointment) return false;
      if (!hay) return true;
      return (
        it.stripeChargeId.toLowerCase().includes(hay) ||
        (it.appointment?.contactName ?? "").toLowerCase().includes(hay)
      );
    });
  }, [initial, q, scope]);

  const metadataNote = (payment: Payment) => {
    if (!payment.metadata || typeof payment.metadata !== "object") {
      return null;
    }
    const rawNote = payment.metadata["note"];
    return typeof rawNote === "string" && rawNote.trim().length ? (
      <p className="text-[11px] text-neutral-500">Note: {rawNote.trim()}</p>
    ) : null;
  };

  const filteredAppts = useMemo(() => {
    const hay = appointmentFilter.trim().toLowerCase();
    if (!hay) {
      return appts.slice(0, 50);
    }
    return appts
      .filter((appt) => {
        const base = [
          appt.contact.name,
          appt.property.addressLine1,
          appt.property.city,
          appt.startAt ? new Date(appt.startAt).toLocaleDateString() : ""
        ]
          .join(" ")
          .toLowerCase();
        return base.includes(hay);
      })
      .slice(0, 50);
  }, [appts, appointmentFilter]);

  const formatAppointmentLabel = (appt: ApptItem) => {
    const date = appt.startAt ? new Date(appt.startAt).toLocaleDateString() : "Unscheduled";
    return `${appt.contact.name} — ${date} — ${appt.property.addressLine1}, ${appt.property.city}`;
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-700">
        <span>Total: {summary.total}</span>
        <span>Matched: {summary.matched}</span>
        <span>Unmatched: {summary.unmatched}</span>
      </div>
      <details className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-neutral-700">
        <summary className="cursor-pointer font-semibold text-emerald-900">Record payment</summary>
        <form action={recordAction} className="mt-3 space-y-3 text-xs text-neutral-700">
          <label className="flex flex-col gap-1">
            <span>Search appointments</span>
            <input
              type="text"
              value={appointmentFilter}
              onChange={(event) => setAppointmentFilter(event.target.value)}
              placeholder="Type a customer, address, or date"
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span>Select appointment</span>
            <select
              name="appointmentId"
              required
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                Choose a job
              </option>
              {filteredAppts.map((appt) => (
                <option key={appt.id} value={appt.id}>
                  {formatAppointmentLabel(appt)}
                </option>
              ))}
            </select>
            {appts.length === 0 ? (
              <p className="text-[11px] text-neutral-500">Loading recent appointments...</p>
            ) : null}
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span>Amount</span>
              <input
                type="number"
                name="amount"
                min="0.01"
                step="0.01"
                required
                placeholder="120.00"
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span>Currency</span>
              <select name="currency" defaultValue="USD" className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
                <option value="USD">USD</option>
                <option value="CAD">CAD</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span>Method</span>
              <input
                type="text"
                name="method"
                placeholder="cash, check, zelle"
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span>Note (optional)</span>
            <textarea
              name="note"
              rows={2}
              placeholder="e.g., adjusted for patio add-on"
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex justify-end">
            <SubmitButton className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white" pendingLabel="Saving...">
              Record payment
            </SubmitButton>
          </div>
        </form>
      </details>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search charge ID or name"
          className="min-w-[240px] flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm"
        />
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
        >
          <option value="all">All</option>
          <option value="matched">Matched</option>
          <option value="unmatched">Unmatched</option>
        </select>
      </div>
      <ul className="space-y-3">
        {filtered.map((p) => (
          <li key={p.id} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-primary-900">{fmtMoney(p.amount, p.currency)}</p>
                <p className="text-xs text-neutral-500">
                  {p.stripeChargeId.slice(0, 14)} - {p.status}
                  {p.method ? ` - ${p.method}` : null}
                </p>
                <p className="text-[11px] text-neutral-500">
                  {new Date(p.createdAt).toLocaleString()}
                  {p.capturedAt ? ` - Captured ${new Date(p.capturedAt).toLocaleDateString()}` : null}
                </p>
                {p.appointment ? (
                  <p className="text-xs text-neutral-600">
                    Linked to {p.appointment.contactName ?? "appointment"}
                  </p>
                ) : (
                  <p className="text-xs text-rose-600">Unmatched</p>
                )}
                {metadataNote(p)}
              </div>
              {p.receiptUrl ? (
                <a href={p.receiptUrl} target="_blank" rel="noreferrer" className="text-xs text-neutral-600 underline">
                  Receipt
                </a>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {p.appointment ? (
                <form action={detachAction}>
                  <input type="hidden" name="paymentId" value={p.id} />
                  <SubmitButton
                    className="rounded-md border border-neutral-300 px-3 py-1 text-xs text-neutral-700"
                    pendingLabel="Detaching..."
                  >
                    Detach
                  </SubmitButton>
                </form>
              ) : (
                <form action={attachAction} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="paymentId" value={p.id} />
                  <input
                    list={`appts-${p.id}`}
                    name="appointmentId"
                    placeholder="Search or enter ID"
                    className="min-w-[220px] rounded-md border border-neutral-300 px-2 py-1 text-xs"
                  />
                  <datalist id={`appts-${p.id}`}>
                    {appts.map((a) => (
                      <option key={a.id} value={a.id}>{`${a.contact.name} - ${a.property.addressLine1}, ${a.property.city}`}</option>
                    ))}
                  </datalist>
                  <SubmitButton className="rounded-md bg-primary-800 px-3 py-1 text-xs font-semibold text-white" pendingLabel="Attaching...">
                    Attach
                  </SubmitButton>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
