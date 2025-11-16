import React, { type ReactElement } from "react";
import { availabilityWindows, zones } from "@myst-os/pricing/src/config/defaults";
import { CopyButton } from "@/components/CopyButton";
import { SubmitButton } from "@/components/SubmitButton";
import {
  addApptNote,
  createQuoteAction,
  rescheduleAppointmentAction,
  updateApptStatus
} from "../actions";
import { callAdminApi, fmtTime } from "../lib/api";
import { ContextSummaryButton } from "./ContextSummaryButton";

type AppointmentStatus = "requested" | "confirmed" | "completed" | "no_show" | "canceled";

interface AppointmentDto {
  id: string;
  status: AppointmentStatus;
  startAt: string | null;
  durationMinutes: number | null;
  travelBufferMinutes: number | null;
  services: string[];
  rescheduleToken: string;
  contact: {
    id: string | null;
    name: string;
    email: string | null;
    phone: string | null;
  };
  property: {
    id: string | null;
    addressLine1: string;
    city: string;
    state: string;
    postalCode: string;
  };
  notes: Array<{ id: string; body: string; createdAt: string }>;
  quote: {
    id: string;
    status: string | null;
    total: number;
    lineItems: Array<Record<string, unknown>>;
  } | null;
  paymentSummary: {
    totalCents: number | null;
    paidCents: number;
    outstandingCents: number | null;
    lastPaymentAt: string | null;
    lastPaymentMethod: string | null;
  } | null;
}

