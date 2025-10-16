CREATE TABLE IF NOT EXISTS "payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "stripe_charge_id" text NOT NULL,
  "amount" integer NOT NULL,
  "currency" varchar(10) NOT NULL,
  "status" text NOT NULL,
  "method" text,
  "card_brand" text,
  "last4" varchar(4),
  "receipt_url" text,
  "metadata" jsonb,
  "appointment_id" uuid REFERENCES "appointments"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "captured_at" timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS "payments_charge_idx" ON "payments" ("stripe_charge_id");
CREATE INDEX IF NOT EXISTS "payments_appointment_idx" ON "payments" ("appointment_id");
