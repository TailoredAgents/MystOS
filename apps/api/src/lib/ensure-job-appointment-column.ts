import { sql } from "drizzle-orm";
import type { DatabaseClient } from "@/db";

let ensured = false;

export async function ensureJobAppointmentSupport(db: DatabaseClient): Promise<void> {
  if (ensured) {
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
