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
  contact: { name: string; email?: string | null };
  property: { addressLine1: string; city: string };
  quote?: {
    id: string;
    status: string;
    total: number;
    lineItems: Array<{ id: string; label: string; amount: number }>;
  } | null;
};

type PaymentLineItem = {
  id: string;
  label: string;
  amount: string;
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
  const [linkSearch, setLinkSearch] = useState("");
  const [linkAppointmentId, setLinkAppointmentId] = useState("");
  const [linkCurrency, setLinkCurrency] = useState("USD");
  const [linkEmail, setLinkEmail] = useState("");
  const [linkEmailDirty, setLinkEmailDirty] = useState(false);
  const [linkStatus, setLinkStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const createLineItem = (label = "", amount = ""): PaymentLineItem => ({
    id: Math.random().toString(36).slice(2),
    label,
    amount
  });
  const [linkLineItems, setLinkLineItems] = useState<PaymentLineItem[]>([createLineItem("", "")]);

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

  useEffect(() => {
    if (!linkAppointmentId) {
      setLinkLineItems([createLineItem("", "")]);
      return;
    }
    const match = appts.find((appt) => appt.id === linkAppointmentId);
    if (match?.quote?.lineItems && match.quote.lineItems.length > 0) {
      setLinkLineItems(
        match.quote.lineItems.map((item) =>
          createLineItem(item.label, item.amount ? item.amount.toFixed(2) : "")
        )
      );
    } else if (match?.quote?.total && match.quote.total > 0) {
      setLinkLineItems([createLineItem("Quoted services", match.quote.total.toFixed(2))]);
    } else {
      setLinkLineItems([createLineItem("", "")]);
    }
  }, [appts, linkAppointmentId]);

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

  const filterAppointments = (term: string) => {
    const hay = term.trim().toLowerCase();
    if (!hay) {
      return appts.slice(0, 50);
    }
    return appts
      .filter((appt) => {
        const base = [
          appt.contact.name,
          appt.contact.email ?? "",
          appt.property.addressLine1,
          appt.property.city,
          appt.startAt ? new Date(appt.startAt).toLocaleDateString() : ""
        ]
          .join(" ")
          .toLowerCase();
        return base.includes(hay);
      })
      .slice(0, 50);
  };

  const recordFilteredAppts = useMemo(
    () => filterAppointments(appointmentFilter),
    [appointmentFilter, appts]
  );
  const stripeFilteredAppts = useMemo(
    () => filterAppointments(linkSearch),
    [linkSearch, appts]
  );

  const updateLineItem = (id: string, updates: Partial<PaymentLineItem>) => {
    setLinkLineItems((items) =>
      items.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const removeLineItem = (id: string) => {
    setLinkLineItems((items) => (items.length > 1 ? items.filter((item) => item.id !== id) : items));
  };

  const addLineItem = () => {
    setLinkLineItems((items) => [...items, createLineItem("", "")]);
  };

  const linkTotal = useMemo(() => {
    return linkLineItems.reduce((sum, item) => {
      const value = Number(item.amount);
      return Number.isFinite(value) && value > 0 ? sum + value : sum;
    }, 0);
  }, [linkLineItems]);

  const metadataNote = (payment: Payment) => {
    if (!payment.metadata || typeof payment.metadata !== "object") {
      return null;
    }
    const rawNote = payment.metadata["note"];
    return typeof rawNote === "string" && rawNote.trim().length ? (
      <p className="text-[11px] text-neutral-500">Note: {rawNote.trim()}</p>
    ) : null;
  };

  const formatAppointmentLabel = (appt: ApptItem) => {
    const date = appt.startAt ? new Date(appt.startAt).toLocaleDateString() : "Unscheduled";
    return `${appt.contact.name} — ${date} — ${appt.property.addressLine1}, ${appt.property.city}`;
  };

  useEffect(() => {
    if (!linkAppointmentId || linkEmailDirty) {
      return;
    }
    const match = appts.find((appt) => appt.id === linkAppointmentId);
    if (match?.contact.email) {
      setLinkEmail(match.contact.email);
    }
  }, [linkAppointmentId, appts, linkEmailDirty]);

  const handleSendStripeLink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!linkAppointmentId) {
      setLinkError("Select an appointment");
      setLinkStatus("error");
      return;
    }

    const validItems = linkLineItems
      .map((item) => ({
        label: item.label.trim(),
        amount: Number(item.amount)
      }))
      .filter((item) => item.label.length > 0 && Number.isFinite(item.amount) && item.amount > 0);

    if (!validItems.length) {
      setLinkError("Add at least one line item with an amount");
      setLinkStatus("error");
      return;
    }

    const totalValue = validItems.reduce((sum, item) => sum + item.amount, 0);
    if (!Number.isFinite(totalValue) || totalValue <= 0) {
      setLinkError("Enter a valid amount");
      setLinkStatus("error");
      return;
    }

    setLinkStatus("pending");
    setLinkError(null);
    setLinkUrl(null);

    try {
      const response = await fetch("/api/stripe-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: linkAppointmentId,
          amount: totalValue,
          currency: linkCurrency,
          email: linkEmail.trim().length ? linkEmail.trim() : undefined,
          lineItems: validItems
        })
      });

      const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };

      if (!response.ok || !data?.url) {
        setLinkStatus("error");
        setLinkError(data?.error ?? "Unable to generate link");
        return;
      }

      setLinkStatus("success");
      setLinkUrl(data.url);
    } catch (error) {
      console.error("[payments] send_stripe_link_failed", error);
      setLinkStatus("error");
      setLinkError("Failed to reach Stripe");
    }
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
              {recordFilteredAppts.map((appt) => (
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
      <details className="rounded-xl border border-primary-200 bg-primary-50/70 p-4 text-xs text-neutral-700">
        <summary className="cursor-pointer font-semibold text-primary-900">Send Stripe payment link</summary>
        <form onSubmit={handleSendStripeLink} className="mt-3 space-y-3 text-xs text-neutral-700">
          <label className="flex flex-col gap-1">
            <span>Search appointments</span>
            <input
              type="text"
              value={linkSearch}
              onChange={(event) => setLinkSearch(event.target.value)}
              placeholder="Type a customer, address, or date"
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span>Select appointment</span>
            <select
              value={linkAppointmentId}
              onChange={(event) => {
                setLinkAppointmentId(event.target.value);
                setLinkEmailDirty(false);
              }}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
              required
            >
              <option value="" disabled>
                Choose a job
              </option>
              {stripeFilteredAppts.map((appt) => (
                <option key={appt.id} value={appt.id}>
                  {formatAppointmentLabel(appt)}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-800">
              Line items
            </span>
            {linkLineItems.map((item) => (
              <div key={item.id} className="grid gap-2 sm:grid-cols-[2fr_minmax(100px,1fr)_auto]">
                <input
                  type="text"
                  value={item.label}
                  onChange={(event) => updateLineItem(item.id, { label: event.target.value })}
                  placeholder="Service description"
                  className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={item.amount}
                  onChange={(event) => updateLineItem(item.id, { amount: event.target.value })}
                  placeholder="120.00"
                  className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  className="rounded-md border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 disabled:opacity-50"
                  onClick={() => removeLineItem(item.id)}
                  disabled={linkLineItems.length === 1}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="rounded-md border border-dashed border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700"
              onClick={addLineItem}
            >
              Add line item
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span>Currency</span>
              <select
                value={linkCurrency}
                onChange={(event) => setLinkCurrency(event.target.value)}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
              >
                <option value="USD">USD</option>
                <option value="CAD">CAD</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span>Customer email (optional)</span>
              <input
                type="email"
                value={linkEmail}
                onChange={(event) => {
                  setLinkEmail(event.target.value);
                  setLinkEmailDirty(true);
                }}
                placeholder="customer@email.com"
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-[11px] text-neutral-600">
              Total: {linkTotal > 0 ? fmtMoney(Math.round(linkTotal * 100), linkCurrency) : "—"}
            </p>
            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-md bg-primary-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                disabled={linkStatus === "pending"}
              >
                {linkStatus === "pending" ? "Generating..." : "Generate link"}
              </button>
            </div>
            {linkStatus === "success" && linkUrl ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
                Stripe checkout link ready:{" "}
                <a href={linkUrl} target="_blank" rel="noreferrer" className="underline">
                  Open checkout
                </a>
              </div>
            ) : null}
            {linkStatus === "error" && linkError ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
                {linkError}
              </div>
            ) : null}
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

