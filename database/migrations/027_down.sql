-- ============================================================================
-- Migration 027 Down: Rollback Audit Immutability Hash Chaining
-- ============================================================================

BEGIN;

DROP INDEX IF EXISTS idx_audit_logs_org_created;
DROP INDEX IF EXISTS idx_audit_logs_prev_hash;
DROP INDEX IF EXISTS idx_audit_logs_record_hash;

ALTER TABLE audit_logs
    DROP COLUMN IF EXISTS record_hash,
    DROP COLUMN IF EXISTS prev_hash;

COMMIT;
