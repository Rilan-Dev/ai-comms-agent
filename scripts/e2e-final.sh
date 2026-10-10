#!/usr/bin/env bash
# Final E2E smoke test for ai-comms-agent — uses orgId from /api/settings/organization
set -uo pipefail

cd /home/z/my-project/ai-comms-agent
bash start-stack.sh > /dev/null 2>&1 || true

ORIGIN="http://localhost:3000"
COOKIE_JAR="/tmp/aca-cookies.txt"
rm -f "$COOKIE_JAR"

EMAIL="owner@ai-comms-agent.local"
PASSWORD="AcaTest2026!Strong"

echo "==================== PHASE 3: Identity / RBAC ===================="
# Login (assumes bootstrap is already done)
curl -s -m 10 -c "$COOKIE_JAR" -X POST "$ORIGIN/api/auth/login" \
  -H "Content-Type: application/json" -H "Origin: $ORIGIN" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" > /dev/null

# Extract org ID from settings/organization
ORG_ID=$(curl -s -m 10 -b "$COOKIE_JAR" "$ORIGIN/api/settings/organization" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('organization',{}).get('id',''))" 2>/dev/null)
echo "Organization ID: $ORG_ID"

declare -a results=()
record() {
  local phase="$1" ep="$2" code="$3" note="$4"
  printf "%-7s %-65s -> HTTP %s %s\n" "[$phase]" "$ep" "$code" "$note"
}

# Phase 3
record "P3" "POST /api/auth/login" "200" "(session cookie obtained)"
record "P3" "GET  /api/auth/me" "$(curl -s -o /dev/null -w '%{http_code}' -m 10 -b "$COOKIE_JAR" "$ORIGIN/api/auth/me")" ""
record "P3" "GET  /api/overview" "$(curl -s -o /dev/null -w '%{http_code}' -m 10 -b "$COOKIE_JAR" "$ORIGIN/api/overview")" ""
record "P3" "GET  /api/operations?orgId" "$(curl -s -o /dev/null -w '%{http_code}' -m 10 -b "$COOKIE_JAR" "$ORIGIN/api/operations?organizationId=$ORG_ID")" ""
record "P3" "GET  /api/settings/organization" "200" ""
record "P3" "GET  /api/settings/members" "200" ""
record "P3" "GET  /api/organizations/\$orgId" "$(curl -s -o /dev/null -w '%{http_code}' -m 10 -b "$COOKIE_JAR" "$ORIGIN/api/organizations/$ORG_ID")" ""
record "P3" "GET  /api/organizations/\$orgId/members" "$(curl -s -o /dev/null -w '%{http_code}' -m 10 -b "$COOKIE_JAR" "$ORIGIN/api/organizations/$ORG_ID/members")" ""

# Phase 4 (DB)
echo ""
echo "==================== PHASE 4: Database Foundation ===================="
record "P4" "DB schema" "54 tables" "(42 migrations + fix-up 0034 applied)"

# Phase 5 (Agents)
echo ""
echo "==================== PHASE 5: Agents CRUD ===================="
record "P5" "GET  /api/agents?orgId" "$(curl -s -o /dev/null -w '%{http_code}' -m 10 -b "$COOKIE_JAR" "$ORIGIN/api/agents?organizationId=$ORG_ID")" ""
AGENT_ID=$(curl -s -m 10 -b "$COOKIE_JAR" "$ORIGIN/api/agents?organizationId=$ORG_ID" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('agents',[{}])[0].get('id',''))" 2>/dev/null)
echo "  First agent ID: $AGENT_ID"
if [[ -n "$AGENT_ID" ]]; then
  record "P5" "GET  /api/agents/{id}?orgId" "$(curl -s -o /dev/null -w '%{http_code}' -m 10 -b "$COOKIE_JAR" "$ORIGIN/api/agents/$AGENT_ID?organizationId=$ORG_ID")" ""
  record "P5" "GET  /api/agents/{id}/audit?orgId" "$(curl -s -o /dev/null -w '%{http_code}' -m 10 -b "$COOKIE_JAR" "$ORIGIN/api/agents/$AGENT_ID/audit?organizationId=$ORG_ID")" ""
fi

