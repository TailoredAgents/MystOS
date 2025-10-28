CREATE TYPE "crm_pipeline_stage" AS ENUM ('new', 'contacted', 'qualified', 'quoted', 'won', 'lost');

CREATE TYPE "crm_task_status" AS ENUM ('open', 'completed');

CREATE TABLE IF NOT EXISTS "crm_pipeline" (
  "contact_id" uuid PRIMARY KEY REFERENCES "contacts" ("id") ON DELETE CASCADE,
  "stage" crm_pipeline_stage DEFAULT 'new' NOT NULL,
  "notes" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "crm_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "contact_id" uuid NOT NULL REFERENCES "contacts" ("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "due_at" timestamptz,
  "assigned_to" text,
  "status" crm_task_status DEFAULT 'open' NOT NULL,
  "notes" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "crm_tasks_contact_idx" ON "crm_tasks" ("contact_id");
CREATE INDEX IF NOT EXISTS "crm_tasks_due_idx" ON "crm_tasks" ("due_at");

INSERT INTO "crm_pipeline" ("contact_id", "stage")
SELECT "id", 'new'
FROM "contacts"
ON CONFLICT ("contact_id") DO NOTHING;
