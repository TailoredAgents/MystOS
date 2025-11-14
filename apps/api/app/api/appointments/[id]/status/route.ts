import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, appointments, leads, outboxEvents, quotes, crmPipeline } from "@/db";
import { isAdminRequest } from "../../../web/admin";
import { deleteCalendarEvent } from "@/lib/calendar";
import {
  ensureJobAppointmentSupport,
  isMissingJobAppointmentColumnError
} from "@/lib/ensure-job-appointment-column";

const StatusSchema = z.object({
  status: z.enum(["requested", "confirmed", "completed", "no_show", "canceled"])
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: appointmentId } = await context.params;
  if (!appointmentId) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const payload = (await request.json().catch(() => null)) as unknown;
  const parsed = StatusSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", message: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const db = getDb();
  await ensureJobAppointmentSupport(db);
  const status = parsed.data.status;

  const [updated] = await db
    .update(appointments)
    .set({
      status,
      updatedAt: new Date()
    })
    .where(eq(appointments.id, appointmentId))
    .returning({
      id: appointments.id,
      leadId: appointments.leadId,
      contactId: appointments.contactId,
      calendarEventId: appointments.calendarEventId
    });

  if (!updated) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (updated.calendarEventId && status === "canceled") {
    await deleteCalendarEvent(updated.calendarEventId);
    await db
      .update(appointments)
      .set({ calendarEventId: null })
      .where(eq(appointments.id, updated.id));
  }

  if (status === "canceled") {
    const clearJob = async () =>
      db
        .update(quotes)
        .set({ jobAppointmentId: null })
        .where(eq(quotes.jobAppointmentId, updated.id));

    try {
      await clearJob();
    } catch (error) {
      if (isMissingJobAppointmentColumnError(error)) {
        await ensureJobAppointmentSupport(db, { force: true });
        await clearJob();
      } else {
        throw error;
      }
    }
  }

  const leadStatusUpdate =
    status === "confirmed" || status === "completed"
      ? "scheduled"
      : status === "canceled" || status === "no_show"
        ? "quoted"
        : null;
  if (updated.leadId && leadStatusUpdate) {
    await db.update(leads).set({ status: leadStatusUpdate }).where(eq(leads.id, updated.leadId));
  }

  const pipelineStage =
    status === "canceled"
      ? "quoted"
      : status === "no_show"
        ? "qualified"
        : status === "confirmed" || status === "completed"
          ? "won"
          : null;

  if (updated.contactId && pipelineStage) {
    const now = new Date();
    await db
      .insert(crmPipeline)
      .values({
        contactId: updated.contactId,
        stage: pipelineStage,
        updatedAt: now,
        createdAt: now
      })
      .onConflictDoUpdate({
        target: crmPipeline.contactId,
        set: {
          stage: pipelineStage,
          updatedAt: now
        }
      });
  }

  await db.insert(outboxEvents).values({
    type: "estimate.status_changed",
    payload: {
      appointmentId: updated.id,
      leadId: updated.leadId,
      status
    }
  });

  return NextResponse.json({ ok: true, appointmentId: updated.id, status });
}
