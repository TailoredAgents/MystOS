import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  getDb,
  crmPipeline,
  contacts,
  properties,
  appointments,
  quotes,
  crmTasks,
  payments
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

  const acceptedQuotes =
    contactIds.length > 0
      ? await db
          .select({
            contactId: quotes.contactId,
            quoteId: quotes.id,
            total: quotes.total,
            appointmentId: quotes.jobAppointmentId,
            appointmentStatus: appointments.status,
            appointmentStartAt: appointments.startAt
          })
          .from(quotes)
          .leftJoin(appointments, eq(quotes.jobAppointmentId, appointments.id))
          .where(and(inArray(quotes.contactId, contactIds), eq(quotes.status, "accepted")))
          .orderBy(sql`coalesce(${quotes.updatedAt}, ${quotes.createdAt}) desc`)
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

  const latestAcceptedByContact = new Map<
    string,
    {
      quoteId: string;
      total: number;
      appointmentId: string | null;
      appointmentStatus: string | null;
      appointmentStartAt: Date | null;
    }
  >();
  for (const row of acceptedQuotes) {
    const contactId = row.contactId;
    if (!contactId || latestAcceptedByContact.has(contactId)) {
      continue;
    }
    latestAcceptedByContact.set(contactId, {
      quoteId: row.quoteId,
      total: Number(row.total ?? 0),
      appointmentId: row.appointmentId ?? null,
      appointmentStatus: row.appointmentStatus ?? null,
      appointmentStartAt: row.appointmentStartAt ?? null
    });
  }

  const paymentAppointmentIds = Array.from(
    new Set(
      Array.from(latestAcceptedByContact.values())
        .map((row) => row.appointmentId)
        .filter((id): id is string => Boolean(id))
    )
  );

  const paymentAggs =
    paymentAppointmentIds.length > 0
      ? await db
          .select({
            appointmentId: payments.appointmentId,
            totalPaidCents: sql<number>`coalesce(sum(${payments.amount}), 0)`,
            lastPaymentAt: sql<Date | null>`max(${payments.capturedAt})`,
            lastPaymentMethod: sql<string | null>`max(${payments.method})`
          })
          .from(payments)
          .where(inArray(payments.appointmentId, paymentAppointmentIds))
          .groupBy(payments.appointmentId)
      : [];

  const paymentMap = new Map<
    string,
    { totalPaidCents: number; lastPaymentAt: Date | null; lastPaymentMethod: string | null }
  >();
  for (const payment of paymentAggs) {
    if (!payment.appointmentId) continue;
    paymentMap.set(payment.appointmentId, {
      totalPaidCents: Number(payment.totalPaidCents ?? 0),
      lastPaymentAt: payment.lastPaymentAt ?? null,
      lastPaymentMethod: payment.lastPaymentMethod ?? null
    });
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
    const latestAccepted = latestAcceptedByContact.get(contactId);
    const paymentSummary =
      latestAccepted && latestAccepted.appointmentId
        ? paymentMap.get(latestAccepted.appointmentId) ?? { totalPaidCents: 0, lastPaymentAt: null, lastPaymentMethod: null }
        : null;
    let jobSummary: {
      quoteId: string;
      appointmentId: string | null;
      appointmentStatus: string | null;
      startAt: string | null;
      totalCents: number;
      paidCents: number;
      outstandingCents: number;
      lastPaymentAt: string | null;
      lastPaymentMethod: string | null;
    } | null = null;

    if (latestAccepted) {
      const totalCents = Math.max(Math.round(Number(latestAccepted.total ?? 0) * 100), 0);
      const paidCents = paymentSummary ? Number(paymentSummary.totalPaidCents ?? 0) : 0;
      const outstandingCents = Math.max(totalCents - paidCents, 0);
      jobSummary = {
        quoteId: latestAccepted.quoteId,
        appointmentId: latestAccepted.appointmentId,
        appointmentStatus: latestAccepted.appointmentStatus ?? null,
        startAt: latestAccepted.appointmentStartAt ? latestAccepted.appointmentStartAt.toISOString() : null,
        totalCents,
        paidCents,
        outstandingCents,
        lastPaymentAt: paymentSummary?.lastPaymentAt ? paymentSummary.lastPaymentAt.toISOString() : null,
        lastPaymentMethod: paymentSummary?.lastPaymentMethod ?? null
      };
    }

    const dates = [
      toDate(row.updatedAt),
      toDate(row.pipelineUpdatedAt ?? null),
      toDate(appointmentStat?.latest ?? null),
      toDate(quoteStat?.latest ?? null)
    ];

    const lastActivity =
      dates
        .filter((value): value is Date => value instanceof Date)
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
      jobSummary,
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
function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
