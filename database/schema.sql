-- ============================================================================
-- UCC-MCA Intelligence Platform - Database Schema
-- PostgreSQL 14+
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search
CREATE EXTENSION IF NOT EXISTS "btree_gin"; -- For composite indexes

-- ============================================================================
-- Tables
-- ============================================================================

-- UCC Filings Table
CREATE TABLE ucc_filings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(255) UNIQUE NOT NULL, -- Original filing ID from source
    filing_date DATE NOT NULL,
    debtor_name VARCHAR(500) NOT NULL,
    debtor_name_normalized VARCHAR(500) NOT NULL, -- Lowercased, trimmed for search
    secured_party VARCHAR(500) NOT NULL,
    secured_party_normalized VARCHAR(500) NOT NULL,
    state CHAR(2) NOT NULL,
    lien_amount DECIMAL(15, 2),
    status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'terminated', 'lapsed')),
    filing_type VARCHAR(10) NOT NULL CHECK (filing_type IN ('UCC-1', 'UCC-3')),
    source VARCHAR(100) NOT NULL, -- 'ny-portal', 'api', etc.
    raw_data JSONB, -- Store original data for reference
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Indexes
    CONSTRAINT filing_date_check CHECK (filing_date <= CURRENT_DATE)
);

CREATE INDEX idx_ucc_filing_date ON ucc_filings(filing_date DESC);
CREATE INDEX idx_ucc_debtor_name ON ucc_filings USING gin(debtor_name_normalized gin_trgm_ops);
CREATE INDEX idx_ucc_secured_party ON ucc_filings USING gin(secured_party_normalized gin_trgm_ops);
CREATE INDEX idx_ucc_state ON ucc_filings(state);
CREATE INDEX idx_ucc_status ON ucc_filings(status);
CREATE INDEX idx_ucc_lapsed ON ucc_filings(filing_date, status) WHERE status = 'lapsed';

-- Prospects Table
CREATE TABLE prospects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(500) NOT NULL,
    company_name_normalized VARCHAR(500) NOT NULL,
    industry VARCHAR(50) NOT NULL CHECK (industry IN (
        'restaurant', 'retail', 'construction', 'healthcare',
        'manufacturing', 'services', 'technology'
    )),
    state CHAR(2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN (
        'new', 'claimed', 'contacted', 'qualified', 'dead',
        'closed-won', 'closed-lost', 'unclaimed'
    )),
    priority_score INTEGER NOT NULL CHECK (priority_score >= 0 AND priority_score <= 100),
    default_date DATE NOT NULL,
    time_since_default INTEGER NOT NULL, -- Days since default
    last_filing_date DATE,
    narrative TEXT,
    estimated_revenue DECIMAL(15, 2),
    claimed_by VARCHAR(200),
    claimed_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_enriched_at TIMESTAMP WITH TIME ZONE,
    enrichment_confidence DECIMAL(3, 2), -- 0.00 to 1.00

    CONSTRAINT default_date_check CHECK (default_date <= CURRENT_DATE),
    CONSTRAINT time_since_default_check CHECK (time_since_default >= 0)
);

CREATE INDEX idx_prospects_priority ON prospects(priority_score DESC);
CREATE INDEX idx_prospects_industry ON prospects(industry);
CREATE INDEX idx_prospects_state ON prospects(state);
CREATE INDEX idx_prospects_status ON prospects(status);
CREATE INDEX idx_prospects_company_name ON prospects USING gin(company_name_normalized gin_trgm_ops);
CREATE INDEX idx_prospects_default_date ON prospects(default_date DESC);
CREATE INDEX idx_prospects_claimed ON prospects(claimed_by, claimed_date) WHERE claimed_by IS NOT NULL;

-- Prospect UCC Filings Junction Table
CREATE TABLE prospect_ucc_filings (
    prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
    ucc_filing_id UUID REFERENCES ucc_filings(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    PRIMARY KEY (prospect_id, ucc_filing_id)
);

CREATE INDEX idx_prospect_ucc_prospect ON prospect_ucc_filings(prospect_id);
CREATE INDEX idx_prospect_ucc_filing ON prospect_ucc_filings(ucc_filing_id);

-- Growth Signals Table
CREATE TABLE growth_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN (
        'hiring', 'permit', 'contract', 'expansion', 'equipment'
    )),
    description TEXT NOT NULL,
    detected_date DATE NOT NULL,
    source_url TEXT,
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    confidence DECIMAL(3, 2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    raw_data JSONB, -- Store original signal data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT detected_date_check CHECK (detected_date <= CURRENT_DATE)
);

