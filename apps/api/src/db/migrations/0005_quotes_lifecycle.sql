ALTER TABLE "quotes"
  ADD COLUMN IF NOT EXISTS "share_token" text,
  ADD COLUMN IF NOT EXISTS "sent_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "expires_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "decision_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "decision_notes" text;

CREATE UNIQUE INDEX IF NOT EXISTS "quotes_share_token_key" ON "quotes" ("share_token");
