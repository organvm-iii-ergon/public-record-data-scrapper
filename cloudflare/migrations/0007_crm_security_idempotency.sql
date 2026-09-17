-- Encrypt newly connected CRM credentials and prevent duplicate remote creates.
UPDATE crm_integrations
   SET api_key = 'credential-removed-reconnect-required', status = 'error'
 WHERE api_key NOT LIKE 'enc:v1:%';

ALTER TABLE crm_push_logs ADD COLUMN idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_push_logs_idempotency
  ON crm_push_logs(idempotency_key) WHERE idempotency_key IS NOT NULL;
