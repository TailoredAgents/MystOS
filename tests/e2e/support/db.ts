import { desc, eq, sql } from "drizzle-orm";

type DbModule = typeof import("../../../apps/api/src/db");

let dbModulePromise: Promise<DbModule> | null = null;

async function loadDbModule(): Promise<DbModule> {
  if (!dbModulePromise) {
    dbModulePromise = import("../../../apps/api/src/db");
  }
  return dbModulePromise;
}

async function getDb() {
  const mod = await loadDbModule();
  return {
    db: mod.getDb(),
    tables: mod
  };
}

export type LeadDetails = {
  leadId: string;
  contactId: string;
  propertyId: string;
  services: string[];
  contactEmail: string | null;
  contactPhoneE164: string | null;
  appointmentId: string | null;
};

export type QuoteDetails = {
  id: string;
  status: string;
  shareToken: string | null;
  total: number;
  depositDue: number;
  balanceDue: number;
  contactEmail: string | null;
};

export type OutboxEventDetails = {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  createdAt: Date;
};

export async function findLeadByEmail(email: string): Promise<LeadDetails | null> {
  const { db, tables } = await getDb();
  const { leads, contacts, properties, appointments } = tables;

  const rows = await db
    .select({
      leadId: leads.id,
      contactId: leads.contactId,
      propertyId: leads.propertyId,
      services: leads.servicesRequested,
      contactEmail: contacts.email,
      contactPhoneE164: contacts.phoneE164,
      appointmentId: appointments.id
    })
    .from(leads)
    .innerJoin(contacts, eq(leads.contactId, contacts.id))
    .innerJoin(properties, eq(leads.propertyId, properties.id))
    .leftJoin(appointments, eq(appointments.leadId, leads.id))
    .where(eq(contacts.email, email))
    .orderBy(desc(leads.createdAt))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    leadId: row.leadId,
    contactId: row.contactId,
    propertyId: row.propertyId,
    services: row.services ?? [],
    contactEmail: row.contactEmail,
    contactPhoneE164: row.contactPhoneE164,
    appointmentId: row.appointmentId ?? null
  };
}

export async function getQuoteById(id: string): Promise<QuoteDetails | null> {
  const { db, tables } = await getDb();
  const { quotes, contacts } = tables;

  const rows = await db
    .select({
      id: quotes.id,
      status: quotes.status,
      shareToken: quotes.shareToken,
      total: quotes.total,
      depositDue: quotes.depositDue,
      balanceDue: quotes.balanceDue,
      contactEmail: contacts.email
    })
    .from(quotes)
    .leftJoin(contacts, eq(quotes.contactId, contacts.id))
    .where(eq(quotes.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    status: row.status,
    shareToken: row.shareToken,
    total: Number(row.total ?? 0),
    depositDue: Number(row.depositDue ?? 0),
    balanceDue: Number(row.balanceDue ?? 0),
    contactEmail: row.contactEmail
  };
}

export async function getOutboxEventsByLeadId(leadId: string): Promise<OutboxEventDetails[]> {
  const { db, tables } = await getDb();
  const { outboxEvents } = tables;

  return db
    .select({
      id: outboxEvents.id,
      type: outboxEvents.type,
      payload: outboxEvents.payload,
      createdAt: outboxEvents.createdAt
    })
    .from(outboxEvents)
    .where(sql`payload->>'leadId' = ${leadId}`)
    .orderBy(desc(outboxEvents.createdAt));
}

export async function getOutboxEventsByQuoteId(quoteId: string): Promise<OutboxEventDetails[]> {
  const { db, tables } = await getDb();
  const { outboxEvents } = tables;

  return db
    .select({
      id: outboxEvents.id,
      type: outboxEvents.type,
      payload: outboxEvents.payload,
      createdAt: outboxEvents.createdAt
    })
    .from(outboxEvents)
    .where(sql`payload->>'quoteId' = ${quoteId}`)
    .orderBy(desc(outboxEvents.createdAt));
}
