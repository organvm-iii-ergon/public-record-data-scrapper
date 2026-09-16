-- ============================================================================
-- Migration 027: Audit Immutability Hash Chaining
--
-- Adds cryptographic hash chaining to audit_logs for SOC2 and regulatory compliance.
-- Each log links to its predecessor via prev_hash, forming an immutable, tamper-evident
-- hash chain verified via SHA-256 signatures.
-- ============================================================================

BEGIN;

-- Add prev_hash and record_hash columns
ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS prev_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS record_hash VARCHAR(64);

-- Indexes for chain traversal and verification
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_hash ON audit_logs(record_hash);
CREATE INDEX IF NOT EXISTS idx_audit_logs_prev_hash ON audit_logs(prev_hash);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON audit_logs(org_id, created_at ASC, id ASC);

COMMIT;
