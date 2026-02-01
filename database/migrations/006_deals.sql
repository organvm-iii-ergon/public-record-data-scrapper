-- ============================================================================
-- Migration 006: Deal Pipeline
--
-- Adds deal management tables for Broker OS deal desk functionality.
-- ============================================================================

-- Deal stages (configurable per organization)
CREATE TABLE deal_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    slug VARCHAR(50) NOT NULL,
    description TEXT,
    stage_order INTEGER NOT NULL,
    is_terminal BOOLEAN DEFAULT false, -- true for 'funded', 'dead', etc.
    terminal_type VARCHAR(20) CHECK (terminal_type IS NULL OR terminal_type IN (
        'won', 'lost', 'withdrawn'
    )),
    color VARCHAR(7), -- Hex color for UI
    auto_actions JSONB DEFAULT '{}', -- Actions to trigger on stage entry
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_stage_per_org UNIQUE (org_id, slug)
);

CREATE INDEX idx_deal_stages_org ON deal_stages(org_id);
CREATE INDEX idx_deal_stages_order ON deal_stages(org_id, stage_order);

-- Insert default stages for new organizations
CREATE OR REPLACE FUNCTION create_default_deal_stages()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO deal_stages (org_id, name, slug, stage_order, is_terminal, terminal_type, color) VALUES
        (NEW.id, 'Lead', 'lead', 1, false, NULL, '#6B7280'),
        (NEW.id, 'Contacted', 'contacted', 2, false, NULL, '#3B82F6'),
        (NEW.id, 'Pack Submitted', 'pack-submitted', 3, false, NULL, '#8B5CF6'),
        (NEW.id, 'Underwriting', 'underwriting', 4, false, NULL, '#F59E0B'),
        (NEW.id, 'Approved', 'approved', 5, false, NULL, '#10B981'),
        (NEW.id, 'Contract Out', 'contract-out', 6, false, NULL, '#EC4899'),
        (NEW.id, 'Funded', 'funded', 7, true, 'won', '#059669'),
        (NEW.id, 'Dead', 'dead', 8, true, 'lost', '#EF4444'),
        (NEW.id, 'Withdrawn', 'withdrawn', 9, true, 'withdrawn', '#9CA3AF');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_org_default_stages
    AFTER INSERT ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION create_default_deal_stages();

-- Lenders table (funding sources)
CREATE TABLE lenders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(100),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    buy_box JSONB DEFAULT '{}', -- Criteria for accepting deals
    commission_rate DECIMAL(5, 4), -- e.g., 0.0250 for 2.5%
    avg_approval_time_hours INTEGER,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_lenders_org ON lenders(org_id);
CREATE INDEX idx_lenders_active ON lenders(org_id, is_active) WHERE is_active = true;

-- Deals table
CREATE TABLE deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    lender_id UUID REFERENCES lenders(id) ON DELETE SET NULL,
    stage_id UUID REFERENCES deal_stages(id) ON DELETE RESTRICT,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Deal details
    deal_number VARCHAR(50), -- Auto-generated or custom
    amount_requested DECIMAL(15, 2),
    amount_approved DECIMAL(15, 2),
    amount_funded DECIMAL(15, 2),
    term_months INTEGER,
    factor_rate DECIMAL(6, 4), -- e.g., 1.35
    daily_payment DECIMAL(12, 2),
    weekly_payment DECIMAL(12, 2),
    total_payback DECIMAL(15, 2),
    commission_amount DECIMAL(12, 2),

    -- Use of funds
    use_of_funds VARCHAR(100),
    use_of_funds_details TEXT,

    -- Underwriting data (summarized)
    bank_connected BOOLEAN DEFAULT false,
    average_daily_balance DECIMAL(15, 2),
    monthly_revenue DECIMAL(15, 2),
    nsf_count INTEGER,
    existing_positions INTEGER, -- Number of existing MCA positions

    -- Status
    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    probability INTEGER CHECK (probability >= 0 AND probability <= 100),
    expected_close_date DATE,
    actual_close_date DATE,
    lost_reason VARCHAR(100),
    lost_notes TEXT,

    -- Timestamps
    submitted_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    funded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_deals_org ON deals(org_id);
