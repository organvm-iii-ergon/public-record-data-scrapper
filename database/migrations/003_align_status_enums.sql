-- ============================================================================
-- Migration 003: Align Prospect Status Enums
--
-- Adds new status values to support deal pipeline workflows:
-- - 'closed-won': Deal funded successfully
-- - 'closed-lost': Deal rejected or dropped
-- - 'unclaimed': Explicitly unclaimed (vs 'new' which is never-touched)
-- ============================================================================

-- PostgreSQL doesn't allow direct modification of CHECK constraints,
-- so we need to drop and recreate

-- Step 1: Drop the existing constraint
ALTER TABLE prospects DROP CONSTRAINT IF EXISTS prospects_status_check;

-- Step 2: Add the new constraint with expanded values
ALTER TABLE prospects ADD CONSTRAINT prospects_status_check
    CHECK (status IN (
        'new', 'claimed', 'contacted', 'qualified', 'dead',
        'closed-won', 'closed-lost', 'unclaimed'
    ));

-- Add comment documenting the status workflow
COMMENT ON COLUMN prospects.status IS 'Prospect status: new (untouched) -> claimed -> contacted -> qualified -> closed-won/closed-lost/dead. unclaimed = explicitly released.';
