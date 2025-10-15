CREATE TYPE IF NOT EXISTS "appointment_status" AS ENUM (
  'requested',
  'confirmed',
  'completed',
  'no_show',
  'canceled'
);

CREATE TABLE IF NOT EXISTS "appointments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "contact_id" uuid NOT NULL REFERENCES "contacts" ("id") ON DELETE CASCADE,
  "property_id" uuid NOT NULL REFERENCES "properties" ("id") ON DELETE CASCADE,
  "lead_id" uuid REFERENCES "leads" ("id") ON DELETE SET NULL,
  "type" text NOT NULL DEFAULT 'estimate',
  "start_at" timestamptz,
  "duration_min" integer NOT NULL DEFAULT 60,
  "travel_buffer_min" integer NOT NULL DEFAULT 30,
  "status" appointment_status NOT NULL DEFAULT 'requested',
  "calendar_event_id" text,
  "reschedule_token" varchar(64) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "appointments_start_idx" ON "appointments" ("start_at");
CREATE INDEX IF NOT EXISTS "appointments_status_idx" ON "appointments" ("status");

CREATE TABLE IF NOT EXISTS "appointment_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "appointment_id" uuid NOT NULL REFERENCES "appointments" ("id") ON DELETE CASCADE,
  "body" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "appointment_notes_appointment_idx" ON "appointment_notes" ("appointment_id");
