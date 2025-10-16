export interface StripeCharge {
  id: string;
  amount: number; // cents
  currency: string;
  status: string;
  created: number; // epoch seconds
  captured: boolean;
  captured_at?: number | null;
  receipt_url?: string | null;
  metadata?: Record<string, unknown> | null;
  payment_method_details?: {
    type?: string;
    card?: { brand?: string; last4?: string } | null;
  } | null;
}

export async function listRecentCharges(days: number = 14): Promise<StripeCharge[]> {
  const secret = process.env["STRIPE_SECRET_KEY"];
  if (!secret) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }

  const since = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;
  const params = new URLSearchParams();
  params.set("limit", "100");
  params.set("created[gte]", String(since));

  const response = await fetch(`https://api.stripe.com/v1/charges?${params.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secret}`
    }
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Stripe charges fetch failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as { data?: unknown[] };
  const list = Array.isArray(data.data) ? (data.data as StripeCharge[]) : [];

  return list.filter((charge) => {
    const status = (charge as StripeCharge).status;
    const paid = (charge as any).paid;
    const refunded = Boolean((charge as any).refunded);

    if (refunded) {
      return false;
    }

    if (status && status !== "succeeded") {
      return false;
    }

    if (paid === false) {
      return false;
    }

    return true;
  });
}

export function mapChargeToPaymentRow(charge: StripeCharge) {
  const pm = charge.payment_method_details ?? {};
  const card = (pm as any).card ?? {};

  const capturedAtUnix =
    typeof (charge as any).captured_at === "number"
      ? (charge as any).captured_at
      : (charge as any).captured
        ? charge.created
        : undefined;

  const metadata = (charge.metadata ?? {}) as Record<string, unknown>;
  const appointmentIdKey = ["appointment_id", "appointmentId", "appointmentID", "AppointmentId"].find(
    (key) => typeof metadata[key] === "string" && (metadata[key] as string).trim().length > 0
  );
  const appointmentId = appointmentIdKey ? ((metadata[appointmentIdKey] as string).trim() ?? null) : null;

  return {
    stripeChargeId: charge.id,
    amount: charge.amount,
    currency: charge.currency,
    status: charge.status,
    method: (pm as any).type ?? null,
    cardBrand: card.brand ?? null,
    last4: card.last4 ?? null,
    receiptUrl: (charge as any).receipt_url ?? null,
    metadata: charge.metadata ?? null,
    appointmentId,
    createdAt: new Date(charge.created * 1000),
    capturedAt: capturedAtUnix ? new Date(capturedAtUnix * 1000) : null
  };
}
