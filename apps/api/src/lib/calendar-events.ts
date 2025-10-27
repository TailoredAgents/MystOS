import type { AppointmentCalendarPayload } from "./calendar";
import { createCalendarEvent, updateCalendarEvent } from "./calendar";

type RetryOptions = {
  attempts?: number;
  delayMs?: number;
};

const DEFAULT_ATTEMPTS = 3;
const DEFAULT_DELAY_MS = 750;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeError(error: unknown, fallback: string): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === "string") {
    return new Error(error);
  }
  try {
    return new Error(JSON.stringify(error));
  } catch {
    return new Error(fallback);
  }
}

async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  shouldRetry: (result: T) => boolean,
  options?: RetryOptions
): Promise<T> {
  const attempts = options?.attempts ?? DEFAULT_ATTEMPTS;
  const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;

  let lastResult: T | undefined;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await operation(attempt);
      lastResult = result;

      if (!shouldRetry(result) || attempt === attempts) {
        return result;
      }
    } catch (error) {
      lastError = error;
      if (attempt === attempts) {
        throw normalizeError(error, "Calendar operation failed");
      }
    }

    if (attempt < attempts) {
      await sleep(delayMs * attempt);
    }
  }

  if (lastError) {
    throw normalizeError(lastError, "Calendar operation failed");
  }

  return lastResult as T;
}

export async function createCalendarEventWithRetry(
  payload: AppointmentCalendarPayload,
  options?: RetryOptions
): Promise<string | null> {
  return withRetry(
    () => createCalendarEvent(payload),
    (result) => result === null,
    options
  );
}

export async function updateCalendarEventWithRetry(
  eventId: string,
  payload: AppointmentCalendarPayload,
  options?: RetryOptions
): Promise<boolean> {
  return withRetry(
    () => updateCalendarEvent(eventId, payload),
    (result) => result === false,
    options
  );
}