export async function MyDaySection({
  focusAppointmentId
}: {
  focusAppointmentId?: string;
} = {}): Promise<ReactElement> {
  const res = await callAdminApi("/api/appointments?status=confirmed");
  if (!res.ok) {
    throw new Error("Failed to load appointments");
  }
  const payload = (await res.json()) as { ok: boolean; data: AppointmentDto[] };
  const appts = (payload.data ?? []).sort((a, b) => {
    const ax = a.startAt ? Date.parse(a.startAt) : 0;
    const bx = b.startAt ? Date.parse(b.startAt) : 0;
    return ax - bx;
  });

  const focusId = focusAppointmentId?.trim() ?? "";
  const focusIndex = focusId ? appts.findIndex((appt) => appt.id === focusId) : -1;
  const ordered =
    focusIndex > -1 ? [appts[focusIndex], ...appts.filter((_, idx) => idx !== focusIndex)] : appts;
  const focusMissing = Boolean(focusId) && focusIndex === -1;

  return (
    <section className="space-y-4">
      {focusId ? (
        <div className="rounded-lg border border-primary-100 bg-primary-50/60 p-3 text-xs text-primary-800">
          {focusMissing
            ? "Requested job is not in today's confirmed list. Showing all confirmed jobs."
            : "Showing requested job first so you can jump straight to it."}
        </div>
      ) : null}
      {ordered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-500">
          No confirmed visits.
        </p>
      ) : (
        ordered.map((a) => {
          if (!a) {
            return null;
          }
          const isFocus = Boolean(focusId) && a.id === focusId;
          const articleClass = [
            "rounded-lg border bg-white p-4 shadow-sm",
            isFocus ? "border-primary-300 shadow-primary-200/70 ring-1 ring-primary-200" : "border-neutral-200"
          ].join(" ");
          return (
            <article key={a.id} id={`appointment-${a.id}`} className={articleClass}>
            {isFocus ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-600">
                Focused from Quotes tab
              </p>
            ) : null}
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                Confirmed
              </span>
              <span>{fmtTime(a.startAt)}</span>
              <span>•</span>
              <span>
                {a.services[0] ?? "Exterior cleaning"}
                {a.services.length > 1 ? ` +${a.services.length - 1}` : ""}
              </span>
            </div>
            <h3 className="mt-1 text-lg font-semibold text-primary-900">{a.contact.name}</h3>
            <p className="text-sm text-neutral-600">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${a.property.addressLine1}, ${a.property.city}, ${a.property.state} ${a.property.postalCode}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="underline-offset-2 hover:underline"
              >
                {a.property.addressLine1}, {a.property.city}, {a.property.state} {a.property.postalCode}
              </a>
              <span className="ml-2 inline-block align-middle">
                <CopyButton
                  value={`${a.property.addressLine1}, ${a.property.city}, ${a.property.state} ${a.property.postalCode}`}
                  label="Copy"
                />
              </span>
            </p>
            {a.paymentSummary ? (
              <div
                className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
                  typeof a.paymentSummary.outstandingCents === "number" && a.paymentSummary.outstandingCents > 0
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800"
                }`}
              >
                <p className="font-semibold">
                  Payments: {formatMoneyFromCents(a.paymentSummary.paidCents)}{" "}
                  {typeof a.paymentSummary.totalCents === "number"
                    ? ` / ${formatMoneyFromCents(a.paymentSummary.totalCents)}`
                    : ""}
                </p>
                {typeof a.paymentSummary.outstandingCents === "number" ? (
                  <p>
                    {a.paymentSummary.outstandingCents > 0
                      ? `${formatMoneyFromCents(a.paymentSummary.outstandingCents)} outstanding`
                      : "Paid in full"}
                    {a.paymentSummary.lastPaymentMethod ? ` · ${a.paymentSummary.lastPaymentMethod}` : ""}
                    {a.paymentSummary.lastPaymentAt
                      ? ` · ${new Date(a.paymentSummary.lastPaymentAt).toLocaleDateString()}`
                      : ""}
                  </p>
                ) : null}
              </div>
            ) : null}
            {a.contact.id ? (
              <ContextSummaryButton
                contactId={a.contact.id}
                appointmentId={a.id}
                className="mt-2"
                label="AI customer summary"
              />
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <form action={updateApptStatus}>
                <input type="hidden" name="appointmentId" value={a.id} />
                <input type="hidden" name="status" value="completed" />
                <SubmitButton className="rounded-md bg-primary-800 px-3 py-1 text-xs font-semibold text-white hover:bg-primary-700" pendingLabel="Saving...">
                  Mark complete
                </SubmitButton>
              </form>
              <form action={updateApptStatus}>
                <input type="hidden" name="appointmentId" value={a.id} />
                <input type="hidden" name="status" value="no_show" />
                <SubmitButton className="rounded-md border border-warning px-3 py-1 text-xs text-warning" pendingLabel="Saving...">
                  No-show
                </SubmitButton>
              </form>
              <a
                href={`/schedule?appointmentId=${encodeURIComponent(a.id)}&token=${encodeURIComponent(a.rescheduleToken)}`}
                className="rounded-md border border-accent-400 bg-accent-50 px-3 py-1 text-xs font-medium text-accent-700 hover:bg-accent-100"
              >
                Reschedule link
              </a>
            </div>

            <details className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
              <summary className="cursor-pointer text-sm font-medium text-neutral-700">Reschedule in console</summary>
              <form action={rescheduleAppointmentAction} className="mt-2 flex flex-col gap-2 text-xs">
                <input type="hidden" name="appointmentId" value={a.id} />
                <label className="flex flex-col gap-1">
                  <span>Date</span>
                  <input
                    type="date"
                    name="preferredDate"
                    defaultValue={a.startAt ? a.startAt.slice(0, 10) : ""}
                    required
                    className="rounded-md border border-neutral-300 px-2 py-1"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span>Time window</span>
                  <select name="timeWindow" defaultValue="" className="rounded-md border border-neutral-300 px-2 py-1" required>
                    <option value="" disabled>
                      Select window
                    </option>
                    {availabilityWindows.map((window) => (
                      <option key={window.id} value={window.id}>
                        {window.label}
                      </option>
                    ))}
                  </select>
                </label>
                <SubmitButton className="self-start rounded-md bg-primary-800 px-3 py-1 text-xs font-semibold text-white" pendingLabel="Saving...">
                  Save new time
                </SubmitButton>
              </form>
            </details>

            {a.contact.id && a.property.id ? (
              <details className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
                <summary className="cursor-pointer text-sm font-medium text-neutral-700">Create quote</summary>
                <form action={createQuoteAction} className="mt-2 flex flex-col gap-2 text-xs">
                  <input type="hidden" name="appointmentId" value={a.id} />
                  <input type="hidden" name="contactId" value={a.contact.id} />
                  <input type="hidden" name="propertyId" value={a.property.id} />
                  <input type="hidden" name="services" value={JSON.stringify(a.services ?? [])} />
                  <label className="flex flex-col gap-1">
                    <span>Zone</span>
                    <select name="zoneId" defaultValue={zones[0]?.id ?? "zone-core"} className="rounded-md border border-neutral-300 px-2 py-1" required>
                      {zones.map((zone) => (
                        <option key={zone.id} value={zone.id}>
                          {zone.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span>General surface area (sq ft)</span>
                    <input type="number" name="surfaceArea" min="0" step="1" placeholder="Optional" className="rounded-md border border-neutral-300 px-2 py-1" />
                  </label>
                  <div className="space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                    <span className="text-xs font-semibold text-neutral-700">Concrete surfaces (optional)</span>
                    {[1, 2, 3].map((index) => (
                      <div key={index} className="flex flex-col gap-2 sm:flex-row">
                        <select
                          name={`concreteSurface${index}Kind`}
                          defaultValue=""
                          className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-700"
                        >
                          <option value="">Select surface</option>
                          <option value="driveway">Driveway</option>
                          <option value="deck">Deck/Patio</option>
                          <option value="other">Other</option>
                        </select>
                        <input
                          name={`concreteSurface${index}Sqft`}
                          type="number"
                          min="0"
                          step="1"
                          placeholder="Sq ft"
                          className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
                        />
                      </div>
                    ))}
                    <p className="text-[11px] text-neutral-500">Priced automatically at $0.14 per sq ft.</p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs text-neutral-700">
                    <input type="checkbox" name="applyBundles" defaultChecked className="rounded border-neutral-300" />
                    Apply bundle discounts
                  </label>
                  <label className="flex flex-col gap-1">
                    <span>Notes</span>
                    <textarea name="notes" rows={3} placeholder="Optional quote notes" className="rounded-md border border-neutral-300 px-2 py-1"></textarea>
                  </label>
                  <SubmitButton className="self-start rounded-md bg-primary-800 px-3 py-1 text-xs font-semibold text-white" pendingLabel="Creating...">
                    Create quote
                  </SubmitButton>
                </form>
              </details>
            ) : null}

            <div className="mt-2 text-xs text-neutral-600">
              {a.contact.phone ? (
                <>
                  <a href={`tel:${a.contact.phone}`} className="underline-offset-2 hover:underline">
                    Call {a.contact.phone}
                  </a>
                  <span className="ml-2 inline-block align-middle">
                    <CopyButton value={a.contact.phone} label="Copy" />
                  </span>
                </>
              ) : null}
            </div>
            <form action={addApptNote} className="mt-3 flex gap-2">
              <input type="hidden" name="appointmentId" value={a.id} />
              <input name="body" placeholder="Add note" className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-xs" />
              <SubmitButton className="rounded-md bg-neutral-800 px-3 py-1 text-xs font-semibold text-white hover:bg-neutral-700" pendingLabel="Saving...">
                Save
              </SubmitButton>
            </form>
          </article>
        );
      })
      )}
    </section>
  );
}

const moneyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function formatMoneyFromCents(cents: number | null | undefined): string {
  if (typeof cents !== "number") {
    return "—";
  }
  return moneyFormatter.format(cents / 100);
}
