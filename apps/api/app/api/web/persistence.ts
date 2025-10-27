import { eq } from "drizzle-orm";
import { contacts, properties } from "@/db";
import type { DatabaseClient } from "@/db";
import type { InferModel } from "drizzle-orm";

type Database = DatabaseClient;
type TransactionExecutor = Parameters<Database["transaction"]>[0] extends (
  tx: infer Tx
) => Promise<unknown>
  ? Tx
  : never;

type DbExecutor = Database | TransactionExecutor;

export type ContactRecord = InferModel<typeof contacts, "select">;
export type PropertyRecord = InferModel<typeof properties, "select">;

interface UpsertContactInput {
  firstName: string;
  lastName: string;
  phoneRaw: string;
  phoneE164: string;
  email?: string | null;
  source?: string;
}

export async function upsertContact(
  db: DbExecutor,
  input: UpsertContactInput
): Promise<ContactRecord> {
  const email = input.email?.trim().toLowerCase();
  let contact: ContactRecord | undefined;

  if (email) {
    const [existingByEmail] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.email, email))
      .limit(1);
    contact = existingByEmail as ContactRecord | undefined;
  }

  if (!contact) {
    const [existingByPhone] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.phoneE164, input.phoneE164))
      .limit(1);
    contact = existingByPhone as ContactRecord | undefined;
  }

  if (contact) {
    const updatePayload: Partial<ContactRecord> = {
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phoneRaw,
      phoneE164: input.phoneE164,
      updatedAt: new Date()
    };

    if (email && !contact.email) {
      updatePayload.email = email;
    }

    const [updated] = await db
      .update(contacts)
      .set(updatePayload)
      .where(eq(contacts.id, contact.id))
      .returning();

    return updated as ContactRecord;
  }

  const [inserted] = await db
    .insert(contacts)
    .values({
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phoneRaw,
      phoneE164: input.phoneE164,
      email,
      source: input.source ?? "web"
    })
    .returning();

  return inserted as ContactRecord;
}

interface UpsertPropertyInput {
  contactId: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  gated?: boolean;
}

export async function upsertProperty(
  db: DbExecutor,
  input: UpsertPropertyInput
): Promise<PropertyRecord> {
  const trimmedAddress = input.addressLine1.trim();
  const trimmedCity = input.city.trim();
  const normalizedState = input.state.trim().toUpperCase();
  const trimmedPostalCode = input.postalCode.trim();
  const gated = input.gated ?? false;

  const [inserted] = await db
    .insert(properties)
    .values({
      contactId: input.contactId,
      addressLine1: trimmedAddress,
      city: trimmedCity,
      state: normalizedState,
      postalCode: trimmedPostalCode,
      gated
    })
    .onConflictDoUpdate({
      target: [properties.addressLine1, properties.postalCode, properties.state],
      set: {
        contactId: input.contactId,
        city: trimmedCity,
        gated,
        updatedAt: new Date()
      }
    })
    .returning();

  return inserted as PropertyRecord;
}
