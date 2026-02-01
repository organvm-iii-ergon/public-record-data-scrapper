-- ============================================================================
-- Migration 008: Compliance & Audit
--
-- Adds disclosures, consent records, and audit logs for regulatory compliance.
-- Supports CA SB 1235, NY CFDL, and other state disclosure requirements.
-- ============================================================================

-- Audit logs (immutable record of all changes)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Action details
    action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'view', 'export', etc.
    entity_type VARCHAR(50) NOT NULL, -- 'prospect', 'deal', 'contact', 'communication', etc.
    entity_id UUID,

    -- Change tracking
    changes JSONB, -- {field: {old: value, new: value}}
    before_state JSONB, -- Full entity state before change
    after_state JSONB, -- Full entity state after change

    -- Context
    ip_address INET,
    user_agent TEXT,
    request_id VARCHAR(100), -- Correlation ID

    -- Immutable timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Use BRIN index for time-series data (more efficient for append-only tables)
CREATE INDEX idx_audit_logs_created_brin ON audit_logs USING brin(created_at);
CREATE INDEX idx_audit_logs_org ON audit_logs(org_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- Prevent updates/deletes on audit_logs
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_audit_update
    BEFORE UPDATE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_modification();

CREATE TRIGGER prevent_audit_delete
    BEFORE DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_modification();

-- Disclosure requirements by state
CREATE TABLE disclosure_requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    state CHAR(2) NOT NULL,
    regulation_name VARCHAR(100) NOT NULL, -- e.g., 'CA SB 1235', 'NY CFDL'
    effective_date DATE NOT NULL,
    expiry_date DATE, -- NULL if still active
    required_fields JSONB NOT NULL, -- Array of required disclosure fields
    calculation_rules JSONB NOT NULL, -- Rules for APR, total cost, etc.
    template_url TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_state_regulation UNIQUE (state, regulation_name, effective_date)
);

CREATE INDEX idx_disclosure_requirements_state ON disclosure_requirements(state);
CREATE INDEX idx_disclosure_requirements_active ON disclosure_requirements(state, effective_date)
    WHERE expiry_date IS NULL OR expiry_date > CURRENT_DATE;

-- Disclosures (generated for deals)
CREATE TABLE disclosures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
    requirement_id UUID REFERENCES disclosure_requirements(id),

    -- Disclosure type
    state CHAR(2) NOT NULL,
    regulation_name VARCHAR(100) NOT NULL,
    version VARCHAR(20) NOT NULL, -- Version of the disclosure format

    -- Calculated values (snapshot at time of generation)
    funding_amount DECIMAL(15, 2) NOT NULL,
    total_dollar_cost DECIMAL(15, 2) NOT NULL,
    finance_charge DECIMAL(15, 2),
    term_days INTEGER,
    payment_frequency VARCHAR(20), -- 'daily', 'weekly', 'monthly'
    payment_amount DECIMAL(12, 2),
    number_of_payments INTEGER,
    apr_equivalent DECIMAL(6, 4), -- Annualized rate as decimal

    -- Additional required fields (varies by state)
    disclosure_data JSONB NOT NULL,

    -- Document
    document_url TEXT, -- Generated PDF URL
    document_hash VARCHAR(64), -- SHA-256 hash for integrity

    -- Signing
    signature_required BOOLEAN DEFAULT true,
    signature_url TEXT, -- DocuSign/HelloSign URL
    signature_id VARCHAR(255), -- External signature service ID
    signed_at TIMESTAMP WITH TIME ZONE,
    signed_by VARCHAR(255), -- Name of signer
    signed_ip INET,
    signature_image_url TEXT,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft', 'generated', 'sent', 'viewed', 'signed', 'expired', 'superseded'
    )),
    sent_at TIMESTAMP WITH TIME ZONE,
    viewed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,

    generated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_disclosures_org ON disclosures(org_id);
CREATE INDEX idx_disclosures_deal ON disclosures(deal_id);
CREATE INDEX idx_disclosures_state ON disclosures(state);
CREATE INDEX idx_disclosures_status ON disclosures(status);
CREATE INDEX idx_disclosures_pending ON disclosures(deal_id, status)
    WHERE status NOT IN ('signed', 'expired', 'superseded');

-- Consent records (TCPA, DNC, marketing preferences)
CREATE TABLE consent_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,

    -- Consent type
    consent_type VARCHAR(50) NOT NULL CHECK (consent_type IN (
        'express_written', -- TCPA express written consent for calls/texts
        'prior_express', -- TCPA prior express consent
        'transactional', -- Transactional message consent
        'marketing_email', -- Email marketing opt-in
        'marketing_sms', -- SMS marketing opt-in
        'marketing_call', -- Telemarketing calls
        'data_sharing', -- Third-party data sharing
        'terms_of_service', -- ToS acceptance
        'privacy_policy' -- Privacy policy acceptance
    )),
    channel VARCHAR(20), -- 'email', 'sms', 'call', 'mail', 'all'

    -- Consent details
    is_granted BOOLEAN NOT NULL,
    consent_text TEXT, -- The actual consent language shown/agreed to
    consent_version VARCHAR(20), -- Version of consent form

    -- Collection method
    collection_method VARCHAR(50) NOT NULL CHECK (collection_method IN (
        'web_form', 'phone_recording', 'signed_document',
        'email_opt_in', 'sms_opt_in', 'verbal', 'imported'
    )),
    collection_url TEXT, -- URL where consent was collected
    recording_url TEXT, -- For phone-based consent
    document_url TEXT, -- For signed documents

    -- Evidence
    ip_address INET,
    user_agent TEXT,
    evidence JSONB, -- Additional evidence (e.g., form submission data)

    -- Timestamps
    granted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_reason TEXT,

    collected_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_consent_records_org ON consent_records(org_id);
