-- ============================================================================
-- Migration 002 Down: Revert UCC Filings Normalization Triggers
-- ============================================================================

-- Drop the new triggers
DROP TRIGGER IF EXISTS normalize_ucc_debtor_name ON ucc_filings;
DROP TRIGGER IF EXISTS normalize_ucc_secured_party ON ucc_filings;

-- Drop the new functions
DROP FUNCTION IF EXISTS normalize_debtor_name();
DROP FUNCTION IF EXISTS normalize_secured_party();

-- Restore original normalize_company_name function (basic version)
CREATE OR REPLACE FUNCTION normalize_company_name()
RETURNS TRIGGER AS $$
BEGIN
    NEW.company_name_normalized = LOWER(TRIM(NEW.company_name));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the original (incorrect) trigger
CREATE TRIGGER normalize_ucc_debtor_name
    BEFORE INSERT OR UPDATE OF debtor_name ON ucc_filings
    FOR EACH ROW
    EXECUTE FUNCTION normalize_company_name();
