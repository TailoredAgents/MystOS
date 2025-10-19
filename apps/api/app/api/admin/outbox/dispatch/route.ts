import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isAdminRequest } from "../../../web/admin";
import { processOutboxBatch } from "@/lib/outbox-processor";

export async function POST(request: NextRequest): Promise<Response> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let rawBody: unknown = {};
  try {
    rawBody = await request.json();
  } catch {
    rawBody = {};
  }
  const limitInput =
    rawBody && typeof rawBody === "object" && "limit" in rawBody
      ? (rawBody as Record<string, unknown>)["limit"]
      : undefined;
  const limit =
    typeof limitInput === "number" && limitInput > 0 ? Math.min(limitInput, 50) : 10;

  try {
    const stats = await processOutboxBatch({ limit });
    return NextResponse.json({ ok: true, ...stats });
  } catch (error) {
    return NextResponse.json({ error: "outbox_failed", details: String(error) }, { status: 500 });
  }
}
