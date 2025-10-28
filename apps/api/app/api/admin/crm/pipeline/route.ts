import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  getDb,
  crmPipeline,
  contacts,
  properties,
  appointments,
  quotes,
  crmTasks
} from "@/db";
import { isAdminRequest } from "../../../web/admin";
import { and, eq, inArray, sql } from "drizzle-orm";
import { PIPELINE_STAGES } from "./stages";

export async function GET(request: NextRequest): Promise<Response> {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getDb();

  const pipelineRows = await db
    .select({
      contactId: crmPipeline.contactId,
      stage: crmPipeline.stage,
      notes: crmPipeline.notes,
      pipelineUpdatedAt: crmPipeline.updatedAt,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      email: contacts.email,
      phone: contacts.phone,
      updatedAt: contacts.updatedAt,
      createdAt: contacts.createdAt
    })
    .from(crmPipeline)
    .innerJoin(contacts, eq(crmPipeline.contactId, contacts.id));

  if (pipelineRows.length === 0) {
    return NextResponse.json({
      stages: PIPELINE_STAGES,
      lanes: PIPELINE_STAGES.map((stage) => ({ stage, contacts: [] }))
    });
  }

  const contactIds = pipelineRows.map((row) => row.contactId).filter((id): id is string => Boolean(id));

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

  const openTaskCounts =
    contactIds.length > 0
      ? await db
          .select({
            contactId: crmTasks.contactId,
            count: sql<number>`count(*)`
          })
          .from(crmTasks)
          .where(and(inArray(crmTasks.contactId, contactIds), eq(crmTasks.status, "open")))
          .groupBy(crmTasks.contactId)
      : [];

  const primaryPropertyByContact = new Map<string, (typeof propertyRows)[number]>();
  for (const property of propertyRows) {
    if (!property.contactId) continue;
    const current = primaryPropertyByContact.get(property.contactId);
    if (!current) {
      primaryPropertyByContact.set(property.contactId, property);
      continue;
    }
    if (property.createdAt > current.createdAt) {
      primaryPropertyByContact.set(property.contactId, property);
    }
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

  const openTaskMap = new Map<string, number>();
  for (const stat of openTaskCounts) {
    if (!stat.contactId) continue;
    openTaskMap.set(stat.contactId, Number(stat.count));
  }

  const lanes = PIPELINE_STAGES.map((stage) => ({ stage, contacts: [] as Array<Record<string, unknown>> }));
  const laneLookup = new Map<string, (typeof lanes)[number]>();
  for (const lane of lanes) {
    laneLookup.set(lane.stage, lane);
  }

  for (const row of pipelineRows) {
    const contactId = row.contactId;
    if (!contactId) continue;
    const stage = (row.stage ?? "new").toLowerCase();
    const lane = laneLookup.get(stage) ?? laneLookup.get("new");
    if (!lane) continue;

    const property = primaryPropertyByContact.get(contactId);
    const appointmentStat = appointmentMap.get(contactId);
    const quoteStat = quoteMap.get(contactId);
    const openTasks = openTaskMap.get(contactId) ?? 0;

    const dates: Date[] = [row.updatedAt];
    if (row.pipelineUpdatedAt) dates.push(row.pipelineUpdatedAt);
    if (appointmentStat?.latest) dates.push(appointmentStat.latest);
    if (quoteStat?.latest) dates.push(quoteStat.latest);

    const lastActivity =
      dates
        .filter((value): value is Date => Boolean(value))
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    lane.contacts.push({
      id: contactId,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      pipeline: {
        stage,
        notes: row.notes ?? null,
        updatedAt: row.pipelineUpdatedAt ? row.pipelineUpdatedAt.toISOString() : null
      },
      property: property
        ? {
            id: property.id,
            addressLine1: property.addressLine1,
            city: property.city,
            state: property.state,
            postalCode: property.postalCode
          }
        : null,
      stats: {
        appointments: appointmentStat?.count ?? 0,
        quotes: quoteStat?.count ?? 0
      },
      openTasks,
      lastActivityAt: lastActivity ? lastActivity.toISOString() : null,
      updatedAt: row.updatedAt.toISOString(),
      createdAt: row.createdAt.toISOString()
    });
  }

  for (const lane of lanes) {
    lane.contacts.sort((a, b) => {
      const aTime = typeof a["lastActivityAt"] === "string" ? Date.parse(a["lastActivityAt"]) : 0;
      const bTime = typeof b["lastActivityAt"] === "string" ? Date.parse(b["lastActivityAt"]) : 0;
      return bTime - aTime;
    });
  }

  return NextResponse.json({ stages: PIPELINE_STAGES, lanes });
}
