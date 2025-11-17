import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getDb, contacts, properties } from "@/db";
import { isAdminRequest } from "../../../../web/admin";
import { eq } from "drizzle-orm";
import { geocodeAddress } from "@/lib/mapbox-geocode";

type RouteContext = {
  params: Promise<{ contactId?: string }>;
};

function normalizeCoordinate(
  value: unknown,
  { field, min, max }: { field: "lat" | "lng"; min: number; max: number }
): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (
    value === null ||
    (typeof value === "string" && value.trim().length === 0)
  ) {
    return null;
  }

  const raw =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value.trim())
      : NaN;
  if (!Number.isFinite(raw) || raw < min || raw > max) {
    throw new Error(`${field}_invalid`);
  }
  return Number(raw.toFixed(6));
}

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { contactId } = await context.params;
  if (!contactId) {
    return NextResponse.json({ error: "contact_id_required" }, { status: 400 });
  }

  const payload = (await request.json().catch(() => null)) as unknown;
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const {
    addressLine1,
    addressLine2,
    city,
    state,
    postalCode,
    lat,
    lng
  } = payload as Record<string, unknown>;

  if (typeof addressLine1 !== "string" || addressLine1.trim().length === 0) {
    return NextResponse.json({ error: "address_required" }, { status: 400 });
  }
  if (typeof city !== "string" || city.trim().length === 0) {
    return NextResponse.json({ error: "city_required" }, { status: 400 });
  }
  if (typeof state !== "string" || state.trim().length === 0) {
    return NextResponse.json({ error: "state_required" }, { status: 400 });
  }
  if (typeof postalCode !== "string" || postalCode.trim().length === 0) {
    return NextResponse.json({ error: "postal_code_required" }, { status: 400 });
  }

  let normalizedLat: number | null | undefined;
  let normalizedLng: number | null | undefined;
  try {
    normalizedLat = normalizeCoordinate(lat, { field: "lat", min: -90, max: 90 });
    normalizedLng = normalizeCoordinate(lng, { field: "lng", min: -180, max: 180 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "coordinate_invalid";
    return NextResponse.json({ error: code }, { status: 400 });
  }

  const db = getDb();

  const [contact] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);

  if (!contact) {
    return NextResponse.json({ error: "contact_not_found" }, { status: 404 });
  }

  const latProvided = normalizedLat !== undefined;
  const lngProvided = normalizedLng !== undefined;
  let latPayload: string | null | undefined;
  if (latProvided) {
    latPayload = normalizedLat === null ? null : normalizedLat!.toFixed(6);
  }
  let lngPayload: string | null | undefined;
  if (lngProvided) {
    lngPayload = normalizedLng === null ? null : normalizedLng!.toFixed(6);
  }

  if (!latProvided && !lngProvided) {
    const geocoded = await geocodeAddress({
      line1: addressLine1.trim(),
      city: city.trim(),
      state: state.trim(),
      postalCode: postalCode.trim()
    });
    if (geocoded) {
      latPayload = geocoded.lat.toFixed(6);
      lngPayload = geocoded.lng.toFixed(6);
    }
  }

  const [property] = await db
    .insert(properties)
    .values({
      contactId,
      addressLine1: addressLine1.trim(),
      addressLine2:
        typeof addressLine2 === "string" && addressLine2.trim().length
          ? addressLine2.trim()
          : null,
      city: city.trim(),
      state: state.trim().slice(0, 2).toUpperCase(),
      postalCode: postalCode.trim(),
      lat: latPayload ?? null,
      lng: lngPayload ?? null
    })
    .returning({
      id: properties.id,
      addressLine1: properties.addressLine1,
      addressLine2: properties.addressLine2,
      city: properties.city,
      state: properties.state,
      postalCode: properties.postalCode,
      lat: properties.lat,
      lng: properties.lng,
      createdAt: properties.createdAt
    });

  if (!property) {
    return NextResponse.json({ error: "property_insert_failed" }, { status: 500 });
  }

  const latValue =
    property.lat === null || property.lat === undefined ? null : Number(property.lat);
  const lngValue =
    property.lng === null || property.lng === undefined ? null : Number(property.lng);

  return NextResponse.json({
    property: {
      id: property.id,
      addressLine1: property.addressLine1,
      addressLine2: property.addressLine2,
      city: property.city,
      state: property.state,
      postalCode: property.postalCode,
      lat: latValue,
      lng: lngValue,
      createdAt: property.createdAt.toISOString()
    }
  });
}
