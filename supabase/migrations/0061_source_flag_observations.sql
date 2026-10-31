-- Provider observations belong to an exact canonical source identity. They do
-- not acknowledge personal review or imply a fresh full-mailbox inventory.
ALTER TABLE email_messages
 ADD COLUMN provider_flags_observed_at timestamptz,
 ADD COLUMN provider_flags_observation_revision text,
 ADD COLUMN provider_flags_requested_at timestamptz,
 ADD CONSTRAINT email_provider_observation_pair CHECK
  ((provider_flags_observed_at IS NULL)=(provider_flags_observation_revision IS NULL)),
 ADD CONSTRAINT email_provider_observation_revision CHECK
  (provider_flags_observation_revision IS NULL OR provider_flags_observation_revision ~ '^[0-9a-f]{64}$');
ALTER TABLE email_sync_states ADD COLUMN provider_flags_retry_at timestamptz,ADD COLUMN provider_flags_focus_error text;
CREATE INDEX email_message_flags_requested ON email_messages(organization_id,email_account_id,provider_flags_requested_at,id)
 WHERE provider_flags_requested_at IS NOT NULL;
CREATE FUNCTION mail_provider_observation_revision(p_message_id uuid) RETURNS text
 LANGUAGE sql STABLE SET search_path=aca,pg_temp AS $$
 SELECT encode(sha256(convert_to(jsonb_build_array(m.organization_id,m.email_account_id,m.id,
   m.provider_message_id,m.internet_message_id,briefing_content_revision(m.id))::text,'UTF8')),'hex')
 FROM email_messages m WHERE m.id=p_message_id AND m.provider_message_id IS NOT NULL
$$;
