import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { callAdminApi } from "@/app/team/lib/api";

const ADMIN_COOKIE = "myst-admin-session";
const CREW_COOKIE = "myst-crew-session";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const jar = await cookies();
  const hasOwner = Boolean(jar.get(ADMIN_COOKIE)?.value);
  const hasCrew = Boolean(jar.get(CREW_COOKIE)?.value);

  if (!hasOwner && !hasCrew) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: quoteId } = await context.params;
  if (!quoteId) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  try {
    const upstream = await callAdminApi(
      `/api/quotes/${encodeURIComponent(quoteId)}/schedule-suggestions`
    );
    const payload = await upstream.json().catch(() => null);
    return NextResponse.json(
      payload ?? { error: "schedule_suggestions_unavailable" },
      { status: upstream.status }
    );
  } catch (error) {
    console.error("[site.api.schedule_suggestions] fetch_failed", error);
    return NextResponse.json(
      { error: "schedule_suggestions_unavailable" },
      { status: 500 }
    );
  }
}
