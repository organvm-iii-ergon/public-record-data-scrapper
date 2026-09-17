-- Recoverable leases for the D1-backed async jobs queue.
ALTER TABLE jobs ADD COLUMN claimed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_jobs_processing_lease
  ON jobs(status, claimed_at);
