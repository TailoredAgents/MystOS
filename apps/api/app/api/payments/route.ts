import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { desc, eq, isNull, isNotNull } from "drizzle-orm";
import { getDb, payments, appointments, contacts } from "@/db";
import { isAdminRequest } from "../web/admin";

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

  const rows = await filteredQuery.orderBy(desc(payments.createdAt));

  const paymentsDto = rows.map((row) => {
    const contactName = row.contactFirstName && row.contactLastName
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

  return NextResponse.json({ payments: paymentsDto });
}
