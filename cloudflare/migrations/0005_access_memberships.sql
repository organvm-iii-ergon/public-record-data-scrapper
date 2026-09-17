-- Membership is provisioned from verified identity evidence, never token role
-- claims or email-domain inference. No business identities are seeded here.
CREATE TABLE access_memberships (
  issuer TEXT NOT NULL,
  subject TEXT NOT NULL,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (issuer, subject, org_id)
);
