import { NextResponse, type NextRequest } from "next/server";
import { and, between, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { getDb, appointments, contacts, properties, quotes } from "@/db";
import { isAdminRequest } from "../web/admin";
import {
  DEFAULT_APPOINTMENT_DURATION_MIN,
  DEFAULT_TRAVEL_BUFFER_MIN
} from "../web/scheduling";

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
  const summaryOnly = searchParams.get("summaryOnly") === "1";

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
      travelBufferMinutes: appointments.travelBufferMinutes,
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
            isNull(appointments.startAt),
            between(appointments.createdAt, startAt, endAt)
          )
        )
      )
    )
    .orderBy(desc(appointments.startAt));

  const summaryByDay = new Map<
    string,
    { jobs: number; minutes: number; travelMinutes: number }
  >();
  let totalJobs = 0;
  let totalMinutes = 0;
  let totalTravel = 0;
  let unscheduledJobs = 0;

  const appointmentsDto = rows.map((row) => {
    const startIso = row.startAt ? row.startAt.toISOString() : null;
    const dayKey = startIso ? startIso.slice(0, 10) : null;
    const duration = row.durationMinutes ?? DEFAULT_APPOINTMENT_DURATION_MIN;
    const travel = row.travelBufferMinutes ?? DEFAULT_TRAVEL_BUFFER_MIN;
    totalJobs += 1;
    totalMinutes += duration;
    totalTravel += travel;
    if (dayKey) {
      const existing = summaryByDay.get(dayKey) ?? {
        jobs: 0,
        minutes: 0,
        travelMinutes: 0
      };
      existing.jobs += 1;
      existing.minutes += duration;
      existing.travelMinutes += travel;
      summaryByDay.set(dayKey, existing);
    } else {
      unscheduledJobs += 1;
    }

    return {
      id: row.id,
      type: row.type,
      status: row.status,
      startAt: startIso,
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
    };
  });

  const summary = {
    totals: {
      jobs: totalJobs,
      minutes: totalMinutes,
      travelMinutes: totalTravel,
      unscheduled: unscheduledJobs
    },
    byDay: Object.fromEntries(summaryByDay)
  };

  return NextResponse.json({
    start: startAt.toISOString(),
    end: endAt.toISOString(),
    appointments: summaryOnly ? [] : appointmentsDto,
    summary
  });
}
