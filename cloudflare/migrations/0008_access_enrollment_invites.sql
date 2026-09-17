-- Pre-authorized Cloudflare Access enrollment. A verified email may claim one
-- durable issuer/subject membership; JWT claims alone never create a tenant.
CREATE TABLE access_enrollment_invites (
  issuer TEXT NOT NULL,
  email TEXT NOT NULL CHECK (email = lower(trim(email)) AND length(email) > 3),
  org_id TEXT NOT NULL REFERENCES organizations(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
  expires_at TEXT,
  revoked_at TEXT,
  claimed_subject TEXT,
  claimed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (issuer, email, org_id),
  CHECK (
    (claimed_subject IS NULL AND claimed_at IS NULL) OR
    (length(claimed_subject) > 0 AND claimed_at IS NOT NULL)
  )
);

CREATE INDEX idx_access_enrollment_invites_lookup
  ON access_enrollment_invites(issuer, email, revoked_at, expires_at);
