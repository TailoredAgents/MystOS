import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { callAdminApi } from "@/app/team/lib/api";

const ADMIN_COOKIE = "myst-admin-session";
const CREW_COOKIE = "myst-crew-session";

export async function GET(request: NextRequest): Promise<Response> {
  const jar = await cookies();
  const hasOwner = Boolean(jar.get(ADMIN_COOKIE)?.value);
  const hasCrew = Boolean(jar.get(CREW_COOKIE)?.value);

  if (!hasOwner && !hasCrew) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json({ error: "missing_range" }, { status: 400 });
  }

  try {
    const upstream = await callAdminApi(
      `/api/calendar?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
    );
    const payload = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      return NextResponse.json(payload ?? { error: "calendar_unavailable" }, { status: upstream.status });
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[site.api.calendar] fetch_failed", error);
    return NextResponse.json({ error: "calendar_unavailable" }, { status: 500 });
  }
}
