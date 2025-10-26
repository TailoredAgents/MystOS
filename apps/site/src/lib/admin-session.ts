export const ADMIN_SESSION_COOKIE = "myst-admin-session";

export function getAdminKey(): string | null {
  const key = process.env["ADMIN_API_KEY"];
  return typeof key === "string" && key.length > 0 ? key : null;
}

export function adminSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    maxAge: 60 * 60 * 8 // 8 hours
  };
}
