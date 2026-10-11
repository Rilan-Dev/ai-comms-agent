-- Phase 4: cross-surface execution correlation propagation.
-- Forward-only: existing rows remain valid; new work can carry the originating
-- execution/request correlation into worker-owned actions and provider messages.

ALTER TABLE email_actions
  ADD COLUMN IF NOT EXISTS correlation_id uuid;

CREATE INDEX IF NOT EXISTS email_actions_org_correlation_idx
  ON email_actions(organization_id, correlation_id)
  WHERE correlation_id IS NOT NULL;

ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS correlation_id uuid;

CREATE INDEX IF NOT EXISTS whatsapp_messages_org_correlation_idx
  ON whatsapp_messages(organization_id, correlation_id)
  WHERE correlation_id IS NOT NULL;
