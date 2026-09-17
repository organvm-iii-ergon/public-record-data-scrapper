-- ============================================================================
-- Migration 009 Down: Remove Portfolio Health History
-- ============================================================================

-- Drop triggers
DROP TRIGGER IF EXISTS set_health_history_grade ON portfolio_health_history;

-- Drop functions
DROP FUNCTION IF EXISTS set_health_grade();
DROP FUNCTION IF EXISTS calculate_health_grade(INTEGER);

-- Drop table
DROP TABLE IF EXISTS portfolio_health_history;
