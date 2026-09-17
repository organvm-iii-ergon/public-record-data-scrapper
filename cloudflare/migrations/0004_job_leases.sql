-- Expiring, ownership-checked claims for the D1 durable job adapter.
ALTER TABLE jobs ADD COLUMN lease_owner TEXT;
ALTER TABLE jobs ADD COLUMN lease_expires_at INTEGER;
ALTER TABLE jobs ADD COLUMN next_attempt_at INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_jobs_retry_lease ON jobs(status, next_attempt_at, lease_expires_at);
-- Legacy processing rows have no owner or expiry. Recover them on the next drain.
UPDATE jobs SET status = 'pending' WHERE status = 'processing';
