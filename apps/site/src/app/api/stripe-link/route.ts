import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { callAdminApi } from "@/app/team/lib/api";

const ADMIN_COOKIE = "myst-admin-session";
const CREW_COOKIE = "myst-crew-session";

export async function POST(request: NextRequest): Promise<Response> {
  const jar = await cookies();
  const hasOwner = Boolean(jar.get(ADMIN_COOKIE)?.value);
  const hasCrew = Boolean(jar.get(CREW_COOKIE)?.value);

  if (!hasOwner && !hasCrew) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const appointmentId =
    payload && typeof payload === "object" && "appointmentId" in payload
      ? ((payload as Record<string, unknown>)["appointmentId"] as string | undefined)
      : undefined;

  if (!appointmentId || typeof appointmentId !== "string" || appointmentId.trim().length === 0) {
    return NextResponse.json({ error: "missing_appointment" }, { status: 400 });
  }

  const upstream = await callAdminApi(`/api/appointments/${appointmentId}/stripe-link`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  const data = await upstream.json().catch(() => null);
  return NextResponse.json(data ?? {}, { status: upstream.status });
}
