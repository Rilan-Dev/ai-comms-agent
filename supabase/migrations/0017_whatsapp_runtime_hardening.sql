-- Phase 4 WhatsApp runtime hardening: provider status/media and inbound agent routing.
-- Forward-only; PostgreSQL 15+.

ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'received';

ALTER TABLE whatsapp_messages
  DROP CONSTRAINT IF EXISTS whatsapp_messages_processing_status_check;

ALTER TABLE whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_processing_status_check
  CHECK (processing_status IN ('received','routed','processing','completed','failed'));

CREATE INDEX IF NOT EXISTS whatsapp_messages_agent_created_idx
  ON whatsapp_messages(agent_id, created_at DESC)
  WHERE agent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS whatsapp_messages_provider_status_idx
  ON whatsapp_messages(provider_message_id, status)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS agent_whatsapp_accounts_account_idx
  ON agent_whatsapp_accounts(whatsapp_account_id);
