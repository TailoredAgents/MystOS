import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { and, asc, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";
import { getDb, appointments, properties, quotes } from "@/db";
import { isAdminRequest } from "../../../web/admin";
import {
  APPOINTMENT_TIME_ZONE,
  DEFAULT_APPOINTMENT_DURATION_MIN
} from "../../../web/scheduling";
import { generateScheduleSuggestions, type ScheduleSuggestion } from "@/lib/ai";
import type { ServiceCategory } from "@myst-os/pricing/src/types";

const UPCOMING_WINDOW_DAYS = 14;
const UPCOMING_LIMIT = 120;
type AppointmentStatus = (typeof appointments.$inferSelect)["status"];
const SCHEDULABLE_STATUSES: AppointmentStatus[] = ["confirmed", "requested"];
const SERVICE_DURATION_ESTIMATES: Record<ServiceCategory, number> = {
  "house-wash": 120,
  driveway: 90,
  roof: 150,
  deck: 120,
  gutter: 75,
  commercial: 210,
  windows: 75,
  other: 60
};
const ADD_ON_DURATION_MIN = 15;
const MAX_DURATION_MIN = 6 * 60;

type UpcomingSlot = {
  startAt: Date;
  durationMinutes: number | null;
  address: {
    line1: string;
    city: string;
    state: string;
    postalCode: string;
  };
  distanceMiles: number | null;
};

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: APPOINTMENT_TIME_ZONE
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: APPOINTMENT_TIME_ZONE
});

function parseCoord(value: string | null): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function haversineMiles(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const sinHalfLat = Math.sin(dLat / 2);
  const sinHalfLng = Math.sin(dLng / 2);

  const a =
    sinHalfLat * sinHalfLat + sinHalfLng * sinHalfLng * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMiles * c;
}

function computeDistanceMiles(
  targetLat: number | null,
  targetLng: number | null,
  slotLat: number | null,
  slotLng: number | null
): number | null {
  if (
    targetLat === null ||
    targetLng === null ||
    slotLat === null ||
    slotLng === null
  ) {
    return null;
  }
  return haversineMiles(targetLat, targetLng, slotLat, slotLng);
}

function formatWindow(startAt: Date, durationMinutes: number | null): string {
  const dayPart = dayFormatter.format(startAt);
  const startPart = timeFormatter.format(startAt);
  if (durationMinutes && durationMinutes > 0) {
    const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);
    const endPart = timeFormatter.format(endAt);
    return `${dayPart} | ${startPart}-${endPart}`;
  }
  return `${dayPart} | ${startPart}`;
}

function buildFallbackSuggestions(
  slots: UpcomingSlot[],
  durationMinutes: number
): ScheduleSuggestion[] {
  const byDay = new Set<string>();
  const suggestions: ScheduleSuggestion[] = [];

  for (const slot of slots) {
    if (suggestions.length >= 3) {
      break;
    }
    const [key] = slot.startAt.toISOString().split("T");
    if (!key) {
      continue;
    }
    if (byDay.has(key)) continue;
    byDay.add(key);
    const fallback: ScheduleSuggestion = {
      window: formatWindow(slot.startAt, slot.durationMinutes ?? durationMinutes),
      reasoning:
        slot.distanceMiles !== null
          ? `Pairs with a job only ${slot.distanceMiles.toFixed(1)} mi away.`
          : "Pairs with another job on this day.",
      startAtIso: slot.startAt.toISOString()
    };
    suggestions.push(fallback);
  }

  if (suggestions.length >= 3) {
    return suggestions;
  }

  const now = new Date();
  const base = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 14, 0, 0, 0)
  );
  let fillerOffset = 1;
  while (suggestions.length < 3) {
    const startAt = new Date(base.getTime() + fillerOffset * 24 * 60 * 60 * 1000);
    suggestions.push({
      window: formatWindow(startAt, durationMinutes),
      reasoning: "Open slot with no conflicting jobs nearby.",
      startAtIso: startAt.toISOString()
    });
    fillerOffset += 1;
  }

  return suggestions;
}

