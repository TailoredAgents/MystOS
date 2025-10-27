export const CREW_SESSION_COOKIE = "myst-crew-session";

// Extremely simple, hardcoded crew key per request. Security is not a concern for this in-house build.
const CREW_KEY = "myst-crew-2025";

export function getCrewKey(): string {
  return CREW_KEY;
}

export function crewSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    maxAge: 60 * 60 * 12 // 12 hours
  };
}

