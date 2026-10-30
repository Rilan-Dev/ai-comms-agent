ALTER TABLE automation_event_outbox DROP CONSTRAINT IF EXISTS automation_event_outbox_event_type_check;
ALTER TABLE automation_event_outbox ADD CONSTRAINT automation_event_outbox_event_type_check CHECK(event_type IN ('email.received','email.action_required','whatsapp.received'));
CREATE INDEX IF NOT EXISTS whatsapp_messages_automation_inbound_idx ON whatsapp_messages(created_at,id) WHERE direction='inbound' AND provider_message_id IS NOT NULL;