function estimateDurationFromQuote(
  services: string[] | null | undefined,
  addOns: string[] | null | undefined
): number {
  const list = Array.isArray(services) ? services.filter(Boolean) : [];
  if (list.length === 0) {
    return DEFAULT_APPOINTMENT_DURATION_MIN;
  }

  let total = 0;
  for (const serviceId of list) {
    const normalized = serviceId as ServiceCategory;
    total += SERVICE_DURATION_ESTIMATES[normalized] ?? DEFAULT_APPOINTMENT_DURATION_MIN;
  }

  if (list.length > 1) {
    total = Math.round(total * 0.9);
  }

  if (Array.isArray(addOns) && addOns.length > 0) {
    total += addOns.length * ADD_ON_DURATION_MIN;
  }

  const clamped = Math.min(Math.max(total, DEFAULT_APPOINTMENT_DURATION_MIN), MAX_DURATION_MIN);
  return clamped;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const db = getDb();
  const [quote] = await db
    .select({
      id: quotes.id,
      status: quotes.status,
      services: quotes.services,
      addOns: quotes.addOns,
      addressLine1: properties.addressLine1,
      city: properties.city,
      state: properties.state,
      postalCode: properties.postalCode,
      lat: properties.lat,
      lng: properties.lng
    })
    .from(quotes)
    .innerJoin(properties, eq(properties.id, quotes.propertyId))
    .where(eq(quotes.id, id))
    .limit(1);

  if (!quote) {
    return NextResponse.json({ error: "quote_not_found" }, { status: 404 });
  }

  if (quote.status !== "accepted") {
    return NextResponse.json({ error: "quote_not_accepted" }, { status: 400 });
  }

  const targetAddress = {
    line1: quote.addressLine1,
    city: quote.city,
    state: quote.state,
    postalCode: quote.postalCode
  };
  const targetLat = parseCoord(quote.lat);
  const targetLng = parseCoord(quote.lng);
  const hasGeo = targetLat !== null && targetLng !== null;
  const durationMinutes = estimateDurationFromQuote(quote.services, quote.addOns);
  const now = new Date();
  const windowEnd = new Date(
    now.getTime() + UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );

  const upcomingRows = await db
    .select({
      startAt: appointments.startAt,
      durationMinutes: appointments.durationMinutes,
      addressLine1: properties.addressLine1,
      city: properties.city,
      state: properties.state,
      postalCode: properties.postalCode,
      lat: properties.lat,
      lng: properties.lng
    })
    .from(appointments)
    .leftJoin(properties, eq(appointments.propertyId, properties.id))
    .where(
      and(
        inArray(appointments.status, SCHEDULABLE_STATUSES),
        isNotNull(appointments.startAt),
        gte(appointments.startAt, now),
        lte(appointments.startAt, windowEnd)
      )
    )
    .orderBy(asc(appointments.startAt))
    .limit(UPCOMING_LIMIT);

  const slots: UpcomingSlot[] = [];
  for (const row of upcomingRows) {
    if (!row.startAt) {
      continue;
    }
    const slotLat = parseCoord(row.lat);
    const slotLng = parseCoord(row.lng);
    slots.push({
      startAt: row.startAt,
      durationMinutes: row.durationMinutes ?? null,
      address: {
        line1: row.addressLine1 ?? "Unspecified address",
        city: row.city ?? "",
        state: row.state ?? "",
        postalCode: row.postalCode ?? ""
      },
      distanceMiles: computeDistanceMiles(targetLat, targetLng, slotLat, slotLng)
    });
  }

  const contextPayload = {
    targetAddress,
    durationMinutes,
    upcoming: slots.map((slot) => ({
      startAtIso: slot.startAt.toISOString(),
      durationMinutes: slot.durationMinutes,
      address: slot.address,
      distanceMiles: slot.distanceMiles
    }))
  };

  const aiSuggestions = hasGeo ? await generateScheduleSuggestions(contextPayload) : null;
  const usedFallback = !(aiSuggestions && aiSuggestions.length > 0);
  const suggestions = usedFallback
    ? buildFallbackSuggestions(slots, contextPayload.durationMinutes)
    : (aiSuggestions as ScheduleSuggestion[]);

  return NextResponse.json({
    suggestions,
    meta: {
      durationMinutes: contextPayload.durationMinutes,
      missingLocation: !hasGeo,
      usedFallback
    }
  });
}
