#!/usr/bin/env bash
set -euo pipefail

MIGRATIONS_DIR="${MIGRATIONS_DIR:-supabase/migrations}"

[[ -d "$MIGRATIONS_DIR" ]] || {
  echo "ERROR: migrations directory missing: $MIGRATIONS_DIR" >&2
  exit 1
}

for forbidden in \
  0002_application_foundation.sql \
  0002_domain_foundation.sql \
  0003_database_foundation.sql
do
  if [[ -e "$MIGRATIONS_DIR/$forbidden" ]]; then
    echo "ERROR: conflicting legacy migration present: $forbidden" >&2
    exit 1
  fi
done

for required in \
  0001_identity_rbac.sql \
  0002_database_foundation.sql \
  0003_email_domain.sql \
  0004_messaging.sql \
  0005_agent_policy_configuration.sql \
  0006_conversations_scheduling.sql \
  0007_actions_ai_voice_audit.sql \
  0008_api_keys_knowledge_storage.sql \
  0009_rls_helper_hardening.sql \
  0010_cross_tenant_integrity.sql \
  0011_ownership_transfer.sql \
  0012_server_identity_rpcs.sql \
  0013_database_security_hardening.sql \
  0014_email_connection_config.sql
do
  [[ -f "$MIGRATIONS_DIR/$required" ]] || {
    echo "ERROR: required migration missing: $required" >&2
    exit 1
  }
done

# The application is PostgreSQL-native; migrations must not depend on
# Supabase-specific auth.uid() runtime functions.
# Reject accidental escaped-newline literals introduced into SQL source.
if grep -RInF '\\n--' "$MIGRATIONS_DIR" --include='*.sql'; then
  echo "ERROR: literal \\n sequence found in SQL migration" >&2
  exit 1
fi

if grep -RIn 'auth\\.uid()' "$MIGRATIONS_DIR" --include='*.sql'; then
  echo "ERROR: Supabase-specific auth.uid() dependency found in migrations" >&2
  exit 1
fi

# A single-dollar function body delimiter is invalid PostgreSQL syntax.
if grep -RInE '(^AS \$[[:space:]]*$|^\$[[:space:]]*;)' "$MIGRATIONS_DIR" --include='*.sql'; then
  echo "ERROR: invalid single-dollar PostgreSQL function delimiter found" >&2
  exit 1
fi

# Migration identity is the full filename recorded by migrate.sh, not the
# numeric prefix alone. The repository contains forward-only reconciliation
# migrations that intentionally share historical numeric prefixes; rejecting
# those prefixes would make the verifier disagree with the committed migration
# history and the migration runner.

# Historical and reconciliation migrations intentionally repeat idempotent
# CREATE TABLE IF NOT EXISTS, sometimes with the aca. schema qualifier, and
# exception-guarded CREATE TYPE within DO blocks. The previous grep counted
# the qualifier "aca" as a table name and rejected these safe reassertions.
# Check only repeated *non-idempotent* declarations instead. Applied-file
# checksums, unknown versions and the live ledger are independently guarded
# by operator-migration-check.mjs before any SQL is applied.
node "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/check-migration-declarations.mjs" "$MIGRATIONS_DIR"

# Migrations 0001-0008 must use the established can_* wrappers; the public
# is_active_* helpers are introduced by later security-hardening migrations.
if grep -RInE '(^|[^[:alnum:]_])is_active_organization_(member|admin_or_owner)\(' \
  "$MIGRATIONS_DIR"/0001_identity_rbac.sql \
  "$MIGRATIONS_DIR"/0002_database_foundation.sql \
  "$MIGRATIONS_DIR"/0003_email_domain.sql \
  "$MIGRATIONS_DIR"/0004_messaging.sql \
  "$MIGRATIONS_DIR"/0005_agent_policy_configuration.sql \
  "$MIGRATIONS_DIR"/0006_conversations_scheduling.sql \
  "$MIGRATIONS_DIR"/0007_actions_ai_voice_audit.sql \
  "$MIGRATIONS_DIR"/0008_api_keys_knowledge_storage.sql \
  | grep -v 'private.is_active_organization_' >/tmp/aca-future-rls-helper-refs.log; then
  cat /tmp/aca-future-rls-helper-refs.log >&2
  echo "ERROR: early migration references public RLS helper before its hardening migration" >&2
  exit 1
fi

echo "Migration chain structure: PASS"
