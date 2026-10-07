-- Phase 4: API access, knowledge/search metadata and storage references.

DO $$
BEGIN
  IF to_regclass('aca.api_keys') IS NOT NULL THEN
    ALTER TABLE api_keys
      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text NOT NULL,
  hashed_key text NOT NULL,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS api_keys_hash_uniq ON api_keys(hashed_key);
CREATE INDEX IF NOT EXISTS api_keys_org_idx ON api_keys(organization_id,created_at DESC);

DO $$
BEGIN
  IF to_regclass('aca.knowledge_documents') IS NOT NULL THEN
    ALTER TABLE knowledge_documents
      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES agents(id) ON DELETE CASCADE,
  filename text NOT NULL,
  content_type text,
  storage_bucket text,
  storage_path text,
  sha256 text,
  size_bytes bigint CHECK(size_bytes >= 0),
  status text NOT NULL DEFAULT 'pending',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_documents_storage_uniq
ON knowledge_documents(organization_id,storage_bucket,storage_path)
WHERE storage_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS knowledge_documents_org_idx ON knowledge_documents(organization_id,created_at DESC);

DO $$
BEGIN
  IF to_regclass('aca.knowledge_chunks') IS NOT NULL THEN
    ALTER TABLE knowledge_chunks
      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL CHECK(chunk_index >= 0),
  content text NOT NULL,
  content_hash text NOT NULL,
  embedding_provider text,
  embedding_model text,
  vector_reference text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id,chunk_index)
);
CREATE INDEX IF NOT EXISTS knowledge_chunks_org_idx ON knowledge_chunks(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_chunks_hash_uniq
ON knowledge_chunks(document_id,content_hash);

DO $$
BEGIN
  IF to_regclass('aca.storage_objects') IS NOT NULL THEN
    ALTER TABLE storage_objects
      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS storage_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bucket text NOT NULL,
  object_path text NOT NULL,
  content_type text,
  size_bytes bigint CHECK(size_bytes >= 0),
  sha256 text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(bucket,object_path)
);
CREATE INDEX IF NOT EXISTS storage_objects_org_idx ON storage_objects(organization_id,created_at DESC);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY api_keys_admin_visibility ON api_keys FOR SELECT TO authenticated
USING (can_manage_organization(organization_id));
CREATE POLICY api_keys_admin_manage ON api_keys FOR ALL TO authenticated
USING (can_manage_organization(organization_id))
WITH CHECK (can_manage_organization(organization_id));

CREATE POLICY knowledge_documents_member_visibility ON knowledge_documents FOR SELECT TO authenticated
USING (can_access_organization(organization_id));
CREATE POLICY knowledge_documents_member_manage ON knowledge_documents FOR ALL TO authenticated
USING (can_access_organization(organization_id))
WITH CHECK (can_access_organization(organization_id));

CREATE POLICY knowledge_chunks_member_visibility ON knowledge_chunks FOR SELECT TO authenticated
USING (can_access_organization(organization_id));
CREATE POLICY knowledge_chunks_member_manage ON knowledge_chunks FOR ALL TO authenticated
USING (can_access_organization(organization_id))
WITH CHECK (can_access_organization(organization_id));

CREATE POLICY storage_objects_member_visibility ON storage_objects FOR SELECT TO authenticated
USING (can_access_organization(organization_id));
CREATE POLICY storage_objects_member_manage ON storage_objects FOR ALL TO authenticated
USING (can_access_organization(organization_id))
WITH CHECK (can_access_organization(organization_id));
