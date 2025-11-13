import { sql } from "drizzle-orm";
import type { DatabaseClient } from "@/db";

let ensured = false;

export async function ensureJobAppointmentSupport(
  db: DatabaseClient,
  options?: { force?: boolean }
): Promise<void> {
  if (ensured && !options?.force) {
    return;
  }

  try {
    await db.execute(sql`
      ALTER TABLE "quotes"
      ADD COLUMN IF NOT EXISTS "job_appointment_id" uuid
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "quotes_job_appointment_idx"
      ON "quotes" ("job_appointment_id")
    `);

    ensured = true;
  } catch (error) {
    console.warn("[quotes] ensure_job_appointment_column_failed", { error: String(error) });
  }
}

export function isMissingJobAppointmentColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const cause = (error as { cause?: unknown }).cause;
  const code = (cause as { code?: string })?.code ?? (error as { code?: string })?.code;
  const message = String((error as { message?: string }).message ?? "");

  return code === "42703" && message.includes("job_appointment_id");
}
