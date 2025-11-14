import { NextResponse, type NextRequest } from "next/server";
import { and, between, desc, eq, gte, lte, or } from "drizzle-orm";
import { getDb, appointments, contacts, properties, quotes } from "@/db";
import { isAdminRequest } from "../web/admin";

const DEFAULT_RANGE_DAYS = 30;

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: NextRequest): Promise<Response> {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const { searchParams } = request.nextUrl;
  const startAtParam = parseDate(searchParams.get("start"));
  const endAtParam = parseDate(searchParams.get("end"));

  const now = new Date();
  const startAt =
    startAtParam ?? new Date(now.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
  const endAt =
    endAtParam ?? new Date(now.getTime() + DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      id: appointments.id,
      type: appointments.type,
      status: appointments.status,
      startAt: appointments.startAt,
      durationMinutes: appointments.durationMinutes,
      contactId: contacts.id,
      contactName: contacts.firstName,
      contactEmail: contacts.email,
      contactPhone: contacts.phone,
      propertyId: properties.id,
      addressLine1: properties.addressLine1,
      city: properties.city,
      state: properties.state,
      postalCode: properties.postalCode,
      quoteId: quotes.id,
      quoteStatus: quotes.status
    })
    .from(appointments)
    .leftJoin(contacts, eq(appointments.contactId, contacts.id))
    .leftJoin(properties, eq(appointments.propertyId, properties.id))
    .leftJoin(quotes, eq(quotes.jobAppointmentId, appointments.id))
    .where(
      and(
        or(
          and(gte(appointments.startAt, startAt), lte(appointments.startAt, endAt)),
          and(
            appointments.startAt.isNull(),
            between(appointments.createdAt, startAt, endAt)
          )
        )
      )
    )
    .orderBy(desc(appointments.startAt));

  const appointmentsDto = rows.map((row) => ({
    id: row.id,
    type: row.type,
    status: row.status,
    startAt: row.startAt ? row.startAt.toISOString() : null,
    durationMinutes: row.durationMinutes,
    contact: {
      id: row.contactId,
      name: row.contactName,
      email: row.contactEmail,
      phone: row.contactPhone
    },
    property: row.propertyId
      ? {
          id: row.propertyId,
          addressLine1: row.addressLine1,
          city: row.city,
          state: row.state,
          postalCode: row.postalCode
        }
      : null,
    quote:
      row.quoteId !== null
        ? {
            id: row.quoteId,
            status: row.quoteStatus
          }
        : null
  }));

  return NextResponse.json({
    start: startAt.toISOString(),
    end: endAt.toISOString(),
    appointments: appointmentsDto
  });
}
