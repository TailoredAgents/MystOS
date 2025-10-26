import { setTimeout as wait } from "node:timers/promises";

type HealthOptions = {
  timeoutMs?: number;
  intervalMs?: number;
  service?: string;
};

export async function waitForHealthcheck(url: string, options: HealthOptions = {}): Promise<void> {
  const { timeoutMs = 60_000, intervalMs = 1_000, service = url } = options;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) {
        return;
      }
    } catch {
      // ignore, retry
    }
    await wait(intervalMs);
  }

  throw new Error(`Timed out waiting for health check ${service} (${url})`);
}
