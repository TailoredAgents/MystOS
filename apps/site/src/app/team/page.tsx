import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "../admin/login/LoginForm";
import { CrewLoginForm } from "../crew/login/LoginForm";
import { revalidatePath } from "next/cache";
import { CopyButton } from "@/components/CopyButton";
import { SubmitButton } from "@/components/SubmitButton";
import { QuotesList } from "./QuotesList";
import { PaymentsList } from "./PaymentsList";
import { availabilityWindows } from "@myst-os/pricing/src/config/defaults";
import React from "react";

const API_BASE_URL =
  process.env["API_BASE_URL"] ??
  process.env["NEXT_PUBLIC_API_BASE_URL"] ??
  "http://localhost:3001";
const ADMIN_API_KEY = process.env["ADMIN_API_KEY"];

const ADMIN_COOKIE = "myst-admin-session";
const CREW_COOKIE = "myst-crew-session";

type AppointmentStatus = "requested" | "confirmed" | "completed" | "no_show" | "canceled";

interface AppointmentDto {
  id: string;
  status: AppointmentStatus;
  startAt: string | null;
  durationMinutes: number | null;
  travelBufferMinutes: number | null;
  services: string[];
  rescheduleToken: string;
  contact: { id: string; name: string; email: string | null; phone: string | null };
  property: { id: string; addressLine1: string; city: string; state: string; postalCode: string };
  notes: Array<{ id: string; body: string; createdAt: string }>;
}

interface QuoteDto {
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
}

interface PaymentDto {
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
  appointment: null | { id: string; status: string; startAt: string | null; contactName: string | null };
}

async function callAdminApi(path: string, init?: RequestInit): Promise<Response> {
  if (!ADMIN_API_KEY) throw new Error("ADMIN_API_KEY must be set");
  const base = API_BASE_URL.replace(/\/$/, "");
  return fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ADMIN_API_KEY,
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });
}

function fmtTime(iso: string | null) {
  if (!iso) return "TBD";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }).format(d);
}

