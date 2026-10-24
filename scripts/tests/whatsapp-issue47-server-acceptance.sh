#!/usr/bin/env bash
# Issue #47 acceptance — server-side live acceptance harness (pending-only, NO approval, NO send).
#
# Complements scripts/tests/whatsapp-issue47-browser.js: instead of a signed-in
# browser session, an operator with database access mints a short-lived
# auth_sessions row for the organization owner (the signed-in authorized
# tester equivalent), executes the same acceptance sequence against the
# deployed web container, then revokes the session.
#
# Checks (all read-only against provider state except ONE pending approval row):
#   1.  Anonymous GET /api/whatsapp/templates denied (401/403)
#   2.  Authenticated GET /api/whatsapp/templates → 200 + real Meta Graph sync
#       (template statuses reflect actual Meta state; never locally forced)
#   3.  Cross-tenant (inaccessible org) template read denied (403/404)
#   4.  Invalid E.164 recipient rejected 422
#   5.  ONE pending proposal: POST /api/whatsapp/messages → 202,
#       approvalRequired=true, status=pending, actionId returned
#   6.  Idempotent replay (same key + same payload) → 202 with SAME actionId
#   7.  Same key + changed payload → 409
#   8.  Read-only DB probe: pending, unexpired, unapproved, not queued,
#       requested_by set, payload_type=text
#   9.  No-send boundary: still pending, no queue linkage, no outbound
#       whatsapp_messages row, worker never claimed the action
#   10. Web log privacy scan: no SQLSTATE detail / Failing-row /
#       recipient_phone / message_body leaks
#   11. Scoped session revoked (logout equivalent)
#
# Safety: never calls any approval/decision/send endpoint; recipient uses
# unallocated country code 999 so the row can never reach a real subscriber
# even if mistakenly approved; the pending row is intentionally left to
# expire (no production data cleanup, per #47 safety boundaries).
#
# Usage (operator, on the deployment host):
#   bash scripts/tests/whatsapp-issue47-server-acceptance.sh
set -uo pipefail

WEB="${ISS47_WEB_ORIGIN:-http://localhost:3300}"
RECIPIENT="${ISS47_RECIPIENT:-+999876543210}"   # CC 999 is unallocated
CONTENT="Issue 47 pending approval acceptance test. DO NOT APPROVE OR SEND."
PSQL_CONTAINER="${ISS47_DB_CONTAINER:-aca-postgres}"
PSQL_DB="${ISS47_DB_NAME:-postgres}"

FAIL_COUNT=0
log()  { echo "[iss47] $*"; }
pass() { echo "[iss47] PASS: $*"; }
fail() { echo "[iss47] FAIL: $*"; FAIL_COUNT=$((FAIL_COUNT + 1)); }

sql() { docker exec -e SQL="$1" "$PSQL_CONTAINER" sh -c "exec psql -X -U \"\${POSTGRES_USER:-aca}\" -d $PSQL_DB -t -A -F'|' -c \"\$SQL\"" 2>&1; }

jget() { python3 -c "import json,sys; d=json.load(open(sys.argv[1])); print($2)" "$1" 2>/dev/null; }

# ---------------------------------------------------------------------------
# 0. Resolve deployed context + real owner identity (output redacted)
# ---------------------------------------------------------------------------
DEPLOYED_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo unknown)
log "deployed SHA: $DEPLOYED_SHA"

ROW=$(sql "SELECT u.id, om.organization_id, om.role FROM aca.users u JOIN aca.organization_memberships om ON om.user_id=u.id WHERE u.status='active' AND om.status='active' ORDER BY (om.role='owner') DESC, u.created_at LIMIT 1")
USER_ID=$(echo "$ROW" | cut -d'|' -f1)
ORG_ID=$(echo "$ROW"  | cut -d'|' -f2)
ROLE=$(echo "$ROW"    | cut -d'|' -f3)
ACCOUNT_ID=$(sql "SELECT id FROM aca.whatsapp_accounts WHERE organization_id='$ORG_ID' AND status='connected' AND phone_number_id <> '__webhook_config__' ORDER BY connected_at DESC NULLS LAST LIMIT 1")

