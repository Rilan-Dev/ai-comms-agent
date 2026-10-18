-- C1: private derived mail storage. Canonical messages stay in email_messages.
-- Legacy rows retain their policies; restrictive guards deny personal rows under
-- EVERY permissive policy. Only trusted repository services return private text.
INSERT INTO permissions(name,description) VALUES
 ('briefing.access.manage','Assign and revoke personal briefing mailbox access')
ON CONFLICT(name) DO UPDATE SET description=EXCLUDED.description;

ALTER TABLE agents ADD CONSTRAINT briefing_agents_org_id UNIQUE(organization_id,id);
ALTER TABLE email_accounts ADD CONSTRAINT briefing_accounts_org_id UNIQUE(organization_id,id);
ALTER TABLE email_messages ADD CONSTRAINT briefing_messages_org_mail_id UNIQUE(organization_id,email_account_id,id);

CREATE TABLE briefing_mailbox_grants (
 organization_id uuid NOT NULL,
 user_id uuid NOT NULL,
 mailbox_id uuid NOT NULL,
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 assigned_by uuid REFERENCES users(id),
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 2000),
 assigned_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz,
 PRIMARY KEY(organization_id,user_id,mailbox_id),
 FOREIGN KEY(organization_id,user_id) REFERENCES organization_memberships(organization_id,user_id) ON DELETE CASCADE,
 FOREIGN KEY(organization_id,mailbox_id) REFERENCES email_accounts(organization_id,id) ON DELETE CASCADE
);
CREATE INDEX briefing_grants_live ON briefing_mailbox_grants(organization_id,user_id,mailbox_id,version) WHERE revoked_at IS NULL;
-- Creator-only seed, with proven active relationship; never grant all members.
INSERT INTO briefing_mailbox_grants(organization_id,user_id,mailbox_id,assigned_by,reason)
 SELECT e.organization_id,e.created_by,e.id,e.created_by,'Proven active mailbox creator at migration 0050'
 FROM email_accounts e JOIN organization_memberships m ON m.organization_id=e.organization_id AND m.user_id=e.created_by
 JOIN users u ON u.id=m.user_id JOIN organizations o ON o.id=e.organization_id
 WHERE m.status='active' AND m.role IN ('owner','admin','member') AND u.status='active' AND u.deleted_at IS NULL
 AND o.status='active' AND o.deleted_at IS NULL AND e.deleted_at IS NULL AND e.status::text IN ('active','connected');

ALTER TABLE summaries
 ADD COLUMN owner_user_id uuid,
 ADD COLUMN mailbox_ids uuid[] NOT NULL DEFAULT '{}',
 ADD COLUMN briefing_status text CHECK(briefing_status IN ('pending','partial','ready','failed','invalidated')),
 ADD COLUMN briefing_mode text CHECK(briefing_mode IN ('catch_up','scheduled')),
 ADD COLUMN scope_version text,
 ADD COLUMN content_version text,
 ADD COLUMN model_version text,
 ADD COLUMN prompt_version text,
 ADD COLUMN schema_version text,
 ADD COLUMN coverage_metadata jsonb NOT NULL DEFAULT '{}',
 ADD COLUMN selected_source_manifest jsonb NOT NULL DEFAULT '[]',
 ADD COLUMN derived_expires_at timestamptz NOT NULL DEFAULT (now()+interval '30 days'),
 ADD CONSTRAINT briefing_summary_owner FOREIGN KEY(organization_id,owner_user_id) REFERENCES organization_memberships(organization_id,user_id) ON DELETE CASCADE,
 ADD CONSTRAINT briefing_summary_agent FOREIGN KEY(organization_id,agent_id) REFERENCES agents(organization_id,id),
 ADD CONSTRAINT briefing_summary_scoped_id UNIQUE(organization_id,owner_user_id,agent_id,id),
 ADD CONSTRAINT briefing_summary_private CHECK((summary_type<>'personal_briefing' OR owner_user_id IS NOT NULL) AND (owner_user_id IS NULL OR (cardinality(mailbox_ids)>0 AND briefing_status IS NOT NULL AND briefing_mode IS NOT NULL AND scope_version IS NOT NULL AND period_end>=period_start)));
CREATE INDEX briefing_summary_scope_created ON summaries(organization_id,owner_user_id,agent_id,created_at DESC,id DESC) WHERE owner_user_id IS NOT NULL;
CREATE INDEX briefing_summary_retention ON summaries(derived_expires_at) WHERE owner_user_id IS NOT NULL;

