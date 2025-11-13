import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import {
  getDb,
  quotes,
  appointments,
  appointmentNotes,
  outboxEvents,
  leads,
  crmPipeline
} from "@/db";
import { isAdminRequest } from "../../../web/admin";
import { eq, and, desc } from "drizzle-orm";
import {
  DEFAULT_APPOINTMENT_DURATION_MIN,
  DEFAULT_TRAVEL_BUFFER_MIN
} from "../../../web/scheduling";

const ScheduleQuoteSchema = z.object({
  startAt: z.string().min(1),
  durationMinutes: z.number().int().min(15).max(8 * 60).optional(),
  travelBufferMinutes: z.number().int().min(0).max(4 * 60).optional(),
  notes: z.string().max(2000).optional()
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: quoteId } = await context.params;
  if (!quoteId) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const parsedBody = ScheduleQuoteSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "invalid_payload", details: parsedBody.error.flatten() },
      { status: 400 }
    );
  }

  const body = parsedBody.data;
  const startAt = new Date(body.startAt);
  if (Number.isNaN(startAt.getTime())) {
    return NextResponse.json({ error: "invalid_start_at" }, { status: 400 });
  }

  const durationMinutes = body.durationMinutes ?? DEFAULT_APPOINTMENT_DURATION_MIN;
  const travelBufferMinutes = body.travelBufferMinutes ?? DEFAULT_TRAVEL_BUFFER_MIN;
  const db = getDb();
  const now = new Date();

  try {
    const result = await db.transaction(async (tx) => {
      const [quote] = await tx
        .select({
          id: quotes.id,
          status: quotes.status,
          contactId: quotes.contactId,
          propertyId: quotes.propertyId,
          services: quotes.services
        })
        .from(quotes)
        .where(eq(quotes.id, quoteId))
        .limit(1);

      if (!quote) {
        return { error: { status: 404, message: "quote_not_found" } };
      }

      if (quote.status !== "accepted") {
        return { error: { status: 400, message: "quote_not_accepted" } };
      }

      const [leadByQuote] = await tx
        .select({ id: leads.id })
        .from(leads)
        .where(eq(leads.quoteId, quote.id))
        .limit(1);

      let leadRecord = leadByQuote ?? null;
      if (!leadRecord) {
        const [leadByContact] = await tx
          .select({ id: leads.id })
          .from(leads)
          .where(and(eq(leads.contactId, quote.contactId), eq(leads.propertyId, quote.propertyId)))
          .orderBy(desc(leads.createdAt))
          .limit(1);
        leadRecord = leadByContact ?? null;
      }

      const [appointment] = await tx
        .insert(appointments)
        .values({
          contactId: quote.contactId,
          propertyId: quote.propertyId,
          leadId: leadRecord?.id ?? null,
          type: "job",
          startAt,
          durationMinutes,
          travelBufferMinutes,
          status: "confirmed",
          rescheduleToken: nanoid(12),
          createdAt: now,
          updatedAt: now
        })
        .returning({
          id: appointments.id,
          rescheduleToken: appointments.rescheduleToken
        });

      if (!appointment) {
        return { error: { status: 500, message: "appointment_insert_failed" } };
      }

      const summaryLines = [
        "Scheduled from accepted quote.",
        quote.services.length ? `Services: ${quote.services.join(", ")}` : null,
        body.notes ? `Notes: ${body.notes}` : null
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n");

      if (summaryLines.length) {
        await tx.insert(appointmentNotes).values({
          appointmentId: appointment.id,
          body: summaryLines
        });
      }

      if (leadRecord) {
        await tx
          .update(leads)
          .set({ status: "scheduled", quoteId: quote.id, updatedAt: now })
          .where(eq(leads.id, leadRecord.id));
      }

      await tx
        .insert(crmPipeline)
        .values({
          contactId: quote.contactId,
          stage: "won",
          notes: body.notes ?? null,
          createdAt: now,
          updatedAt: now
        })
        .onConflictDoUpdate({
          target: crmPipeline.contactId,
          set: {
            stage: "won",
            notes: body.notes ?? null,
            updatedAt: now
          }
        });

      await tx.insert(outboxEvents).values({
        type: "estimate.requested",
        payload: {
          appointmentId: appointment.id,
          leadId: leadRecord?.id ?? null,
          services: quote.services,
          notes: body.notes ?? null
        }
      });

      return {
        appointmentId: appointment.id,
        rescheduleToken: appointment.rescheduleToken
      };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error.message }, { status: result.error.status });
    }

    return NextResponse.json({
      ok: true,
      appointmentId: result.appointmentId,
      rescheduleToken: result.rescheduleToken
    });
  } catch (error) {
    console.error("[quotes.schedule] unexpected_error", { error });
    return NextResponse.json({ error: "schedule_failed" }, { status: 500 });
  }
}
