-- Migration 029: Database-enforced audit hash chain
--
-- Serializes audit appends inside PostgreSQL, derives every hash from the
-- stored row, and keeps the existing UPDATE/DELETE/TRUNCATE guards in force.

BEGIN;

ALTER TABLE audit_logs
    ADD COLUMN chain_sequence BIGINT,
    ADD COLUMN prev_hash CHAR(64),
    ADD COLUMN record_hash CHAR(64);

CREATE TABLE audit_chain_state (
    singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
    last_sequence BIGINT NOT NULL DEFAULT 0 CHECK (last_sequence >= 0),
    last_hash CHAR(64) NOT NULL DEFAULT repeat('0', 64),
    CHECK (last_hash ~ '^[0-9a-f]{64}$')
);

INSERT INTO audit_chain_state (singleton) VALUES (TRUE);

-- Existing immutable rows must be chained once, in a deterministic order.
-- The update guard is disabled only for this migration transaction.
ALTER TABLE audit_logs DISABLE TRIGGER prevent_audit_update;

DO $$
DECLARE
    audit_row RECORD;
    next_sequence BIGINT := 0;
    previous_hash CHAR(64) := repeat('0', 64);
    next_hash CHAR(64);
BEGIN
    FOR audit_row IN
        SELECT id FROM audit_logs ORDER BY created_at, id
    LOOP
        next_sequence := next_sequence + 1;

        UPDATE audit_logs
        SET chain_sequence = next_sequence,
            prev_hash = previous_hash
        WHERE id = audit_row.id;

        SELECT encode(
            sha256(convert_to((to_jsonb(entry) - 'record_hash')::TEXT, 'UTF8')),
            'hex'
        )
        INTO next_hash
        FROM audit_logs AS entry
        WHERE entry.id = audit_row.id;

        UPDATE audit_logs SET record_hash = next_hash WHERE id = audit_row.id;
        previous_hash := next_hash;
    END LOOP;

    UPDATE audit_chain_state
    SET last_sequence = next_sequence,
        last_hash = previous_hash
    WHERE singleton = TRUE;
END;
$$;

ALTER TABLE audit_logs ENABLE TRIGGER prevent_audit_update;

ALTER TABLE audit_logs
    ALTER COLUMN chain_sequence SET NOT NULL,
    ALTER COLUMN prev_hash SET NOT NULL,
    ALTER COLUMN record_hash SET NOT NULL,
    ADD CONSTRAINT audit_logs_chain_sequence_unique UNIQUE (chain_sequence),
    ADD CONSTRAINT audit_logs_prev_hash_shape CHECK (prev_hash ~ '^[0-9a-f]{64}$'),
    ADD CONSTRAINT audit_logs_record_hash_shape CHECK (record_hash ~ '^[0-9a-f]{64}$');

CREATE OR REPLACE FUNCTION append_audit_hash_chain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    chain_state audit_chain_state%ROWTYPE;
BEGIN
    -- The row lock is the serialization point. It prevents two application
    -- processes from reading the same predecessor and forking the chain.
    SELECT * INTO STRICT chain_state
    FROM audit_chain_state
    WHERE singleton = TRUE
    FOR UPDATE;

    NEW.chain_sequence := chain_state.last_sequence + 1;
    NEW.prev_hash := chain_state.last_hash;
    NEW.record_hash := encode(
        sha256(convert_to((to_jsonb(NEW) - 'record_hash')::TEXT, 'UTF8')),
        'hex'
    );

    UPDATE audit_chain_state
    SET last_sequence = NEW.chain_sequence,
        last_hash = NEW.record_hash
    WHERE singleton = TRUE;

    RETURN NEW;
END;
$$;

REVOKE ALL ON TABLE audit_chain_state FROM PUBLIC;
REVOKE ALL ON FUNCTION append_audit_hash_chain() FROM PUBLIC;

CREATE TRIGGER append_audit_hash_chain_before_insert
    BEFORE INSERT ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION append_audit_hash_chain();

COMMENT ON COLUMN audit_logs.record_hash IS
    'SHA-256 over the canonical JSONB representation of the stored row, excluding record_hash';
COMMENT ON TABLE audit_chain_state IS
    'Singleton serialization state for the database-enforced audit hash chain';

COMMIT;
