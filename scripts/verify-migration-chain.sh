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

# A single-dollar function body delimiter is invalid PostgreSQL syntax.
if grep -RInE '(^AS \$[[:space:]]*$|^\$[[:space:]]*;)' "$MIGRATIONS_DIR" --include='*.sql'; then
  echo "ERROR: invalid single-dollar PostgreSQL function delimiter found" >&2
  exit 1
fi

duplicates="$(
  find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' -printf '%f\n' |
    sed -nE 's/^([0-9]+)_.*/\1/p' |
    sort |
    uniq -d
)"
if [[ -n "$duplicates" ]]; then
  echo "ERROR: duplicate migration numeric prefix(es): $duplicates" >&2
  exit 1
fi

# Domain objects must have exactly one canonical CREATE migration.
for kind in table enum; do
  case "$kind" in
    table) pattern='CREATE TABLE IF NOT EXISTS[[:space:]]+([a-zA-Z_][a-zA-Z0-9_]*)';;
    enum) pattern='CREATE TYPE[[:space:]]+(IF[[:space:]]+NOT[[:space:]]+EXISTS[[:space:]]+)?([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]+AS ENUM';;
  esac
  if [[ "$kind" == "table" ]]; then
    duplicates="$({
      grep -RhoE "$pattern" "$MIGRATIONS_DIR" --include='*.sql' 2>/dev/null || true
    } | sed -E 's/^.*CREATE TABLE IF NOT EXISTS[[:space:]]+([A-Za-z_][A-Za-z0-9_]*).*$/\1/' | sort | uniq -d)"
  else
    duplicates="$({
      grep -RhoE "$pattern" "$MIGRATIONS_DIR" --include='*.sql' 2>/dev/null || true
    } | sed -E 's/^.*CREATE TYPE[[:space:]]+(IF[[:space:]]+NOT[[:space:]]+EXISTS[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)[[:space:]]+AS ENUM.*$/\2/' | sort | uniq -d)"
  fi
  if [[ -n "$duplicates" ]]; then
    echo "ERROR: duplicate canonical $kind object(s): $duplicates" >&2
    exit 1
  fi
done

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
