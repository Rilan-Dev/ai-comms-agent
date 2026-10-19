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

-- Preserve source navigation for private manifests created by the earlier C2
-- publisher. Old review rows remain in the explicit legacy scope: never borrow
-- their acknowledgement into a new grant version without proven ownership.
WITH ranked AS (
 SELECT id,row_number() OVER(PARTITION BY summary_id ORDER BY email_message_id,id)-1 ordinal
 FROM summary_sources WHERE owner_user_id IS NOT NULL
)
UPDATE summary_sources s SET source_ordinal=r.ordinal FROM ranked r WHERE s.id=r.id;
UPDATE summary_sources s SET source_thread_id=m.thread_id,
 source_received_at=coalesce(m.received_at,m.created_at)
 FROM email_messages m WHERE s.owner_user_id IS NOT NULL AND s.email_message_id=m.id
 AND s.organization_id=m.organization_id AND s.mailbox_id=m.email_account_id;
UPDATE summaries s SET selected_source_manifest=(
 SELECT jsonb_agg(jsonb_build_object('messageId',p.email_message_id,'mailboxId',p.mailbox_id,
   'threadId',p.source_thread_id,'contentRevision',p.content_revision) ORDER BY p.source_ordinal)
 FROM summary_sources p WHERE p.summary_id=s.id
) WHERE s.owner_user_id IS NOT NULL AND s.selected_source_manifest='[]'::jsonb
 AND EXISTS(SELECT 1 FROM summary_sources p WHERE p.summary_id=s.id);
