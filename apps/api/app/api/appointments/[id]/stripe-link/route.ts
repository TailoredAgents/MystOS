import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, appointments, contacts } from "@/db";
import { isAdminRequest } from "../../../web/admin";

const PayloadSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().min(3).max(10).default("USD"),
  email: z.string().email().optional()
});

function ensureStripeSecret(): string {
  const secret = process.env["STRIPE_SECRET_KEY"];
  if (!secret) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return secret;
}

function successUrl() {
  return process.env["STRIPE_CHECKOUT_SUCCESS_URL"] ?? "https://www.mystwashing.com/payment-success";
}

function cancelUrl() {
  return process.env["STRIPE_CHECKOUT_CANCEL_URL"] ?? "https://www.mystwashing.com/payment";
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: appointmentId } = await context.params;
  if (!appointmentId) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  let payloadRaw: unknown;
  try {
    payloadRaw = await request.json();
  } catch {
    payloadRaw = null;
  }

  const parsed = PayloadSchema.safeParse(payloadRaw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  const amountInCents = Math.round(payload.amount * 100);
  if (!Number.isFinite(amountInCents) || amountInCents <= 0) {
    return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
  }

  const db = getDb();
  const [appt] = await db
    .select({
      id: appointments.id,
      contactName: contacts.firstName,
      contactEmail: contacts.email
    })
    .from(appointments)
    .leftJoin(contacts, eq(appointments.contactId, contacts.id))
    .where(eq(appointments.id, appointmentId))
    .limit(1);

  if (!appt) {
    return NextResponse.json({ error: "appointment_not_found" }, { status: 404 });
  }

  const descriptor = appt.contactName ? `Myst job for ${appt.contactName}` : "Myst washing service";
  const customerEmail = payload.email ?? appt.contactEmail ?? undefined;

  try {
    const secret = ensureStripeSecret();
    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("success_url", successUrl());
    params.set("cancel_url", cancelUrl());
    params.set("line_items[0][price_data][currency]", payload.currency.toLowerCase());
    params.set("line_items[0][price_data][product_data][name]", descriptor);
    params.set("line_items[0][price_data][unit_amount]", String(amountInCents));
    params.set("line_items[0][quantity]", "1");
    params.set("metadata[appointment_id]", appointmentId);
    if (customerEmail) {
      params.set("customer_email", customerEmail);
    }

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });

    const data = (await stripeResponse.json()) as { url?: string; error?: { message?: string } };
    if (!stripeResponse.ok || !data?.url) {
      return NextResponse.json(
        { error: data?.error?.message ?? "stripe_request_failed" },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: data.url });
  } catch (error) {
    console.error("[appointments.stripe-link] stripe_error", error);
    return NextResponse.json({ error: "stripe_error" }, { status: 500 });
  }
}
