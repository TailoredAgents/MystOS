import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import React from "react";

const API_BASE_URL =
  process.env["API_BASE_URL"] ??
  process.env["NEXT_PUBLIC_API_BASE_URL"] ??
  "http://localhost:3001";
const ADMIN_API_KEY = process.env["ADMIN_API_KEY"];

type AppointmentStatus = "requested" | "confirmed" | "completed" | "no_show" | "canceled";

interface AppointmentResponse {
  id: string;
  status: AppointmentStatus;
  startAt: string | null;
  durationMinutes: number | null;
  travelBufferMinutes: number | null;
  createdAt: string;
  updatedAt: string;
  leadId: string | null;
  services: string[];
  contact: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
  property: {
    id: string;
    addressLine1: string;
    city: string;
    state: string;
    postalCode: string;
  };
  calendarEventId: string | null;
  rescheduleToken: string;
  notes: Array<{
    id: string;
    body: string;
    createdAt: string;
  }>;
}

async function callAppointmentsApi(
  path: string,
  init?: RequestInit
): Promise<Response> {
  if (!ADMIN_API_KEY) {
    throw new Error("ADMIN_API_KEY must be set to access the admin board.");
  }

  const base = API_BASE_URL.replace(/\/$/, "");
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ADMIN_API_KEY,
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  return response;
}

export async function updateStatusAction(formData: FormData) {
  "use server";

  const appointmentId = formData.get("appointmentId");
  const status = formData.get("status");

  if (typeof appointmentId !== "string" || typeof status !== "string") {
    return;
  }

  const response = await callAppointmentsApi(
    `/api/appointments/${appointmentId}/status`,
    {
      method: "POST",
      body: JSON.stringify({ status })
    }
  );

  if (!response.ok) {
    console.warn("failed to update appointment status", {
      appointmentId,
      status,
      statusCode: response.status
    });
  }

  revalidatePath("/admin/estimates");
}

export async function addNoteAction(formData: FormData) {
  "use server";

  const appointmentId = formData.get("appointmentId");
  const body = formData.get("body");

  if (typeof appointmentId !== "string" || typeof body !== "string" || body.trim().length === 0) {
    return;
  }

  const response = await callAppointmentsApi(
    `/api/appointments/${appointmentId}/notes`,
    {
      method: "POST",
      body: JSON.stringify({ body })
    }
  );

  if (!response.ok) {
    console.warn("failed to add appointment note", {
      appointmentId,
      statusCode: response.status
    });
  }

  revalidatePath("/admin/estimates");
}

const STATUS_COLUMNS: Array<{
  key: Exclude<AppointmentStatus, "canceled">;
  title: string;
  description: string;
}> = [
  { key: "requested", title: "Requested", description: "New estimate requests awaiting scheduling." },
  { key: "confirmed", title: "Confirmed", description: "Site visits with date/time locked in." },
  { key: "completed", title: "Completed", description: "Finished estimates ready for follow-up." },
  { key: "no_show", title: "No-show", description: "Customer missed the appointment." }
];