if [ -z "$USER_ID" ] || [ -z "$ORG_ID" ] || [ -z "$ACCOUNT_ID" ]; then
  log "ABORT: could not resolve owner/org/connected-account"
  exit 1
fi
log "identity resolved (redacted): user=${USER_ID:0:8}.. role=$ROLE org=${ORG_ID:0:8}.. account=${ACCOUNT_ID:0:8}.. (connected)"

T0=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# ---------------------------------------------------------------------------
# 1. Mint a scoped 30-minute session for the real owner (revoked at the end)
# ---------------------------------------------------------------------------
TOKEN=$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')
TOKEN_HASH=$(printf '%s' "$TOKEN" | sha256sum | cut -d' ' -f1)
SESS=$(sql "INSERT INTO aca.auth_sessions (user_id, token_hash, expires_at, user_agent) VALUES ('$USER_ID', '$TOKEN_HASH', now() + interval '30 minutes', 'issue47-acceptance') RETURNING id")
if [ -z "$SESS" ] || [ "${SESS:0:4}" = "ERROR" ]; then
  log "ABORT: session mint failed: $SESS"
  exit 1
fi
COOKIE="aca-access-token=$TOKEN"
pass "scoped 30-min session minted for owner (server-side signed-in tester; revoked at end)"

# ---------------------------------------------------------------------------
# 2. Anonymous (no cookie) template read must be denied
# ---------------------------------------------------------------------------
ANON=$(curl -sS -o /tmp/iss47-anon.json -w '%{http_code}' "$WEB/api/whatsapp/templates?organizationId=$ORG_ID&accountId=$ACCOUNT_ID")
if [ "$ANON" = "401" ] || [ "$ANON" = "403" ]; then pass "anonymous template read denied (HTTP $ANON)"; else fail "anonymous template read NOT denied (HTTP $ANON)"; fi

