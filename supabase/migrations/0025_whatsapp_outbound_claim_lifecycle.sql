-- Claimable WhatsApp outbound lifecycle.
-- A worker crash after Meta accepts a message must not make the queued row
-- eligible for automatic resend; abandoned executions are failed closed.
ALTER TABLE whatsapp_messages
  DROP CONSTRAINT IF EXISTS whatsapp_messages_status_check;

ALTER TABLE whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_status_check
  CHECK (status IN ('received','queued','executing','sent','delivered','read','failed'));

CREATE INDEX IF NOT EXISTS whatsapp_messages_outbound_claim_idx
  ON whatsapp_messages(created_at, id)
  WHERE direction = 'outbound' AND status = 'queued';
