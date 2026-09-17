-- ============================================================================
-- Migration 005: Contact Management (CRM)
--
-- Adds contacts, prospect_contacts junction, and contact_activities tables
-- for CRM functionality in Broker OS.
-- ============================================================================

-- Contacts table (individuals at companies)
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    phone_ext VARCHAR(10),
    mobile VARCHAR(20),
    title VARCHAR(100), -- Job title
    role VARCHAR(50) CHECK (role IN (
        'owner', 'ceo', 'cfo', 'controller', 'manager', 'bookkeeper', 'other'
    )),
    preferred_contact_method VARCHAR(20) DEFAULT 'email' CHECK (preferred_contact_method IN (
        'email', 'phone', 'mobile', 'sms'
    )),
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    notes TEXT,
    tags VARCHAR(50)[] DEFAULT '{}',
    source VARCHAR(50), -- Where the contact came from
    is_active BOOLEAN DEFAULT true,
    last_contacted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_contacts_org ON contacts(org_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_phone ON contacts(phone);
CREATE INDEX idx_contacts_name ON contacts(last_name, first_name);
CREATE INDEX idx_contacts_tags ON contacts USING gin(tags);
CREATE INDEX idx_contacts_active ON contacts(org_id, is_active) WHERE is_active = true;

-- Junction table: Prospects <-> Contacts (many-to-many)
CREATE TABLE prospect_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT false,
    relationship VARCHAR(50) DEFAULT 'employee' CHECK (relationship IN (
        'owner', 'decision_maker', 'influencer', 'employee', 'advisor', 'other'
    )),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_prospect_contact UNIQUE (prospect_id, contact_id)
);

CREATE INDEX idx_prospect_contacts_prospect ON prospect_contacts(prospect_id);
CREATE INDEX idx_prospect_contacts_contact ON prospect_contacts(contact_id);
CREATE INDEX idx_prospect_contacts_primary ON prospect_contacts(prospect_id, is_primary)
    WHERE is_primary = true;

-- Contact activities (interactions log)
CREATE TABLE contact_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    activity_type VARCHAR(30) NOT NULL CHECK (activity_type IN (
        'call_outbound', 'call_inbound', 'call_missed',
        'email_sent', 'email_received', 'email_opened', 'email_clicked',
        'sms_sent', 'sms_received',
        'meeting_scheduled', 'meeting_completed', 'meeting_cancelled',
        'note', 'task_created', 'task_completed',
        'status_change', 'document_sent', 'document_signed'
    )),
    subject VARCHAR(255),
    description TEXT,
    outcome VARCHAR(50), -- e.g., 'interested', 'not_interested', 'callback', 'voicemail'
    duration_seconds INTEGER, -- For calls
    metadata JSONB DEFAULT '{}', -- Additional activity-specific data
    scheduled_at TIMESTAMP WITH TIME ZONE, -- For scheduled activities
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_contact_activities_contact ON contact_activities(contact_id);
CREATE INDEX idx_contact_activities_prospect ON contact_activities(prospect_id);
CREATE INDEX idx_contact_activities_user ON contact_activities(user_id);
CREATE INDEX idx_contact_activities_type ON contact_activities(activity_type);
CREATE INDEX idx_contact_activities_created ON contact_activities(created_at DESC);

-- Ensure only one primary contact per prospect
CREATE OR REPLACE FUNCTION ensure_single_primary_contact()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_primary = true THEN
        UPDATE prospect_contacts
        SET is_primary = false
        WHERE prospect_id = NEW.prospect_id
            AND id != NEW.id
            AND is_primary = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_single_primary_contact
    BEFORE INSERT OR UPDATE OF is_primary ON prospect_contacts
    FOR EACH ROW
    WHEN (NEW.is_primary = true)
    EXECUTE FUNCTION ensure_single_primary_contact();

-- Update last_contacted_at on contact when activity is logged
CREATE OR REPLACE FUNCTION update_contact_last_contacted()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.activity_type IN ('call_outbound', 'call_inbound', 'email_sent', 'sms_sent', 'meeting_completed') THEN
        UPDATE contacts
        SET last_contacted_at = NEW.created_at
        WHERE id = NEW.contact_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_contact_last_contacted_trigger
    AFTER INSERT ON contact_activities
    FOR EACH ROW
    EXECUTE FUNCTION update_contact_last_contacted();

-- Update timestamps
CREATE TRIGGER update_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Comments
COMMENT ON TABLE contacts IS 'Individual contacts associated with prospects/companies';
COMMENT ON TABLE prospect_contacts IS 'Junction table linking prospects to their contacts';
COMMENT ON TABLE contact_activities IS 'Log of all interactions with contacts';