CREATE INDEX idx_deals_prospect ON deals(prospect_id);
CREATE INDEX idx_deals_stage ON deals(stage_id);
CREATE INDEX idx_deals_assigned ON deals(assigned_to);
CREATE INDEX idx_deals_lender ON deals(lender_id);
CREATE INDEX idx_deals_created ON deals(created_at DESC);
CREATE INDEX idx_deals_expected_close ON deals(expected_close_date) WHERE expected_close_date IS NOT NULL;

-- Deal documents
CREATE TABLE deal_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN (
        'application', 'bank_statement', 'tax_return', 'voided_check',
        'drivers_license', 'business_license', 'landlord_letter',
        'contract', 'signed_contract', 'disclosure', 'signed_disclosure',
        'other'
    )),
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL, -- S3 or storage path
    file_size INTEGER, -- bytes
    mime_type VARCHAR(100),
    is_required BOOLEAN DEFAULT false,
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_deal_documents_deal ON deal_documents(deal_id);
CREATE INDEX idx_deal_documents_type ON deal_documents(document_type);

-- Deal stage history (audit trail)
CREATE TABLE deal_stage_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
    from_stage_id UUID REFERENCES deal_stages(id),
    to_stage_id UUID REFERENCES deal_stages(id) NOT NULL,
    changed_by UUID REFERENCES users(id),
    notes TEXT,
    duration_in_stage_hours INTEGER, -- Time spent in previous stage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_deal_stage_history_deal ON deal_stage_history(deal_id);
CREATE INDEX idx_deal_stage_history_created ON deal_stage_history(created_at DESC);

-- Auto-generate deal number
CREATE OR REPLACE FUNCTION generate_deal_number()
RETURNS TRIGGER AS $$
DECLARE
    org_prefix VARCHAR(10);
    next_num INTEGER;
BEGIN
    IF NEW.deal_number IS NULL THEN
        SELECT COALESCE(slug, 'DEAL') INTO org_prefix
        FROM organizations WHERE id = NEW.org_id;

        SELECT COALESCE(MAX(
            CAST(regexp_replace(deal_number, '[^0-9]', '', 'g') AS INTEGER)
        ), 0) + 1 INTO next_num
        FROM deals WHERE org_id = NEW.org_id;

        NEW.deal_number = UPPER(LEFT(org_prefix, 4)) || '-' || LPAD(next_num::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_deal_number_trigger
    BEFORE INSERT ON deals
    FOR EACH ROW
    EXECUTE FUNCTION generate_deal_number();

-- Track stage changes
CREATE OR REPLACE FUNCTION track_deal_stage_change()
RETURNS TRIGGER AS $$
DECLARE
    prev_entry deal_stage_history%ROWTYPE;
    hours_in_stage INTEGER;
BEGIN
    IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
        -- Calculate time in previous stage
        SELECT * INTO prev_entry
        FROM deal_stage_history
        WHERE deal_id = NEW.id
        ORDER BY created_at DESC
        LIMIT 1;

        IF prev_entry.id IS NOT NULL THEN
            hours_in_stage = EXTRACT(EPOCH FROM (NOW() - prev_entry.created_at)) / 3600;
        ELSE
            hours_in_stage = EXTRACT(EPOCH FROM (NOW() - OLD.created_at)) / 3600;
        END IF;

        INSERT INTO deal_stage_history (deal_id, from_stage_id, to_stage_id, duration_in_stage_hours)
        VALUES (NEW.id, OLD.stage_id, NEW.stage_id, hours_in_stage);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_deal_stage_change_trigger
    AFTER UPDATE OF stage_id ON deals
    FOR EACH ROW
    EXECUTE FUNCTION track_deal_stage_change();

-- Update timestamps
CREATE TRIGGER update_deals_updated_at
    BEFORE UPDATE ON deals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_lenders_updated_at
    BEFORE UPDATE ON lenders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Comments
COMMENT ON TABLE deal_stages IS 'Configurable deal pipeline stages per organization';
COMMENT ON TABLE lenders IS 'Funding sources/lenders that brokers submit deals to';
COMMENT ON TABLE deals IS 'MCA deals in the pipeline';
COMMENT ON TABLE deal_documents IS 'Documents attached to deals';
COMMENT ON TABLE deal_stage_history IS 'Audit trail of deal stage transitions';