CREATE INDEX idx_signals_prospect ON growth_signals(prospect_id);
CREATE INDEX idx_signals_type ON growth_signals(type);
CREATE INDEX idx_signals_detected_date ON growth_signals(detected_date DESC);
CREATE INDEX idx_signals_score ON growth_signals(score DESC);

-- Health Scores Table
CREATE TABLE health_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
    grade CHAR(1) NOT NULL CHECK (grade IN ('A', 'B', 'C', 'D', 'F')),
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    sentiment_trend VARCHAR(20) NOT NULL CHECK (sentiment_trend IN (
        'improving', 'stable', 'declining'
    )),
    review_count INTEGER NOT NULL CHECK (review_count >= 0),
    avg_sentiment DECIMAL(3, 2) NOT NULL CHECK (avg_sentiment >= 0 AND avg_sentiment <= 1),
    violation_count INTEGER NOT NULL CHECK (violation_count >= 0),
    recorded_date DATE NOT NULL,
    raw_data JSONB, -- Store detailed health metrics
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT recorded_date_check CHECK (recorded_date <= CURRENT_DATE)
);

CREATE INDEX idx_health_prospect ON health_scores(prospect_id);
CREATE INDEX idx_health_grade ON health_scores(grade);
CREATE INDEX idx_health_recorded_date ON health_scores(recorded_date DESC);
CREATE UNIQUE INDEX idx_health_prospect_date ON health_scores(prospect_id, recorded_date);

-- Competitor Data Table
CREATE TABLE competitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lender_name VARCHAR(500) NOT NULL UNIQUE,
    lender_name_normalized VARCHAR(500) NOT NULL,
    filing_count INTEGER NOT NULL DEFAULT 0,
    avg_deal_size DECIMAL(15, 2),
    market_share DECIMAL(5, 2), -- Percentage
    industries VARCHAR(50)[], -- Array of industries
    top_state CHAR(2),
    monthly_trend DECIMAL(5, 2), -- Percentage change
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_competitors_filing_count ON competitors(filing_count DESC);
CREATE INDEX idx_competitors_market_share ON competitors(market_share DESC);
CREATE INDEX idx_competitors_name ON competitors USING gin(lender_name_normalized gin_trgm_ops);

-- Portfolio Companies Table
CREATE TABLE portfolio_companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(500) NOT NULL,
    company_name_normalized VARCHAR(500) NOT NULL,
    funding_date DATE NOT NULL,
    funding_amount DECIMAL(15, 2) NOT NULL,
    current_status VARCHAR(20) NOT NULL CHECK (current_status IN (
        'performing', 'watch', 'at-risk', 'default'
    )),
    last_alert_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_portfolio_status ON portfolio_companies(current_status);
CREATE INDEX idx_portfolio_funding_date ON portfolio_companies(funding_date DESC);
CREATE INDEX idx_portfolio_at_risk ON portfolio_companies(current_status)
    WHERE current_status IN ('at-risk', 'default');

-- Portfolio Health Scores Junction
CREATE TABLE portfolio_health_scores (
    portfolio_company_id UUID REFERENCES portfolio_companies(id) ON DELETE CASCADE,
    health_score_id UUID REFERENCES health_scores(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    PRIMARY KEY (portfolio_company_id, health_score_id)
);

-- Data Ingestion Logs Table
CREATE TABLE ingestion_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
    records_found INTEGER NOT NULL DEFAULT 0,
    records_processed INTEGER NOT NULL DEFAULT 0,
    errors JSONB, -- Array of error messages
    processing_time_ms INTEGER,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB -- Additional context
);

CREATE INDEX idx_ingestion_source ON ingestion_logs(source);
CREATE INDEX idx_ingestion_status ON ingestion_logs(status);
CREATE INDEX idx_ingestion_started ON ingestion_logs(started_at DESC);

-- Enrichment Logs Table
CREATE TABLE enrichment_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
    enriched_fields VARCHAR(100)[],
    errors JSONB,
    confidence DECIMAL(3, 2),
    processing_time_ms INTEGER,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB
);

CREATE INDEX idx_enrichment_prospect ON enrichment_logs(prospect_id);
CREATE INDEX idx_enrichment_status ON enrichment_logs(status);
CREATE INDEX idx_enrichment_started ON enrichment_logs(started_at DESC);

