-- ============================================================================
-- Migration 027: Partner & Referral Program Persistence (Issue #480)
-- Enables tenants to generate referral links, customize partner codes,
-- and track clicks, signups, conversions, and tiered commissions.
-- ============================================================================

CREATE TABLE IF NOT EXISTS partner_referral_programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    partner_code VARCHAR(50) NOT NULL UNIQUE,
    referral_url TEXT NOT NULL,
    commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 15.00,
    tier VARCHAR(30) NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
    payout_email VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_partner_programs_org UNIQUE (org_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_programs_code ON partner_referral_programs(partner_code);
CREATE INDEX IF NOT EXISTS idx_partner_programs_org ON partner_referral_programs(org_id);

CREATE TABLE IF NOT EXISTS partner_referral_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID NOT NULL REFERENCES partner_referral_programs(id) ON DELETE CASCADE,
    event_type VARCHAR(30) NOT NULL CHECK (event_type IN ('click', 'signup', 'conversion', 'payout')),
    referred_email VARCHAR(255),
    referred_org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    revenue_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    commission_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_events_program_created
    ON partner_referral_events(program_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_referral_events_type
    ON partner_referral_events(event_type);

COMMENT ON TABLE partner_referral_programs IS 'Tenant affiliate partner accounts, codes, and commission tiers';
COMMENT ON TABLE partner_referral_events IS 'Referral funnel telemetry: clicks, signups, paid conversions, and payouts';