CREATE INDEX idx_consent_records_contact ON consent_records(contact_id);
CREATE INDEX idx_consent_records_type ON consent_records(consent_type);
CREATE INDEX idx_consent_records_active ON consent_records(contact_id, consent_type, is_granted)
    WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP);

-- DNC (Do Not Call/Contact) list
CREATE TABLE dnc_list (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    -- Contact identifier (one of these must be set)
    phone VARCHAR(20),
    email VARCHAR(255),

    -- Source
    source VARCHAR(50) NOT NULL CHECK (source IN (
        'federal_dnc', -- National DNC Registry
        'state_dnc', -- State-specific DNC
        'internal', -- Customer requested
        'complaint', -- Customer complaint
        'imported' -- Imported from external source
    )),

    -- Scope
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('call', 'sms', 'email', 'all')),

    -- Metadata
    reason TEXT,
    added_by UUID REFERENCES users(id),
    expires_at TIMESTAMP WITH TIME ZONE, -- NULL = permanent

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT dnc_has_identifier CHECK (phone IS NOT NULL OR email IS NOT NULL)
);

CREATE INDEX idx_dnc_list_org ON dnc_list(org_id);
CREATE INDEX idx_dnc_list_phone ON dnc_list(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_dnc_list_email ON dnc_list(email) WHERE email IS NOT NULL;
CREATE INDEX idx_dnc_list_active ON dnc_list(org_id, phone, email)
    WHERE expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP;

-- Compliance alerts
CREATE TABLE compliance_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    -- Alert details
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN (
        'disclosure_missing', -- Deal moved past stage without disclosure
        'disclosure_expired', -- Disclosure expired without signing
        'consent_missing', -- Communication attempted without consent
        'dnc_violation', -- Contact on DNC list was contacted
        'audit_review_required', -- Audit log flagged for review
        'regulation_update' -- New regulation or update
    )),
    severity VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (severity IN (
        'low', 'medium', 'high', 'critical'
    )),

    -- Related entities
    deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    communication_id UUID REFERENCES communications(id) ON DELETE SET NULL,

    -- Description
    title VARCHAR(255) NOT NULL,
    description TEXT,
    remediation_steps TEXT,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN (
        'open', 'acknowledged', 'investigating', 'resolved', 'false_positive'
    )),
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_compliance_alerts_org ON compliance_alerts(org_id);
CREATE INDEX idx_compliance_alerts_type ON compliance_alerts(alert_type);
CREATE INDEX idx_compliance_alerts_severity ON compliance_alerts(severity);
CREATE INDEX idx_compliance_alerts_open ON compliance_alerts(org_id, status, severity)
    WHERE status NOT IN ('resolved', 'false_positive');

-- Insert default disclosure requirements
INSERT INTO disclosure_requirements (state, regulation_name, effective_date, required_fields, calculation_rules) VALUES
(
    'CA', 'SB 1235', '2022-12-09',
    '["funding_amount", "total_dollar_cost", "finance_charge", "term", "payment_amount", "payment_frequency", "apr_equivalent", "prepayment_policy"]',
    '{"apr_calculation": "annualized_rate", "show_apr_until": "2024-01-01"}'
),
(
    'NY', 'CFDL', '2023-08-01',
    '["funding_amount", "total_dollar_cost", "finance_charge", "term", "payment_amount", "payment_frequency", "apr", "prepayment_policy", "collateral", "broker_fees"]',
    '{"apr_calculation": "true_apr", "include_fees_in_apr": true}'
);

-- Update timestamps
CREATE TRIGGER update_disclosure_requirements_updated_at
    BEFORE UPDATE ON disclosure_requirements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_disclosures_updated_at
    BEFORE UPDATE ON disclosures
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_compliance_alerts_updated_at
    BEFORE UPDATE ON compliance_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Comments
COMMENT ON TABLE audit_logs IS 'Immutable audit trail of all data changes';
COMMENT ON TABLE disclosure_requirements IS 'State-specific disclosure requirements (CA SB 1235, NY CFDL, etc.)';
COMMENT ON TABLE disclosures IS 'Generated disclosure documents for deals';
COMMENT ON TABLE consent_records IS 'TCPA and marketing consent tracking';
COMMENT ON TABLE dnc_list IS 'Do Not Call/Contact suppression list';
COMMENT ON TABLE compliance_alerts IS 'Compliance violations and alerts requiring attention';
