CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "lead_status" AS ENUM ('new', 'contacted', 'quoted', 'scheduled');

CREATE TABLE IF NOT EXISTS "contacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "email" text,
  "phone" varchar(32),
  "phone_e164" varchar(32),
  "preferred_contact_method" text DEFAULT 'phone',
  "source" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "contacts_email_key" ON "contacts" ("email");
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_phone_key" ON "contacts" ("phone");
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_phone_e164_key" ON "contacts" ("phone_e164");

CREATE TABLE IF NOT EXISTS "properties" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "contact_id" uuid NOT NULL REFERENCES "contacts" ("id") ON DELETE CASCADE,
  "address_line1" text NOT NULL,
  "address_line2" text,
  "city" text NOT NULL,
  "state" varchar(2) NOT NULL,
  "postal_code" varchar(16) NOT NULL,
  "lat" numeric(9, 6),
  "lng" numeric(9, 6),
  "gated" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "properties_contact_idx" ON "properties" ("contact_id");
CREATE UNIQUE INDEX IF NOT EXISTS "properties_address_key" ON "properties" ("address_line1", "postal_code", "state");

CREATE TABLE IF NOT EXISTS "leads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "contact_id" uuid NOT NULL REFERENCES "contacts" ("id") ON DELETE CASCADE,
  "property_id" uuid NOT NULL REFERENCES "properties" ("id") ON DELETE CASCADE,
  "services_requested" text[] NOT NULL,
  "notes" text,
  "surface_area" numeric,
  "status" lead_status DEFAULT 'new' NOT NULL,
  "source" text,
  "utm_source" text,
  "utm_medium" text,
  "utm_campaign" text,
  "utm_term" text,
  "utm_content" text,
  "gclid" text,
  "fbclid" text,
  "referrer" text,
  "form_payload" jsonb,
  "quote_estimate" numeric,
  "quote_id" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "leads_contact_idx" ON "leads" ("contact_id");
CREATE INDEX IF NOT EXISTS "leads_property_idx" ON "leads" ("property_id");
CREATE UNIQUE INDEX IF NOT EXISTS "leads_quote_idx" ON "leads" ("quote_id");

CREATE TABLE IF NOT EXISTS "outbox_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "type" text NOT NULL,
  "payload" jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "processed_at" timestamptz
);
