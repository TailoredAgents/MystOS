export interface StripeCardDetails {
  brand?: string;
  last4?: string;
}

export interface StripePaymentMethodDetails {
  type?: string;
  card?: StripeCardDetails | null;
}

export interface StripeCharge {
  id: string;
  amount: number; // cents
  currency: string;
  status: string;
  created: number; // epoch seconds
  captured: boolean;
  captured_at?: number | null;
  paid?: boolean;
  refunded?: boolean;
  receipt_url?: string | null;
  metadata?: Record<string, string | null | undefined> | null;
  payment_method_details?: StripePaymentMethodDetails | null;
}

export interface StripePaymentRow {
  stripeChargeId: string;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  cardBrand: string | null;
  last4: string | null;
  receiptUrl: string | null;
  metadata: Record<string, string | null | undefined> | null;
  appointmentId: string | null;
  createdAt: Date;
  capturedAt: Date | null;
}

function isStripeCharge(value: unknown): value is StripeCharge {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  const id = record["id"];
  const amount = record["amount"];
  const currency = record["currency"];
  const status = record["status"];
  const created = record["created"];
  const captured = record["captured"];
  return (
    typeof id === "string" &&
    typeof amount === "number" &&
    typeof currency === "string" &&
    typeof status === "string" &&
    typeof created === "number" &&
    typeof captured === "boolean"
  );
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
  const rawList = Array.isArray(data.data) ? data.data.filter(isStripeCharge) : [];

  return rawList.filter((charge) => {
    if (charge.refunded) {
      return false;
    }

    if (charge.status !== "succeeded") {
      return false;
    }

    if (charge.paid === false) {
      return false;
    }

    return true;
  });
}

export function mapChargeToPaymentRow(charge: StripeCharge): StripePaymentRow {
  const paymentMethod = charge.payment_method_details ?? undefined;
  const card = paymentMethod?.card ?? undefined;

  const capturedAtUnix =
    typeof charge.captured_at === "number"
      ? charge.captured_at
      : charge.captured
        ? charge.created
        : undefined;

  const metadata = charge.metadata ?? null;
  const metadataRecord = metadata ?? null;
  const appointmentIdKeys = ["appointment_id", "appointmentId", "appointmentID", "AppointmentId"] as const;
  let appointmentId: string | null = null;
  if (metadataRecord) {
    for (const key of appointmentIdKeys) {
      const value = metadataRecord[key];
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          appointmentId = trimmed;
          break;
        }
      }
    }
  }

  return {
    stripeChargeId: charge.id,
    amount: charge.amount,
    currency: charge.currency,
    status: charge.status,
    method: paymentMethod?.type ?? null,
    cardBrand: card?.brand ?? null,
    last4: card?.last4 ?? null,
    receiptUrl: charge.receipt_url ?? null,
    metadata: metadataRecord,
    appointmentId,
    createdAt: new Date(charge.created * 1000),
    capturedAt: capturedAtUnix ? new Date(capturedAtUnix * 1000) : null
  };
}
