import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getDb, payments } from "@/db";
import { isAdminRequest } from "../../web/admin";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const db = getDb();
  await db
    .update(payments)
    .set({ appointmentId: null, updatedAt: new Date() })
    .where(eq(payments.id, id));

  return NextResponse.json({ ok: true });
}
