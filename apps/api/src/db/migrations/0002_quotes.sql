CREATE TYPE IF NOT EXISTS "quote_status" AS ENUM ('pending', 'sent', 'accepted', 'declined');

CREATE TABLE IF NOT EXISTS "quotes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "contact_id" uuid NOT NULL REFERENCES "contacts" ("id") ON DELETE CASCADE,
  "property_id" uuid NOT NULL REFERENCES "properties" ("id") ON DELETE CASCADE,
  "status" quote_status DEFAULT 'pending' NOT NULL,
  "services" jsonb NOT NULL,
  "add_ons" jsonb,
  "surface_area" numeric,
  "zone_id" text NOT NULL,
  "travel_fee" numeric DEFAULT 0 NOT NULL,
  "discounts" numeric DEFAULT 0 NOT NULL,
  "add_ons_total" numeric DEFAULT 0 NOT NULL,
  "subtotal" numeric NOT NULL,
  "total" numeric NOT NULL,
  "deposit_due" numeric NOT NULL,
  "deposit_rate" numeric NOT NULL,
  "balance_due" numeric NOT NULL,
  "line_items" jsonb NOT NULL,
  "availability" jsonb,
  "marketing" jsonb,
  "notes" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "quotes_contact_idx" ON "quotes" ("contact_id");
CREATE INDEX IF NOT EXISTS "quotes_property_idx" ON "quotes" ("property_id");
