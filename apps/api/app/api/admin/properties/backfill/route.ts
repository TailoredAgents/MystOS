import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { getDb, properties } from "@/db";
import { isAdminRequest } from "../../../web/admin";
import { geocodeAddress } from "@/lib/mapbox-geocode";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 200;

function parseLimit(request: NextRequest): number {
  const value = request.nextUrl.searchParams.get("limit");
  if (!value) return DEFAULT_LIMIT;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limit = parseLimit(request);
  const db = getDb();
  const candidates = await db
    .select({
      id: properties.id,
      contactId: properties.contactId,
      addressLine1: properties.addressLine1,
      city: properties.city,
      state: properties.state,
      postalCode: properties.postalCode
    })
    .from(properties)
    .where(
      or(
        isNull(properties.lat),
        isNull(properties.lng)
      )
    )
    .orderBy(asc(properties.updatedAt))
    .limit(limit);

  if (candidates.length === 0) {
    return NextResponse.json({ processed: 0, updated: 0, skipped: 0 }, { status: 200 });
  }

  let processed = 0;
  let updated = 0;
  let skipped = 0;

  for (const property of candidates) {
    processed += 1;
    if (!property.addressLine1 || !property.city || !property.state || !property.postalCode) {
      skipped += 1;
      continue;
    }

    const geocoded = await geocodeAddress({
      line1: property.addressLine1,
      city: property.city,
      state: property.state,
      postalCode: property.postalCode
    });

    if (!geocoded) {
      skipped += 1;
      continue;
    }

    await db
      .update(properties)
      .set({
        lat: geocoded.lat.toFixed(6),
        lng: geocoded.lng.toFixed(6),
        updatedAt: new Date()
      })
      .where(eq(properties.id, property.id));

    updated += 1;
  }

  return NextResponse.json({ processed, updated, skipped }, { status: 200 });
}
