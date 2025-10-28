import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getDb, contacts } from "@/db";
import { isAdminRequest } from "../../../web/admin";
import { normalizePhone } from "../../../web/utils";
import { eq } from "drizzle-orm";

type RouteContext = {
  params: Promise<{ contactId?: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
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

  const { firstName, lastName, email, phone, preferredContactMethod, source } = payload as Record<
    string,
    unknown
  >;

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (typeof firstName === "string") {
    const trimmed = firstName.trim();
    if (trimmed.length === 0) {
      return NextResponse.json({ error: "first_name_required" }, { status: 400 });
    }
    updates["firstName"] = trimmed;
  }

  if (typeof lastName === "string") {
    const trimmed = lastName.trim();
    if (trimmed.length === 0) {
      return NextResponse.json({ error: "last_name_required" }, { status: 400 });
    }
    updates["lastName"] = trimmed;
  }

  if (email !== undefined) {
    if (typeof email === "string" && email.trim().length > 0) {
      updates["email"] = email.trim();
    } else if (email === null || (typeof email === "string" && email.trim().length === 0)) {
      updates["email"] = null;
    } else {
      return NextResponse.json({ error: "invalid_email" }, { status: 400 });
    }
  }

  if (phone !== undefined) {
    if (typeof phone === "string" && phone.trim().length > 0) {
      try {
        const normalized = normalizePhone(phone);
        updates["phone"] = normalized.raw;
        updates["phoneE164"] = normalized.e164;
      } catch {
        return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
      }
    } else if (phone === null || (typeof phone === "string" && phone.trim().length === 0)) {
      updates["phone"] = null;
      updates["phoneE164"] = null;
    } else {
      return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
    }
  }

  if (typeof preferredContactMethod === "string") {
    updates["preferredContactMethod"] = preferredContactMethod.trim();
  }

  if (typeof source === "string") {
    updates["source"] = source.trim();
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: "no_updates_provided" }, { status: 400 });
  }

  const db = getDb();

  const [updated] = await db
    .update(contacts)
    .set(updates)
    .where(eq(contacts.id, contactId))
    .returning({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      email: contacts.email,
      phone: contacts.phone,
      phoneE164: contacts.phoneE164,
      preferredContactMethod: contacts.preferredContactMethod,
      source: contacts.source,
      updatedAt: contacts.updatedAt
    });

  if (!updated) {
    return NextResponse.json({ error: "contact_not_found" }, { status: 404 });
  }

  return NextResponse.json({
    contact: {
      id: updated.id,
      firstName: updated.firstName,
      lastName: updated.lastName,
      email: updated.email,
      phone: updated.phone,
      phoneE164: updated.phoneE164,
      preferredContactMethod: updated.preferredContactMethod,
      source: updated.source,
      updatedAt: updated.updatedAt.toISOString()
    }
  });
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { contactId } = await context.params;
  if (!contactId) {
    return NextResponse.json({ error: "contact_id_required" }, { status: 400 });
  }

  const db = getDb();
  const [result] = await db
    .delete(contacts)
    .where(eq(contacts.id, contactId))
    .returning({ id: contacts.id });

  if (!result) {
    return NextResponse.json({ error: "contact_not_found" }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
