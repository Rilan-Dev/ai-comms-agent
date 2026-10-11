-- Phase 4: persisted agent policy/configuration boundaries.
CREATE TABLE IF NOT EXISTS agent_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL UNIQUE REFERENCES agents(id) ON DELETE CASCADE,
  security_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  allowed_tools text[] NOT NULL DEFAULT '{}'::text[],
  allowed_senders text[] NOT NULL DEFAULT '{}'::text[],
  blocked_senders text[] NOT NULL DEFAULT '{}'::text[],
  rate_limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_tool_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_id, tool_name)
);

CREATE INDEX IF NOT EXISTS agent_tool_bindings_agent_enabled_idx
  ON agent_tool_bindings(agent_id, enabled);

DROP TRIGGER IF EXISTS set_updated_at ON agent_policies;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON agent_policies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON agent_tool_bindings;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON agent_tool_bindings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE agent_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tool_bindings ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_policies_org_member ON agent_policies
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM agents a
    WHERE a.id = agent_policies.agent_id
      AND can_access_organization(a.organization_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM agents a
    WHERE a.id = agent_policies.agent_id
      AND can_manage_organization(a.organization_id)
  ));

CREATE POLICY agent_tool_bindings_org_member ON agent_tool_bindings
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM agents a
    WHERE a.id = agent_tool_bindings.agent_id
      AND can_access_organization(a.organization_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM agents a
    WHERE a.id = agent_tool_bindings.agent_id
      AND can_manage_organization(a.organization_id)
  ));
