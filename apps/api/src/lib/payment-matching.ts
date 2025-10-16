import type { DatabaseClient } from "@/db";
import type { StripeCharge } from "./stripe";
import { and, desc, eq, ne } from "drizzle-orm";
import { appointments, contacts } from "@/db";

function getMetadataValue<T extends string>(metadata: Record<string, unknown> | null | undefined, keys: T[]): string | null {
  if (!metadata) {
    return null;
  }
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

export async function resolveAppointmentIdForCharge(db: DatabaseClient, charge: StripeCharge): Promise<string | null> {
  const metadata = (charge.metadata ?? null) as Record<string, unknown> | null;
  const directId = getMetadataValue(metadata, ["appointment_id", "appointmentId"]);
  if (directId) {
    const existing = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(eq(appointments.id, directId))
      .limit(1);
    if (existing.length > 0) {
      return existing[0]!.id;
    }
  }

  const email = getMetadataValue(metadata, ["contact_email", "email", "customer_email"]);
  if (email) {
    const emailLower = email.toLowerCase();
    const candidates = await db
      .select({ id: appointments.id })
      .from(appointments)
      .leftJoin(contacts, eq(appointments.contactId, contacts.id))
      .where(and(eq(contacts.email, emailLower), ne(appointments.status, "canceled")))
      .orderBy(desc(appointments.updatedAt))
      .limit(1);
    if (candidates.length > 0) {
      return candidates[0]!.id;
    }
  }

  const phone = getMetadataValue(metadata, ["contact_phone", "phone", "phone_e164"]);
  if (phone) {
    const normalized = phone.replace(/[^+0-9]/g, "");
    const candidates = await db
      .select({ id: appointments.id })
      .from(appointments)
      .leftJoin(contacts, eq(appointments.contactId, contacts.id))
      .where(
        and(
          ne(appointments.status, "canceled"),
          eq(contacts.phoneE164, normalized.startsWith("+") ? normalized : `+${normalized}`)
        )
      )
      .orderBy(desc(appointments.updatedAt))
      .limit(1);
    if (candidates.length > 0) {
      return candidates[0]!.id;
    }
  }

  return null;
}
