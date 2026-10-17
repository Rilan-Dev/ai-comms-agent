-- Persist Meta-managed WhatsApp templates. Approval state is populated only from Meta responses/status reconciliation.
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  whatsapp_account_id uuid NOT NULL REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
  provider_template_id text,
  name text NOT NULL CHECK (name ~ '^[a-z0-9_]{1,512}$'),
  language text NOT NULL CHECK (length(language) BETWEEN 2 AND 32),
  category text NOT NULL CHECK (category IN ('UTILITY','MARKETING','AUTHENTICATION')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  components jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (whatsapp_account_id, name, language)
);
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_templates_provider_id_uniq
  ON whatsapp_templates(whatsapp_account_id, provider_template_id)
  WHERE provider_template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS whatsapp_templates_approved_lookup_idx
  ON whatsapp_templates(organization_id, whatsapp_account_id, name, language)
  WHERE status='approved';

ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname=current_schema() AND tablename='whatsapp_templates'
      AND policyname='whatsapp_templates_member_visibility'
  ) THEN
    CREATE POLICY whatsapp_templates_member_visibility
      ON whatsapp_templates FOR SELECT TO authenticated
      USING (can_access_organization(organization_id));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname=current_schema() AND tablename='whatsapp_templates'
      AND policyname='whatsapp_templates_admin_manage'
  ) THEN
    CREATE POLICY whatsapp_templates_admin_manage
      ON whatsapp_templates FOR ALL TO authenticated
      USING (can_manage_organization(organization_id))
      WITH CHECK (can_manage_organization(organization_id));
  END IF;
END $$;
