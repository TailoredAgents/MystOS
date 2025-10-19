import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";

const API_BASE_URL =
  process.env["API_BASE_URL"] ??
  process.env["NEXT_PUBLIC_API_BASE_URL"] ??
  "http://localhost:3001";
const ADMIN_API_KEY = process.env["ADMIN_API_KEY"];

type QuoteStatus = "pending" | "sent" | "accepted" | "declined";

interface QuoteResponse {
  id: string;
  status: QuoteStatus;
  services: string[];
  addOns: string[] | null;
  total: number;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  expiresAt: string | null;
  shareToken: string | null;
  contact: {
    name: string;
    email: string | null;
  };
  property: {
    addressLine1: string;
    city: string;
    state: string;
    postalCode: string;
  };
}

interface QuotesSummaryPayload {
  quotes: QuoteResponse[];
}

function isQuoteResponse(value: unknown): value is QuoteResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  const id = record["id"];
  const status = record["status"];
  const services = record["services"];
  const total = record["total"];
  const createdAt = record["createdAt"];

  return (
    typeof id === "string" &&
    typeof status === "string" &&
    Array.isArray(services) &&
    services.every((service) => typeof service === "string") &&
    typeof total === "number" &&
    typeof createdAt === "string"
  );
}

const STATUS_LABELS: Record<QuoteStatus, string> = {
  pending: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined"
};

const STATUS_COLORS: Record<QuoteStatus, string> = {
  pending: "bg-neutral-200 text-neutral-700 border-neutral-300",
  sent: "bg-amber-100 text-amber-700 border-amber-200",
  accepted: "bg-emerald-100 text-emerald-700 border-emerald-200",
  declined: "bg-rose-100 text-rose-700 border-rose-200"
};

