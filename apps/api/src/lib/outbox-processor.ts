import { asc, eq, isNull } from "drizzle-orm";
import {
  getDb,
  outboxEvents,
  appointments,
  leads,
  contacts,
  properties,
  quotes,
  appointmentNotes,
  crmPipeline
} from "@/db";
import type { EstimateNotificationPayload, QuoteNotificationPayload } from "@/lib/notifications";
import {
  sendEstimateConfirmation,
  sendQuoteSentNotification,
  sendQuoteDecisionNotification
} from "@/lib/notifications";
import type { AppointmentCalendarPayload } from "@/lib/calendar";
import { createCalendarEventWithRetry, updateCalendarEventWithRetry } from "@/lib/calendar-events";

type OutboxEventRecord = typeof outboxEvents.$inferSelect;

export interface OutboxBatchStats {
  total: number;
  processed: number;
  skipped: number;
  errors: number;
}

export interface ProcessOutboxBatchOptions {
  limit?: number;
}


const APPOINTMENT_STATUS_VALUES = ["requested", "confirmed", "completed", "no_show", "canceled"] as const;
type AppointmentStatus = (typeof APPOINTMENT_STATUS_VALUES)[number];
const VALID_APPOINTMENT_STATUSES = new Set<string>(APPOINTMENT_STATUS_VALUES);

type PipelineStageValue = (typeof crmPipeline.$inferInsert)["stage"];
const PIPELINE_STAGE_VALUES: PipelineStageValue[] = ["new", "contacted", "qualified", "quoted", "won", "lost"];
const VALID_PIPELINE_STAGES = new Set<PipelineStageValue>(PIPELINE_STAGE_VALUES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidAppointmentStatus(value: unknown): value is AppointmentStatus {
  return typeof value === "string" && VALID_APPOINTMENT_STATUSES.has(value);
}

function parsePipelineStage(value: unknown): PipelineStageValue | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase() as PipelineStageValue;
  return normalized && VALID_PIPELINE_STAGES.has(normalized) ? normalized : null;
}

