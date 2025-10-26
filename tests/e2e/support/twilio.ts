import { getOptionalEnvVar } from "./env";

const twilioBase = (getOptionalEnvVar("TWILIO_API_BASE_URL", "http://localhost:4010") ?? "http://localhost:4010").replace(/\/$/, "");

type TwilioMessage = {
  sid: string;
  to: string;
  from: string;
  body: string;
  status: string;
  date_created: string;
};

export async function fetchTwilioMessages(): Promise<TwilioMessage[]> {
  const response = await fetch(`${twilioBase}/messages`);
  if (!response.ok) {
    throw new Error(`Failed to fetch Twilio mock messages (${response.status})`);
  }
  const payload = (await response.json()) as { messages: TwilioMessage[] };
  return payload.messages ?? [];
}

export async function clearTwilioMessages(): Promise<void> {
  const response = await fetch(`${twilioBase}/messages`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(`Failed to clear Twilio mock messages (${response.status})`);
  }
}

export async function waitForTwilioMessage(
  matcher: (message: TwilioMessage) => boolean,
  { timeoutMs = 15_000, intervalMs = 500 }: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<TwilioMessage> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const messages = await fetchTwilioMessages();
    const match = messages.find(matcher);
    if (match) {
      return match;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("Timed out waiting for Twilio message");
}
