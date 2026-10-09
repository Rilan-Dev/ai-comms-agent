/**
 * Migration static verification tests.
 *
 * Per Phase 3 final correction handoff §8: verify the SQL migration artifact
 * contains the correct owner-invariant mechanism without provisioning Supabase.
 *
 * These tests read the migration file as a string and verify:
 *   - owner invariant mechanism exists
 *   - it is transaction/deferred based (DEFERRABLE INITIALLY DEFERRED)
 *   - INSERT/UPDATE/DELETE are covered
 *   - roles and role_permissions remain absent (Option A)
 *   - permissions reference catalogue remains present
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(__dirname, "../../../supabase/migrations/0001_identity_rbac.sql");
const migrationSql = readFileSync(migrationPath, "utf8");
const initPath = resolve(__dirname, "../../../infra/postgres-init/00-supabase-roles.sql");
const initSql = readFileSync(initPath, "utf8");

const databaseFoundationPath = resolve(__dirname, "../../../supabase/migrations/0002_database_foundation.sql");
const databaseFoundationSql = readFileSync(databaseFoundationPath, "utf8");

describe("Disposable PostgreSQL bootstrap static verification", () => {
  it("uses valid dollar-quoted DO blocks", () => {
    expect(initSql).toContain("DO $$");
    expect(initSql).toContain("END\n$;");
    expect(initSql).not.toMatch(/^DO \$(?!\$)/m);
    expect(initSql).not.toMatch(/^\$/m);
  });
});

describe("Migration static verification (0002_database_foundation.sql)", () => {
  it("does not contain invalid single-dollar DO delimiters", () => {
    expect(databaseFoundationSql).not.toMatch(/^DO \$(?!\$)/m);
    expect(databaseFoundationSql).not.toMatch(/END \$;/m);
    expect(databaseFoundationSql).toContain("DO $aca$ BEGIN");
    expect(databaseFoundationSql).toContain("END $aca$;");
  });

  it("contains the canonical agent foundation migration artifact", () => {
    expect(databaseFoundationSql).toContain("CREATE TABLE IF NOT EXISTS agents");
    expect(databaseFoundationSql).not.toContain("CREATE TABLE IF NOT EXISTS email_accounts");
    expect(databaseFoundationSql).not.toContain("CREATE TABLE IF NOT EXISTS whatsapp_accounts");
  });
});

describe("Migration static verification (0001_identity_rbac.sql)", () => {
  describe("Migration chain integrity", () => {
    it("uses the canonical Phase 3 → Phase 4 migration names", () => {
      expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS organizations");
      expect(migrationSql).toContain("CROSS-ROW, CROSS-STATEMENT invariant");
    });

    it("does not contain invalid single-dollar PostgreSQL delimiters", () => {
      expect(migrationSql).not.toMatch(/^AS \$/m);
      expect(migrationSql).not.toMatch(/^\$/m);
    });
  });

  describe("Owner invariant mechanism", () => {
    it("contains a deferred constraint trigger for exactly-one-owner", () => {
      expect(migrationSql).toContain("CREATE CONSTRAINT TRIGGER");
      expect(migrationSql).toContain("DEFERRABLE INITIALLY DEFERRED");
    });

    it("contains enforce_exactly_one_owner function", () => {
      expect(migrationSql).toContain("enforce_exactly_one_owner");
    });

    it("contains immediate owner-status-active check (Layer 1)", () => {
      expect(migrationSql).toContain("enforce_owner_status_active");
      expect(migrationSql).toContain("BEFORE INSERT OR UPDATE");
    });

    it("covers INSERT, UPDATE, AND DELETE in the deferred trigger", () => {
      // The deferred constraint trigger must cover all three operations
      expect(migrationSql).toContain("AFTER INSERT OR UPDATE OR DELETE");
    });

    it("does NOT use a statement-level BEFORE trigger for the cross-row owner count", () => {
      // The old incorrect approach used BEFORE INSERT OR UPDATE for cross-row
      // owner count checks. The new approach uses AFTER ... DEFERRABLE.
      // Verify the old function name is gone.
      expect(migrationSql).not.toContain("enforce_owner_invariant");
    });

    it("rejects zero active owners at COMMIT", () => {
      expect(migrationSql).toContain("has no active owner at commit");
    });

    it("rejects multiple active owners at COMMIT", () => {
      expect(migrationSql).toContain("active owners at commit");
    });

    it("handles the final-owner DELETE even when no memberships remain", () => {
      expect(migrationSql).toContain("TG_OP = 'DELETE'");
      expect(migrationSql).toContain("OLD.organization_id");
      expect(migrationSql).toContain("has no active owner at commit");
    });

    it("validates UPDATEs against both OLD and NEW organization IDs", () => {
      expect(migrationSql).toContain("OLD.organization_id IS DISTINCT FROM NEW.organization_id");
      expect(migrationSql).toContain("NEW.organization_id");
    });

    it("checks the affected organization directly rather than iterating only existing memberships", () => {
      expect(migrationSql).toContain("SELECT EXISTS (");
      expect(migrationSql).toContain("FROM organizations WHERE id = affected_org_id");
      expect(migrationSql).toContain("owner_count = 0");
    });

    it("guards direct organization INSERTs with a deferred owner-count trigger", () => {
      expect(migrationSql).toContain("enforce_organization_has_owner");
      expect(migrationSql).toContain("CREATE CONSTRAINT TRIGGER organizations_owner_count");
      expect(migrationSql).toContain("AFTER INSERT OR UPDATE ON organizations");
      expect(migrationSql).toContain("DEFERRABLE INITIALLY DEFERRED");
    });

    it("rejects non-active owner status (invited/suspended)", () => {
      expect(migrationSql).toContain("Owner membership must have status active");
    });

    it("contains no single-dollar DO blocks", () => {
      const singleDollarDo = /DO \\$ (?!\\$)/g;
      expect(migrationSql).not.toMatch(singleDollarDo);
      expect(migrationSql).not.toMatch(/END \\$;/g);
    });

    it("uses valid PostgreSQL dollar-quoted function bodies", () => {
      expect(migrationSql).not.toMatch(/\\bAS \\$(?!\\$)/);
      expect(migrationSql).not.toMatch(/^\\$ LANGUAGE /m);
      expect(migrationSql).toContain("RETURNS TRIGGER AS $");
    });

    it("uses valid PostgreSQL dollar-quoted function bodies", () => {
      expect(migrationSql).not.toMatch(/\\bAS \\$(?!\\$)/);
      expect(migrationSql).not.toMatch(/^\\$ LANGUAGE /m);
      expect(migrationSql).toContain("RETURNS TRIGGER AS $");
    });
  });

  describe("RBAC persistence (Option A — deferred custom-role tables)", () => {
    it("does NOT contain a persisted roles table", () => {
      expect(migrationSql).not.toMatch(/CREATE\s+TABLE.*\broles\b/i);
    });

    it("does NOT contain a persisted role_permissions table", () => {
      expect(migrationSql).not.toMatch(/CREATE\s+TABLE.*\brole_permissions\b/i);
    });

    it("does NOT contain RLS policies for roles or role_permissions", () => {
      expect(migrationSql).not.toContain("roles_member_visibility");
      expect(migrationSql).not.toContain("role_permissions_member_visibility");
    });

    it("RETAINS the permissions reference catalogue table", () => {
      expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS permissions");
      expect(migrationSql).toContain("permissions_name_uniq");
    });

    it("RETAINS the permissions catalogue seed (Phase 3 identity/RBAC foundation only)", () => {
      expect(migrationSql).toContain("organization.read");
      expect(migrationSql).toContain("organization.members.manage");
      expect(migrationSql).toContain("audit.read");
      expect(migrationSql).toContain("settings.manage");
    });

    it("does NOT seed feature-domain permissions (agent.*, email.*, etc.)", () => {
      expect(migrationSql).not.toContain("'agent.read'");
      expect(migrationSql).not.toContain("'email.send'");
      expect(migrationSql).not.toContain("'whatsapp.send'");
      expect(migrationSql).not.toContain("'schedule.read'");
    });
  });

  describe("Provider-neutral identity boundary", () => {
    it("does not depend on Supabase auth.uid()", () => {
      expect(migrationSql).not.toContain("auth.uid()");
    });
  });

  describe("RLS recursion safety", () => {
    it("uses SECURITY DEFINER membership helpers", () => {
      expect(migrationSql).toContain("private.is_active_organization_member");
      expect(migrationSql).toContain("private.is_active_organization_admin_or_owner");
      expect(migrationSql).toContain("SECURITY DEFINER");
      expect(migrationSql).toContain("CREATE SCHEMA IF NOT EXISTS private");
    });

    it("pins the SECURITY DEFINER helper search_path", () => {
      expect(migrationSql).toContain("SET search_path = ''");
      expect(migrationSql).toContain("REVOKE EXECUTE ON FUNCTION private.is_active_organization_member(uuid, uuid) FROM PUBLIC");
      expect(migrationSql).toContain("REVOKE EXECUTE ON FUNCTION private.is_active_organization_admin_or_owner(uuid, uuid) FROM PUBLIC");
    });

    it("does not self-query organization_memberships directly from its RLS policy", () => {
      expect(migrationSql).not.toMatch(/SELECT 1 FROM organization_memberships m2/);
    });
  });

  describe("Application-owned authentication", () => {
    it("creates password credentials, opaque sessions, and login-attempt tables", () => {
      const authMigration = readFileSync(
        resolve(__dirname, "../../../supabase/migrations/0022_application_authentication.sql"),
        "utf8",
      );
      expect(authMigration).toContain("CREATE TABLE IF NOT EXISTS aca.auth_credentials");
      expect(authMigration).toContain("CREATE TABLE IF NOT EXISTS aca.auth_sessions");
      expect(authMigration).toContain("CREATE TABLE IF NOT EXISTS aca.auth_login_attempts");
      expect(authMigration).toContain("REVOKE ALL ON aca.auth_credentials FROM PUBLIC");
    });

    it("does not introduce hosted Supabase Auth runtime calls", () => {
      const loginSource = readFileSync(
        resolve(__dirname, "../src/app/api/auth/login/route.ts"),
        "utf8",
      );
      expect(loginSource).not.toContain("SUPABASE_URL");
      expect(loginSource).not.toContain("/auth/v1/token");
    });
  });

  describe("Core identity tables", () => {
    it("contains organizations table with unique slug", () => {
      expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS organizations");
      expect(migrationSql).toContain("organizations_slug_uniq");
    });

    it("contains users table with unique email", () => {
      expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS users");
      expect(migrationSql).toContain("users_email_uniq");
    });

    it("contains organization_memberships table with unique org+user", () => {
      expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS organization_memberships");
      expect(migrationSql).toContain("organization_memberships_org_user_uniq");
    });

    it("contains membership_role enum with owner/admin/member/viewer", () => {
      expect(migrationSql).toContain("membership_role");
      expect(migrationSql).toContain("'owner'");
      expect(migrationSql).toContain("'admin'");
      expect(migrationSql).toContain("'member'");
      expect(migrationSql).toContain("'viewer'");
    });

    it("contains RLS policies for organization isolation", () => {
      expect(migrationSql).toContain("ENABLE ROW LEVEL SECURITY");
      expect(migrationSql).toContain("organizations_member_visibility");
    });
  });

  describe("Transaction-safety documentation", () => {
    it("documents that ownership transfer requires deferred semantics", () => {
      expect(migrationSql).toContain("ownership transfer");
      expect(migrationSql).toContain("transient intermediate state");
    });

    it("documents that the invariant is transaction-level, not statement-level", () => {
      expect(migrationSql).toContain("CROSS-ROW, CROSS-STATEMENT invariant");
    });
  });
});


describe("Phase 4 database foundation migration", () => {
  const requiredTables = [
    "agents","agent_versions","agent_deployments","agent_email_accounts","agent_whatsapp_accounts",
    "agent_ai_settings","ai_provider_configs","email_accounts","email_account_credentials",
    "email_folders","email_labels","email_threads","email_messages","email_attachments",
    "email_sync_states","email_sync_events","whatsapp_accounts","whatsapp_contacts",
    "whatsapp_messages","whatsapp_webhook_events","conversations","conversation_messages",
    "conversation_turns","scheduled_jobs","scheduled_job_runs","automation_rules","automation_runs",
    "email_actions","email_action_approvals","summaries","summary_sources","ai_usage_events",
    "voice_sessions","voice_telemetry","audit_events","api_keys",
  ];

  it("declares every Phase 4 target table", () => {
    for (const table of requiredTables) {
      expect(databaseFoundationSql).toMatch(new RegExp("CREATE TABLE IF NOT EXISTS " + table + "\\b"));
    }
  });

  it("enables RLS for every direct tenant table", () => {
    for (const table of [
      "agents","ai_provider_configs","email_accounts","whatsapp_accounts","conversations",
      "scheduled_jobs","automation_rules","email_actions","summaries","ai_usage_events",
      "voice_sessions","audit_events","api_keys",
    ]) {
      expect(databaseFoundationSql).toContain("ALTER TABLE " + table + " ENABLE ROW LEVEL SECURITY");
    }
  });

  it("protects child-domain tables through their organization-owning parent", () => {
    expect(databaseFoundationSql).toContain("agent_versions_org_member");
    expect(databaseFoundationSql).toContain("email_messages_org_member");
    expect(databaseFoundationSql).toContain("whatsapp_messages_org_member");
    expect(databaseFoundationSql).toContain("conversation_messages_org_member");
    expect(databaseFoundationSql).toContain("scheduled_job_runs_org_member");
    expect(databaseFoundationSql).toContain("summary_sources_org_member");
    expect(databaseFoundationSql).toContain("voice_telemetry_org_member");
  });

  it("stores provider credentials as ciphertext bytea", () => {
    expect(databaseFoundationSql).toContain("encrypted_payload bytea NOT NULL");
    expect(databaseFoundationSql).toContain("encrypted_api_key bytea");
    expect(databaseFoundationSql).toContain("encrypted_credentials bytea NOT NULL");
    expect(databaseFoundationSql).toContain("hashed_key text NOT NULL");
  });

  it("provides full-text search and idempotency indexes", () => {
    expect(databaseFoundationSql).toContain("search_tsv tsvector GENERATED ALWAYS");
    expect(databaseFoundationSql).toContain("USING gin(search_tsv)");
    expect(databaseFoundationSql).toContain("email_messages_provider_id_uniq");
    expect(databaseFoundationSql).toContain("whatsapp_webhook_events");
    expect(databaseFoundationSql).toContain("UNIQUE(scheduled_job_id, fire_at)");
  });

  it("makes audit updates and deletes fail closed through RLS", () => {
    expect(databaseFoundationSql).toContain("audit_events_update_deny");
    expect(databaseFoundationSql).toContain("audit_events_delete_deny");
    expect(databaseFoundationSql).toContain("USING (false) WITH CHECK (false)");
  });

  it("does not reintroduce custom role persistence", () => {
    expect(databaseFoundationSql).not.toMatch(/CREATE\\s+TABLE.*\\broles\\b/i);
    expect(databaseFoundationSql).not.toMatch(/CREATE\\s+TABLE.*\\brole_permissions\\b/i);
  });
});


describe("Phase 4 database security hardening migration", () => {
  const securityPath = resolve(__dirname, "../../../supabase/migrations/0003_database_security_hardening.sql");
  const securitySql = readFileSync(securityPath, "utf8");

  it("uses the repository app.user_id context instead of a second auth identity contract", () => {
    expect(securitySql).toContain("current_setting('app.user_id', true)");
    expect(securitySql).not.toContain("auth.uid()");
  });

  it("defines public membership helper wrappers over the Phase 3 private helpers", () => {
    expect(securitySql).toContain("CREATE OR REPLACE FUNCTION public.is_active_organization_member");
    expect(securitySql).toContain("private.is_active_organization_member(p_organization_id, p_user_id)");
    expect(securitySql).toContain("CREATE OR REPLACE FUNCTION public.is_active_organization_admin_or_owner");
    expect(securitySql).toContain("private.is_active_organization_admin_or_owner(p_organization_id, p_user_id)");
  });

  it("keeps policy wrappers SECURITY INVOKER", () => {
    expect(securitySql).toContain("SECURITY INVOKER");
    expect(securitySql).toContain("SELECT public.is_active_organization_member");
    expect(securitySql).toContain("SELECT public.is_active_organization_admin_or_owner");
  });

  it("revokes public execution of privileged membership helpers", () => {
    expect(securitySql).toContain("REVOKE EXECUTE ON FUNCTION public.is_active_organization_member(uuid, uuid) FROM PUBLIC");
    expect(securitySql).toContain("REVOKE EXECUTE ON FUNCTION public.is_active_organization_admin_or_owner(uuid, uuid) FROM PUBLIC");
    expect(securitySql).toContain("GRANT EXECUTE ON FUNCTION public.is_active_organization_member(uuid, uuid) TO authenticated");
  });

  it("restricts secret-bearing tables to organization admins/owners", () => {
    expect(securitySql).toContain("email_account_credentials_admin");
    expect(securitySql).toContain("ai_provider_configs_admin");
    expect(securitySql).toContain("api_keys_admin");
    expect(securitySql).toContain("can_manage_organization");
  });

  it("uses restrictive audit deny policies so permissive member policies cannot override them", () => {
    expect(securitySql).toContain("AS RESTRICTIVE FOR UPDATE");
    expect(securitySql).toContain("AS RESTRICTIVE FOR DELETE");
    expect(securitySql).toContain("audit_events_update_deny");
    expect(securitySql).toContain("audit_events_delete_deny");
  });
});


describe("Phase 4 agent policy configuration migration", () => {
  const policyPath = resolve(__dirname, "../../../supabase/migrations/0004_agent_policy_configuration.sql");
  const policySql = readFileSync(policyPath, "utf8");

  it("persists per-agent security policy and allowed tool configuration", () => {
    expect(policySql).toContain("CREATE TABLE IF NOT EXISTS agent_policies");
    expect(policySql).toContain("security_policy jsonb");
    expect(policySql).toContain("allowed_tools text[]");
    expect(policySql).toContain("rate_limits jsonb");
  });

  it("persists explicit tool bindings without making the registry dynamic", () => {
    expect(policySql).toContain("CREATE TABLE IF NOT EXISTS agent_tool_bindings");
    expect(policySql).toContain("UNIQUE(agent_id, tool_name)");
    expect(policySql).toContain("enabled boolean");
  });

  it("requires organization management permission for policy writes", () => {
    expect(policySql).toContain("WITH CHECK");
    expect(policySql).toContain("can_manage_organization(a.organization_id)");
  });
});


describe("Application database foundation static verification (0002_application_foundation.sql)", () => {
  it("defines the core application domains", () => {
    for (const table of [
      "agents", "agent_versions", "agent_deployments", "email_accounts",
      "email_account_credentials", "email_messages", "email_threads",
      "whatsapp_accounts", "whatsapp_messages", "conversations",
      "scheduled_jobs", "automation_rules", "email_actions", "summaries",
      "ai_provider_configs", "ai_usage_events", "voice_sessions", "voice_telemetry",
      "audit_events",
    ]) {
      expect(databaseFoundationSql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it("enforces one WhatsApp account per agent", () => {
    expect(databaseFoundationSql).toContain("agent_id uuid NOT NULL UNIQUE REFERENCES agents");
  });

  it("defines email full-text indexing", () => {
    expect(databaseFoundationSql).toContain("search_tsv tsvector GENERATED ALWAYS");
    expect(databaseFoundationSql).toContain("email_messages_search_tsv_idx");
  });

  it("defines tenant RLS fail-closed through PostgreSQL settings", () => {
    expect(databaseFoundationSql).toContain("current_app_organization_id");
    expect(databaseFoundationSql).toContain("tenant_access");
    expect(databaseFoundationSql).toContain("SET search_path = public");
  });

  it("makes audit events append-only", () => {
    expect(databaseFoundationSql).toContain("audit_events_insert");
    expect(databaseFoundationSql).toContain("audit_events_read");
    expect(databaseFoundationSql).toContain("audit_events is append-only");
  });
});

describe("Phase 4 migration SQL verification", () => {
  it("uses valid PostgreSQL dollar-quoted DO blocks", () => {
    expect(databaseFoundationSql).not.toMatch(/DO \\$ BEGIN/);
    expect(databaseFoundationSql).not.toMatch(/END \\$;/);
    expect(databaseFoundationSql).toMatch(/DO \\$\$phase4\\$/);
  });
});


describe("Cross-tenant provider binding integrity migration", () => {
  const path = resolve(__dirname, "../../../supabase/migrations/0010_cross_tenant_integrity.sql");
  const sql = readFileSync(path, "utf8");

  it("derives the binding tenant from the agent because binding rows have no organization_id", () => {
    expect(sql).toContain("SELECT a.organization_id INTO agent_org FROM agents a WHERE a.id = NEW.agent_id");
    expect(sql).not.toContain("NEW.organization_id");
  });

  it("guards both email and WhatsApp bindings against cross-organization attachment", () => {
    expect(sql).toContain("enforce_agent_email_account_org");
    expect(sql).toContain("enforce_agent_whatsapp_account_org");
    expect(sql).toContain("account_org <> agent_org");
  });
});


describe("Email schema reconciliation (0015_email_schema_reconciliation.sql)", () => {
  const reconciliationPath = resolve(__dirname, "../../../supabase/migrations/0015_email_schema_reconciliation.sql");
  const reconciliationSql = readFileSync(reconciliationPath, "utf8");

  it("reconciles the provider connection status enum to the runtime states", () => {
    expect(reconciliationSql).toContain("email_account_status_canonical");
    expect(reconciliationSql).toContain("'pending','connected','error','disconnected','revoked'");
    expect(reconciliationSql).toContain("ALTER COLUMN status TYPE email_account_status_canonical");
  });

  it("migrates legacy encrypted credential payloads into the canonical ciphertext column", () => {
    expect(reconciliationSql).toContain("ADD COLUMN IF NOT EXISTS ciphertext bytea");
    expect(reconciliationSql).toContain("ciphertext = COALESCE(c.ciphertext, c.encrypted_payload)");
    expect(reconciliationSql).toContain("ALTER COLUMN ciphertext SET NOT NULL");
    expect(reconciliationSql).toContain("key_reference");
  });

  it("adds organization scoping needed by credential and folder/label RLS", () => {
    expect(reconciliationSql).toContain("ADD COLUMN IF NOT EXISTS organization_id uuid");
    expect(reconciliationSql).toContain("email_account_credentials_org_idx");
    expect(reconciliationSql).toContain("email_folders_org_idx");
    expect(reconciliationSql).toContain("email_labels_org_idx");
  });
});


describe("WhatsApp runtime hardening migration (0017)", () => {
  const sql = readFileSync(resolve(__dirname, "../../../supabase/migrations/0017_whatsapp_runtime_hardening.sql"), "utf8");

  it("stores an explicit agent routing target and processing lifecycle", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES agents(id) ON DELETE SET NULL");
    expect(sql).toContain("processing_status text NOT NULL DEFAULT 'received'");
    expect(sql).toContain("('received','routed','processing','completed','failed')");
  });

  it("indexes provider status updates and agent routing", () => {
    expect(sql).toContain("whatsapp_messages_agent_created_idx");
    expect(sql).toContain("whatsapp_messages_provider_status_idx");
    expect(sql).toContain("agent_whatsapp_accounts_account_idx");
  });

  it("supports shared-number routing without global provider-id collisions", () => {
    expect(sql).toContain("DROP CONSTRAINT IF EXISTS whatsapp_messages_provider_message_id_key");
    expect(sql).toContain("whatsapp_messages_account_provider_agent_uniq");
    expect(sql).toContain("COALESCE(agent_id, '00000000-0000-0000-0000-000000000000'::uuid)");
  });
});


describe("Audit schema reconciliation migration (0023)", () => {
  const reconciliationSql = readFileSync(
    resolve(__dirname, "../../../supabase/migrations/0023_audit_schema_reconciliation.sql"),
    "utf8",
  );

  it("adds audit columns required by the current repository contract to legacy tables", () => {
    expect(reconciliationSql).toContain("ADD COLUMN IF NOT EXISTS agent_id uuid");
    expect(reconciliationSql).toContain("ADD COLUMN IF NOT EXISTS decision text");
  });

  it("uses forward-only idempotent indexes for the reconciled audit columns", () => {
    expect(reconciliationSql).toContain("CREATE INDEX IF NOT EXISTS audit_events_agent_created_idx");
    expect(reconciliationSql).toContain("CREATE INDEX IF NOT EXISTS audit_events_org_decision_idx");
  });
});

describe("Manual deployment migration boundary", () => {
  const manualUpSql = readFileSync(
    resolve(__dirname, "../../../scripts/manual-up.sh"),
    "utf8",
  );

  it("applies the PostgreSQL migration chain before starting the application", () => {
    expect(manualUpSql).toContain("bash scripts/migrate.sh");
    expect(manualUpSql).toContain("DATABASE_URL");
    expect(manualUpSql).toContain("docker compose --env-file .env.docker");
  });
});

describe("Migration failure diagnostics", () => {
  it("preserves the PostgreSQL diagnostic when migration-ledger initialization fails", () => {
    const migrateSql = readFileSync(
      resolve(__dirname, "../../../scripts/migrate.sh"),
      "utf8",
    );
    expect(migrateSql).toContain('ERROR: PostgreSQL connection/DDL diagnostic:');
    expect(migrateSql).toContain('tail -12 "$TMP_ERR"');
  });
});


describe("Legacy audit schema compatibility migration (0024)", () => {
  const legacyAuditPath = resolve(__dirname, "../../../supabase/migrations/0024_audit_legacy_column_compatibility.sql");
  const legacyAuditSql = readFileSync(legacyAuditPath, "utf8");

  it("makes retired resource_type and outcome columns optional on older databases", () => {
    expect(legacyAuditSql).toContain("column_name = 'resource_type'");
    expect(legacyAuditSql).toContain("column_name = 'outcome'");
    expect(legacyAuditSql).toContain("ALTER TABLE audit_events ALTER COLUMN resource_type DROP NOT NULL");
    expect(legacyAuditSql).toContain("ALTER TABLE audit_events ALTER COLUMN outcome DROP NOT NULL");
  });

  it("checks column existence and nullability before applying compatibility changes", () => {
    expect(legacyAuditSql).toContain("information_schema.columns");
    expect(legacyAuditSql).toContain("table_schema = current_schema()");
    expect(legacyAuditSql).toContain("is_nullable = 'NO'");
  });
});

describe("Live runtime schema reconciliation migration (0029)", () => {
  const sql = readFileSync(
    resolve(__dirname, "../../../supabase/migrations/0029_runtime_schema_reconciliation.sql"),
    "utf8",
  );

  it("adds the missing provider model and mailbox retry/checkpoint columns idempotently", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS model text");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS history_id text");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS error_count integer NOT NULL DEFAULT 0");
  });

  it("preserves legacy mailbox checkpoints when old column names exist", () => {
    expect(sql).toContain("column_name = 'history_token'");
    expect(sql).toContain("history_id = COALESCE(history_id, history_token)");
    expect(sql).toContain("column_name = 'last_sync_at'");
    expect(sql).toContain("last_success_at = COALESCE(last_success_at, last_sync_at)");
  });
});

describe("Legacy email message runtime reconciliation migration (0030)", () => {
  const sql = readFileSync(
    resolve(__dirname, "../../../supabase/migrations/0030_email_messages_runtime_reconciliation.sql"),
    "utf8",
  );

  it("adds canonical sender and recipient columns used by the inbox repository", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS from_email text");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS from_name text");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS to_recipients jsonb");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS is_sent boolean");
  });

  it("backfills legacy sender, recipient, direction, and body columns without overwriting canonical values", () => {
    expect(sql).toContain("column_name = 'from_address'");
    expect(sql).toContain("from_email = COALESCE(from_email, from_address)");
    expect(sql).toContain("ALTER TABLE email_messages ALTER COLUMN from_address DROP NOT NULL");
    expect(sql).toContain("column_name = 'to_addresses'");
    expect(sql).toContain("column_name = 'is_outbound'");
    expect(sql).toContain("html_body_sanitized = COALESCE(html_body_sanitized, html_body)");
  });
});
