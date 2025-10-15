import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const COOKIE_NAME = "myst_utm";
const UTM_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid"
];

type UtmCookie = Record<string, string>;

function parseCookie(value: string | undefined): UtmCookie {
  if (!value) {
    return {};
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as UtmCookie;
    }
  } catch {
    // ignore malformed cookie
  }
  return {};
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const url = request.nextUrl;
  const hasTrackingParams = UTM_PARAMS.some((param) => url.searchParams.has(param));

  if (!hasTrackingParams) {
    return response;
  }

  const cookieValue = request.cookies.get(COOKIE_NAME)?.value;
  const enriched: UtmCookie = { ...parseCookie(cookieValue) };

  for (const param of UTM_PARAMS) {
    const value = url.searchParams.get(param);
    if (value) {
      const normalizedKey = param.replace(/^utm_/, "");
      enriched[normalizedKey] = value;
    }
  }

  response.cookies.set({
    name: COOKIE_NAME,
    value: JSON.stringify(enriched),
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    path: "/"
  });

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
