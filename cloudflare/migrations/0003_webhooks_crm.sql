-- ============================================================================
-- ucc-mca-edge — D1 (SQLite) Migration 0002: Webhooks & CRM Integrations
-- ----------------------------------------------------------------------------
-- Supports Issue #485: Outbound webhooks, retry scheduling, dead-letter queues
-- (DLQ), and native CRM integrations (HubSpot, Salesforce, GoHighLevel).
--
-- Tenant isolation: Every table carries org_id and every query MUST filter on it.
-- ============================================================================

-- Webhook Endpoints (tenant-scoped destination endpoints)
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id                   TEXT PRIMARY KEY,
  org_id               TEXT NOT NULL REFERENCES organizations(id),
  url                  TEXT NOT NULL,
  secret               TEXT NOT NULL,                            -- HMAC-SHA256 signing secret
  description          TEXT,
  events               TEXT NOT NULL DEFAULT '["*"]',            -- JSON array of events, e.g. ["prospect.created"]
  status               TEXT NOT NULL DEFAULT 'active',           -- active | paused | disabled
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_org ON webhook_endpoints(org_id);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_status ON webhook_endpoints(org_id, status);

-- Webhook Deliveries (attempt history & Dead-Letter Queue)
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES organizations(id),
  webhook_id      TEXT NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event           TEXT NOT NULL,
  payload         TEXT NOT NULL,                                 -- full JSON payload sent
  status          TEXT NOT NULL DEFAULT 'pending',              -- pending | delivering | delivered | failed | dead_letter
  attempts        INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 5,
  next_retry_at   TEXT,                                         -- ISO-8601 or SQLite datetime string
  response_status INTEGER,
  response_body   TEXT,
  error_message   TEXT,
  delivered_at    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_org ON webhook_deliveries(org_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_drain ON webhook_deliveries(status, next_retry_at);

-- CRM Integrations (HubSpot, Salesforce, GoHighLevel configurations per tenant)
CREATE TABLE IF NOT EXISTS crm_integrations (
  id         TEXT PRIMARY KEY,
  org_id     TEXT NOT NULL REFERENCES organizations(id),
  provider   TEXT NOT NULL,                                     -- hubspot | salesforce | gohighlevel
  status     TEXT NOT NULL DEFAULT 'active',                    -- active | disabled | error
  api_key    TEXT NOT NULL,                                     -- Private app access token or API key
  config     TEXT,                                              -- JSON settings: pipeline, deal stage, field mapping
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_crm_integrations_org ON crm_integrations(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_integrations_org_provider ON crm_integrations(org_id, provider);

-- CRM Push Audit Logs
CREATE TABLE IF NOT EXISTS crm_push_logs (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organizations(id),
  crm_id        TEXT NOT NULL REFERENCES crm_integrations(id) ON DELETE CASCADE,
  prospect_id   TEXT NOT NULL,
  provider      TEXT NOT NULL,
  external_id   TEXT,                                           -- CRM object ID (e.g. HubSpot company ID)
  status        TEXT NOT NULL,                                  -- success | failed
  error_message TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_crm_push_logs_org ON crm_push_logs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_push_logs_prospect ON crm_push_logs(prospect_id);
