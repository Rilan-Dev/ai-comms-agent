-- Dedicated, fail-closed approval records for WhatsApp outbound messages.
-- An action is not a send. Only an authenticated approval handler may queue it.
CREATE TABLE IF NOT EXISTS whatsapp_send_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  whatsapp_account_id uuid NOT NULL REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  agent_binding_required boolean NOT NULL DEFAULT false,
  requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  recipient_phone text NOT NULL CHECK (recipient_phone ~ '^\\+[1-9][0-9]{7,14}$'),
  message_body text NOT NULL CHECK (length(message_body) BETWEEN 1 AND 4096),
  payload_type text NOT NULL DEFAULT 'text' CHECK (payload_type IN ('text','template')),
  template_name text,
  template_language text,
  template_parameters jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','queued','requires_template','expired')),
  idempotency_key text,
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  queued_message_id uuid REFERENCES whatsapp_messages(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (payload_type = 'text' AND template_name IS NULL AND template_language IS NULL)
    OR
    (payload_type = 'template' AND template_name IS NOT NULL AND template_language IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_send_actions_idempotency_uniq
  ON whatsapp_send_actions(organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS whatsapp_send_actions_pending_idx
  ON whatsapp_send_actions(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS whatsapp_send_actions_account_idx
  ON whatsapp_send_actions(whatsapp_account_id, status, created_at DESC);

ALTER TABLE whatsapp_send_actions ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'whatsapp_send_actions'
      AND policyname = 'whatsapp_send_actions_member_visibility'
  ) THEN
    CREATE POLICY whatsapp_send_actions_member_visibility
      ON whatsapp_send_actions FOR SELECT TO authenticated
      USING (can_access_organization(organization_id));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'whatsapp_send_actions'
      AND policyname = 'whatsapp_send_actions_admin_manage'
  ) THEN
    CREATE POLICY whatsapp_send_actions_admin_manage
      ON whatsapp_send_actions FOR ALL TO authenticated
      USING (can_manage_organization(organization_id))
      WITH CHECK (can_manage_organization(organization_id));
  END IF;
END $$;
