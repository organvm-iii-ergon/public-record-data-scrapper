-- Migration: 001_initial_schema
-- Description: Initial database schema for UCC-MCA Intelligence Platform
-- Date: 2025-01-01
-- Up Migration

BEGIN;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create tables (from schema.sql)
-- See ../schema.sql for complete schema

-- Add migration tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO schema_migrations (version, name)
VALUES ('001', 'initial_schema');

COMMIT;
