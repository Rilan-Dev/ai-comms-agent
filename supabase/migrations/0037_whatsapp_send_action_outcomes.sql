-- Track post-approval outcomes without treating queue acceptance as provider success.
ALTER TABLE whatsapp_send_actions
  DROP CONSTRAINT IF EXISTS whatsapp_send_actions_status_check;
ALTER TABLE whatsapp_send_actions
  ADD CONSTRAINT whatsapp_send_actions_status_check
  CHECK (status IN ('pending','approved','rejected','queued','sent','failed','requires_template','expired'));
