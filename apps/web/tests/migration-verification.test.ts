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
import { readFileSync, readdirSync } from "node:fs";
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
    expect(initSql).toContain("END\n$$;");
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
      expect(migrationSql).not.toContain("SELECT 1 FROM organization_memberships m2");
    });
  });


  describe("Phase 4 schema foundation", () => {
    const migrationDir = resolve(__dirname, "../../../supabase/migrations");
    const schemaSql = readdirSync(migrationDir)
      .filter((name) => /^\\d+_.*\\.sql$/.test(name))
      .sort()
      .map((name) => readFileSync(resolve(migrationDir, name), "utf8"))
      .join("\\n");

    const tenantTables = [
      "organizations", "organization_memberships", "agents", "agent_versions",
      "agent_deployments", "agent_email_accounts", "agent_whatsapp_accounts",
      "email_accounts", "email_account_credentials", "email_folders", "email_labels",
      "email_threads", "email_messages", "email_attachments", "email_sync_states",
      "email_sync_events", "whatsapp_accounts", "whatsapp_contacts", "whatsapp_messages",
      "whatsapp_webhook_events", "agent_policies", "agent_tool_bindings", "conversations",
      "conversation_messages", "conversation_turns", "scheduled_jobs", "scheduled_job_runs",
      "automation_rules", "automation_runs", "summaries", "summary_sources", "email_actions",
      "email_action_approvals", "ai_provider_configs", "agent_ai_settings", "ai_usage_events",
      "voice_sessions", "voice_telemetry", "audit_events", "api_keys", "knowledge_documents",
      "knowledge_chunks", "storage_objects",
    ];

    it("contains the complete Phase 4 tenant table inventory", () => {
      for (const table of tenantTables) {
        expect(schemaSql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS\\\\s+${table}\\\\b`));
      }
    });

    it("enables RLS on every tenant table", () => {
      for (const table of tenantTables) {
        expect(schemaSql).toMatch(new RegExp(`ALTER TABLE\\\\s+${table}\\\\s+ENABLE ROW LEVEL SECURITY`));
      }
    });

    it("keeps provider and AI credentials ciphertext-only", () => {
      expect(schemaSql).toContain("email_account_credentials");
      expect(schemaSql).toMatch(/email_account_credentials[\\s\\S]*ciphertext bytea NOT NULL/);
      expect(schemaSql).toMatch(/ai_provider_configs[\\s\\S]*credential_ciphertext bytea/);
      expect(schemaSql).not.toMatch(/email_account_credentials[\\s\\S]*(access_token|refresh_token|password)\\s+text/i);
    });

    it("enforces audit append-only behavior", () => {
      expect(schemaSql).toContain("prevent_audit_mutation");
      expect(schemaSql).toContain("BEFORE UPDATE OR DELETE ON audit_events");
      expect(schemaSql).toContain("audit_events_update_deny");
      expect(schemaSql).toContain("audit_events_delete_deny");
    });

    it("defines required idempotency and search indexes", () => {
      expect(schemaSql).toContain("email_threads_provider_uniq");
      expect(schemaSql).toContain("email_messages_search_idx");
      expect(schemaSql).toContain("email_messages USING gin(search_vector)");
      expect(schemaSql).toContain("ai_usage_request_uniq");
    });
  });
\n  describe("Core identity tables", () => {
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
  const foundationPath = resolve(__dirname, "../../../supabase/migrations/0002_database_foundation.sql");
  const foundationSql = readFileSync(foundationPath, "utf8");

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
      expect(foundationSql).toMatch(new RegExp("CREATE TABLE IF NOT EXISTS " + table + "\\b"));
    }
  });

  it("enables RLS for every direct tenant table", () => {
    for (const table of [
      "agents","ai_provider_configs","email_accounts","whatsapp_accounts","conversations",
      "scheduled_jobs","automation_rules","email_actions","summaries","ai_usage_events",
      "voice_sessions","audit_events","api_keys",
    ]) {
      expect(foundationSql).toContain("ALTER TABLE " + table + " ENABLE ROW LEVEL SECURITY");
    }
  });

  it("protects child-domain tables through their organization-owning parent", () => {
    expect(foundationSql).toContain("agent_versions_org_member");
    expect(foundationSql).toContain("email_messages_org_member");
    expect(foundationSql).toContain("whatsapp_messages_org_member");
    expect(foundationSql).toContain("conversation_messages_org_member");
    expect(foundationSql).toContain("scheduled_job_runs_org_member");
    expect(foundationSql).toContain("summary_sources_org_member");
    expect(foundationSql).toContain("voice_telemetry_org_member");
  });

  it("stores provider credentials as ciphertext bytea", () => {
    expect(foundationSql).toContain("encrypted_payload bytea NOT NULL");
    expect(foundationSql).toContain("encrypted_api_key bytea");
    expect(foundationSql).toContain("encrypted_credentials bytea NOT NULL");
    expect(foundationSql).toContain("hashed_key text NOT NULL");
  });

  it("provides full-text search and idempotency indexes", () => {
    expect(foundationSql).toContain("search_tsv tsvector GENERATED ALWAYS");
    expect(foundationSql).toContain("USING gin(search_tsv)");
    expect(foundationSql).toContain("email_messages_provider_id_uniq");
    expect(foundationSql).toContain("whatsapp_webhook_events");
    expect(foundationSql).toContain("UNIQUE(scheduled_job_id, fire_at)");
  });

  it("makes audit updates and deletes fail closed through RLS", () => {
    expect(foundationSql).toContain("audit_events_update_deny");
    expect(foundationSql).toContain("audit_events_delete_deny");
    expect(foundationSql).toContain("USING (false) WITH CHECK (false)");
  });

  it("does not reintroduce custom role persistence", () => {
    expect(foundationSql).not.toMatch(/CREATE\\s+TABLE.*\\broles\\b/i);
    expect(foundationSql).not.toMatch(/CREATE\\s+TABLE.*\\brole_permissions\\b/i);
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
      expect(foundationSql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it("enforces one WhatsApp account per agent", () => {
    expect(foundationSql).toContain("agent_id uuid NOT NULL UNIQUE REFERENCES agents");
  });

  it("defines email full-text indexing", () => {
    expect(foundationSql).toContain("search_tsv tsvector GENERATED ALWAYS");
    expect(foundationSql).toContain("email_messages_search_tsv_idx");
  });

  it("defines tenant RLS fail-closed through PostgreSQL settings", () => {
    expect(foundationSql).toContain("current_app_organization_id");
    expect(foundationSql).toContain("tenant_access");
    expect(foundationSql).toContain("SET search_path = public");
  });

  it("makes audit events append-only", () => {
    expect(foundationSql).toContain("audit_events_insert");
    expect(foundationSql).toContain("audit_events_read");
    expect(foundationSql).toContain("audit_events is append-only");
  });
});

describe("Phase 4 migration SQL verification", () => {
  it("uses valid PostgreSQL dollar-quoted DO blocks", () => {
    expect(foundationSql).not.toMatch(/DO \\$ BEGIN/);
    expect(foundationSql).not.toMatch(/END \\$;/);
    expect(foundationSql).toMatch(/DO \\$\$phase4\\$/);
  });
});
