-- Canonical, tenant-scoped inputs for the six dashboard surfaces. Connectors
-- must supply provenance; this migration intentionally seeds no business data.
CREATE TABLE dashboard_records (
  id TEXT NOT NULL,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  collection TEXT NOT NULL CHECK (collection IN ('prospects', 'competitors', 'portfolio')),
  payload TEXT NOT NULL CHECK (json_valid(payload) AND json_type(payload) = 'object'),
  source_ref TEXT NOT NULL CHECK (length(trim(source_ref)) > 0),
  observed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (org_id, collection, id)
);

CREATE INDEX idx_dashboard_records_tenant_collection
  ON dashboard_records(org_id, collection, observed_at DESC, id);

CREATE TABLE dashboard_user_actions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  action_type TEXT NOT NULL,
  details TEXT NOT NULL CHECK (json_valid(details) AND json_type(details) = 'object'),
  occurred_at TEXT NOT NULL
);

CREATE INDEX idx_dashboard_user_actions_tenant_time
  ON dashboard_user_actions(org_id, occurred_at DESC, id);
