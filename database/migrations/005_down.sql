-- ============================================================================
-- Migration 005 Down: Remove Contact Management
-- ============================================================================

-- Drop triggers
DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
DROP TRIGGER IF EXISTS update_contact_last_contacted_trigger ON contact_activities;
DROP TRIGGER IF EXISTS enforce_single_primary_contact ON prospect_contacts;

-- Drop functions
DROP FUNCTION IF EXISTS update_contact_last_contacted();
DROP FUNCTION IF EXISTS ensure_single_primary_contact();

-- Drop tables
DROP TABLE IF EXISTS contact_activities;
DROP TABLE IF EXISTS prospect_contacts;
DROP TABLE IF EXISTS contacts;
