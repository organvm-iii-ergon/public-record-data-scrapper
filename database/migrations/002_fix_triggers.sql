-- ============================================================================
-- Migration 002: Fix UCC Filings Normalization Triggers
--
-- Issue: The ucc_filings table uses normalize_company_name() trigger which
-- only works for prospects table (targets company_name_normalized column).
-- UCC filings need separate triggers for debtor_name_normalized and
-- secured_party_normalized columns.
-- ============================================================================

-- Drop the incorrect trigger
DROP TRIGGER IF EXISTS normalize_ucc_debtor_name ON ucc_filings;

-- Create function to normalize debtor name
CREATE OR REPLACE FUNCTION normalize_debtor_name()
RETURNS TRIGGER AS $$
BEGIN
    NEW.debtor_name_normalized = LOWER(TRIM(
        regexp_replace(
            regexp_replace(NEW.debtor_name, '\s+', ' ', 'g'),  -- Collapse whitespace
            '[^\w\s]', '', 'g'  -- Remove special characters
        )
    ));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to normalize secured party name
CREATE OR REPLACE FUNCTION normalize_secured_party()
RETURNS TRIGGER AS $$
BEGIN
    NEW.secured_party_normalized = LOWER(TRIM(
        regexp_replace(
            regexp_replace(NEW.secured_party, '\s+', ' ', 'g'),  -- Collapse whitespace
            '[^\w\s]', '', 'g'  -- Remove special characters
        )
    ));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for debtor name normalization
CREATE TRIGGER normalize_ucc_debtor_name
    BEFORE INSERT OR UPDATE OF debtor_name ON ucc_filings
    FOR EACH ROW
    EXECUTE FUNCTION normalize_debtor_name();

-- Create trigger for secured party normalization
CREATE TRIGGER normalize_ucc_secured_party
    BEFORE INSERT OR UPDATE OF secured_party ON ucc_filings
    FOR EACH ROW
    EXECUTE FUNCTION normalize_secured_party();

-- Update normalize_company_name to also strip common legal suffixes
CREATE OR REPLACE FUNCTION normalize_company_name()
RETURNS TRIGGER AS $$
DECLARE
    normalized TEXT;
BEGIN
    -- Start with basic normalization
    normalized = LOWER(TRIM(NEW.company_name));

    -- Collapse whitespace
    normalized = regexp_replace(normalized, '\s+', ' ', 'g');

    -- Strip common legal suffixes (LLC, Inc, Corp, etc.)
    normalized = regexp_replace(normalized,
        '\s*(,?\s*)?(llc|l\.l\.c\.|inc\.?|incorporated|corp\.?|corporation|ltd\.?|limited|lp|l\.p\.|llp|l\.l\.p\.|co\.?|company|pllc|p\.l\.l\.c\.)$',
        '', 'i');

    NEW.company_name_normalized = TRIM(normalized);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Backfill existing records with proper normalization
UPDATE ucc_filings
SET debtor_name_normalized = LOWER(TRIM(
    regexp_replace(
        regexp_replace(debtor_name, '\s+', ' ', 'g'),
        '[^\w\s]', '', 'g'
    )
))
WHERE debtor_name_normalized IS NULL
   OR debtor_name_normalized = '';

UPDATE ucc_filings
SET secured_party_normalized = LOWER(TRIM(
    regexp_replace(
        regexp_replace(secured_party, '\s+', ' ', 'g'),
        '[^\w\s]', '', 'g'
    )
))
WHERE secured_party_normalized IS NULL
   OR secured_party_normalized = '';
