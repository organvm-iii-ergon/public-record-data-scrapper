-- ============================================================================
-- Migration 027: API Usage Metering & Tier Tracking
-- Provides audit trail, request tracking, and Stripe billing synchronization.
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_usage_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL DEFAULT 'GET',
    status_code INTEGER NOT NULL DEFAULT 200,
    request_count INTEGER NOT NULL DEFAULT 1,
    reported_to_stripe BOOLEAN NOT NULL DEFAULT false,
    stripe_event_id VARCHAR(255),
    reported_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_events_org_created
    ON api_usage_events(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_usage_events_unreported
    ON api_usage_events(reported_to_stripe, created_at) WHERE reported_to_stripe = false;

CREATE TABLE IF NOT EXISTS api_usage_meter_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    tier VARCHAR(50) NOT NULL DEFAULT 'free',
    total_requests INTEGER NOT NULL DEFAULT 0,
    included_quota INTEGER NOT NULL DEFAULT 100,
    overage_requests INTEGER NOT NULL DEFAULT 0,
    estimated_overage_cost NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
    reported_quantity INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'open',
    stripe_meter_event_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_api_usage_meter_records_org_period UNIQUE(org_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_api_usage_meter_records_org
    ON api_usage_meter_records(org_id, period_start DESC);

COMMENT ON TABLE api_usage_events IS 'Granular API usage records for metering and billing auditing';
COMMENT ON TABLE api_usage_meter_records IS 'Aggregated period usage and Stripe metering synchronization records';
