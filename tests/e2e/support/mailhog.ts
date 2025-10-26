import { getOptionalEnvVar } from "./env";

const mailhogBase = (getOptionalEnvVar("MAILHOG_UI", "http://localhost:8025") ?? "http://localhost:8025").replace(/\/$/, "");

type MailHogItem = {
  ID: string;
  Content: {
    Headers: Record<string, string[]>;
    Body: string;
  };
};

type MailHogResponse = {
  total: number;
  count: number;
  start: number;
  items: MailHogItem[];
};

export async function fetchLatestMail(): Promise<MailHogItem | null> {
  const response = await fetch(`${mailhogBase}/api/v2/messages`);
  if (!response.ok) {
    throw new Error(`Failed to read MailHog messages (${response.status})`);
  }
  const body = (await response.json()) as MailHogResponse;
  return body.items[0] ?? null;
}

export async function clearMailhog(): Promise<void> {
  const response = await fetch(`${mailhogBase}/api/v1/messages`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(`Failed to clear MailHog messages (${response.status})`);
  }
}

export async function waitForMailhogMessage(
  matcher: (item: MailHogItem) => boolean,
  { timeoutMs = 15_000, intervalMs = 500 }: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<MailHogItem> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const message = await fetchLatestMail();
    if (message && matcher(message)) {
      return message;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("Timed out waiting for MailHog message");
}
