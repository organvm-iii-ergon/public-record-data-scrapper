-- ============================================================================
-- Migration 007 Down: Remove Communications Engine
-- ============================================================================

-- Drop triggers
DROP TRIGGER IF EXISTS update_follow_up_reminders_updated_at ON follow_up_reminders;
DROP TRIGGER IF EXISTS update_communication_templates_updated_at ON communication_templates;
DROP TRIGGER IF EXISTS update_communication_from_event_trigger ON communication_events;

-- Drop functions
DROP FUNCTION IF EXISTS update_communication_from_event();

-- Drop tables
DROP TABLE IF EXISTS follow_up_reminders;
DROP TABLE IF EXISTS communication_events;
DROP TABLE IF EXISTS communications;
DROP TABLE IF EXISTS communication_templates;
