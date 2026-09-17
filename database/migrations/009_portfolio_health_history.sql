-- ============================================================================
-- Migration 009: Portfolio Health History
--
-- Adds time-series tracking for prospect health scores, enabling historical
-- trend analysis and DEWS (Distressed Early Warning System) alerting.
-- ============================================================================

-- Portfolio health history (time-series tracking of health scores)
CREATE TABLE portfolio_health_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,

    -- Health metrics
    health_score INTEGER NOT NULL CHECK (health_score >= 0 AND health_score <= 100),
    health_grade CHAR(1) CHECK (health_grade IN ('A', 'B', 'C', 'D', 'F')),

    -- Contributing factors (snapshot at recording time)
    factors JSONB, -- {"payment_history": 85, "revenue_trend": -5, "new_ucc_filings": 0}

    -- Context
    source VARCHAR(50) DEFAULT 'system', -- 'system', 'manual', 'enrichment', 'webhook'
    notes TEXT,

    -- Immutable timestamp
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Primary index for prospect lookups with time ordering (most common query pattern)
CREATE INDEX idx_health_history_prospect ON portfolio_health_history(prospect_id, recorded_at DESC);

-- BRIN index for time-series queries (efficient for append-only data)
CREATE INDEX idx_health_history_recorded_brin ON portfolio_health_history USING brin(recorded_at);

-- Index for finding low-health prospects across the portfolio
CREATE INDEX idx_health_history_score ON portfolio_health_history(health_score, recorded_at DESC);

-- Index for health grade distribution queries
CREATE INDEX idx_health_history_grade ON portfolio_health_history(health_grade, recorded_at DESC);

-- Function to calculate health grade from score
CREATE OR REPLACE FUNCTION calculate_health_grade(score INTEGER)
RETURNS CHAR(1) AS $$
BEGIN
    RETURN CASE
        WHEN score >= 90 THEN 'A'
        WHEN score >= 80 THEN 'B'
        WHEN score >= 70 THEN 'C'
        WHEN score >= 60 THEN 'D'
        ELSE 'F'
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-calculate health grade if not provided
CREATE OR REPLACE FUNCTION set_health_grade()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.health_grade IS NULL THEN
        NEW.health_grade := calculate_health_grade(NEW.health_score);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_health_history_grade
    BEFORE INSERT ON portfolio_health_history
    FOR EACH ROW
    EXECUTE FUNCTION set_health_grade();

-- Comments
COMMENT ON TABLE portfolio_health_history IS 'Time-series tracking of prospect health scores for trend analysis and DEWS alerting';
COMMENT ON COLUMN portfolio_health_history.factors IS 'Snapshot of contributing factors at recording time';
COMMENT ON COLUMN portfolio_health_history.source IS 'Origin of the health score: system, manual, enrichment, or webhook';
COMMENT ON FUNCTION calculate_health_grade(INTEGER) IS 'Calculate letter grade from numeric health score';
