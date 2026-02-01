-- ============================================================================
-- Migration 007: Communications Engine
--
-- Adds unified communications tables for email, SMS, and call tracking.
-- ============================================================================

-- Communication templates
CREATE TABLE communication_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'sms', 'call_script')),
    category VARCHAR(50) CHECK (category IN (
        'initial_outreach', 'follow_up', 'application_request',
        'document_request', 'approval_notification', 'funding_notification',
        'check_in', 'renewal', 'other'
    )),
    subject VARCHAR(255), -- For email
    body TEXT NOT NULL,
    variables VARCHAR(50)[] DEFAULT '{}', -- e.g., ['companyName', 'contactName', 'dealAmount']
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_comm_templates_org ON communication_templates(org_id);
CREATE INDEX idx_comm_templates_channel ON communication_templates(channel);
CREATE INDEX idx_comm_templates_category ON communication_templates(category);
CREATE INDEX idx_comm_templates_active ON communication_templates(org_id, is_active) WHERE is_active = true;

-- Communications (sent messages)
CREATE TABLE communications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
    template_id UUID REFERENCES communication_templates(id) ON DELETE SET NULL,
    sent_by UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Channel info
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'sms', 'call')),
    direction VARCHAR(10) NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),

    -- For email
    from_address VARCHAR(255),
    to_address VARCHAR(255),
    cc_addresses VARCHAR(255)[],
    bcc_addresses VARCHAR(255)[],
    subject VARCHAR(255),

    -- For SMS/Call
    from_phone VARCHAR(20),
    to_phone VARCHAR(20),

    -- Content
    body TEXT,
    body_html TEXT, -- For rich email
    attachments JSONB DEFAULT '[]', -- Array of {name, url, size, mimeType}

    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'queued', 'sent', 'delivered', 'opened', 'clicked',
        'bounced', 'failed', 'answered', 'no_answer', 'voicemail', 'busy'
    )),
    status_reason TEXT,

    -- Call-specific
    call_duration_seconds INTEGER,
    call_recording_url TEXT,

    -- Tracking
    external_id VARCHAR(255), -- Twilio/SendGrid message ID
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    failure_reason TEXT,

    -- Scheduling
    scheduled_for TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_communications_org ON communications(org_id);
CREATE INDEX idx_communications_contact ON communications(contact_id);
CREATE INDEX idx_communications_prospect ON communications(prospect_id);
CREATE INDEX idx_communications_deal ON communications(deal_id);
CREATE INDEX idx_communications_channel ON communications(channel);
CREATE INDEX idx_communications_status ON communications(status);
CREATE INDEX idx_communications_direction ON communications(direction);
CREATE INDEX idx_communications_sent ON communications(sent_at DESC);
CREATE INDEX idx_communications_scheduled ON communications(scheduled_for)
    WHERE scheduled_for IS NOT NULL AND status = 'pending';
CREATE INDEX idx_communications_external ON communications(external_id)
    WHERE external_id IS NOT NULL;

-- Communication events (webhooks from providers)
CREATE TABLE communication_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    communication_id UUID REFERENCES communications(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- e.g., 'delivered', 'opened', 'clicked', 'bounced'
    event_data JSONB DEFAULT '{}',
    external_timestamp TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_comm_events_communication ON communication_events(communication_id);
CREATE INDEX idx_comm_events_type ON communication_events(event_type);
CREATE INDEX idx_comm_events_created ON communication_events(created_at DESC);

-- Follow-up reminders
CREATE TABLE follow_up_reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES users(id) ON DELETE CASCADE,

    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    due_at TIMESTAMP WITH TIME ZONE NOT NULL,
    reminder_at TIMESTAMP WITH TIME ZONE, -- When to send notification

    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by UUID REFERENCES users(id),

    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_follow_ups_org ON follow_up_reminders(org_id);
CREATE INDEX idx_follow_ups_assigned ON follow_up_reminders(assigned_to);
CREATE INDEX idx_follow_ups_contact ON follow_up_reminders(contact_id);
CREATE INDEX idx_follow_ups_due ON follow_up_reminders(due_at)
    WHERE is_completed = false;
CREATE INDEX idx_follow_ups_reminder ON follow_up_reminders(reminder_at)
    WHERE is_completed = false AND reminder_at IS NOT NULL;

-- Update communication status based on events
CREATE OR REPLACE FUNCTION update_communication_from_event()
RETURNS TRIGGER AS $$
BEGIN
    -- Update communication based on event type
    UPDATE communications
    SET
        status = CASE
            WHEN NEW.event_type = 'delivered' THEN 'delivered'
            WHEN NEW.event_type = 'opened' THEN 'opened'
            WHEN NEW.event_type = 'clicked' THEN 'clicked'
            WHEN NEW.event_type = 'bounced' THEN 'bounced'
            WHEN NEW.event_type = 'failed' THEN 'failed'
            ELSE status
        END,
        delivered_at = CASE WHEN NEW.event_type = 'delivered' THEN COALESCE(NEW.external_timestamp, NOW()) ELSE delivered_at END,
        opened_at = CASE WHEN NEW.event_type = 'opened' THEN COALESCE(NEW.external_timestamp, NOW()) ELSE opened_at END,
        clicked_at = CASE WHEN NEW.event_type = 'clicked' THEN COALESCE(NEW.external_timestamp, NOW()) ELSE clicked_at END,
        failed_at = CASE WHEN NEW.event_type IN ('bounced', 'failed') THEN COALESCE(NEW.external_timestamp, NOW()) ELSE failed_at END,
        failure_reason = CASE WHEN NEW.event_type IN ('bounced', 'failed') THEN NEW.event_data->>'reason' ELSE failure_reason END
    WHERE id = NEW.communication_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_communication_from_event_trigger
    AFTER INSERT ON communication_events
    FOR EACH ROW
    EXECUTE FUNCTION update_communication_from_event();

-- Update timestamps
CREATE TRIGGER update_communication_templates_updated_at
    BEFORE UPDATE ON communication_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_follow_up_reminders_updated_at
    BEFORE UPDATE ON follow_up_reminders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Comments
COMMENT ON TABLE communication_templates IS 'Reusable templates for emails, SMS, and call scripts';
COMMENT ON TABLE communications IS 'Log of all communications sent/received';
COMMENT ON TABLE communication_events IS 'Webhook events from email/SMS providers';
COMMENT ON TABLE follow_up_reminders IS 'Scheduled follow-up tasks for contacts';
