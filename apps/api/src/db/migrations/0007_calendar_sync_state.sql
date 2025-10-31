CREATE TABLE IF NOT EXISTS calendar_sync_state (
  calendar_id TEXT PRIMARY KEY,
  sync_token TEXT,
  channel_id TEXT,
  resource_id TEXT,
  channel_expires_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  last_notification_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
