import React, { type ReactElement } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { createContactAction } from "../actions";
import { callAdminApi } from "../lib/api";
import ContactsListClient from "./ContactsListClient";
import type { ContactSummary, PaginationInfo } from "./contacts.types";

const PAGE_SIZE = 25;

function buildHref(args: { search?: string; offset?: number }): string {
  const query = new URLSearchParams();
  query.set("tab", "contacts");
  if (args.search && args.search.trim().length > 0) {
    query.set("q", args.search.trim());
  }
  if (typeof args.offset === "number" && args.offset > 0) {
    query.set("offset", String(args.offset));
  }
  return `/team?${query.toString()}`;
}

function formatRange(pagination: PaginationInfo, count: number): string {
  if (pagination.total === 0) {
    return "Showing 0 of 0";
  }
  const start = pagination.offset + 1;
  const end = pagination.offset + count;
  return `Showing ${start}-${end} of ${pagination.total}`;
}

type ContactsSectionProps = {
  search?: string;
  offset?: number;
};

export async function ContactsSection({ search, offset }: ContactsSectionProps): Promise<ReactElement> {
  const safeOffset = typeof offset === "number" && offset > 0 ? offset : 0;

  const params = new URLSearchParams();
  params.set("limit", String(PAGE_SIZE));
  if (safeOffset > 0) params.set("offset", String(safeOffset));
  if (search && search.trim().length > 0) params.set("q", search.trim());

  const response = await callAdminApi(`/api/admin/contacts?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to load contacts");
  }

  const payload = (await response.json()) as {
    contacts: ContactSummary[];
    pagination?: PaginationInfo;
  };

  const contacts = payload.contacts ?? [];
  const pagination: PaginationInfo = payload.pagination ?? {
    limit: PAGE_SIZE,
    offset: safeOffset,
    total: contacts.length,
    nextOffset: null
  };

  const hasPrev = pagination.offset > 0;
  const prevOffset = hasPrev ? Math.max(pagination.offset - pagination.limit, 0) : 0;
  const hasNext =
    typeof pagination.nextOffset === "number" && pagination.nextOffset > pagination.offset;
  const nextOffset = hasNext
    ? pagination.nextOffset ?? pagination.offset + contacts.length
    : pagination.offset;

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
        <input type="hidden" name="offset" value="0" />
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
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>{formatRange(pagination, contacts.length)}</span>
            <div className="flex gap-2">
              <a
                aria-disabled={!hasPrev}
                className={`rounded-md border border-neutral-300 px-3 py-1 ${
                  hasPrev ? "text-neutral-700 hover:bg-neutral-100" : "pointer-events-none opacity-50"
                }`}
                href={hasPrev ? buildHref({ search, offset: prevOffset }) : "#"}
              >
                Previous
              </a>
              <a
                aria-disabled={!hasNext}
                className={`rounded-md border border-neutral-300 px-3 py-1 ${
                  hasNext ? "text-neutral-700 hover:bg-neutral-100" : "pointer-events-none opacity-50"
                }`}
                href={hasNext ? buildHref({ search, offset: nextOffset }) : "#"}
              >
                Next
              </a>
            </div>
          </div>

          <ContactsListClient contacts={contacts} />

          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>{formatRange(pagination, contacts.length)}</span>
            <div className="flex gap-2">
              <a
                aria-disabled={!hasPrev}
                className={`rounded-md border border-neutral-300 px-3 py-1 ${
                  hasPrev ? "text-neutral-700 hover:bg-neutral-100" : "pointer-events-none opacity-50"
                }`}
                href={hasPrev ? buildHref({ search, offset: prevOffset }) : "#"}
              >
                Previous
              </a>
              <a
                aria-disabled={!hasNext}
                className={`rounded-md border border-neutral-300 px-3 py-1 ${
                  hasNext ? "text-neutral-700 hover:bg-neutral-100" : "pointer-events-none opacity-50"
                }`}
                href={hasNext ? buildHref({ search, offset: nextOffset }) : "#"}
              >
                Next
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
