-- C2: durable source-revision coverage. No provider read state is modified.
CREATE TABLE briefing_selection_scopes (
 organization_id uuid NOT NULL, owner_user_id uuid NOT NULL, agent_id uuid NOT NULL, scope_version text NOT NULL,
 history_start timestamptz NOT NULL,
 PRIMARY KEY(organization_id,owner_user_id,agent_id,scope_version),
 FOREIGN KEY(organization_id,owner_user_id) REFERENCES organization_memberships(organization_id,user_id) ON DELETE CASCADE,
 FOREIGN KEY(organization_id,agent_id) REFERENCES agents(organization_id,id) ON DELETE CASCADE
);
ALTER TABLE mail_review_items ADD COLUMN scope_version text NOT NULL DEFAULT 'legacy';
ALTER TABLE mail_review_items DROP CONSTRAINT mail_review_items_pkey;
ALTER TABLE mail_review_items ADD PRIMARY KEY(organization_id,owner_user_id,agent_id,scope_version,message_id,content_revision,item_id);
CREATE INDEX briefing_review_scope_items ON mail_review_items(organization_id,owner_user_id,agent_id,scope_version,item_id);
CREATE TABLE briefing_review_sources (
 organization_id uuid NOT NULL,owner_user_id uuid NOT NULL,agent_id uuid NOT NULL,scope_version text NOT NULL,
 mailbox_id uuid NOT NULL,message_id uuid NOT NULL,content_revision text NOT NULL,
 representation_complete boolean NOT NULL DEFAULT false,reviewed_at timestamptz,
 PRIMARY KEY(organization_id,owner_user_id,agent_id,scope_version,message_id,content_revision),
 FOREIGN KEY(organization_id,owner_user_id,agent_id,scope_version) REFERENCES briefing_selection_scopes ON DELETE CASCADE,
 FOREIGN KEY(organization_id,mailbox_id,message_id) REFERENCES email_messages(organization_id,email_account_id,id) ON DELETE CASCADE,
 CHECK(reviewed_at IS NULL OR representation_complete)
);
CREATE INDEX briefing_fully_reviewed ON briefing_review_sources(organization_id,owner_user_id,agent_id,scope_version,message_id,content_revision) WHERE reviewed_at IS NOT NULL;
ALTER TABLE summary_sources
 ADD COLUMN source_ordinal integer CHECK(source_ordinal>=0),
 ADD COLUMN source_thread_id uuid,
 ADD COLUMN source_received_at timestamptz,
 ADD COLUMN estimated_input_tokens integer CHECK(estimated_input_tokens>=0),
 ADD CONSTRAINT briefing_source_ordinal UNIQUE(summary_id,source_ordinal);
ALTER TABLE briefing_generation_jobs ADD COLUMN request_fingerprint text;
ALTER TABLE briefing_generation_batches ADD COLUMN source_ids uuid[] NOT NULL DEFAULT '{}',
 ADD COLUMN partial_representation boolean NOT NULL DEFAULT false,
 ADD COLUMN lease_token uuid;
CREATE INDEX briefing_candidate_scope ON email_messages(organization_id,email_account_id,id);
ALTER TABLE briefing_selection_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefing_review_sources ENABLE ROW LEVEL SECURITY;
-- No direct client policies: same trusted application boundary as migration0050.
