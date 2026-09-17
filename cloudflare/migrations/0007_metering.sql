-- Tracks metered API calls at the Cloudflare edge for billing and auditing.
CREATE TABLE IF NOT EXISTS api_usage_events (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organizations(id),
  key_id        TEXT,
  endpoint      TEXT NOT NULL,
  method        TEXT NOT NULL DEFAULT 'GET',
  status_code   INTEGER NOT NULL DEFAULT 200,
  request_count INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_edge_api_usage_org
  ON api_usage_events(org_id, created_at DESC);
