import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getDb, properties } from "@/db";
import { isAdminRequest } from "../../../../../web/admin";
import { and, eq } from "drizzle-orm";

type RouteParams = {
  params: { contactId?: string; propertyId?: string };
};

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<Response> {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const contactId = params.contactId;
  const propertyId = params.propertyId;
  if (!contactId || !propertyId) {
    return NextResponse.json({ error: "contact_and_property_required" }, { status: 400 });
  }

  const payload = (await request.json().catch(() => null)) as unknown;
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const { addressLine1, addressLine2, city, state, postalCode } = payload as Record<
    string,
    unknown
  >;

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (addressLine1 !== undefined) {
    if (typeof addressLine1 === "string" && addressLine1.trim().length > 0) {
      updates["addressLine1"] = addressLine1.trim();
    } else if (addressLine1 === null || (typeof addressLine1 === "string" && addressLine1.trim().length === 0)) {
      return NextResponse.json({ error: "address_required" }, { status: 400 });
    } else {
      return NextResponse.json({ error: "invalid_address" }, { status: 400 });
    }
  }

  if (addressLine2 !== undefined) {
    if (typeof addressLine2 === "string" && addressLine2.trim().length > 0) {
      updates["addressLine2"] = addressLine2.trim();
    } else if (addressLine2 === null || (typeof addressLine2 === "string" && addressLine2.trim().length === 0)) {
      updates["addressLine2"] = null;
    } else {
      return NextResponse.json({ error: "invalid_address_line2" }, { status: 400 });
    }
  }

  if (city !== undefined) {
    if (typeof city === "string" && city.trim().length > 0) {
      updates["city"] = city.trim();
    } else {
      return NextResponse.json({ error: "city_required" }, { status: 400 });
    }
  }

  if (state !== undefined) {
    if (typeof state === "string" && state.trim().length > 0) {
      updates["state"] = state.trim().slice(0, 2).toUpperCase();
    } else {
      return NextResponse.json({ error: "state_required" }, { status: 400 });
    }
  }

  if (postalCode !== undefined) {
    if (typeof postalCode === "string" && postalCode.trim().length > 0) {
      updates["postalCode"] = postalCode.trim();
    } else {
      return NextResponse.json({ error: "postal_code_required" }, { status: 400 });
    }
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: "no_updates_provided" }, { status: 400 });
  }

  const db = getDb();

  const [updated] = await db
    .update(properties)
    .set(updates)
    .where(and(eq(properties.id, propertyId), eq(properties.contactId, contactId)))
    .returning({
      id: properties.id,
      addressLine1: properties.addressLine1,
      addressLine2: properties.addressLine2,
      city: properties.city,
      state: properties.state,
      postalCode: properties.postalCode,
      updatedAt: properties.updatedAt
    });

  if (!updated) {
    return NextResponse.json({ error: "property_not_found" }, { status: 404 });
  }

  return NextResponse.json({
    property: {
      id: updated.id,
      addressLine1: updated.addressLine1,
      addressLine2: updated.addressLine2,
      city: updated.city,
      state: updated.state,
      postalCode: updated.postalCode,
      updatedAt: updated.updatedAt.toISOString()
    }
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<Response> {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const contactId = params.contactId;
  const propertyId = params.propertyId;
  if (!contactId || !propertyId) {
    return NextResponse.json({ error: "contact_and_property_required" }, { status: 400 });
  }

  const db = getDb();
  const [deleted] = await db
    .delete(properties)
    .where(and(eq(properties.id, propertyId), eq(properties.contactId, contactId)))
    .returning({ id: properties.id });

  if (!deleted) {
    return NextResponse.json({ error: "property_not_found" }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
