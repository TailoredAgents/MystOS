import { asc, eq, isNull } from "drizzle-orm";
import { getDb, outboxEvents, appointments, leads, contacts, properties } from "@/db";
import type { EstimateNotificationPayload } from "@/lib/notifications";
import { sendEstimateConfirmation } from "@/lib/notifications";

type OutboxEventRecord = typeof outboxEvents.$inferSelect;

const VALID_APPOINTMENT_STATUSES = new Set<EstimateNotificationPayload["appointment"]["status"]>([
  "requested",
  "confirmed",
  "completed",
  "no_show",
  "canceled"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function coerceServices(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
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

  const status = VALID_APPOINTMENT_STATUSES.has(row.status as EstimateNotificationPayload["appointment"]["status"])
    ? (row.status as EstimateNotificationPayload["appointment"]["status"])
    : "requested";

  const rescheduleToken = row.rescheduleToken;
  if (!rescheduleToken) {
    console.warn("[outbox] missing_reschedule_token", { appointmentId });
    return null;
  }

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
      rescheduleUrl: overrides?.rescheduleUrl ?? undefined
    },
    notes: overrides?.notes ?? (typeof row.leadNotes === "string" ? row.leadNotes : null)
  };

  return payload;
}

async function handleOutboxEvent(event: OutboxEventRecord): Promise<"processed" | "skipped"> {
  switch (event.type) {
    case "estimate.requested": {
      const payload = isRecord(event.payload) ? event.payload : null;
      const appointmentId = typeof payload?.appointmentId === "string" ? payload.appointmentId : null;
      if (!appointmentId) {
        console.warn("[outbox] estimate.requested.missing_appointment", { id: event.id });
        return "skipped";
      }

      const services = coerceServices(payload?.services);
      const schedulingOverride =
        payload && isRecord(payload["scheduling"]) ? (payload["scheduling"] as Record<string, unknown>) : null;

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
        notes: typeof payload?.notes === "string" ? payload.notes : undefined
      });

      if (!notification) {
        return "skipped";
      }

      await sendEstimateConfirmation(notification, "requested");
      return "processed";
    }

    case "estimate.rescheduled": {
      const payload = isRecord(event.payload) ? event.payload : null;
      const appointmentId = typeof payload?.appointmentId === "string" ? payload.appointmentId : null;
      if (!appointmentId) {
        console.warn("[outbox] estimate.rescheduled.missing_appointment", { id: event.id });
        return "skipped";
      }

      const notification = await buildNotificationPayload(appointmentId, {
        services: coerceServices(payload?.services),
        rescheduleUrl: typeof payload?.rescheduleUrl === "string" ? payload.rescheduleUrl : undefined
      });

      if (!notification) {
        return "skipped";
      }

      await sendEstimateConfirmation(notification, "rescheduled");
      return "processed";
    }

    case "estimate.status_changed":
    case "lead.created":
    default:
      return "skipped";
  }
}

export async function processOutboxBatch(options: { limit?: number } = {}): Promise<{
  total: number;
  processed: number;
  skipped: number;
  errors: number;
}> {
  const db = getDb();
  const { limit = 10 } = options;

  const events = await db
    .select()
    .from(outboxEvents)
    .where(isNull(outboxEvents.processedAt))
    .orderBy(asc(outboxEvents.createdAt))
    .limit(limit);

  const stats = {
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

