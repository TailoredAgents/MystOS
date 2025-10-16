import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, quotes, contacts, properties, outboxEvents } from "@/db";
import { eq } from "drizzle-orm";

const PublicDecisionSchema = z.object({
  decision: z.enum(["accepted", "declined"]),
  notes: z.string().max(1000).optional()
});

function mapPublicQuote(row: {
  id: string;
  status: string;
  services: string[];
  addOns: string[] | null;
  lineItems: unknown;
  subtotal: unknown;
  total: unknown;
  depositDue: unknown;
  balanceDue: unknown;
  sentAt: Date | null;
  expiresAt: Date | null;
  decisionNotes: string | null;
  contactName: string;
  propertyCity: string;
  propertyState: string;
  propertyPostalCode: string;
}) {
  const expiresAtIso = row.expiresAt ? row.expiresAt.toISOString() : null;
  const expired = row.expiresAt ? row.expiresAt.getTime() < Date.now() : false;

  return {
    id: row.id,
    status: row.status,
    services: row.services,
    addOns: row.addOns,
    lineItems: row.lineItems,
    subtotal: Number(row.subtotal),
    total: Number(row.total),
    depositDue: Number(row.depositDue),
    balanceDue: Number(row.balanceDue),
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    expiresAt: expiresAtIso,
    expired,
    decisionNotes: row.decisionNotes,
    customerName: row.contactName,
    serviceArea: `${row.propertyCity}, ${row.propertyState} ${row.propertyPostalCode}`.trim()
  };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
): Promise<Response> {
  const { token } = await context.params;
  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }

  const db = getDb();
  const rows = await db
    .select({
      id: quotes.id,
      status: quotes.status,
      services: quotes.services,
      addOns: quotes.addOns,
      lineItems: quotes.lineItems,
      subtotal: quotes.subtotal,
      total: quotes.total,
      depositDue: quotes.depositDue,
      balanceDue: quotes.balanceDue,
      sentAt: quotes.sentAt,
      expiresAt: quotes.expiresAt,
      decisionNotes: quotes.decisionNotes,
      contactName: contacts.firstName,
      propertyCity: properties.city,
      propertyState: properties.state,
      propertyPostalCode: properties.postalCode
    })
    .from(quotes)
    .leftJoin(contacts, eq(quotes.contactId, contacts.id))
    .leftJoin(properties, eq(quotes.propertyId, properties.id))
    .where(eq(quotes.shareToken, token))
    .limit(1);

  const quote = rows[0];
  if (!quote) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    quote: mapPublicQuote(quote)
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
): Promise<Response> {
  const { token } = await context.params;
  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }

  const parsedBody = PublicDecisionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "invalid_payload", details: parsedBody.error.flatten() },
      { status: 400 }
    );
  }

  const db = getDb();
  const rows = await db
    .select({
      id: quotes.id,
      status: quotes.status,
      expiresAt: quotes.expiresAt
    })
    .from(quotes)
    .where(eq(quotes.shareToken, token))
    .limit(1);

  const quote = rows[0];
  if (!quote) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (quote.expiresAt && quote.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  const decisionAt = new Date();
  const [updated] = await db
    .update(quotes)
    .set({
      status: parsedBody.data.decision,
      decisionAt,
      decisionNotes: parsedBody.data.notes ?? null,
      updatedAt: decisionAt
    })
    .where(eq(quotes.id, quote.id))
    .returning({
      id: quotes.id,
      status: quotes.status,
      decisionAt: quotes.decisionAt,
      decisionNotes: quotes.decisionNotes
    });

  await db.insert(outboxEvents).values({
    type: "quote.decision",
    payload: {
      quoteId: updated.id,
      decision: parsedBody.data.decision,
      source: "customer"
    }
  });

  return NextResponse.json({
    ok: true,
    quoteId: updated.id,
    status: updated.status,
    decisionAt: updated.decisionAt ? updated.decisionAt.toISOString() : null,
    decisionNotes: updated.decisionNotes
  });
}

