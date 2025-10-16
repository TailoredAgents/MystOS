import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getDb, payments, appointments } from "@/db";
import { isAdminRequest } from "../../web/admin";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { appointmentId?: string | null };
  const appointmentId = typeof body.appointmentId === "string" ? body.appointmentId.trim() : null;

  if (!appointmentId) {
    return NextResponse.json({ error: "invalid_payload", message: "appointmentId is required" }, { status: 400 });
  }

  const db = getDb();
  const appointment = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);

  if (!appointment.length) {
    return NextResponse.json({ error: "appointment_not_found" }, { status: 404 });
  }

  await db
    .update(payments)
    .set({ appointmentId, updatedAt: new Date() })
    .where(eq(payments.id, id));

  return NextResponse.json({ ok: true, appointmentId });
}
