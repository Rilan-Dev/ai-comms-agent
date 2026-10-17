-- Preserve the requirement to re-check agent/account binding even if the agent is later deleted.
ALTER TABLE whatsapp_send_actions
  ADD COLUMN IF NOT EXISTS agent_binding_required boolean NOT NULL DEFAULT false;
