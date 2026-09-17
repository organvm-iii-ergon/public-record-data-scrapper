-- Rollback for 001_initial_schema.sql
-- Drop all tables and extensions in reverse order

-- Drop tables
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS usage_tracking CASCADE;
DROP TABLE IF EXISTS data_sources CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS portfolio_companies CASCADE;
DROP TABLE IF EXISTS competitors CASCADE;
DROP TABLE IF EXISTS health_scores CASCADE;
DROP TABLE IF EXISTS growth_signals CASCADE;
DROP TABLE IF EXISTS prospect_ucc_filings CASCADE;
DROP TABLE IF EXISTS prospects CASCADE;
DROP TABLE IF EXISTS ucc_filings CASCADE;

-- Drop extensions
DROP EXTENSION IF EXISTS "btree_gin";
DROP EXTENSION IF EXISTS "pg_trgm";
DROP EXTENSION IF EXISTS "uuid-ossp";
