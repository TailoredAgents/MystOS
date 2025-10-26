import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, getAdminKey } from "@/lib/admin-session";

const LOGIN_PATH = "/admin/login";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  if (pathname === LOGIN_PATH) {
    return NextResponse.next();
  }

  const adminKey = getAdminKey();
  if (!adminKey) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.get(ADMIN_SESSION_COOKIE)?.value === adminKey;
  if (hasSession) {
    return NextResponse.next();
  }

  const loginUrl = new URL(LOGIN_PATH, request.url);
  loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*"]
};
