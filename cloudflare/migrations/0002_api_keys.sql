-- ============================================================================
-- ucc-mca-edge — Migration 0002: API Keys for Programmatic Ingestion & Auth
-- ----------------------------------------------------------------------------
-- Multi-tenant B2B data delivery: enables customers to access versioned v1
-- REST endpoints using long-lived, scoped API keys ('prk_...').
-- Keys are hashed via SHA-256 before storage; the raw secret is never stored.
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id           TEXT PRIMARY KEY,
  org_id       TEXT NOT NULL REFERENCES organizations(id),
  name         TEXT NOT NULL,
  key_prefix   TEXT NOT NULL,
  key_hash     TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  expires_at   TEXT,
  revoked_at   TEXT,
  last_used_at TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(org_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_org_active ON api_keys(org_id) WHERE revoked_at IS NULL;