function coerceServices(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function formatCurrencyFromCents(
  amountCents: number | null | undefined,
  currency: string | null | undefined
): string {
  const cents = typeof amountCents === "number" ? amountCents : 0;
  const curr = currency && currency.trim().length ? currency.trim().toUpperCase() : "USD";
  return `${curr} ${(cents / 100).toFixed(2)}`;
}

function buildQuoteShareUrl(token: string): string {
  const base =
    process.env["NEXT_PUBLIC_SITE_URL"] ??
    process.env["SITE_URL"] ??
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/quote/${token}`;
}

function buildRescheduleUrlForAppointment(appointmentId: string, token: string): string {
  const base =
    process.env["NEXT_PUBLIC_SITE_URL"] ??
    process.env["SITE_URL"] ??
    "http://localhost:3000";
  const url = new URL("/schedule", base);
  url.searchParams.set("appointmentId", appointmentId);
  url.searchParams.set("token", token);
  return url.toString();
}

function buildCalendarPayloadFromNotification(
  notification: EstimateNotificationPayload
): AppointmentCalendarPayload | null {
  const appointment = notification.appointment;
  if (!appointment.startAt) {
    return null;
  }

  const rescheduleUrl =
    appointment.rescheduleUrl ?? buildRescheduleUrlForAppointment(appointment.id, appointment.rescheduleToken);

  return {
    appointmentId: appointment.id,
    startAt: appointment.startAt,
    durationMinutes: appointment.durationMinutes,
    travelBufferMinutes: appointment.travelBufferMinutes,
    services: notification.services,
    notes: notification.notes ?? null,
    contact: {
      name: notification.contact.name,
      email: notification.contact.email ?? null,
      phone: notification.contact.phone ?? null
    },
    property: {
      addressLine1: notification.property.addressLine1,
      city: notification.property.city,
      state: notification.property.state,
      postalCode: notification.property.postalCode
    },
    rescheduleUrl
  };
}

async function ensureCalendarEventCreated(
  notification: EstimateNotificationPayload
): Promise<string | null> {
  if (notification.appointment.calendarEventId) {
    return notification.appointment.calendarEventId;
  }

  const payload = buildCalendarPayloadFromNotification(notification);
  if (!payload) {
    return null;
  }

  const eventId = await createCalendarEventWithRetry(payload);
  if (!eventId) {
    console.warn("[calendar] create_skipped", { appointmentId: notification.appointment.id });
    return null;
  }

  try {
    const db = getDb();
    await db
      .update(appointments)
      .set({ calendarEventId: eventId, updatedAt: new Date() })
      .where(eq(appointments.id, notification.appointment.id));
  } catch (error) {
    console.warn("[calendar] appointment_update_failed", {
      appointmentId: notification.appointment.id,
      error: String(error)
    });
  }

  return eventId;
}

async function syncCalendarEventForReschedule(
  notification: EstimateNotificationPayload
): Promise<string | null> {
  const payload = buildCalendarPayloadFromNotification(notification);
  if (!payload) {
    return notification.appointment.calendarEventId ?? null;
  }

  const db = getDb();
  let calendarEventId = notification.appointment.calendarEventId ?? null;

  if (calendarEventId) {
    const updated = await updateCalendarEventWithRetry(calendarEventId, payload);
    if (updated) {
      return calendarEventId;
    }
    console.warn("[calendar] update_retry_failed", {
      appointmentId: notification.appointment.id,
      eventId: calendarEventId
    });
  }

  calendarEventId = await createCalendarEventWithRetry(payload);
  if (!calendarEventId) {
    console.warn("[calendar] create_after_update_failed", {
      appointmentId: notification.appointment.id
    });
    return null;
  }

  try {
    await db
      .update(appointments)
      .set({ calendarEventId, updatedAt: new Date() })
      .where(eq(appointments.id, notification.appointment.id));
  } catch (error) {
    console.warn("[calendar] appointment_update_failed", {
      appointmentId: notification.appointment.id,
      error: String(error)
    });
  }

  return calendarEventId;
}

async function buildNotificationPayload(
  appointmentId: string,
  overrides?: {
    services?: string[];
    rescheduleUrl?: string | null;
    scheduling?: Partial<EstimateNotificationPayload["scheduling"]>;
    notes?: string | null;
  }
): Promise<EstimateNotificationPayload | null> {
  const db = getDb();

  const rows = await db
    .select({
      appointmentId: appointments.id,
      startAt: appointments.startAt,
      durationMinutes: appointments.durationMinutes,
      travelBufferMinutes: appointments.travelBufferMinutes,
      status: appointments.status,
      rescheduleToken: appointments.rescheduleToken,
      calendarEventId: appointments.calendarEventId,
      leadId: appointments.leadId,
      contactId: contacts.id,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
      contactEmail: contacts.email,
      contactPhone: contacts.phone,
      contactPhoneE164: contacts.phoneE164,
      propertyAddressLine1: properties.addressLine1,
      propertyCity: properties.city,
      propertyState: properties.state,
      propertyPostalCode: properties.postalCode,
      leadServices: leads.servicesRequested,
      leadNotes: leads.notes,
      leadFormPayload: leads.formPayload
    })
    .from(appointments)
    .leftJoin(contacts, eq(appointments.contactId, contacts.id))
    .leftJoin(properties, eq(appointments.propertyId, properties.id))
    .leftJoin(leads, eq(appointments.leadId, leads.id))
    .where(eq(appointments.id, appointmentId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    console.warn("[outbox] appointment_not_found", { appointmentId });
    return null;
  }

  const services =
    overrides?.services && overrides.services.length > 0
      ? overrides.services
      : Array.isArray(row.leadServices)
        ? row.leadServices.filter((service): service is string => typeof service === "string" && service.length > 0)
        : [];

  const formPayload = isRecord(row.leadFormPayload) ? row.leadFormPayload : null;
  const schedulingPayload = formPayload && isRecord(formPayload["scheduling"]) ? formPayload["scheduling"] : null;

  const scheduling: EstimateNotificationPayload["scheduling"] = {
    preferredDate:
      overrides?.scheduling?.preferredDate ??
      (typeof schedulingPayload?.["preferredDate"] === "string" ? schedulingPayload["preferredDate"] : null),
    alternateDate:
      overrides?.scheduling?.alternateDate ??
      (typeof schedulingPayload?.["alternateDate"] === "string" ? schedulingPayload["alternateDate"] : null),
    timeWindow:
      overrides?.scheduling?.timeWindow ??
      (typeof schedulingPayload?.["timeWindow"] === "string" ? schedulingPayload["timeWindow"] : null)
  };

  const contactNameParts = [row.contactFirstName, row.contactLastName].filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0
  );
  const contactName =
    contactNameParts.join(" ").trim() ||
    row.contactFirstName ||
    row.contactLastName ||
    "Myst Customer";

  const status: AppointmentStatus = isValidAppointmentStatus(row.status) ? row.status : "requested";

  const rescheduleToken = row.rescheduleToken;
  if (!rescheduleToken) {
    console.warn("[outbox] missing_reschedule_token", { appointmentId });
    return null;
  }

  const rescheduleUrl =
    overrides?.rescheduleUrl ?? buildRescheduleUrlForAppointment(row.appointmentId, rescheduleToken);

  const payload: EstimateNotificationPayload = {
    leadId: row.leadId ?? "unknown",
    services,
    contact: {
      name: contactName,
      email: row.contactEmail ?? undefined,
      phone: row.contactPhoneE164 ?? row.contactPhone ?? undefined
    },
    property: {
      addressLine1: row.propertyAddressLine1 ?? "Undisclosed address",
      city: row.propertyCity ?? "",
      state: row.propertyState ?? "",
      postalCode: row.propertyPostalCode ?? ""
    },
    scheduling,
    appointment: {
      id: row.appointmentId,
      startAt: row.startAt ?? null,
      durationMinutes: row.durationMinutes ?? 60,
      travelBufferMinutes: row.travelBufferMinutes ?? 30,
      status,
      rescheduleToken,
      rescheduleUrl,
      calendarEventId: row.calendarEventId ?? null
    },
    notes: overrides?.notes ?? (typeof row.leadNotes === "string" ? row.leadNotes : null)
  };

  return payload;
}

async function buildQuoteNotificationPayload(
  quoteId: string,
  overrides?: {
    shareToken?: string | null;
    notes?: string | null;
  }
): Promise<QuoteNotificationPayload | null> {
  const db = getDb();

  const rows = await db
    .select({
      id: quotes.id,
      services: quotes.services,
      total: quotes.total,
      depositDue: quotes.depositDue,
      balanceDue: quotes.balanceDue,
      shareToken: quotes.shareToken,
      expiresAt: quotes.expiresAt,
      contactId: quotes.contactId,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
      contactEmail: contacts.email,
      contactPhone: contacts.phone,
      contactPhoneE164: contacts.phoneE164,
      propertyCity: properties.city,
      propertyState: properties.state,
      propertyPostalCode: properties.postalCode
    })
    .from(quotes)
    .leftJoin(contacts, eq(quotes.contactId, contacts.id))
    .leftJoin(properties, eq(quotes.propertyId, properties.id))
    .where(eq(quotes.id, quoteId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    console.warn("[outbox] quote_not_found", { quoteId });
    return null;
  }

  const services = Array.isArray(row.services)
    ? row.services.filter((service): service is string => typeof service === "string" && service.trim().length > 0)
    : [];

  const shareToken = overrides?.shareToken ?? row.shareToken ?? null;
  const shareUrl = shareToken ? buildQuoteShareUrl(shareToken) : null;
  if (!shareUrl) {
    console.warn("[outbox] quote_missing_share_url", { quoteId });
    return null;
  }

  const contactNameParts = [row.contactFirstName, row.contactLastName].filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0
  );
  const customerName = contactNameParts.join(" ").trim() || row.contactFirstName || "Myst Customer";

  const total = Number(row.total ?? 0);
  const depositDue = Number(row.depositDue ?? 0);
  const balanceDue = Number(row.balanceDue ?? 0);

  return {
    quoteId,
    services,
    contact: {
      name: customerName,
      email: row.contactEmail ?? null,
      phone: row.contactPhoneE164 ?? row.contactPhone ?? null
    },
    total,
    depositDue,
    balanceDue,
    shareUrl,
    expiresAt: row.expiresAt ?? null,
    notes: overrides?.notes ?? null
  };
}

async function handleOutboxEvent(event: OutboxEventRecord): Promise<"processed" | "skipped"> {
  switch (event.type) {
    case "estimate.requested": {
      const payload = isRecord(event.payload) ? event.payload : null;
      const appointmentIdValue = payload?.["appointmentId"];
      const appointmentId = typeof appointmentIdValue === "string" ? appointmentIdValue : null;
      if (!appointmentId) {
        console.warn("[outbox] estimate.requested.missing_appointment", { id: event.id });
        return "skipped";
      }

      const services = coerceServices(payload?.["services"]);
      const schedulingOverride = payload && isRecord(payload["scheduling"]) ? payload["scheduling"] : null;

      const notification = await buildNotificationPayload(appointmentId, {
        services,
        scheduling: schedulingOverride
          ? {
              preferredDate:
                typeof schedulingOverride["preferredDate"] === "string"
                  ? schedulingOverride["preferredDate"]
                  : undefined,
              alternateDate:
                typeof schedulingOverride["alternateDate"] === "string"
                  ? schedulingOverride["alternateDate"]
                  : undefined,
              timeWindow:
                typeof schedulingOverride["timeWindow"] === "string"
                  ? schedulingOverride["timeWindow"]
                  : undefined
            }
          : undefined,
        notes: typeof payload?.["notes"] === "string" ? payload["notes"] : undefined
      });

      if (!notification) {
        return "skipped";
      }

      await ensureCalendarEventCreated(notification);
      await sendEstimateConfirmation(notification, "requested");
      return "processed";
    }

    case "estimate.rescheduled": {
      const payload = isRecord(event.payload) ? event.payload : null;
      const appointmentIdValue = payload?.["appointmentId"];
      const appointmentId = typeof appointmentIdValue === "string" ? appointmentIdValue : null;
      if (!appointmentId) {
        console.warn("[outbox] estimate.rescheduled.missing_appointment", { id: event.id });
        return "skipped";
      }

      const notification = await buildNotificationPayload(appointmentId, {
        services: coerceServices(payload?.["services"]),
        rescheduleUrl: typeof payload?.["rescheduleUrl"] === "string" ? payload["rescheduleUrl"] : undefined
      });

      if (!notification) {
        return "skipped";
      }

      await syncCalendarEventForReschedule(notification);
      await sendEstimateConfirmation(notification, "rescheduled");
      return "processed";
    }

    case "quote.sent": {
      const payload = isRecord(event.payload) ? event.payload : null;
      const quoteId = typeof payload?.["quoteId"] === "string" ? payload["quoteId"] : null;
      if (!quoteId) {
        console.warn("[outbox] quote.sent.missing_id", { id: event.id });
        return "skipped";
      }

      const shareToken =
        typeof payload?.["shareToken"] === "string" && payload["shareToken"].trim().length > 0
          ? payload["shareToken"].trim()
          : null;

      const notification = await buildQuoteNotificationPayload(quoteId, { shareToken });
      if (!notification) {
        return "skipped";
      }

      await sendQuoteSentNotification(notification);
      return "processed";
    }

    case "quote.decision": {
      const payload = isRecord(event.payload) ? event.payload : null;
      const quoteId = typeof payload?.["quoteId"] === "string" ? payload["quoteId"] : null;
      const rawDecision = typeof payload?.["decision"] === "string" ? payload["decision"] : null;
      const decision =
        rawDecision === "accepted" || rawDecision === "declined" ? rawDecision : null;
      if (!quoteId || !decision) {
        console.warn("[outbox] quote.decision.missing_data", { id: event.id });
        return "skipped";
      }

      const rawSource = typeof payload?.["source"] === "string" ? payload["source"] : null;
      const source: "customer" | "admin" =
        rawSource === "customer" || rawSource === "admin" ? rawSource : "customer";
      const notes = typeof payload?.["notes"] === "string" ? payload["notes"] : null;

      const notification = await buildQuoteNotificationPayload(quoteId, { notes });
      if (!notification) {
        return "skipped";
      }

      await sendQuoteDecisionNotification({
        ...notification,
        decision,
        source
      });
      return "processed";
    }

    case "estimate.status_changed":
    case "lead.created": {
      const payload = isRecord(event.payload) ? event.payload : null;
      const leadId = typeof payload?.["leadId"] === "string" ? payload["leadId"] : null;
      const services = coerceServices(payload?.["services"]);
      const schedulingOverride = payload && isRecord(payload["scheduling"]) ? payload["scheduling"] : null;

      if (!leadId) {
        console.warn("[outbox] lead.created.missing_lead", { id: event.id });
        return "skipped";
      }

      const db = getDb();
      const rows = await db
        .select({
          id: appointments.id
        })
        .from(appointments)
        .where(eq(appointments.leadId, leadId))
        .limit(1);

      const appointment = rows[0];
      if (!appointment?.id) {
        console.info("[outbox] lead.created.no_appointment", { id: event.id, leadId });
        return "skipped";
      }

      const notification = await buildNotificationPayload(appointment.id, {
        services,
        scheduling: schedulingOverride
          ? {
              preferredDate:
                typeof schedulingOverride["preferredDate"] === "string"
                  ? schedulingOverride["preferredDate"]
                  : undefined,
              alternateDate:
                typeof schedulingOverride["alternateDate"] === "string"
                  ? schedulingOverride["alternateDate"]
                  : undefined,
              timeWindow:
                typeof schedulingOverride["timeWindow"] === "string"
                  ? schedulingOverride["timeWindow"]
                  : undefined
            }
          : undefined,
        notes: typeof payload?.["notes"] === "string" ? payload["notes"] : undefined
      });

      if (!notification) {
        return "skipped";
      }

      await sendEstimateConfirmation(notification, "requested");
      return "processed";
    }

    case "payment.recorded": {
      const payload = isRecord(event.payload) ? event.payload : null;
      const appointmentId = typeof payload?.["appointmentId"] === "string" ? payload["appointmentId"] : null;
      if (!appointmentId) {
        console.warn("[outbox] payment.recorded.missing_appointment", { id: event.id });
        return "skipped";
      }

      const amountCents =
        typeof payload?.["amountCents"] === "number" && Number.isFinite(payload["amountCents"])
          ? Number(payload["amountCents"])
          : null;
      const currency = typeof payload?.["currency"] === "string" ? payload["currency"] : "USD";
      const method = typeof payload?.["method"] === "string" ? payload["method"] : null;
      const source = typeof payload?.["source"] === "string" ? payload["source"] : "system";

      const noteParts = [
        `Payment recorded ${formatCurrencyFromCents(amountCents, currency)}`,
        method ? `Method: ${method}` : null,
        source ? `Source: ${source}` : null
      ].filter((part): part is string => Boolean(part));
      const body = noteParts.join(" | ") || "Payment recorded.";

      const db = getDb();
      try {
        await db.insert(appointmentNotes).values({
          appointmentId,
          body
        });
      } catch (error) {
        console.warn("[outbox] payment.recorded.note_failed", { appointmentId, error: String(error) });
      }

      try {
        await db
          .update(appointments)
          .set({ updatedAt: new Date() })
          .where(eq(appointments.id, appointmentId));
      } catch (error) {
        console.warn("[outbox] payment.recorded.touch_failed", { appointmentId, error: String(error) });
      }

      return "processed";
    }

    case "pipeline.stage_request": {
      const payload = isRecord(event.payload) ? event.payload : null;
      const contactId = typeof payload?.["contactId"] === "string" ? payload["contactId"].trim() : null;
      const stage = parsePipelineStage(payload?.["stage"]);
      const reason =
        typeof payload?.["reason"] === "string" && payload["reason"].trim().length > 0
          ? payload["reason"].trim()
          : null;

      if (!contactId || !stage) {
        console.warn("[outbox] pipeline.stage_request.invalid_payload", { id: event.id, payload });
        return "skipped";
      }

      await upsertPipelineStage(contactId, stage, reason);
      return "processed";
    }

    default:
      return "skipped";
  }
}

export async function processOutboxBatch(
  options: ProcessOutboxBatchOptions = {}
): Promise<OutboxBatchStats> {
  const db = getDb();
  const { limit = 10 } = options;

  const events = await db
    .select()
    .from(outboxEvents)
    .where(isNull(outboxEvents.processedAt))
    .orderBy(asc(outboxEvents.createdAt))
    .limit(limit);

  const stats: OutboxBatchStats = {
    total: events.length,
    processed: 0,
    skipped: 0,
    errors: 0
  };

  for (const event of events) {
    let outcome: "processed" | "skipped" | "error" = "skipped";
    try {
      const result = await handleOutboxEvent(event);
      outcome = result;
    } catch (error) {
      outcome = "error";
      console.warn("[outbox] handler_error", { id: event.id, type: event.type, error: String(error) });
    }

    if (outcome === "processed") {
      stats.processed += 1;
    } else if (outcome === "skipped") {
      stats.skipped += 1;
    } else {
      stats.errors += 1;
    }

    try {
      await db
        .update(outboxEvents)
        .set({ processedAt: new Date() })
        .where(eq(outboxEvents.id, event.id));
    } catch (error) {
      console.warn("[outbox] mark_processed_failed", { id: event.id, error: String(error) });
    }
  }

  return stats;
}

async function upsertPipelineStage(contactId: string, stage: PipelineStageValue, reason: string | null) {
  try {
    const db = getDb();
    const now = new Date();
    await db
      .insert(crmPipeline)
      .values({
        contactId,
        stage,
        notes: reason,
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: crmPipeline.contactId,
        set: {
          stage,
          notes: reason ?? null,
          updatedAt: now
        }
      });
  } catch (error) {
    console.warn("[pipeline] upsert_failed", { contactId, stage, error: String(error) });
  }
}
