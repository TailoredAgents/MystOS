import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CREW_SESSION_COOKIE, getCrewKey } from "@/lib/crew-session";
import { revalidatePath } from "next/cache";

const API_BASE_URL =
  process.env["API_BASE_URL"] ??
  process.env["NEXT_PUBLIC_API_BASE_URL"] ??
  "http://localhost:3001";
const ADMIN_API_KEY = process.env["ADMIN_API_KEY"];

type AppointmentStatus = "requested" | "confirmed" | "completed" | "no_show" | "canceled";

interface Appointment {
  id: string;
  status: AppointmentStatus;
  startAt: string | null;
  durationMinutes: number | null;
  travelBufferMinutes: number | null;
  services: string[];
  rescheduleToken: string;
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
  notes: Array<{ id: string; body: string; createdAt: string }>;
}

async function callAdminApi(path: string, init?: RequestInit): Promise<Response> {
  if (!ADMIN_API_KEY) {
    throw new Error("ADMIN_API_KEY must be set for crew actions.");
  }
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

function formatTime(iso: string | null) {
  if (!iso) return "TBD";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }).format(d);
}

function servicesLabel(services: string[]) {
  if (!services.length) return "Exterior cleaning";
  if (services.length === 1) return services[0];
  return `${services[0]} +${services.length - 1}`;
}

export async function updateStatusAction(formData: FormData) {
  "use server";
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_SESSION_COOKIE)?.value;
  if (token !== getCrewKey()) {
    redirect("/crew/login?redirectTo=/crew");
  }

  const id = formData.get("appointmentId");
  const status = formData.get("status");
  if (typeof id !== "string" || typeof status !== "string") return;

  await callAdminApi(`/api/appointments/${id}/status`, { method: "POST", body: JSON.stringify({ status }) });
  revalidatePath("/crew");
}

export async function addNoteAction(formData: FormData) {
  "use server";
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_SESSION_COOKIE)?.value;
  if (token !== getCrewKey()) {
    redirect("/crew/login?redirectTo=/crew");
  }

  const id = formData.get("appointmentId");
  const body = formData.get("body");
  if (typeof id !== "string" || typeof body !== "string" || body.trim().length === 0) return;

  await callAdminApi(`/api/appointments/${id}/notes`, { method: "POST", body: JSON.stringify({ body }) });
  revalidatePath("/crew");
}

export default async function CrewMyDayPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_SESSION_COOKIE)?.value;
  if (token !== getCrewKey()) {
    redirect("/crew/login?redirectTo=/crew");
  }

  const res = await callAdminApi("/api/appointments?status=confirmed");
  if (!res.ok) {
    throw new Error(`Failed to load appointments: ${res.status}`);
  }

  const payload = (await res.json()) as { ok: boolean; data: Appointment[] };
  const appts = (payload.data ?? []).sort((a, b) => {
    const ax = a.startAt ? Date.parse(a.startAt) : 0;
    const bx = b.startAt ? Date.parse(b.startAt) : 0;
    return ax - bx;
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-primary-900">My Day</h1>
        <p className="text-sm text-neutral-600">Today\'s confirmed visits</p>
      </header>

      {appts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-500">
          No confirmed visits yet.
        </p>
      ) : (
        <ul className="space-y-4">
          {appts.map((a) => (
            <li key={a.id} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    Confirmed
                  </span>
                  <span>{formatTime(a.startAt)}</span>
                  <span>•</span>
                  <span>{servicesLabel(a.services)}</span>
                </div>
                <h3 className="text-lg font-semibold text-primary-900">{a.contact.name}</h3>
                <p className="text-sm text-neutral-600">
                  {a.property.addressLine1}, {a.property.city}, {a.property.state} {a.property.postalCode}
                </p>
                {a.contact.phone ? (
                  <p className="text-xs text-neutral-500">Phone: {a.contact.phone}</p>
                ) : null}
              </div>

              {a.notes.length ? (
                <div className="mt-3 rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                  <p className="font-medium text-neutral-700">Notes</p>
                  <ul className="mt-1 space-y-1">
                    {a.notes.slice(0, 3).map((n) => (
                      <li key={n.id} className="line-clamp-2">{n.body}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                <form action={updateStatusAction}>
                  <input type="hidden" name="appointmentId" value={a.id} />
                  <input type="hidden" name="status" value="completed" />
                  <button className="rounded-md bg-primary-800 px-3 py-1 text-xs font-semibold text-white hover:bg-primary-700">
                    Mark complete
                  </button>
                </form>
                <form action={updateStatusAction}>
                  <input type="hidden" name="appointmentId" value={a.id} />
                  <input type="hidden" name="status" value="no_show" />
                  <button className="rounded-md border border-warning px-3 py-1 text-xs text-warning">
                    No-show
                  </button>
                </form>
                <a
                  href={`/schedule?appointmentId=${encodeURIComponent(a.id)}&token=${encodeURIComponent(a.rescheduleToken)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-accent-400 bg-accent-50 px-3 py-1 text-xs font-medium text-accent-700 hover:bg-accent-100"
                >
                  Reschedule link
                </a>
              </div>

              <form action={addNoteAction} className="mt-3 flex gap-2">
                <input type="hidden" name="appointmentId" value={a.id} />
                <input
                  type="text"
                  name="body"
                  placeholder="Add note"
                  className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                />
                <button className="rounded-md bg-neutral-800 px-3 py-1 text-xs font-semibold text-white hover:bg-neutral-700">
                  Save
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

