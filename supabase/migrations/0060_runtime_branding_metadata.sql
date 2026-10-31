-- Preserve the bytes/checksums of already-applied migrations. Branding changes
-- belong in this forward migration and never rewrite saved organization prompts.
ALTER TABLE organization_ai_runtime_settings ALTER COLUMN system_prompt
  SET DEFAULT 'You are a helpful AI assistant for the user''s communication workspace.';
COMMENT ON TABLE voice_sessions IS
  'Host-owned voice session metadata; the agent runtime owns realtime transport and provider lifecycle.';
COMMENT ON TABLE voice_telemetry IS
  'Host-owned persistence for agent realtime latency/quality telemetry; audio is never persisted.';
COMMENT ON TABLE email_knowledge_sync_jobs IS
  'Durable email vector upsert, message deletion, and account purge outbox. Complete only after agent RAG/vector operations are confirmed.';
