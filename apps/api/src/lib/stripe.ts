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
  const list = Array.isArray(data.data) ? data.data : [];
  return list as StripeCharge[];
}

export function mapChargeToPaymentRow(charge: StripeCharge) {
  const pm = charge.payment_method_details ?? {};
  const card = (pm as any).card ?? {};

  const capturedAt = (charge as any).captured ? (charge as any).created : undefined;
  const appointmentId =
    typeof (charge.metadata as any)?.appointment_id === "string"
      ? ((charge.metadata as any).appointment_id as string)
      : null;

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
    capturedAt: capturedAt ? new Date(capturedAt * 1000) : null
  };
}

