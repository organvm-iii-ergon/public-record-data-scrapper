-- ============================================================================
-- Migration 003 Down: Revert Prospect Status Enums
-- ============================================================================

-- First, update any records with new statuses back to compatible values
UPDATE prospects SET status = 'qualified' WHERE status = 'closed-won';
UPDATE prospects SET status = 'dead' WHERE status = 'closed-lost';
UPDATE prospects SET status = 'new' WHERE status = 'unclaimed';

-- Drop the expanded constraint
ALTER TABLE prospects DROP CONSTRAINT IF EXISTS prospects_status_check;

-- Restore original constraint
ALTER TABLE prospects ADD CONSTRAINT prospects_status_check
    CHECK (status IN (
        'new', 'claimed', 'contacted', 'qualified', 'dead'
    ));

-- Remove comment
COMMENT ON COLUMN prospects.status IS NULL;
