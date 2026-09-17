-- ============================================================================
-- Migration 004 Down: Remove Multi-tenancy Support
-- ============================================================================

-- Remove org_id from prospects
ALTER TABLE prospects DROP COLUMN IF EXISTS org_id;

-- Drop triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;

-- Drop tables in order (respecting foreign keys)
DROP TABLE IF EXISTS api_keys;
DROP TABLE IF EXISTS user_permissions;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS organizations;
