-- ============================================================================
-- Migration 006 Down: Remove Deal Pipeline
-- ============================================================================

-- Drop triggers
DROP TRIGGER IF EXISTS update_lenders_updated_at ON lenders;
DROP TRIGGER IF EXISTS update_deals_updated_at ON deals;
DROP TRIGGER IF EXISTS track_deal_stage_change_trigger ON deals;
DROP TRIGGER IF EXISTS generate_deal_number_trigger ON deals;
DROP TRIGGER IF EXISTS create_org_default_stages ON organizations;

-- Drop functions
DROP FUNCTION IF EXISTS track_deal_stage_change();
DROP FUNCTION IF EXISTS generate_deal_number();
DROP FUNCTION IF EXISTS create_default_deal_stages();

-- Drop tables
DROP TABLE IF EXISTS deal_stage_history;
DROP TABLE IF EXISTS deal_documents;
DROP TABLE IF EXISTS deals;
DROP TABLE IF EXISTS lenders;
DROP TABLE IF EXISTS deal_stages;