CREATE FUNCTION briefing_check_summary_mailboxes() RETURNS trigger LANGUAGE plpgsql SET search_path=aca,pg_temp AS $$
BEGIN
 IF NEW.owner_user_id IS NOT NULL AND
   (SELECT count(*) FROM email_accounts e WHERE e.organization_id=NEW.organization_id AND e.id=ANY(NEW.mailbox_ids)) <> cardinality(NEW.mailbox_ids) THEN
   RAISE EXCEPTION 'Summary mailbox scope mismatch' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER briefing_summary_mailboxes BEFORE INSERT OR UPDATE ON summaries FOR EACH ROW EXECUTE FUNCTION briefing_check_summary_mailboxes();

ALTER TABLE summary_sources
 ADD COLUMN owner_user_id uuid,
 ADD COLUMN agent_id uuid,
 ADD COLUMN mailbox_id uuid,
 ADD COLUMN content_revision text,
 ADD COLUMN item_metadata jsonb NOT NULL DEFAULT '{}',
 ADD CONSTRAINT briefing_source_summary FOREIGN KEY(organization_id,owner_user_id,agent_id,summary_id) REFERENCES summaries(organization_id,owner_user_id,agent_id,id) ON DELETE CASCADE,
 ADD CONSTRAINT briefing_source_message FOREIGN KEY(organization_id,mailbox_id,email_message_id) REFERENCES email_messages(organization_id,email_account_id,id) ON DELETE SET NULL (email_message_id),
 ADD CONSTRAINT briefing_source_private CHECK(owner_user_id IS NULL OR (organization_id IS NOT NULL AND agent_id IS NOT NULL AND mailbox_id IS NOT NULL AND content_revision IS NOT NULL));
-- A source cannot be disguised as legacy while linked to a private summary.
CREATE FUNCTION briefing_check_source_owner() RETURNS trigger LANGUAGE plpgsql SET search_path=aca,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM summaries s WHERE s.id=NEW.summary_id AND s.owner_user_id IS NOT DISTINCT FROM NEW.owner_user_id AND (s.owner_user_id IS NULL OR (s.organization_id=NEW.organization_id AND s.agent_id=NEW.agent_id AND NEW.mailbox_id=ANY(s.mailbox_ids)))) THEN
   RAISE EXCEPTION 'Summary source ownership mismatch' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER briefing_source_owner BEFORE INSERT OR UPDATE ON summary_sources FOR EACH ROW EXECUTE FUNCTION briefing_check_source_owner();
CREATE INDEX briefing_source_scope ON summary_sources(organization_id,owner_user_id,agent_id,summary_id);

-- Preserve deleted private source references as tombstones so derived reads
-- invalidate rather than silently losing provenance. Legacy sources keep their
-- original at-least-one-source requirement.
ALTER TABLE summary_sources DROP CONSTRAINT summary_sources_check;
ALTER TABLE summary_sources ADD CONSTRAINT summary_sources_check CHECK (
 (owner_user_id IS NOT NULL AND whatsapp_message_id IS NULL)
 OR (owner_user_id IS NULL AND (email_message_id IS NOT NULL OR whatsapp_message_id IS NOT NULL))
);

