-- Recoverable leases for the D1-backed asynchronous job queue.
ALTER TABLE jobs ADD COLUMN claimed_at TEXT;

-- A deployment may inherit jobs stranded by the pre-lease implementation.
UPDATE jobs SET status = 'pending' WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS idx_jobs_claim_lease ON jobs(status, claimed_at, created_at);