-- ============================================================================
-- Views
-- ============================================================================

-- Latest Health Score per Prospect
CREATE VIEW latest_health_scores AS
SELECT DISTINCT ON (prospect_id)
    id,
    prospect_id,
    grade,
    score,
    sentiment_trend,
    review_count,
    avg_sentiment,
    violation_count,
    recorded_date
FROM health_scores
ORDER BY prospect_id, recorded_date DESC;

-- Prospects with Latest Health
CREATE VIEW prospects_with_health AS
SELECT
    p.*,
    h.grade as health_grade,
    h.score as health_score,
    h.sentiment_trend,
    h.violation_count,
    h.recorded_date as health_last_updated
FROM prospects p
LEFT JOIN latest_health_scores h ON p.id = h.prospect_id;

-- High Priority Prospects
CREATE VIEW high_priority_prospects AS
SELECT *
FROM prospects_with_health
WHERE priority_score >= 70
    AND status IN ('new', 'claimed')
ORDER BY priority_score DESC;

-- Stale Prospects (health score > 7 days old)
CREATE VIEW stale_prospects AS
SELECT p.*
FROM prospects p
WHERE p.last_enriched_at < NOW() - INTERVAL '7 days'
    OR p.last_enriched_at IS NULL;

-- ============================================================================
-- Functions
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_ucc_filings_updated_at
    BEFORE UPDATE ON ucc_filings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_prospects_updated_at
    BEFORE UPDATE ON prospects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_portfolio_companies_updated_at
    BEFORE UPDATE ON portfolio_companies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Calculate time since default
CREATE OR REPLACE FUNCTION calculate_time_since_default()
RETURNS TRIGGER AS $$
BEGIN
    NEW.time_since_default = EXTRACT(DAY FROM (CURRENT_DATE - NEW.default_date))::INTEGER;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_prospect_time_since_default
    BEFORE INSERT OR UPDATE OF default_date ON prospects
    FOR EACH ROW
    EXECUTE FUNCTION calculate_time_since_default();

-- Normalize company names for search (with legal suffix stripping)
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

-- Normalize debtor name for UCC filings
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

-- Normalize secured party name for UCC filings
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

CREATE TRIGGER normalize_prospect_company_name
    BEFORE INSERT OR UPDATE OF company_name ON prospects
    FOR EACH ROW
    EXECUTE FUNCTION normalize_company_name();

CREATE TRIGGER normalize_ucc_debtor_name
    BEFORE INSERT OR UPDATE OF debtor_name ON ucc_filings
    FOR EACH ROW
    EXECUTE FUNCTION normalize_debtor_name();

CREATE TRIGGER normalize_ucc_secured_party
    BEFORE INSERT OR UPDATE OF secured_party ON ucc_filings
    FOR EACH ROW
    EXECUTE FUNCTION normalize_secured_party();

-- ============================================================================
-- Indexes for Full-Text Search
-- ============================================================================

-- Add full-text search columns
ALTER TABLE prospects ADD COLUMN search_vector tsvector;
ALTER TABLE ucc_filings ADD COLUMN search_vector tsvector;

-- Update search vectors
CREATE OR REPLACE FUNCTION prospects_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector =
        setweight(to_tsvector('english', coalesce(NEW.company_name, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW.narrative, '')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prospects_search_vector_trigger
    BEFORE INSERT OR UPDATE OF company_name, narrative ON prospects
    FOR EACH ROW
    EXECUTE FUNCTION prospects_search_vector_update();

CREATE INDEX idx_prospects_search_vector ON prospects USING gin(search_vector);

-- ============================================================================
-- Sample Queries
-- ============================================================================

-- Find prospects by company name (fuzzy)
-- SELECT * FROM prospects WHERE company_name_normalized % 'acme corp';

-- Find lapsed UCC filings in last 3 years
-- SELECT * FROM ucc_filings
-- WHERE status = 'lapsed'
--   AND filing_date >= CURRENT_DATE - INTERVAL '3 years';

-- Top prospects with growth signals
-- SELECT p.*, COUNT(gs.id) as signal_count
-- FROM prospects p
-- LEFT JOIN growth_signals gs ON p.id = gs.prospect_id
-- GROUP BY p.id
-- ORDER BY p.priority_score DESC, signal_count DESC
-- LIMIT 20;

-- Competitor market analysis
-- SELECT * FROM competitors
-- ORDER BY market_share DESC
-- LIMIT 10;