function fmtMoney(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

export async function updateApptStatus(formData: FormData) {
  "use server";
  const id = formData.get("appointmentId");
  const status = formData.get("status");
  if (typeof id !== "string" || typeof status !== "string") return;
  await callAdminApi(`/api/appointments/${id}/status`, { method: "POST", body: JSON.stringify({ status }) });
  const jar = await cookies();
  jar.set({ name: "myst-flash", value: "Appointment updated", path: "/" });
  revalidatePath("/team");
}

export async function addApptNote(formData: FormData) {
  "use server";
  const id = formData.get("appointmentId");
  const body = formData.get("body");
  if (typeof id !== "string" || typeof body !== "string" || body.trim().length === 0) return;
  await callAdminApi(`/api/appointments/${id}/notes`, { method: "POST", body: JSON.stringify({ body }) });
  const jar = await cookies();
  jar.set({ name: "myst-flash", value: "Note added", path: "/" });
  revalidatePath("/team");
}

export async function sendQuoteAction(formData: FormData) {
  "use server";
  const id = formData.get("quoteId");
  if (typeof id !== "string") return;
  await callAdminApi(`/api/quotes/${id}/send`, { method: "POST", body: JSON.stringify({}) });
  const jar = await cookies();
  jar.set({ name: "myst-flash", value: "Quote sent", path: "/" });
  revalidatePath("/team");
}

export async function quoteDecisionAction(formData: FormData) {
  "use server";
  const id = formData.get("quoteId");
  const decision = formData.get("decision");
  if (typeof id !== "string" || (decision !== "accepted" && decision !== "declined")) return;
  await callAdminApi(`/api/quotes/${id}/decision`, {
    method: "POST",
    body: JSON.stringify({ decision })
  });
  const jar = await cookies();
  jar.set({ name: "myst-flash", value: "Quote updated", path: "/" });
  revalidatePath("/team");
}

export async function attachPaymentAction(formData: FormData) {
  "use server";
  const id = formData.get("paymentId");
  const appt = formData.get("appointmentId");
  if (typeof id !== "string" || typeof appt !== "string" || appt.trim().length === 0) return;
  await callAdminApi(`/api/payments/${id}/attach`, { method: "POST", body: JSON.stringify({ appointmentId: appt }) });
  const jar = await cookies();
  jar.set({ name: "myst-flash", value: "Payment attached", path: "/" });
  revalidatePath("/team");
}

export async function detachPaymentAction(formData: FormData) {
  "use server";
  const id = formData.get("paymentId");
  if (typeof id !== "string") return;
  await callAdminApi(`/api/payments/${id}/detach`, { method: "POST" });
  const jar = await cookies();
  jar.set({ name: "myst-flash", value: "Payment detached", path: "/" });
  revalidatePath("/team");
}

export async function rescheduleAppointmentAction(formData: FormData) {
  "use server";
  const id = formData.get("appointmentId");
  const preferredDate = formData.get("preferredDate");
  const timeWindow = formData.get("timeWindow");

  const jar = await cookies();

  if (typeof id !== "string" || id.trim().length === 0 || typeof preferredDate !== "string" || preferredDate.trim().length === 0) {
    jar.set({ name: "myst-flash-error", value: "Missing date", path: "/" });
    revalidatePath("/team");
    return;
  }

  const body: Record<string, unknown> = {
    preferredDate
  };
  if (typeof timeWindow === "string" && timeWindow.length > 0) {
    body.timeWindow = timeWindow;
  }

  const response = await callAdminApi(`/api/web/appointments/${id}/reschedule`, {
    method: "POST",
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    let message = "Unable to reschedule";
    try {
      const data = (await response.json()) as { error?: string; message?: string };
      message = data.message ?? data.error ?? message;
    } catch {
      // ignore
    }
    jar.set({ name: "myst-flash-error", value: message, path: "/" });
  } else {
    jar.set({ name: "myst-flash", value: "Appointment rescheduled", path: "/" });
  }

  revalidatePath("/team");
}

export async function logoutCrew() {
  "use server";
  const jar = await cookies();
  jar.set({ name: CREW_COOKIE, value: "", path: "/", maxAge: 0 });
  redirect("/team");
}

export async function logoutOwner() {
  "use server";
  const jar = await cookies();
  jar.set({ name: ADMIN_COOKIE, value: "", path: "/", maxAge: 0 });
  redirect("/team");
}

function Tabs({ active, hasOwner, hasCrew }: { active: string; hasOwner: boolean; hasCrew: boolean }) {
  const mk = (tab: string, label: string, require?: "owner" | "crew") => {
    const disabled = (require === "owner" && !hasOwner) || (require === "crew" && !hasCrew);
    const href = `/team?tab=${encodeURIComponent(tab)}`;
    const cls = `rounded-md px-3 py-1 text-sm font-medium ${
      active === tab ? "bg-primary-50 text-primary-800 border border-primary-200" : "text-neutral-700 hover:bg-neutral-50 border border-transparent"
    } ${disabled ? "opacity-50 pointer-events-none" : ""}`;
    return <a key={tab} href={href} className={cls}>{label}</a>;
  };
  return (
    <nav className="flex flex-wrap gap-2">
      {mk("myday", "My Day", "crew")}
      {mk("estimates", "Estimates", "owner")}
      {mk("quotes", "Quotes", "owner")}
      {mk("payments", "Payments", "owner")}
      {mk("settings", "Settings")}
    </nav>
  );
}

async function MyDay() {
  const res = await callAdminApi("/api/appointments?status=confirmed");
  if (!res.ok) throw new Error("Failed to load appointments");
  const payload = (await res.json()) as { ok: boolean; data: AppointmentDto[] };
  const appts = (payload.data ?? []).sort((a, b) => (a.startAt && b.startAt ? Date.parse(a.startAt) - Date.parse(b.startAt) : 0));
  return (
    <section className="space-y-4">
      {appts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-500">No confirmed visits.</p>
      ) : (
        appts.map((a) => (
          <article key={a.id} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Confirmed</span>
              <span>{fmtTime(a.startAt)}</span>
              <span>•</span>
              <span>{a.services[0] ?? "Exterior cleaning"}{a.services.length > 1 ? ` +${a.services.length - 1}` : ""}</span>
            </div>
            <h3 className="mt-1 text-lg font-semibold text-primary-900">{a.contact.name}</h3>
            <p className="text-sm text-neutral-600">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${a.property.addressLine1}, ${a.property.city}, ${a.property.state} ${a.property.postalCode}`)}`}
                target="_blank"
                rel="noreferrer"
                className="underline-offset-2 hover:underline"
              >
                {a.property.addressLine1}, {a.property.city}, {a.property.state} {a.property.postalCode}
              </a>
              <span className="ml-2 inline-block align-middle"><CopyButton value={`${a.property.addressLine1}, ${a.property.city}, ${a.property.state} ${a.property.postalCode}`} label="Copy" /></span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={updateApptStatus}><input type="hidden" name="appointmentId" value={a.id} /><input type="hidden" name="status" value="completed" /><SubmitButton className="rounded-md bg-primary-800 px-3 py-1 text-xs font-semibold text-white hover:bg-primary-700" pendingLabel="Saving...">Mark complete</SubmitButton></form>
              <form action={updateApptStatus}><input type="hidden" name="appointmentId" value={a.id} /><input type="hidden" name="status" value="no_show" /><SubmitButton className="rounded-md border border-warning px-3 py-1 text-xs text-warning" pendingLabel="Saving...">No-show</SubmitButton></form>
              <a href={`/schedule?appointmentId=${encodeURIComponent(a.id)}&token=${encodeURIComponent(a.rescheduleToken)}`} className="rounded-md border border-accent-400 bg-accent-50 px-3 py-1 text-xs font-medium text-accent-700 hover:bg-accent-100">Reschedule</a>
            </div>
            <details className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
              <summary className="cursor-pointer text-sm font-medium text-neutral-700">Reschedule in console</summary>
              <form action={rescheduleAppointmentAction} className="mt-2 flex flex-col gap-2 text-xs">
                <input type="hidden" name="appointmentId" value={a.id} />
                <label className="flex flex-col gap-1">
                  <span>Date</span>
                  <input type="date" name="preferredDate" defaultValue={a.startAt ? a.startAt.slice(0, 10) : ""} required className="rounded-md border border-neutral-300 px-2 py-1" />
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
                <SubmitButton className="self-start rounded-md bg-primary-800 px-3 py-1 text-xs font-semibold text-white" pendingLabel="Saving...">Save new time</SubmitButton>
              </form>
            </details>
            <div className="mt-2 text-xs text-neutral-600">
              {a.contact.phone ? (
                <>
                  <a href={`tel:${a.contact.phone}`} className="underline-offset-2 hover:underline">Call {a.contact.phone}</a>
                  <span className="ml-2 inline-block align-middle"><CopyButton value={a.contact.phone} label="Copy" /></span>
                </>
              ) : null}
            </div>
            <form action={addApptNote} className="mt-3 flex gap-2"><input type="hidden" name="appointmentId" value={a.id} /><input name="body" placeholder="Add note" className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-xs" /><SubmitButton className="rounded-md bg-neutral-800 px-3 py-1 text-xs font-semibold text-white hover:bg-neutral-700" pendingLabel="Saving...">Save</SubmitButton></form>
          </article>
        ))
      )}
    </section>
  );
}

