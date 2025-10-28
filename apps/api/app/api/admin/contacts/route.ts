import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getDb, contacts, properties } from "@/db";
import { isAdminRequest } from "../../web/admin";
import { normalizePhone } from "../../web/utils";

export async function GET(request: NextRequest): Promise<Response> {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const search = request.nextUrl.searchParams.get("q")?.trim().toLowerCase();
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.max(1, Math.min(Number(limitParam) || 50, 200)) : 50;

  const contactRows = await db.query.contacts.findMany({
    with: {
      properties: true,
      appointments: {
        columns: {
          id: true,
          status: true,
          startAt: true,
          updatedAt: true
        }
      },
      quotes: {
        columns: {
          id: true,
          status: true,
          total: true,
          updatedAt: true
        }
      }
    },
    orderBy: (fields, operators) => operators.desc(fields.updatedAt),
    limit
  });

  const filtered = search
    ? contactRows.filter((contact) => {
        const haystack = [
          contact.firstName,
          contact.lastName,
          contact.email ?? "",
          contact.phone ?? "",
          contact.phoneE164 ?? "",
          contact.properties.map((p) => `${p.addressLine1} ${p.city} ${p.state} ${p.postalCode}`).join(" ")
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(search);
      })
    : contactRows;

  const contactsDto = filtered.map((contact) => {
    const fullName = `${contact.firstName} ${contact.lastName}`.trim();
    const appointments = contact.appointments ?? [];
    const quotes = contact.quotes ?? [];
    const lastActivity = [
      contact.updatedAt,
      ...appointments.map((a) => a.updatedAt ?? a.startAt ?? null),
      ...quotes.map((q) => q.updatedAt ?? null)
    ]
      .filter((value): value is Date => value instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime())[0];

    return {
      id: contact.id,
      name: fullName,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      phoneE164: contact.phoneE164,
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
      lastActivityAt: lastActivity ? lastActivity.toISOString() : null,
      properties: (contact.properties ?? []).map((property) => ({
        id: property.id,
        addressLine1: property.addressLine1,
        city: property.city,
        state: property.state,
        postalCode: property.postalCode,
        createdAt: property.createdAt.toISOString()
      })),
      stats: {
        appointments: appointments.length,
        quotes: quotes.length
      }
    };
  });

  return NextResponse.json({ contacts: contactsDto });
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as unknown;
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const {
    firstName,
    lastName,
    email,
    phone,
    property: propertyInput
  } = payload as Record<string, unknown>;

  if (typeof firstName !== "string" || firstName.trim().length === 0) {
    return NextResponse.json({ error: "first_name_required" }, { status: 400 });
  }
  if (typeof lastName !== "string" || lastName.trim().length === 0) {
    return NextResponse.json({ error: "last_name_required" }, { status: 400 });
  }
  if (!propertyInput || typeof propertyInput !== "object") {
    return NextResponse.json({ error: "property_required" }, { status: 400 });
  }

  const { addressLine1, city, state, postalCode } = propertyInput as Record<string, unknown>;
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

  let normalizedPhone: { raw: string; e164: string } | null = null;
  if (typeof phone === "string" && phone.trim().length > 0) {
    try {
      normalizedPhone = normalizePhone(phone);
    } catch {
      return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
    }
  }

  const db = getDb();

  const [contact] = await db
    .insert(contacts)
    .values({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: typeof email === "string" && email.trim().length ? email.trim() : null,
      phone: normalizedPhone?.raw ?? (typeof phone === "string" ? phone.trim() : null),
      phoneE164: normalizedPhone?.e164 ?? null,
      source: "manual",
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .returning();

  if (!contact) {
    return NextResponse.json({ error: "contact_insert_failed" }, { status: 500 });
  }

  const [property] = await db
    .insert(properties)
    .values({
      contactId: contact.id,
      addressLine1: addressLine1.trim(),
      addressLine2: null,
      city: city.trim(),
      state: state.trim().slice(0, 2).toUpperCase(),
      postalCode: postalCode.trim()
    })
    .returning();

  return NextResponse.json({
    contact: {
      id: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      phoneE164: contact.phoneE164,
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
      property: property
        ? {
            id: property.id,
            addressLine1: property.addressLine1,
            city: property.city,
            state: property.state,
            postalCode: property.postalCode
          }
        : null
    }
  });
}
