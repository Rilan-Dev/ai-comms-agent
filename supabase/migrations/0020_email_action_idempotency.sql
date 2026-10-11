-- Cross-surface sensitive-action idempotency.
-- A stable client/agent request key prevents duplicate email approval actions
-- when a caller retries the same request after a timeout.

ALTER TABLE email_actions
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS email_actions_org_idempotency_uniq
  ON email_actions(organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
