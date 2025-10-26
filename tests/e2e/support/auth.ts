import { promises as fs } from "node:fs";
import path from "node:path";
import { getEnvVar } from "./env";

const storageDir = path.resolve(process.cwd(), "tests/e2e/storage");

type StorageState = {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite?: "Strict" | "Lax" | "None";
  }>;
  origins: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
    sessionStorage?: Array<{ name: string; value: string }>;
  }>;
};

export async function ensureStorageState(filename: string, state?: StorageState): Promise<void> {
  await fs.mkdir(storageDir, { recursive: true });
  const filePath = path.resolve(process.cwd(), filename);

  const defaultState: StorageState =
    state ??
    ({
      cookies: [],
      origins: []
    } as StorageState);

  await fs.writeFile(filePath, JSON.stringify(defaultState, null, 2));
}

export async function bootstrapVisitorStorage(filename: string): Promise<void> {
  await ensureStorageState(filename);
}

export async function bootstrapAdminStorage(filename: string): Promise<void> {
  const adminKey = getEnvVar("ADMIN_API_KEY");
  const siteBase = getEnvVar("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");

  const response = await fetch(new URL("/api/admin/session", siteBase).toString(), {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ key: adminKey }),
    redirect: "manual"
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Failed to bootstrap admin session (${response.status}): ${text}`);
  }

  const cookies = extractSetCookies(response);
  if (!cookies.length) {
    throw new Error("Admin session endpoint did not return Set-Cookie header");
  }

  const url = new URL(siteBase);
  const storageState: StorageState = {
    cookies: cookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.attributes.domain ?? url.hostname,
      path: cookie.attributes.path ?? "/",
      expires: cookie.attributes.expires
        ? Math.floor(new Date(cookie.attributes.expires).getTime() / 1000)
        : Math.floor(Date.now() / 1000) + 60 * 60 * 8,
      httpOnly: "httponly" in cookie.attributes,
      secure: "secure" in cookie.attributes,
      sameSite: parseSameSite(cookie.attributes.samesite)
    })),
    origins: []
  };

  await ensureStorageState(filename, storageState);
}

type CookieParseResult = {
  name: string;
  value: string;
  attributes: Record<string, string | boolean>;
};

function extractSetCookies(response: Response): CookieParseResult[] {
  const headers = (response.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  const fallbackHeader = response.headers.get("set-cookie");
  const allHeaders = headers.length ? headers : fallbackHeader ? [fallbackHeader] : [];
  return allHeaders.map(parseSetCookie).filter((cookie): cookie is CookieParseResult => Boolean(cookie));
}

function parseSetCookie(header: string | undefined): CookieParseResult | undefined {
  if (!header) {
    return undefined;
  }
  const parts = header.split(";");
  const [nameValue, ...attributePairs] = parts;
  const [name, ...valueParts] = nameValue.split("=");
  if (!name) {
    return undefined;
  }
  const value = valueParts.join("=").trim();
  const attributes: Record<string, string | boolean> = {};
  attributePairs.forEach((pair) => {
    const [attrName, ...attrValue] = pair.trim().split("=");
    if (!attrName) {
      return;
    }
    if (attrValue.length === 0) {
      attributes[attrName.toLowerCase()] = true;
    } else {
      attributes[attrName.toLowerCase()] = attrValue.join("=");
    }
  });

  return {
    name: name.trim(),
    value,
    attributes
  };
}

function parseSameSite(value: string | boolean | undefined): "Strict" | "Lax" | "None" | undefined {
  if (!value || typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "strict") {
    return "Strict";
  }
  if (normalized === "none") {
    return "None";
  }
  if (normalized === "lax") {
    return "Lax";
  }
  return undefined;
}
