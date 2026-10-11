-- Reconcile created_at columns on partially-applied application tables.
-- This migration is intentionally idempotent and only touches tables that are
-- defined by the project schema with a created_at timestamp.
DO $$
DECLARE
  table_name text;
  target_schema text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'organizations',
    'users',
    'organization_memberships',
    'permissions',
    'agents',
    'agent_versions',
    'email_accounts',
    'email_account_credentials',
    'email_folders',
    'email_labels',
    'email_threads',
    'email_messages',
    'email_attachments',
    'email_sync_states',
    'agent_email_accounts',
    'whatsapp_accounts',
    'whatsapp_contacts',
    'whatsapp_messages',
    'agent_whatsapp_accounts',
    'conversations',
    'conversation_messages',
    'conversation_turns',
    'scheduled_jobs',
    'scheduled_job_runs',
    'automation_rules',
    'automation_runs',
    'summaries',
    'summary_sources',
    'agent_policies',
    'agent_tool_bindings',
    'email_action_approvals',
    'ai_provider_configs',
    'ai_usage_events',
    'voice_telemetry',
    'audit_events',
    'api_keys',
    'knowledge_documents',
    'knowledge_chunks',
    'storage_objects',
    'agent_messaging_assignments'
  ] LOOP
    target_schema := NULL;

    SELECT n.nspname
      INTO target_schema
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relname = table_name
       AND c.relkind = 'r'
       AND n.nspname IN ('aca', 'public')
     ORDER BY CASE n.nspname WHEN 'aca' THEN 0 ELSE 1 END
     LIMIT 1;

    IF target_schema IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()',
        target_schema,
        table_name
      );
    END IF;
  END LOOP;
END $$;