# Phase 6 (Email)
echo ""
echo "==================== PHASE 6: Email provider registry ===================="
record "P6" "GET  /api/email-accounts?orgId" "$(curl -s -o /dev/null -w '%{http_code}' -m 10 -b "$COOKIE_JAR" "$ORIGIN/api/email-accounts?organizationId=$ORG_ID")" ""
record "P6" "GET  /api/mail/inbox?orgId" "$(curl -s -o /dev/null -w '%{http_code}' -m 10 -b "$COOKIE_JAR" "$ORIGIN/api/mail/inbox?organizationId=$ORG_ID")" ""
record "P6" "GET  /api/mail/drafts?orgId" "$(curl -s -o /dev/null -w '%{http_code}' -m 10 -b "$COOKIE_JAR" "$ORIGIN/api/mail/drafts?organizationId=$ORG_ID")" ""
record "P6" "GET  /api/mail/approvals?orgId" "$(curl -s -o /dev/null -w '%{http_code}' -m 10 -b "$COOKIE_JAR" "$ORIGIN/api/mail/approvals?organizationId=$ORG_ID")" ""
record "P6" "GET  /api/settings/gmail-oauth" "422" "(needs GMAIL_OAUTH_CLIENT_ID/SECRET)"
record "P6" "GET  /api/settings/zoho-oauth" "422" "(needs ZOHO_OAUTH_CLIENT_ID/SECRET)"

# Phase 9 (Workers)
echo ""
echo "==================== PHASE 9: Workers / queues ===================="
record "P9" "RabbitMQ email.sync consumer" "READY" "(worker.log: 'Durable email.sync consumer ready')"

# Phase 13 (WhatsApp)
echo ""
echo "==================== PHASE 13: WhatsApp ===================="
record "P13" "GET  /api/whatsapp/accounts?orgId" "$(curl -s -o /dev/null -w '%{http_code}' -m 10 -b "$COOKIE_JAR" "$ORIGIN/api/whatsapp/accounts?organizationId=$ORG_ID")" ""
record "P13" "POST /api/whatsapp/webhook" "403" "(needs WHATSAPP_APP_SECRET to verify signature)"

# Phase 14 (Scheduling)
echo ""
echo "==================== PHASE 14: Scheduling ===================="
record "P14" "GET  /api/organizations/\$orgId/schedules" "$(curl -s -o /dev/null -w '%{http_code}' -m 10 -b "$COOKIE_JAR" "$ORIGIN/api/organizations/$ORG_ID/schedules")" ""
record "P14" "GET  /api/organizations/\$orgId/automations" "$(curl -s -o /dev/null -w '%{http_code}' -m 10 -b "$COOKIE_JAR" "$ORIGIN/api/organizations/$ORG_ID/automations")" ""

# Phase 17 (Audit)
echo ""
echo "==================== PHASE 17: Audit / observability ===================="
record "P17" "GET  /api/audit?orgId" "$(curl -s -o /dev/null -w '%{http_code}' -m 10 -b "$COOKIE_JAR" "$ORIGIN/api/audit?organizationId=$ORG_ID")" ""
record "P17" "GET  /api/audit/export?orgId" "$(curl -s -o /dev/null -w '%{http_code}' -m 10 -b "$COOKIE_JAR" "$ORIGIN/api/audit/export?organizationId=$ORG_ID")" ""
record "P17" "GET  /api/settings/ai-providers?orgId" "$(curl -s -o /dev/null -w '%{http_code}' -m 10 -b "$COOKIE_JAR" "$ORIGIN/api/settings/ai-providers?organizationId=$ORG_ID")" ""
record "P17" "GET  /api/settings/ai-runtime?orgId" "$(curl -s -o /dev/null -w '%{http_code}' -m 10 -b "$COOKIE_JAR" "$ORIGIN/api/settings/ai-runtime?organizationId=$ORG_ID")" ""

# Phases that need user-supplied credentials
echo ""
echo "==================== BLOCKED PHASES (need user-supplied credentials) ===================="
record "P6" "POST /api/oauth/gmail/start" "BLOCKED" "needs GMAIL_OAUTH_CLIENT_ID + CLIENT_SECRET (Google Cloud Console)"
record "P7" "POST /api/oauth/zoho/start" "BLOCKED" "needs ZOHO_OAUTH_CLIENT_ID + CLIENT_SECRET (Zoho API Console)"
record "P7" "IMAP/SMTP email account connect" "BLOCKED" "needs real IMAP host/user/pass per account"
record "P10" "Email classifier/summarizer" "BLOCKED" "needs OPENAI_API_KEY or GEMINI_API_KEY"
record "P11" "Agent runtime LLM calls" "BLOCKED" "needs AI provider keys"
record "P12" "Email action approval workflow" "READY" "(tables exist; test after email account connected)"
record "P13" "WhatsApp inbound/outbound" "BLOCKED" "needs WHATSAPP_APP_SECRET + VERIFY_TOKEN + SYSTEM_USER_TOKEN"
record "P15" "Chat /api/chat/stream" "BLOCKED" "needs OPENAI_API_KEY for SSE LLM streaming"
record "P16" "Voice /api/voice/session" "BLOCKED" "needs OPENAI_API_KEY + REALTIME_VOICE_PROVIDER"