function formatDate(iso: string | null) {
  if (!iso) {
    return "TBD";
  }
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function formatServices(services: string[]) {
  if (!services.length) {
    return "General exterior cleaning";
  }
  return services.join(", ");
}

export default async function EstimatesPage() {
  if (!ADMIN_API_KEY) {
    notFound();
  }

  const response = await callAppointmentsApi("/api/appointments?status=all");
  if (!response.ok) {
    throw new Error("Unable to load appointments");
  }

  const payload = (await response.json()) as { data: AppointmentResponse[] };
  const appointments = payload.data ?? [];

  const grouped = new Map<
    Exclude<AppointmentStatus, "canceled">,
    AppointmentResponse[]
  >();
  for (const column of STATUS_COLUMNS) {
    grouped.set(column.key, []);
  }

  for (const appointment of appointments) {
    if (appointment.status === "canceled") {
      continue;
    }
    const list = grouped.get(appointment.status);
    if (list) {
      list.push(appointment);
    }
  }

  return (
    <main className="space-y-10 px-6 py-10">
      <header className="max-w-5xl">
        <h1 className="font-display text-3xl text-primary-800">
          Estimate Pipeline
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          Track requested estimates, confirm arrival windows, and keep the team aligned with quick updates and notes.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-4">
        {STATUS_COLUMNS.map((column) => {
          const items = grouped.get(column.key) ?? [];
          return (
            <article
              key={column.key}
              className="flex h-full flex-col rounded-xl border border-neutral-200 bg-white shadow-soft"
            >
              <div className="border-b border-neutral-200 px-4 py-3">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-500">
                  {column.title}
                </h2>
                <p className="mt-1 text-xs text-neutral-500">{column.description}</p>
              </div>
              <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
                {items.length === 0 ? (
                  <p className="text-xs text-neutral-400">
                    Nothing here yet.
                  </p>
                ) : (
                  items.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-2">
                        <div>
                          <p className="text-sm font-semibold text-primary-800">
                            {appointment.contact.name}
                          </p>
                          <p className="text-xs text-neutral-500">
                            {formatServices(appointment.services)}
                          </p>
                        </div>
                        <div className="text-xs text-neutral-600">
                          <p>{appointment.property.addressLine1}</p>
                          <p>
                            {appointment.property.city}, {appointment.property.state} {appointment.property.postalCode}
                          </p>
                        </div>
                        <div className="text-xs text-neutral-600">
                          <span className="font-medium text-neutral-500">Visit:</span>{" "}
                          {formatDate(appointment.startAt)}
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-neutral-500">
                          {appointment.contact.phone ? (
                            <a
                              href={`tel:${appointment.contact.phone}`}
                              className="rounded-full border border-neutral-300 px-2 py-1 hover:border-accent-500 hover:text-accent-600"
                            >
                              Call
                            </a>
                          ) : null}
                          {appointment.contact.email ? (
                            <a
                              href={`mailto:${appointment.contact.email}`}
                              className="rounded-full border border-neutral-300 px-2 py-1 hover:border-accent-500 hover:text-accent-600"
                            >
                              Email
                            </a>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {column.key === "requested" ? (
                          <>
                            <form action={updateStatusAction}>
                              <input type="hidden" name="appointmentId" value={appointment.id} />
                              <input type="hidden" name="status" value="confirmed" />
                              <button
                                type="submit"
                                className="rounded-full bg-accent-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-accent-500"
                              >
                                Assign / Confirm
                              </button>
                            </form>
                            <form action={updateStatusAction}>
                              <input type="hidden" name="appointmentId" value={appointment.id} />
                              <input type="hidden" name="status" value="canceled" />
                              <button
                                type="submit"
                                className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 transition hover:border-neutral-400"
                              >
                                Cancel
                              </button>
                            </form>
                          </>
                        ) : null}

                        {column.key === "confirmed" ? (
                          <>
                            <form action={updateStatusAction}>
                              <input type="hidden" name="appointmentId" value={appointment.id} />
                              <input type="hidden" name="status" value="completed" />
                              <button
                                type="submit"
                                className="rounded-full bg-primary-800 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-700"
                              >
                                Mark complete
                              </button>
                            </form>
                            <form action={updateStatusAction}>
                              <input type="hidden" name="appointmentId" value={appointment.id} />
                              <input type="hidden" name="status" value="no_show" />
                              <button
                                type="submit"
                                className="rounded-full border border-warning px-3 py-1 text-xs text-warning transition hover:border-warning"
                              >
                                No-show
                              </button>
                            </form>
                          </>
                        ) : null}

                        {column.key === "completed" ? (
                          <form action={updateStatusAction}>
                            <input type="hidden" name="appointmentId" value={appointment.id} />
                            <input type="hidden" name="status" value="confirmed" />
                            <button
                              type="submit"
                              className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 transition hover:border-neutral-400"
                            >
                              Re-open
                            </button>
                          </form>
                        ) : null}

                        {column.key === "no_show" ? (
                          <form action={updateStatusAction}>
                            <input type="hidden" name="appointmentId" value={appointment.id} />
                            <input type="hidden" name="status" value="requested" />
                            <button
                              type="submit"
                              className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 transition hover:border-neutral-400"
                            >
                              Reschedule
                            </button>
                          </form>
                        ) : null}
                      </div>

                      <div className="mt-4 space-y-2">
                        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
                          Notes
                        </h3>
                        <div className="space-y-1 text-xs text-neutral-600">
                          {appointment.notes.length === 0 ? (
                            <p className="text-neutral-400">No notes yet.</p>
                          ) : (
                            appointment.notes.map((note) => (
                              <div
                                key={note.id}
                                className="rounded-md border border-neutral-200 bg-white px-2 py-1"
                              >
                                <p>{note.body}</p>
                                <p className="mt-1 text-[10px] text-neutral-400">
                                  {formatDate(note.createdAt)}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                        <form action={addNoteAction} className="flex gap-2">
                          <input type="hidden" name="appointmentId" value={appointment.id} />
                          <input
                            type="text"
                            name="body"
                            placeholder="Add note"
                            className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                          />
                          <button
                            type="submit"
                            className="rounded-md bg-primary-800 px-3 py-1 text-xs font-semibold text-white transition hover:bg-primary-700"
                          >
                            Save
                          </button>
                        </form>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
