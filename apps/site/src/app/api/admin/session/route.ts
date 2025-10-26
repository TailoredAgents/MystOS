import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, adminSessionCookieOptions, getAdminKey } from "@/lib/admin-session";

export async function POST(request: NextRequest) {
  const adminKey = getAdminKey();
  if (!adminKey) {
    return NextResponse.json({ error: "admin_key_missing" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const submitted =
    body && typeof body === "object" && "key" in body ? (body as { key?: unknown }).key : undefined;

  if (typeof submitted !== "string" || submitted.trim().length === 0) {
    return NextResponse.json({ error: "missing_key" }, { status: 400 });
  }

  if (submitted.trim() !== adminKey) {
    return NextResponse.json({ error: "invalid_key" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, adminKey, adminSessionCookieOptions());
  return response;
}
