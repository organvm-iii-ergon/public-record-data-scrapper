-- Recover webhook deliveries abandoned when a Worker isolate is evicted.
ALTER TABLE webhook_deliveries ADD COLUMN claimed_at TEXT;

UPDATE webhook_deliveries SET status = 'pending' WHERE status = 'delivering';

CREATE INDEX IF NOT EXISTS idx_webhook_delivery_claim_lease
  ON webhook_deliveries(status, claimed_at, created_at);
