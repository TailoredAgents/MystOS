"use client";

import { useMemo, useState } from "react";

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

export function QuotesList({ initial }: { initial: Quote[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");

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
              {q.shareToken ? (
                <a href={`/quote/${q.shareToken}`} target="_blank" rel="noreferrer" className="rounded-md border border-neutral-300 px-3 py-1 text-xs text-neutral-700">Open link</a>
              ) : null}
            </div>
          </article>
        ))
      )}
    </section>
  );
}

