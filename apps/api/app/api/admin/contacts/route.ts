import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getDb, contacts, properties, appointments, quotes } from "@/db";
import { isAdminRequest } from "../../web/admin";
import { normalizePhone } from "../../web/utils";
import { desc, inArray, sql } from "drizzle-orm";

export async function GET(request: NextRequest): Promise<Response> {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const search = request.nextUrl.searchParams.get("q")?.trim().toLowerCase();
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.max(1, Math.min(Number(limitParam) || 50, 200)) : 50;

  const contactRows = await db
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      email: contacts.email,
      phone: contacts.phone,
      phoneE164: contacts.phoneE164,
      createdAt: contacts.createdAt,
      updatedAt: contacts.updatedAt
    })
    .from(contacts)
    .orderBy(desc(contacts.updatedAt))
    .limit(limit);

  const filteredContacts = search
    ? contactRows.filter((contact) => {
        const haystack = [contact.firstName, contact.lastName, contact.email ?? "", contact.phone ?? "", contact.phoneE164 ?? ""]
          .join(" ")
          .toLowerCase();
        return haystack.includes(search);
      })
    : contactRows;

  const contactIds = filteredContacts.map((contact) => contact.id);

  const propertyRows =
    contactIds.length > 0
      ? await db
          .select({
            id: properties.id,
            contactId: properties.contactId,
            addressLine1: properties.addressLine1,
            city: properties.city,
            state: properties.state,
            postalCode: properties.postalCode,
            createdAt: properties.createdAt
          })
          .from(properties)
          .where(inArray(properties.contactId, contactIds))
      : [];

  const appointmentStats =
    contactIds.length > 0
      ? await db
          .select({
            contactId: appointments.contactId,
            count: sql<number>`count(*)`,
            latest: sql<Date | null>`max(coalesce(${appointments.updatedAt}, ${appointments.startAt}))`
          })
          .from(appointments)
          .where(inArray(appointments.contactId, contactIds))
          .groupBy(appointments.contactId)
      : [];

  const quoteStats =
    contactIds.length > 0
      ? await db
          .select({
            contactId: quotes.contactId,
            count: sql<number>`count(*)`,
            latest: sql<Date | null>`max(${quotes.updatedAt})`
          })
          .from(quotes)
          .where(inArray(quotes.contactId, contactIds))
          .groupBy(quotes.contactId)
      : [];

  const propertyMap = new Map<string, typeof propertyRows>();
  for (const property of propertyRows) {
    if (!property.contactId) continue;
    if (!propertyMap.has(property.contactId)) {
      propertyMap.set(property.contactId, []);
    }
    propertyMap.get(property.contactId)!.push(property);
  }

  const appointmentMap = new Map<string, { count: number; latest: Date | null }>();
  for (const stat of appointmentStats) {
    if (!stat.contactId) continue;
    appointmentMap.set(stat.contactId, { count: Number(stat.count), latest: stat.latest });
  }

  const quoteMap = new Map<string, { count: number; latest: Date | null }>();
  for (const stat of quoteStats) {
    if (!stat.contactId) continue;
    quoteMap.set(stat.contactId, { count: Number(stat.count), latest: stat.latest });
  }

  const contactsDto = filteredContacts.map((contact) => {
    const propertiesForContact = propertyMap.get(contact.id) ?? [];
    const appointmentStat = appointmentMap.get(contact.id);
    const quoteStat = quoteMap.get(contact.id);

    const dates: Date[] = [contact.updatedAt];
    if (appointmentStat?.latest) dates.push(appointmentStat.latest);
    if (quoteStat?.latest) dates.push(quoteStat.latest);
    const lastActivity = dates.filter(Boolean).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    const fullName = `${contact.firstName} ${contact.lastName}`.trim();

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
      properties: propertiesForContact.map((property) => ({
        id: property.id,
        addressLine1: property.addressLine1,
        city: property.city,
        state: property.state,
        postalCode: property.postalCode,
        createdAt: property.createdAt.toISOString()
      })),
      stats: {
        appointments: appointmentStat?.count ?? 0,
        quotes: quoteStat?.count ?? 0
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
