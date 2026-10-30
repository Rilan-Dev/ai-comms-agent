-- Owner-scoped personal WhatsApp recipients. No messaging permissions are granted by this table.
-- Primary/secondary indicate user-chosen roles, NOT verified phone ownership.
CREATE TABLE IF NOT EXISTS personal_whatsapp_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name varchar(120) NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 120),
  phone_e164 varchar(16) NOT NULL CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  recipient_role text NOT NULL DEFAULT 'contact' CHECK (recipient_role IN ('primary','secondary','contact')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS personal_whatsapp_recipients_active_number_unique
ON personal_whatsapp_recipients (organization_id, owner_user_id, phone_e164) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS personal_whatsapp_recipients_personal_role_unique
ON personal_whatsapp_recipients (organization_id, owner_user_id, recipient_role)
WHERE deleted_at IS NULL AND recipient_role IN ('primary','secondary');
CREATE INDEX IF NOT EXISTS personal_whatsapp_recipients_owner_list_idx
ON personal_whatsapp_recipients(organization_id,owner_user_id,recipient_role,display_name)
WHERE deleted_at IS NULL;

-- Defense in depth for role-scoped connections. Application routes also enforce
-- user+organization scoping independently, including when a service DB role bypasses RLS.
ALTER TABLE personal_whatsapp_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY personal_whatsapp_recipients_owner_only ON personal_whatsapp_recipients
  FOR ALL
  USING (owner_user_id=aca.current_app_user_id() AND aca.app_is_org_member(organization_id))
  WITH CHECK (owner_user_id=aca.current_app_user_id() AND aca.app_is_org_member(organization_id));
