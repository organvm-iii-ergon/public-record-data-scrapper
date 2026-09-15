-- Migration: 20260915_webhook_subscriptions
-- Tenant webhook subscriptions and delivery log with DLQ tracking

-- Tenant webhook subscriptions
CREATE TABLE webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,  -- stored hashed (SHA-256)
  events TEXT[] NOT NULL DEFAULT '{}',  -- ['prospect.created', '*']
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Delivery log with DLQ tracking
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending|delivered|failed|dead
  attempt_count INT NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  response_status INT,
  response_body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status, next_retry_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX idx_webhook_subscriptions_org ON webhook_subscriptions(org_id);

-- Auto-update updated_at on webhook_subscriptions
CREATE OR REPLACE FUNCTION set_webhook_subscriptions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_webhook_subscriptions_updated_at
  BEFORE UPDATE ON webhook_subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_webhook_subscriptions_updated_at();
