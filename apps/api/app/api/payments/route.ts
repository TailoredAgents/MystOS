import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { desc, eq, isNull, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";
import { getDb, payments, appointments, contacts } from "@/db";
import { isAdminRequest } from "../web/admin";

const RecordPaymentSchema = z.object({
  appointmentId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().min(1).max(10).default("USD"),
  method: z.string().min(1).max(50).optional(),
  note: z.string().max(500).optional()
});

export async function GET(request: NextRequest): Promise<Response> {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const statusFilter = request.nextUrl.searchParams.get("status");

  const baseQuery = db
    .select({
      id: payments.id,
      stripeChargeId: payments.stripeChargeId,
      amount: payments.amount,
      currency: payments.currency,
      status: payments.status,
      method: payments.method,
      cardBrand: payments.cardBrand,
      last4: payments.last4,
      receiptUrl: payments.receiptUrl,
      metadata: payments.metadata,
      createdAt: payments.createdAt,
      updatedAt: payments.updatedAt,
      capturedAt: payments.capturedAt,
      appointmentId: payments.appointmentId,
      appointmentStatus: appointments.status,
      appointmentStartAt: appointments.startAt,
      appointmentUpdatedAt: appointments.updatedAt,
      contactId: contacts.id,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
      contactEmail: contacts.email,
      contactPhone: contacts.phone,
      contactPhoneE164: contacts.phoneE164
    })
    .from(payments)
    .leftJoin(appointments, eq(payments.appointmentId, appointments.id))
    .leftJoin(contacts, eq(appointments.contactId, contacts.id));

  const filteredQuery =
    statusFilter === "unmatched"
      ? baseQuery.where(isNull(payments.appointmentId))
      : statusFilter === "matched"
        ? baseQuery.where(isNotNull(payments.appointmentId))
        : baseQuery;

  const [rows, summaryRow] = await Promise.all([
    filteredQuery.orderBy(desc(payments.createdAt)),
    db
      .select({
        total: sql<number>`count(*)`,
        matched: sql<number>`count(*) filter (where ${payments.appointmentId} is not null)`
      })
      .from(payments)
      .then((result) => result[0] ?? { total: 0, matched: 0 })
  ]);

  const total = Number(summaryRow.total ?? 0);
  const matched = Number(summaryRow.matched ?? 0);
  const summary = {
    total,
    matched,
    unmatched: Math.max(total - matched, 0)
  };

  const paymentsDto = rows.map((row) => {
    const contactName =
      row.contactFirstName && row.contactLastName
        ? `${row.contactFirstName} ${row.contactLastName}`
        : row.contactFirstName ?? row.contactLastName ?? null;

    return {
      id: row.id,
      stripeChargeId: row.stripeChargeId,
      amount: row.amount,
      currency: row.currency,
      status: row.status,
      method: row.method,
      cardBrand: row.cardBrand,
      last4: row.last4,
      receiptUrl: row.receiptUrl,
      metadata: row.metadata,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      capturedAt: row.capturedAt ? row.capturedAt.toISOString() : null,
      appointment: row.appointmentId
        ? {
            id: row.appointmentId,
            status: row.appointmentStatus,
            startAt: row.appointmentStartAt ? row.appointmentStartAt.toISOString() : null,
            updatedAt: row.appointmentUpdatedAt ? row.appointmentUpdatedAt.toISOString() : null,
            contactId: row.contactId,
            contactName,
            contactEmail: row.contactEmail,
            contactPhone: row.contactPhone,
            contactPhoneE164: row.contactPhoneE164
          }
        : null
    };
  });

  return NextResponse.json({ payments: paymentsDto, summary });
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    parsedBody = null;
  }

  const body = RecordPaymentSchema.safeParse(parsedBody);
  if (!body.success) {
    return NextResponse.json({ error: "invalid_payload", details: body.error.flatten() }, { status: 400 });
  }

  const data = body.data;
  const amountInCents = Math.round(data.amount * 100);
  if (!Number.isFinite(amountInCents) || amountInCents <= 0) {
    return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
  }

  const db = getDb();
  const [appointment] = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(eq(appointments.id, data.appointmentId))
    .limit(1);

  if (!appointment) {
    return NextResponse.json({ error: "appointment_not_found" }, { status: 404 });
  }

  const manualChargeId = `manual_${nanoid(10)}`;
  const now = new Date();
  const metadataPayload: Record<string, unknown> =
    data.note && data.note.trim().length > 0
      ? { source: "manual", note: data.note.trim() }
      : { source: "manual" };

  const [inserted] = await db
    .insert(payments)
    .values({
      stripeChargeId: manualChargeId,
      amount: amountInCents,
      currency: data.currency.toUpperCase(),
      status: "succeeded",
      method: data.method ? data.method.trim() : "offline",
      cardBrand: null,
      last4: null,
      receiptUrl: null,
      metadata: metadataPayload,
      appointmentId: data.appointmentId,
      createdAt: now,
      updatedAt: now,
      capturedAt: now
    })
    .returning({ id: payments.id });

  return NextResponse.json({ ok: true, id: inserted?.id ?? null });
}
