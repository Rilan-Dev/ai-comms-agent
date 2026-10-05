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
  0013_database_security_hardening.sql
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

echo "Migration chain structure: PASS"
