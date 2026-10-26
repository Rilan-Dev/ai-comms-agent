-- Organization-scoped AI runtime configuration. Secrets remain envelope-encrypted.
CREATE TABLE IF NOT EXISTS organization_ai_runtime_settings (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  default_provider text NOT NULL DEFAULT 'openai' CHECK (default_provider IN ('openai','gemini','sarvam')),
  knowledge_base_id text NOT NULL DEFAULT '',
  realtime_voice_provider text NOT NULL DEFAULT 'openai' CHECK (realtime_voice_provider IN ('openai','gemini','sarvam','elevenlabs')),
  realtime_voice_model text NOT NULL DEFAULT 'gpt-realtime-2.1-mini',
  voice_id text NOT NULL DEFAULT 'alloy',
  temperature numeric(4,3) NOT NULL DEFAULT 0.8 CHECK (temperature >= 0 AND temperature <= 2),
  max_tokens integer NOT NULL DEFAULT 1500 CHECK (max_tokens BETWEEN 1 AND 32768),
  system_prompt text NOT NULL DEFAULT 'You are a helpful AI assistant for the user''s communication workspace.',
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS organization_ai_runtime_settings_updated_idx ON organization_ai_runtime_settings(updated_at DESC);
ALTER TABLE organization_ai_runtime_settings ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'organization_ai_runtime_settings' AND policyname = 'organization_ai_runtime_settings_admin_manage') THEN
    EXECUTE $policy$CREATE POLICY organization_ai_runtime_settings_admin_manage ON organization_ai_runtime_settings FOR ALL TO authenticated USING (can_manage_organization(organization_id)) WITH CHECK (can_manage_organization(organization_id))$policy$;
  END IF;
END $$;
