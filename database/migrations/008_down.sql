-- ============================================================================
-- Migration 008 Down: Remove Compliance & Audit
-- ============================================================================

-- Drop triggers
DROP TRIGGER IF EXISTS update_compliance_alerts_updated_at ON compliance_alerts;
DROP TRIGGER IF EXISTS update_disclosures_updated_at ON disclosures;
DROP TRIGGER IF EXISTS update_disclosure_requirements_updated_at ON disclosure_requirements;
DROP TRIGGER IF EXISTS prevent_audit_delete ON audit_logs;
DROP TRIGGER IF EXISTS prevent_audit_update ON audit_logs;

-- Drop functions
DROP FUNCTION IF EXISTS prevent_audit_modification();

-- Drop tables
DROP TABLE IF EXISTS compliance_alerts;
DROP TABLE IF EXISTS dnc_list;
DROP TABLE IF EXISTS consent_records;
DROP TABLE IF EXISTS disclosures;
DROP TABLE IF EXISTS disclosure_requirements;
DROP TABLE IF EXISTS audit_logs;
