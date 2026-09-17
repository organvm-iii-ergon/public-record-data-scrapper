BEGIN;

DROP TRIGGER IF EXISTS append_audit_hash_chain_before_insert ON audit_logs;
DROP FUNCTION IF EXISTS append_audit_hash_chain();
DROP TABLE IF EXISTS audit_chain_state;

ALTER TABLE audit_logs
    DROP CONSTRAINT IF EXISTS audit_logs_record_hash_shape,
    DROP CONSTRAINT IF EXISTS audit_logs_prev_hash_shape,
    DROP CONSTRAINT IF EXISTS audit_logs_chain_sequence_unique,
    DROP COLUMN IF EXISTS record_hash,
    DROP COLUMN IF EXISTS prev_hash,
    DROP COLUMN IF EXISTS chain_sequence;

COMMIT;
