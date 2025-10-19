import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";

const API_BASE_URL =
  process.env["API_BASE_URL"] ??
  process.env["NEXT_PUBLIC_API_BASE_URL"] ??
  "http://localhost:3001";
const ADMIN_API_KEY = process.env["ADMIN_API_KEY"];

type PaymentResponse = {
  id: string;
  stripeChargeId: string;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  cardBrand: string | null;
  last4: string | null;
  receiptUrl: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  capturedAt: string | null;
  appointment: {
    id: string;
    status: string;
    startAt: string | null;
    updatedAt: string | null;
    contactId: string | null;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    contactPhoneE164: string | null;
  } | null;
};

type PaymentsSummary = {
  total: number;
  matched: number;
  unmatched: number;
};

function isPaymentsPayload(value: unknown): value is { payments: PaymentResponse[]; summary?: PaymentsSummary } {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  const paymentsValue = record["payments"];
  if (!Array.isArray(paymentsValue)) {
    return false;
  }

  const summary = record["summary"];
  if (summary !== undefined) {
    if (!summary || typeof summary !== "object") {
      return false;
    }
    const summaryRecord = summary as Record<string, unknown>;
    const validNumber = (key: string) => summaryRecord[key] === undefined || typeof summaryRecord[key] === "number";
    if (!validNumber("total") || !validNumber("matched") || !validNumber("unmatched")) {
      return false;
    }
  }

  return true;
}

async function callPaymentsApi(path: string, init?: RequestInit): Promise<Response> {
  if (!ADMIN_API_KEY) {
    throw new Error("ADMIN_API_KEY must be set to access the admin payments board.");
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

function formatAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount / 100);
  } catch {
    return `${amount / 100} ${currency.toUpperCase()}`;
  }
}