CREATE TABLE user_mail_activity (
 organization_id uuid NOT NULL,user_id uuid NOT NULL,agent_id uuid NOT NULL,
 last_foreground_at timestamptz NOT NULL,
 PRIMARY KEY(organization_id,user_id,agent_id),
 FOREIGN KEY(organization_id,user_id) REFERENCES organization_memberships(organization_id,user_id) ON DELETE CASCADE,
 FOREIGN KEY(organization_id,agent_id) REFERENCES agents(organization_id,id) ON DELETE CASCADE
);
CREATE TABLE mail_review_items (
 organization_id uuid NOT NULL,owner_user_id uuid NOT NULL,agent_id uuid NOT NULL,
 mailbox_id uuid NOT NULL,message_id uuid NOT NULL,content_revision text NOT NULL,
 item_id text NOT NULL,representation text NOT NULL CHECK(representation IN ('complete','partial')),
 acknowledged_at timestamptz,snoozed_until timestamptz,
 PRIMARY KEY(organization_id,owner_user_id,agent_id,message_id,content_revision,item_id),
 FOREIGN KEY(organization_id,owner_user_id) REFERENCES organization_memberships(organization_id,user_id) ON DELETE CASCADE,
 FOREIGN KEY(organization_id,agent_id) REFERENCES agents(organization_id,id) ON DELETE CASCADE,
 FOREIGN KEY(organization_id,mailbox_id,message_id) REFERENCES email_messages(organization_id,email_account_id,id) ON DELETE CASCADE,
 CHECK(acknowledged_at IS NULL OR representation='complete')
);
CREATE INDEX briefing_review_selection ON mail_review_items(organization_id,owner_user_id,agent_id,mailbox_id,message_id,content_revision) WHERE acknowledged_at IS NOT NULL;
CREATE TABLE briefing_generation_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,owner_user_id uuid NOT NULL,agent_id uuid NOT NULL,
 summary_id uuid,request_key text NOT NULL,scope_version text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','partial','ready','failed','invalidated')),
 attempt integer NOT NULL DEFAULT 0 CHECK(attempt>=0),lease_owner text,lease_expires_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,owner_user_id) REFERENCES organization_memberships(organization_id,user_id) ON DELETE CASCADE,
 FOREIGN KEY(organization_id,agent_id) REFERENCES agents(organization_id,id) ON DELETE CASCADE,
 FOREIGN KEY(organization_id,owner_user_id,agent_id,summary_id) REFERENCES summaries(organization_id,owner_user_id,agent_id,id) ON DELETE CASCADE,
 UNIQUE(organization_id,owner_user_id,agent_id,scope_version,request_key),UNIQUE(organization_id,owner_user_id,agent_id,id)
);
CREATE INDEX briefing_job_reclaim ON briefing_generation_jobs(status,lease_expires_at) WHERE status IN ('pending','running','partial');
CREATE TABLE briefing_generation_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,owner_user_id uuid NOT NULL,agent_id uuid NOT NULL,job_id uuid NOT NULL,
 ordinal integer NOT NULL CHECK(ordinal>=0),source_count integer NOT NULL CHECK(source_count BETWEEN 0 AND 50),
 estimated_input_tokens integer NOT NULL CHECK(estimated_input_tokens BETWEEN 0 AND 12000),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','ready','failed')),
 attempt integer NOT NULL DEFAULT 0,lease_owner text,lease_expires_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,owner_user_id,agent_id,job_id) REFERENCES briefing_generation_jobs(organization_id,owner_user_id,agent_id,id) ON DELETE CASCADE,
 UNIQUE(job_id,ordinal)
);

-- A revision changes for relevant content anywhere in the thread, including a
-- new reply, and excludes unread/folder/star/label and provider timestamp changes.
CREATE FUNCTION briefing_content_revision(p_message_id uuid) RETURNS text
 LANGUAGE sql STABLE SET search_path=aca,pg_temp AS $$
 SELECT encode(sha256(convert_to(jsonb_build_array(m.id,m.thread_id,m.email_account_id,
  (SELECT jsonb_agg(jsonb_build_array(t.id,t.subject,t.text_body,t.html_body,t.html_body_sanitized,t.snippet,t.headers,t.from_address,t.from_email,t.from_name,t.to_addresses,t.cc_addresses,t.bcc_addresses,t.to_recipients,t.cc_recipients,t.bcc_recipients,t.reply_to_recipients,t.received_at,t.sent_at,t.in_reply_to,t.references_header) ORDER BY t.id)
   FROM email_messages t WHERE (t.id=m.id OR t.thread_id=m.thread_id) AND t.email_account_id=m.email_account_id AND t.organization_id=m.organization_id))::text,'UTF8')),'hex')
 FROM email_messages m WHERE m.id=p_message_id
$$;

-- RESTRICTIVE policies compose with (AND) every existing permissive policy,
-- including policies installed before/after this migration. No direct SQL text
-- reads of personal summaries bypass source revalidation by the repository.
CREATE POLICY briefing_private_summary_guard ON summaries AS RESTRICTIVE FOR ALL TO PUBLIC
 USING(owner_user_id IS NULL) WITH CHECK(owner_user_id IS NULL);
CREATE POLICY briefing_private_source_guard ON summary_sources AS RESTRICTIVE FOR ALL TO PUBLIC
 USING(owner_user_id IS NULL AND EXISTS(SELECT 1 FROM summaries s WHERE s.id=summary_id AND s.owner_user_id IS NULL))
 WITH CHECK(owner_user_id IS NULL AND EXISTS(SELECT 1 FROM summaries s WHERE s.id=summary_id AND s.owner_user_id IS NULL));
ALTER TABLE briefing_mailbox_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_mail_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE mail_review_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefing_generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefing_generation_batches ENABLE ROW LEVEL SECURITY;
-- These private tables deliberately have no client-role policies. The trusted
-- application role uses explicit scoped predicates; administration is audited.