async function callQuotesApi(path: string, init?: RequestInit): Promise<Response> {
  if (!ADMIN_API_KEY) {
    throw new Error("ADMIN_API_KEY must be set to access the admin quotes board.");
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

export async function sendQuoteAction(formData: FormData) {
  "use server";

  const quoteId = formData.get("quoteId");
  if (typeof quoteId !== "string" || quoteId.trim().length === 0) {
    return;
  }

  const response = await callQuotesApi(`/api/quotes/${quoteId}/send`, {
    method: "POST",
    body: JSON.stringify({})
  });

  if (!response.ok) {
    console.warn("[quotes] send_failed", { quoteId, status: response.status });
  }

  revalidatePath("/admin/quotes");
}

export async function markQuoteDecisionAction(formData: FormData) {
  "use server";

  const quoteId = formData.get("quoteId");
  const decision = formData.get("decision");

  if (typeof quoteId !== "string" || quoteId.trim().length === 0) {
    return;
  }
  if (decision !== "accepted" && decision !== "declined") {
    return;
  }

  const response = await callQuotesApi(`/api/quotes/${quoteId}/decision`, {
    method: "POST",
    body: JSON.stringify({ decision })
  });

  if (!response.ok) {
    console.warn("[quotes] decision_failed", { quoteId, decision, status: response.status });
  }

  revalidatePath("/admin/quotes");
}

function formatCurrency(total: number) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(total);
  } catch {
    return `$${(total / 100).toFixed(2)}`;
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

function servicesLabel(services: string[]) {
  if (!services.length) {
    return "Exterior cleaning";
  }
  if (services.length === 1) {
    return services[0];
  }
  return `${services[0]} +${services.length - 1}`;
}

function isExpired(iso: string | null) {
  if (!iso) {
    return false;
  }
  const expires = new Date(iso);
  return expires.getTime() < Date.now();
}

function buildShareUrl(token: string | null) {
  if (!token) {
    return null;
  }
  const siteUrl =
    process.env["NEXT_PUBLIC_SITE_URL"] ?? process.env["SITE_URL"] ?? "http://localhost:3000";
  return `${siteUrl.replace(/\/$/, "")}/quote/${token}`;
}

function groupQuotes(quotes: QuoteResponse[]) {
  const groups: Record<QuoteStatus, QuoteResponse[]> = {
    pending: [],
    sent: [],
    accepted: [],
    declined: []
  };

  quotes.forEach((quote) => {
    groups[quote.status].push(quote);
  });

  return groups;
}

export default async function QuotesPage() {
  if (!ADMIN_API_KEY) {
    notFound();
  }

  const response = await callQuotesApi("/api/quotes");
  if (!response.ok) {
    throw new Error("Unable to load quotes");
  }

  const raw = (await response.json()) as unknown;
  const maybeQuotes = (raw as { quotes?: unknown[] }).quotes;
  const quotes = Array.isArray(maybeQuotes) ? maybeQuotes.filter(isQuoteResponse) : [];

  const grouped = groupQuotes(quotes);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary-900">Quotes</h1>
          <p className="text-sm text-neutral-600">
            Draft, send, and track Myst Pressure Washing proposals in a single workspace.
          </p>
        </div>
        <Link
          href="/admin/estimates"
          className="inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Back to estimates
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-4">
        {(Object.keys(grouped) as QuoteStatus[]).map((status) => (
          <div key={status} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
              {STATUS_LABELS[status]}
            </p>
            <p className="mt-2 text-3xl font-semibold text-primary-900">{grouped[status].length}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {(Object.keys(grouped) as QuoteStatus[]).map((status) => (
          <section key={status} className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-primary-900">{STATUS_LABELS[status]}</h2>
                <p className="text-xs text-neutral-500">{grouped[status].length} quote{grouped[status].length === 1 ? "" : "s"}.</p>
              </div>
            </header>
            <div className="space-y-4">
              {grouped[status].length ? (
                grouped[status].map((quote) => {
                  const shareUrl = buildShareUrl(quote.shareToken);
                  return (
                    <article
                      key={quote.id}
                      className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 shadow-xs"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[quote.status]}`}>
                          {STATUS_LABELS[quote.status]}
                        </span>
                        <span className="text-xs text-neutral-500">{servicesLabel(quote.services)}</span>
                        <span className="text-xs text-neutral-400">•</span>
                        <span className="text-xs text-neutral-500">{formatCurrency(quote.total)}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-primary-900">{quote.contact.name}</p>
                        <p className="text-xs text-neutral-600">
                          {quote.property.addressLine1}, {quote.property.city}, {quote.property.state}{" "}
                          {quote.property.postalCode}
                        </p>
                      </div>
                      <dl className="grid gap-2 text-xs text-neutral-500 sm:grid-cols-2">
                        <div>
                          <dt className="uppercase tracking-[0.12em]">Created</dt>
                          <dd>{formatDate(quote.createdAt)}</dd>
                        </div>
                        <div>
                          <dt className="uppercase tracking-[0.12em]">Sent</dt>
                          <dd>{quote.sentAt ? formatDate(quote.sentAt) : "Not sent"}</dd>
                        </div>
                        <div>
                          <dt className="uppercase tracking-[0.12em]">Expires</dt>
                          <dd className={isExpired(quote.expiresAt) ? "text-rose-600" : undefined}>
                            {quote.expiresAt ? formatDate(quote.expiresAt) : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="uppercase tracking-[0.12em]">Share link</dt>
                        <dd>
                          {shareUrl ? (
                            <a
                              href={shareUrl}
                              className="text-accent-600 hover:underline"
                              target="_blank"
                              rel="noreferrer"
                            >
                              View quote
                            </a>
                          ) : (
                            "-"
                          )}
                        </dd>
                          <form action={sendQuoteAction}>
                            <input type="hidden" name="quoteId" value={quote.id} />
                            <button className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100">
                              Send quote
                            </button>
                          </form>
                        ) : null}

                        {quote.status === "sent" ? (
                          <>
                            <form action={markQuoteDecisionAction}>
                              <input type="hidden" name="quoteId" value={quote.id} />
                              <input type="hidden" name="decision" value="accepted" />
                              <button className="rounded-md border border-emerald-400 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100">
                                Mark accepted
                              </button>
                            </form>
                            <form action={markQuoteDecisionAction}>
                              <input type="hidden" name="quoteId" value={quote.id} />
                              <input type="hidden" name="decision" value="declined" />
                              <button className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600 hover:bg-rose-100">
                                Mark declined
                              </button>
                            </form>
                          </>
                        ) : null}
                        {shareUrl ? (
                          <a
                            href={shareUrl}
                            className="rounded-md border border-accent-300 bg-accent-50 px-3 py-1 text-xs font-medium text-accent-700 hover:bg-accent-100"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Copy link
                          </a>
                        ) : null}
                          </a>
                        ) : null}
                })
              ) : (
                <p className="text-sm text-neutral-500">No quotes in this lane yet.</p>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
