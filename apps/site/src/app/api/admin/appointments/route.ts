import { NextResponse } from "next/server";

const API_BASE_URL =
  process.env["API_BASE_URL"] ??
  process.env["NEXT_PUBLIC_API_BASE_URL"] ??
  "http://localhost:3001";
const ADMIN_API_KEY = process.env["ADMIN_API_KEY"];

export async function GET(request: Request): Promise<Response> {
  if (!ADMIN_API_KEY) {
    return NextResponse.json({ error: "admin_key_missing" }, { status: 500 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "all";
  const base = API_BASE_URL.replace(/\/$/, "");

  const upstream = await fetch(`${base}/api/appointments?status=${encodeURIComponent(status)}`, {
    headers: { "x-api-key": ADMIN_API_KEY },
    cache: "no-store"
  });

  const body = await upstream.json().catch(() => ({ ok: false }));
  return NextResponse.json(body, { status: upstream.status });
}