async function Estimates() {
  const res = await callAdminApi("/api/appointments?status=all");
  if (!res.ok) throw new Error("Failed to load appointments");
  const payload = (await res.json()) as { ok: boolean; data: AppointmentDto[] };
  const byStatus: Record<AppointmentStatus, AppointmentDto[]> = { requested: [], confirmed: [], completed: [], no_show: [], canceled: [] } as any;
  for (const a of payload.data ?? []) byStatus[a.status]?.push(a);
  const order: AppointmentStatus[] = ["requested", "confirmed", "completed", "no_show", "canceled"];
  return (
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {order.filter((s) => s !== "canceled").map((s) => (
        <div key={s} className="rounded-lg border border-neutral-200 bg-white shadow-sm">
          <header className="border-b border-neutral-200 px-4 py-2"><h3 className="text-sm font-semibold text-primary-900 capitalize">{s.replace("_", " ")}</h3><p className="text-xs text-neutral-500">{byStatus[s].length} appt(s)</p></header>
          <ul className="divide-y divide-neutral-200">
            {byStatus[s].map((a) => (
              <li key={a.id} className="px-4 py-3">
                <p className="text-sm text-neutral-600">{fmtTime(a.startAt)} • {a.contact.name}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {s === "requested" && (
                    <>
                      <form action={updateApptStatus}><input type="hidden" name="appointmentId" value={a.id} /><input type="hidden" name="status" value="confirmed" /><SubmitButton className="rounded-full bg-accent-600 px-3 py-1 text-xs font-semibold text-white" pendingLabel="Saving...">Assign / Confirm</SubmitButton></form>
                      <form action={updateApptStatus}><input type="hidden" name="appointmentId" value={a.id} /><input type="hidden" name="status" value="canceled" /><SubmitButton className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600" pendingLabel="Saving...">Cancel</SubmitButton></form>
                    </>
                  )}
                  {s === "confirmed" && (
                    <>
                      <form action={updateApptStatus}><input type="hidden" name="appointmentId" value={a.id} /><input type="hidden" name="status" value="completed" /><SubmitButton className="rounded-full bg-primary-800 px-3 py-1 text-xs font-semibold text-white" pendingLabel="Saving...">Mark complete</SubmitButton></form>
                      <form action={updateApptStatus}><input type="hidden" name="appointmentId" value={a.id} /><input type="hidden" name="status" value="no_show" /><SubmitButton className="rounded-full border border-warning px-3 py-1 text-xs text-warning" pendingLabel="Saving...">No-show</SubmitButton></form>
                    </>
                  )}
                </div>
                <details className="mt-2 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
                  <summary className="cursor-pointer text-xs font-medium text-neutral-700">Reschedule</summary>
                  <form action={rescheduleAppointmentAction} className="mt-2 flex flex-col gap-2">
                    <input type="hidden" name="appointmentId" value={a.id} />
                    <label className="flex flex-col gap-1">
                      <span>Date</span>
                      <input type="date" name="preferredDate" defaultValue={a.startAt ? a.startAt.slice(0, 10) : ""} required className="rounded-md border border-neutral-300 px-2 py-1" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span>Time window</span>
                      <select name="timeWindow" defaultValue="" className="rounded-md border border-neutral-300 px-2 py-1" required>
                        <option value="" disabled>Select window</option>
                        {availabilityWindows.map((window) => (
                          <option key={window.id} value={window.id}>
                            {window.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <SubmitButton className="self-start rounded-md bg-primary-800 px-3 py-1 text-xs font-semibold text-white" pendingLabel="Saving...">Save new time</SubmitButton>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

async function Quotes() {
  const res = await callAdminApi("/api/quotes");
  if (!res.ok) throw new Error("Failed to load quotes");
  const payload = (await res.json()) as { quotes: QuoteDto[] };
  return <QuotesList initial={payload.quotes} sendAction={sendQuoteAction} decisionAction={quoteDecisionAction} />;
}

async function Payments() {
  const res = await callAdminApi("/api/payments?status=all");
  if (!res.ok) throw new Error("Failed to load payments");
  const payload = (await res.json()) as { payments: PaymentDto[]; summary: { total: number; matched: number; unmatched: number } };
  return <PaymentsList initial={payload.payments} summary={payload.summary} attachAction={attachPaymentAction} detachAction={detachPaymentAction} />;
}

export const metadata = { title: "Myst Team Console" };

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const hasOwner = cookieStore.get(ADMIN_COOKIE)?.value ? true : false;
  const hasCrew = cookieStore.get(CREW_COOKIE)?.value ? true : false;

  const tab = params?.tab || (hasCrew && !hasOwner ? "myday" : "estimates");

  const flash = cookieStore.get("myst-flash")?.value;
  const flashError = cookieStore.get("myst-flash-error")?.value;
  if (flash) {
    cookieStore.set({ name: "myst-flash", value: "", path: "/", maxAge: 0 });
  }
  if (flashError) {
    cookieStore.set({ name: "myst-flash-error", value: "", path: "/", maxAge: 0 });
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Myst Team</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold text-primary-900">Team Console</h1>
          <Tabs active={tab} hasOwner={hasOwner} hasCrew={hasCrew} />
        </div>
      </header>

      {flash ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{flash}</div>
      ) : null}
      {flashError ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{flashError}</div>
      ) : null}

      {/* Inline login prompts if required for the active tab */}
      {tab === "myday" && !hasCrew ? (
        <section className="max-w-md"><CrewLoginForm redirectTo="/team?tab=myday" /></section>
      ) : tab !== "myday" && !hasOwner ? (
        <section className="max-w-md"><AdminLoginForm redirectTo={`/team?tab=${encodeURIComponent(tab)}`} /></section>
      ) : null}

      {/* Content */}
      {tab === "myday" && hasCrew ? (
        <React.Suspense fallback={<div className="rounded-md border border-neutral-200 bg-white p-6 text-sm text-neutral-500">Loading My Day…</div>}>
          <MyDay />
        </React.Suspense>
      ) : null}
      {tab === "estimates" && hasOwner ? (
        <React.Suspense fallback={<div className="rounded-md border border-neutral-200 bg-white p-6 text-sm text-neutral-500">Loading Estimates…</div>}>
          <Estimates />
        </React.Suspense>
      ) : null}
      {tab === "quotes" && hasOwner ? (
        <React.Suspense fallback={<div className="rounded-md border border-neutral-200 bg-white p-6 text-sm text-neutral-500">Loading Quotes…</div>}>
          <Quotes />
        </React.Suspense>
      ) : null}
      {tab === "payments" && hasOwner ? (
        <React.Suspense fallback={<div className="rounded-md border border-neutral-200 bg-white p-6 text-sm text-neutral-500">Loading Payments…</div>}>
          <Payments />
        </React.Suspense>
      ) : null}
      {tab === "settings" ? (
        <section className="space-y-4 text-sm text-neutral-700">
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-primary-900">Sessions</h2>
            <div className="flex gap-2">
              <form action={logoutCrew}><button className="rounded-md border border-neutral-300 px-3 py-1 text-xs text-neutral-700">Log out crew</button></form>
              <form action={logoutOwner}><button className="rounded-md border border-neutral-300 px-3 py-1 text-xs text-neutral-700">Log out owner</button></form>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}

