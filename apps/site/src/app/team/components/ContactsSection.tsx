import React, { type ReactElement } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { createContactAction } from "../actions";
import { callAdminApi } from "../lib/api";

type ContactSummary = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  phoneE164: string | null;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string | null;
  properties: Array<{ id: string; addressLine1: string; city: string; state: string; postalCode: string; createdAt: string }>;
  stats: { appointments: number; quotes: number };
};

export async function ContactsSection({ search }: { search?: string }): Promise<ReactElement> {
  const query = search && search.trim().length ? `?q=${encodeURIComponent(search.trim())}` : "";
  const res = await callAdminApi(`/api/admin/contacts${query}`);
  if (!res.ok) throw new Error("Failed to load contacts");

  const payload = (await res.json()) as { contacts: ContactSummary[] };
  const contacts = payload.contacts ?? [];

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-primary-900">Add contact</h2>
        <form action={createContactAction} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            <span>First name</span>
            <input name="firstName" required className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            <span>Last name</span>
            <input name="lastName" required className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            <span>Email</span>
            <input name="email" type="email" placeholder="optional" className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            <span>Phone</span>
            <input name="phone" type="tel" placeholder="optional" className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-neutral-700 sm:col-span-2">
            <span>Address</span>
            <input name="addressLine1" required className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            <span>City</span>
            <input name="city" required className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-neutral-700">
              <span>State</span>
              <input name="state" required maxLength={2} className="rounded-md border border-neutral-300 px-3 py-2 text-sm uppercase" />
            </label>
            <label className="flex flex-col gap-1 text-sm text-neutral-700">
              <span>Postal code</span>
              <input name="postalCode" required className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
            </label>
          </div>
          <div className="sm:col-span-2">
            <SubmitButton className="inline-flex items-center rounded-md bg-primary-800 px-4 py-2 text-sm font-semibold text-white" pendingLabel="Saving...">
              Save contact
            </SubmitButton>
          </div>
        </form>
      </div>

      <form method="get" className="flex flex-wrap items-center gap-2 text-sm text-neutral-700">
        <input type="hidden" name="tab" value="contacts" />
        <input
          name="q"
          defaultValue={search ?? ""}
          placeholder="Search name, email, address"
          className="min-w-[220px] flex-1 rounded-md border border-neutral-300 px-3 py-2"
        />
        <button type="submit" className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-700">
          Search
        </button>
      </form>

      {contacts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-500">
          No contacts yet. Add your first lead above.
        </p>
      ) : (
        <ul className="space-y-3">
          {contacts.map((contact) => (
            <li key={contact.id} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-primary-900">{contact.name}</h3>
                  <div className="text-xs text-neutral-600">
                    {contact.email ? <p>{contact.email}</p> : null}
                    {contact.phone ? <p>{contact.phone}</p> : null}
                  </div>
                </div>
                <div className="flex gap-4 text-xs text-neutral-600">
                  <span>Appointments: {contact.stats.appointments}</span>
                  <span>Quotes: {contact.stats.quotes}</span>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-xs text-neutral-600">
                {contact.properties.map((property) => (
                  <p key={property.id}>
                    {property.addressLine1}, {property.city}, {property.state} {property.postalCode}
                  </p>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-neutral-500">
                Last activity:{" "}
                {contact.lastActivityAt
                  ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(contact.lastActivityAt))
                  : "None yet"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