# ---------------------------------------------------------------------------
# 3. Authenticated GET template sync (real Meta Graph call, read-only)
# ---------------------------------------------------------------------------
TPL=$(curl -sS --cookie "$COOKIE" -o /tmp/iss47-templates.json -w '%{http_code}' "$WEB/api/whatsapp/templates?organizationId=$ORG_ID&accountId=$ACCOUNT_ID")
if [ "$TPL" = "200" ]; then
  TPL_COUNT=$(jget /tmp/iss47-templates.json "len(d.get('templates', []))")
  TPL_STATUS_COUNTS=$(python3 -c "
import json
d=json.load(open('/tmp/iss47-templates.json'))
c={}
for t in d.get('templates', []):
    c[t.get('status','?')]=c.get(t.get('status','?'),0)+1
print(c)" 2>/dev/null)
  pass "authenticated GET /api/whatsapp/templates HTTP 200 (real Meta sync); template count=$TPL_COUNT statuses=$TPL_STATUS_COUNTS"
  if [ "$TPL_COUNT" = "0" ]; then log "INCOMPLETE: zero templates returned; cannot confirm per-template status reconciliation"; fi
else
  fail "authenticated template sync NOT HTTP 200 (got $TPL)"
fi

# ---------------------------------------------------------------------------
# 4. Cross-tenant denial (random inaccessible org UUID)
# ---------------------------------------------------------------------------
FOREIGN=$(cat /proc/sys/kernel/random/uuid)
if [ "$FOREIGN" = "$ORG_ID" ]; then FOREIGN=$(cat /proc/sys/kernel/random/uuid); fi
XORG=$(curl -sS --cookie "$COOKIE" -o /tmp/iss47-xorg.json -w '%{http_code}' "$WEB/api/whatsapp/templates?organizationId=$FOREIGN&accountId=$ACCOUNT_ID")
if [ "$XORG" = "403" ] || [ "$XORG" = "404" ]; then pass "cross-tenant template read denied (HTTP $XORG)"; else fail "cross-tenant read NOT denied (HTTP $XORG)"; fi

# ---------------------------------------------------------------------------
# 5. Invalid E.164 must fail 422 (auth + account OK, validation fails)
# ---------------------------------------------------------------------------
IDEM="issue47-$(cat /proc/sys/kernel/random/uuid)"
INV=$(curl -sS --cookie "$COOKIE" -H 'content-type: application/json' -H "Idempotency-Key: $IDEM" \
  -o /tmp/iss47-invalid.json -w '%{http_code}' -X POST "$WEB/api/whatsapp/messages" \
  -d "{\"organizationId\":\"$ORG_ID\",\"accountId\":\"$ACCOUNT_ID\",\"to\":\"${RECIPIENT#+}\",\"body\":\"$CONTENT\"}")
if [ "$INV" = "422" ]; then pass "invalid E.164 rejected with HTTP 422"; else fail "invalid E.164 NOT rejected (HTTP $INV)"; fi

# ---------------------------------------------------------------------------
# 6. ONE pending 202 proposal (never approved, never sent)
# ---------------------------------------------------------------------------
post_proposal() {
  curl -sS --cookie "$COOKIE" -H 'content-type: application/json' -H "Idempotency-Key: $IDEM" \
    -o /tmp/iss47-proposal.json -w '%{http_code}' -X POST "$WEB/api/whatsapp/messages" -d "$1"
}
FIRST=$(post_proposal "{\"organizationId\":\"$ORG_ID\",\"accountId\":\"$ACCOUNT_ID\",\"to\":\"$RECIPIENT\",\"body\":\"$CONTENT\"}")
ACTION_ID=""
if [ "$FIRST" = "202" ]; then
  APPROVAL_REQ=$(jget /tmp/iss47-proposal.json "d.get('approvalRequired')")
  STATUS=$(jget /tmp/iss47-proposal.json "d.get('status')")
  ACTION_ID=$(jget /tmp/iss47-proposal.json "d.get('actionId')")
  if [ "$APPROVAL_REQ" = "True" ] && [ "$STATUS" = "pending" ] && [ -n "$ACTION_ID" ]; then
    pass "authorized proposal HTTP 202, approvalRequired=true, status=pending, actionId=${ACTION_ID:0:8}.. (kept private)"
  else
    fail "202 response body invalid (approvalRequired=$APPROVAL_REQ status=$STATUS)"
  fi
else
  fail "pending proposal NOT accepted (HTTP $FIRST)"
fi

# ---------------------------------------------------------------------------
# 7. Idempotent replay (same key + same payload → same action)
# ---------------------------------------------------------------------------
REPEAT=$(post_proposal "{\"organizationId\":\"$ORG_ID\",\"accountId\":\"$ACCOUNT_ID\",\"to\":\"$RECIPIENT\",\"body\":\"$CONTENT\"}")
if [ "$REPEAT" = "202" ]; then
  REPEAT_ACTION=$(jget /tmp/iss47-proposal.json "d.get('actionId')")
  if [ -n "$ACTION_ID" ] && [ "$REPEAT_ACTION" = "$ACTION_ID" ]; then
    pass "identical idempotency key retained ONE action"
  else fail "idempotent retry returned a different action"; fi
else fail "identical idempotent retry failed (HTTP $REPEAT)"; fi

# ---------------------------------------------------------------------------
# 8. Same key + changed payload → 409 conflict
# ---------------------------------------------------------------------------
CONFLICT=$(post_proposal "{\"organizationId\":\"$ORG_ID\",\"accountId\":\"$ACCOUNT_ID\",\"to\":\"$RECIPIENT\",\"body\":\"$CONTENT changed\"}")
if [ "$CONFLICT" = "409" ]; then pass "changed payload with same idempotency key HTTP 409"; else fail "idempotency conflict NOT rejected (HTTP $CONFLICT)"; fi

# ---------------------------------------------------------------------------
# 9. Read-only DB probe of the pending action row
# ---------------------------------------------------------------------------
sleep 1
if [ -n "$ACTION_ID" ]; then
  DBROW=$(sql "SELECT status, (queued_message_id IS NULL), (approved_at IS NULL), (expires_at > now()), (requested_by IS NOT NULL), payload_type FROM aca.whatsapp_send_actions WHERE id='$ACTION_ID'")
  if echo "$DBROW" | grep -q '^pending|t|t|t|t|text$'; then
    pass "DB probe: action pending, unexpired, unapproved, not queued, requested_by set, payload_type=text"
  else fail "DB probe mismatch: $DBROW"; fi
else
  log "SKIP: DB probe skipped (no actionId — 202 failed)"
fi

# ---------------------------------------------------------------------------
# 10. No-send boundary: action still pending, never queued; worker log quiet
# ---------------------------------------------------------------------------
sleep 3
if [ -n "$ACTION_ID" ]; then
  STILL=$(sql "SELECT status, (queued_message_id IS NULL) FROM aca.whatsapp_send_actions WHERE id='$ACTION_ID'")
  if echo "$STILL" | grep -q '^pending|t$'; then pass "no-send boundary: action still pending, queued_message_id still NULL"; else fail "no-send boundary violated: $STILL"; fi
  WLOG=$(docker logs --since "$T0" ai-comms-agent-worker-1 2>&1 | grep -c "$ACTION_ID" || true)
  if [ "$WLOG" = "0" ]; then pass "worker never claimed the unapproved action (0 log refs)"; else fail "worker referenced unapproved action $WLOG times"; fi
  MSGQ=$(sql "SELECT count(*) FROM aca.whatsapp_messages WHERE correlation_id IN (SELECT correlation_id FROM aca.whatsapp_send_actions WHERE id='$ACTION_ID') AND direction='outbound'")
  if [ "$MSGQ" = "0" ]; then pass "no outbound whatsapp_messages row was ever queued for this action"; else fail "outbound message row exists ($MSGQ)"; fi
fi

# ---------------------------------------------------------------------------
# 11. Log privacy scan on web container since test start
# ---------------------------------------------------------------------------
LEAKS=$(docker logs --since "$T0" ai-comms-agent-web-1 2>&1 | grep -ciE 'Failing row contains|SQLSTATE=[0-9A-Z]{5}[^0-9A-Z]|error:.*recipient_phone|error:.*message_body' || true)
if [ "$LEAKS" = "0" ]; then pass "web log privacy scan: no SQLSTATE detail/Failing-row/recipient/body leaks since $T0"; else fail "web log privacy scan found $LEAKS suspicious lines"; fi

# ---------------------------------------------------------------------------
# 12. Revoke the scoped session
# ---------------------------------------------------------------------------
REV=$(sql "UPDATE aca.auth_sessions SET revoked_at=now() WHERE token_hash='$TOKEN_HASH' AND revoked_at IS NULL RETURNING id")
if [ -n "$REV" ] && [ "${REV:0:4}" != "ERROR" ]; then pass "scoped session revoked (logout equivalent)"; else fail "session revoke failed"; fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "=== ISSUE #47 SERVER ACCEPTANCE SUMMARY (deployed SHA $DEPLOYED_SHA) ==="
if [ "$FAIL_COUNT" -eq 0 ]; then
  echo "OUTCOME: ALL CHECKS PASS ($ACTION_ID pending row left to expire; session revoked)"
  exit 0
else
  echo "OUTCOME: $FAIL_COUNT FAILURE(S) — see FAIL lines above"
  exit 1
fi