function formatDate(iso: string | null) {
  if (!iso) {
    return "—";
  }
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export async function attachPaymentAction(formData: FormData) {
  "use server";

  const paymentId = formData.get("paymentId");
  const appointmentId = formData.get("appointmentId");

  if (typeof paymentId !== "string" || paymentId.trim().length === 0) {
    return;
  }

  if (typeof appointmentId !== "string" || appointmentId.trim().length === 0) {
    return;
  }

  const response = await callPaymentsApi(`/api/payments/${paymentId}/attach`, {
    method: "POST",
    body: JSON.stringify({ appointmentId })
  });

  if (!response.ok) {
    console.warn("failed to attach payment", {
      paymentId,
      appointmentId,
      status: response.status
    });
  }

  revalidatePath("/admin/payments");
}

export async function detachPaymentAction(formData: FormData) {
  "use server";

  const paymentId = formData.get("paymentId");
  if (typeof paymentId !== "string" || paymentId.trim().length === 0) {
    return;
  }

  const response = await callPaymentsApi(`/api/payments/${paymentId}/detach`, {
    method: "POST"
  });

  if (!response.ok) {
    console.warn("failed to detach payment", {
      paymentId,
      status: response.status
    });
  }

  revalidatePath("/admin/payments");
}

const FILTERS = [
  { key: "unmatched", label: "Unmatched" },
  { key: "matched", label: "Matched" },
  { key: "all", label: "All" }
];

export default async function PaymentsPage({ searchParams }: { searchParams?: { filter?: string } }) {
  if (!ADMIN_API_KEY) {
    notFound();
  }

  const filter = FILTERS.some((f) => f.key === searchParams?.filter) ? searchParams!.filter! : "unmatched";
  const params = filter === "all" ? "" : `?status=${filter}`;

  const response = await callPaymentsApi(`/api/payments${params}`);
  if (!response.ok) {
    throw new Error("Unable to load payments");
  }

  const raw = (await response.json()) as unknown;
  if (!isPaymentsPayload(raw)) {
    throw new Error("Invalid payments response from API");
  }

  const { payments, summary } = raw;

  const summaryData: PaymentsSummary = summary
    ? {
        total: typeof summary.total === "number" ? summary.total : payments.length,
        matched: typeof summary.matched === "number" ? summary.matched : 0,
        unmatched: typeof summary.unmatched === "number" ? summary.unmatched : Math.max(payments.length - (summary.matched ?? 0), 0)
      }
    : { total: payments.length, matched: 0, unmatched: payments.length };
  const filterCounts: Record<string, number> = {
    all: summaryData.total,
    matched: summaryData.matched,
    unmatched: summaryData.unmatched
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary-900">Payments</h1>
          <p className="text-sm text-neutral-600">Review imported Stripe charges and reconcile them with appointments.</p>
        </div>
        <nav className="flex items-center gap-2">
          {FILTERS.map((item) => {
            const isActive = item.key === filter;
            const href = item.key === "all" ? "/admin/payments" : `/admin/payments?filter=${item.key}`;
            const count = filterCounts[item.key] ?? 0;
            return (
              <Link
                key={item.key}
                href={href}
                className={`rounded-md px-3 py-1 text-sm font-medium ${
                  isActive ? "bg-primary-900 text-white" : "bg-neutral-200 text-neutral-700"
                }`}
              >
                {item.label} ({count})
              </Link>
            );
          })}
        </nav>
      </header>

      <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Unmatched charges</dt>
            <dd className="text-2xl font-semibold text-primary-900">{summaryData.unmatched}</dd>
            <p className="text-xs text-neutral-500">Charges waiting to be linked to an appointment.</p>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Matched</dt>
            <dd className="text-2xl font-semibold text-primary-900">{summaryData.matched}</dd>
            <p className="text-xs text-neutral-500">Charges attached to an appointment.</p>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Total imported</dt>
            <dd className="text-2xl font-semibold text-primary-900">{summaryData.total}</dd>
            <p className="text-xs text-neutral-500">Last synced via Stripe API.</p>
          </div>
        </dl>
      </section>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-600">
            <tr>
              <th className="px-4 py-3">Charge</th>
              <th className="px-4 py-3">Details</th>
              <th className="px-4 py-3">Appointment</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 text-sm text-neutral-700">
            {payments.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-neutral-500">
                  No payments found.
                </td>
              </tr>
            ) : (
              payments.map((payment) => {
                const amount = formatAmount(payment.amount, payment.currency);
                const paymentMetadata = payment.metadata ? JSON.stringify(payment.metadata, null, 2) : "{}";
                const appointment = payment.appointment;

                return (
                  <tr key={payment.id}>
                    <td className="whitespace-nowrap px-4 py-3 align-top">
                      <div className="space-y-1">
                        <div className="font-medium text-primary-900">{amount}</div>
                        <div className="text-xs text-neutral-500">{payment.status.toUpperCase()}</div>
                        <div className="text-xs text-neutral-500">{formatDate(payment.capturedAt ?? payment.createdAt)}</div>
                        <div className="text-xs text-neutral-500">Charge ID: {payment.stripeChargeId}</div>
                        {payment.receiptUrl ? (
                          <a className="text-xs text-accent-600" href={payment.receiptUrl} target="_blank" rel="noreferrer">
                            View receipt
                          </a>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="space-y-1">
                        <div className="text-xs text-neutral-600">
                          Method: {payment.method ?? "—"}
                          {payment.cardBrand ? ` / ${payment.cardBrand.toUpperCase()} ${payment.last4 ?? ""}` : null}
                        </div>
                        <details className="rounded border border-neutral-200 bg-neutral-50 p-2 text-xs text-neutral-600">
                          <summary className="cursor-pointer font-medium text-neutral-700">Metadata</summary>
                          <pre className="mt-2 whitespace-pre-wrap text-[11px]">{paymentMetadata}</pre>
                        </details>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {appointment ? (
                        <div className="space-y-1">
                          <div className="font-medium text-primary-900">{appointment.contactName ?? "Unknown contact"}</div>
                          <div className="text-xs text-neutral-500">Appointment ID: {appointment.id}</div>
                          <div className="text-xs text-neutral-500">Status: {appointment.status}</div>
                          <div className="text-xs text-neutral-500">Scheduled: {formatDate(appointment.startAt)}</div>
                          {appointment.contactEmail ? (
                            <div className="text-xs text-neutral-500">Email: {appointment.contactEmail}</div>
                          ) : null}
                          {appointment.contactPhoneE164 ? (
                            <div className="text-xs text-neutral-500">Phone: {appointment.contactPhoneE164}</div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="text-xs text-neutral-500">Not linked</div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {appointment ? (
                        <form action={detachPaymentAction} className="space-y-2">
                          <input type="hidden" name="paymentId" value={payment.id} />
                          <button
                            type="submit"
                            className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                          >
                            Detach
                          </button>
                        </form>
                      ) : (
                        <form action={attachPaymentAction} className="space-y-2">
                          <input type="hidden" name="paymentId" value={payment.id} />
                          <label className="flex flex-col gap-1 text-xs text-neutral-600">
                            Attach to appointment
                            <input
                              type="text"
                              name="appointmentId"
                              placeholder="Appointment ID"
                              defaultValue={
                                payment.metadata && typeof payment.metadata["appointment_id"] === "string"
                                  ? payment.metadata["appointment_id"]
                                  : undefined
                              }
                              className="rounded border border-neutral-300 px-2 py-1 text-sm"
                            />
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              className="rounded-md bg-primary-900 px-3 py-1 text-xs font-medium text-white hover:bg-primary-800"
                            >
                              Attach
                            </button>
                          </div>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
