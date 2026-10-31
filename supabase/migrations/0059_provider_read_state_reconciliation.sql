-- Read-only provider metadata sweeps are independent of personal review and
-- of the ingestion/history cursor. An incomplete sweep is never fresh coverage.
ALTER TABLE email_sync_states
  ADD COLUMN provider_flags_cursor uuid,
  ADD COLUMN provider_flags_started_at timestamptz,
  ADD COLUMN provider_flags_checked_at timestamptz,
  ADD COLUMN provider_flags_error text;

CREATE INDEX email_messages_flag_sweep_idx
  ON email_messages(organization_id,email_account_id,id)
  WHERE NOT is_draft AND NOT is_sent AND provider_message_id IS NOT NULL;
