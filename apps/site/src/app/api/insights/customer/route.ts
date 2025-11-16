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

  const query = request.nextUrl.searchParams.toString();
  try {
    const upstream = await callAdminApi(`/api/insights/customer?${query}`);
    const payload = await upstream.json().catch(() => null);
    return NextResponse.json(payload ?? { error: "insights_unavailable" }, { status: upstream.status });
  } catch (error) {
    console.error("[site.api.insights.customer] fetch_failed", error);
    return NextResponse.json({ error: "insights_unavailable" }, { status: 500 });
  }
}
