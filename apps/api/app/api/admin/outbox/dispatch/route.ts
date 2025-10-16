import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isAdminRequest } from "../../web/admin";
import { processOutboxBatch } from "@/lib/outbox-processor";

export async function POST(request: NextRequest): Promise<Response> {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { limit?: number };
  const limit = typeof body.limit === "number" && body.limit > 0 ? Math.min(body.limit, 50) : 10;

  try {
    const stats = await processOutboxBatch({ limit });
    return NextResponse.json({ ok: true, ...stats });
  } catch (error) {
    return NextResponse.json({ error: "outbox_failed", details: String(error) }, { status: 500 });
  }
}

