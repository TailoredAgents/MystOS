import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  getDb,
  contacts,
  appointments,
  properties,
  quotes,
  payments,
  appointmentNotes
} from "@/db";
import { isAdminRequest } from "../../web/admin";
import { generateCustomerSummary } from "@/lib/ai";

export async function GET(request: NextRequest): Promise<Response> {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const contactId = searchParams.get("contactId");
  const quoteId = searchParams.get("quoteId");
  const appointmentId = searchParams.get("appointmentId");

  if (!contactId) {
    return NextResponse.json({ error: "missing_contact" }, { status: 400 });
  }

  const db = getDb();
  const [contact] = await db
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      email: contacts.email,
      phone: contacts.phoneE164 ?? contacts.phone
    })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);

  if (!contact) {
    return NextResponse.json({ error: "contact_not_found" }, { status: 404 });
  }

  const [targetQuote] = quoteId
    ? await db
        .select({
          id: quotes.id,
          status: quotes.status,
          total: quotes.total,
          services: quotes.services,
          jobAppointmentId: quotes.jobAppointmentId,
          updatedAt: quotes.updatedAt
        })
        .from(quotes)
        .where(and(eq(quotes.id, quoteId), eq(quotes.contactId, contactId)))
        .limit(1)
    : [];

  const [targetAppointment] = appointmentId
    ? await db
        .select({
          id: appointments.id,
          status: appointments.status,
          startAt: appointments.startAt,
          addressLine1: properties.addressLine1,
          city: properties.city,
          state: properties.state
        })
        .from(appointments)
        .leftJoin(properties, eq(appointments.propertyId, properties.id))
        .where(and(eq(appointments.id, appointmentId), eq(appointments.contactId, contactId)))
        .limit(1)
    : [];

  const recentAppointments = await db
    .select({
      id: appointments.id,
      status: appointments.status,
      startAt: appointments.startAt,
      createdAt: appointments.createdAt,
      addressLine1: properties.addressLine1,
      city: properties.city
    })
    .from(appointments)
    .leftJoin(properties, eq(appointments.propertyId, properties.id))
    .where(eq(appointments.contactId, contactId))
    .orderBy(desc(appointments.startAt ?? appointments.createdAt))
    .limit(5);

  const appointmentIds = recentAppointments.map((appt) => appt.id).filter(Boolean);
  const paymentRows =
    appointmentIds.length > 0
      ? await db
          .select({
            appointmentId: payments.appointmentId,
            amount: payments.amount,
            currency: payments.currency,
            method: payments.method,
            createdAt: payments.createdAt
          })
          .from(payments)
          .where(inArray(payments.appointmentId, appointmentIds))
          .orderBy(desc(payments.createdAt))
      : [];

  const noteRows =
    appointmentIds.length > 0
      ? await db
          .select({
            appointmentId: appointmentNotes.appointmentId,
            body: appointmentNotes.body,
            createdAt: appointmentNotes.createdAt
          })
          .from(appointmentNotes)
          .where(inArray(appointmentNotes.appointmentId, appointmentIds))
          .orderBy(desc(appointmentNotes.createdAt))
      : [];

  let outstandingCents: number | null = null;
  if (targetQuote?.jobAppointmentId) {
    const relatedPayments = paymentRows
      .filter((row) => row.appointmentId === targetQuote.jobAppointmentId)
      .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    const totalNumber = Number(targetQuote.total ?? 0);
    const totalCents = Number.isFinite(totalNumber) ? Math.round(totalNumber * 100) : null;
    if (totalCents !== null) {
      outstandingCents = Math.max(totalCents - relatedPayments, 0);
    }
  }

  const history: Array<{ heading: string; detail: string }> = [];
  for (const appt of recentAppointments) {
    history.push({
      heading: `Appointment ${appt.status}`,
      detail: `${appt.startAt ? new Date(appt.startAt).toLocaleDateString() : "Scheduled"} at ${
        appt.city ?? appt.addressLine1 ?? "address TBD"
      }`
    });
  }
  for (const payment of paymentRows.slice(0, 3)) {
    history.push({
      heading: "Payment",
      detail: `${payment.amount / 100} ${payment.currency} via ${payment.method ?? "unknown"} on ${payment.createdAt.toLocaleDateString()}`
    });
  }
  for (const note of noteRows.slice(0, 3)) {
    history.push({
      heading: "Note",
      detail: `${note.createdAt.toLocaleDateString()}: ${note.body.slice(0, 140)}`
    });
  }

  const aiSummary = await generateCustomerSummary({
    customer: {
      name: `${contact.firstName} ${contact.lastName}`.trim() || "Customer",
      email: contact.email,
      phone: contact.phone
    },
    quote: targetQuote
      ? {
          status: targetQuote.status,
          total: Number(targetQuote.total ?? 0),
          services: targetQuote.services,
          outstandingCents,
          updatedAtIso: targetQuote.updatedAt.toISOString()
        }
      : undefined,
    appointment: targetAppointment
      ? {
          status: targetAppointment.status,
          startAtIso: targetAppointment.startAt ? targetAppointment.startAt.toISOString() : null,
          location: targetAppointment.addressLine1
            ? `${targetAppointment.addressLine1}, ${targetAppointment.city ?? ""}, ${targetAppointment.state ?? ""}`
            : targetAppointment.city ?? null
        }
      : undefined,
    history
  });

  if (!aiSummary) {
    return NextResponse.json({ error: "summary_unavailable" }, { status: 502 });
  }

  return NextResponse.json({ summary: aiSummary });
}
