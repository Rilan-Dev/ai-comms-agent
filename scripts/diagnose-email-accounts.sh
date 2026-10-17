#!/usr/bin/env bash
# Safe diagnostics for deployed email accounts. Never prints cookies or passwords.
set -uo pipefail
PUBLIC_BASE_URL="$(printenv PUBLIC_BASE_URL 2>/dev/null || true)"
LOCAL_BASE_URL="$(printenv LOCAL_BASE_URL 2>/dev/null || true)"
COMPOSE_FILE="$(printenv COMPOSE_FILE 2>/dev/null || true)"
ENV_FILE="$(printenv ENV_FILE 2>/dev/null || true)"
REPORT="$(printenv REPORT 2>/dev/null || true)"
[[ -n "$PUBLIC_BASE_URL" ]] || PUBLIC_BASE_URL="https://aca.ostechnologies.in"
[[ -n "$LOCAL_BASE_URL" ]] || LOCAL_BASE_URL="http://127.0.0.1:3300"
[[ -n "$COMPOSE_FILE" ]] || COMPOSE_FILE="infra/docker-compose.yml"
[[ -n "$ENV_FILE" ]] || ENV_FILE=".env.docker"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
[[ -n "$REPORT" ]] || REPORT="email-diagnostics-$STAMP.txt"
TMP_DIR="$(mktemp -d)"; chmod 700 "$TMP_DIR"
COOKIE=""; IMAP_PASSWORD=""; LAST_CODE=""; ORG_ID=""
trap 'unset COOKIE IMAP_PASSWORD; rm -rf "$TMP_DIR"' EXIT
baseurl() { printf '%s' "$1" | sed 's:/*$::'; }
redact() {
  sed -E -e 's/(password|passwd|secret|access[_ -]?token|refresh[_ -]?token|authorization|cookie)([=: ]+)[^ ,;"]+/\1\2[REDACTED]/Ig' \
    -e 's/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/[EMAIL]/Ig' \
    -e 's/(Bearer )[A-Za-z0-9._~+\/=-]+/\1[REDACTED]/Ig'
}
log() { printf '%s\n' "$*" | tee -a "$REPORT"; }
section() { log ""; log "===== $* ====="; }
request() {
  local label="$1" method="$2" url="$3" data_file="" out="$TMP_DIR/response" rc=0
  if (( $# >= 4 )); then data_file="$4"; fi
  local auth_cfg="$TMP_DIR/curl-auth.conf"
  if [[ -n "$COOKIE" ]]; then printf 'header = "Cookie: %s"\n' "$COOKIE" > "$auth_cfg"; chmod 600 "$auth_cfg"; fi
  if [[ -n "$data_file" ]]; then
    if [[ -n "$COOKIE" ]]; then
      LAST_CODE="$(curl --config "$auth_cfg" -sS --connect-timeout 5 --max-time 30 -X "$method" -H 'Content-Type: application/json' --data-binary "@$data_file" -o "$out" -w '%{http_code}' "$url" 2>"$TMP_DIR/curl.err")" || rc=$?
    else
      LAST_CODE="$(curl -sS --connect-timeout 5 --max-time 30 -X "$method" -H 'Content-Type: application/json' --data-binary "@$data_file" -o "$out" -w '%{http_code}' "$url" 2>"$TMP_DIR/curl.err")" || rc=$?
    fi
  else
    if [[ -n "$COOKIE" ]]; then
      LAST_CODE="$(curl --config "$auth_cfg" -sS --connect-timeout 5 --max-time 20 -X "$method" -o "$out" -w '%{http_code}' "$url" 2>"$TMP_DIR/curl.err")" || rc=$?
    else
      LAST_CODE="$(curl -sS --connect-timeout 5 --max-time 20 -X "$method" -o "$out" -w '%{http_code}' "$url" 2>"$TMP_DIR/curl.err")" || rc=$?
    fi
  fi
  [[ -n "$LAST_CODE" ]] || LAST_CODE="000"
  log "$label: HTTP $LAST_CODE (curl_exit=$rc)"
  if [[ -s "$TMP_DIR/curl.err" ]]; then redact < "$TMP_DIR/curl.err" | tee -a "$REPORT" >/dev/null; fi
  if [[ -s "$out" ]]; then
    python3 - "$out" <<'PY' 2>/dev/null | redact | tee -a "$REPORT"
import json,sys
try:
 o=json.load(open(sys.argv[1],encoding="utf-8"))
 if isinstance(o,dict):
  keep={k:o[k] for k in ("status","error","message","reason","queued","ok","checks","fieldErrors") if k in o}
  if isinstance(o.get("accounts"),list):
   keep["accounts"]=[{k:a.get(k) for k in ("id","provider","status","last_synced_at","created_at") if a.get(k) is not None} for a in o["accounts"] if isinstance(a,dict)]
  print(json.dumps(keep if keep else {"response_keys":sorted(o.keys())},ensure_ascii=False))
 else: print("Response JSON type:",type(o).__name__)
except Exception:
 print("Non-JSON response preview:",open(sys.argv[1],encoding="utf-8",errors="replace").read(250).replace("\n"," "))
PY
  fi
}
if ! command -v curl >/dev/null || ! command -v python3 >/dev/null; then echo "ERROR: curl and python3 are required." >&2; exit 2; fi
: > "$REPORT"; chmod 600 "$REPORT"
log "Email account diagnostics — UTC $STAMP"
log "Public URL: $(baseurl "$PUBLIC_BASE_URL")"; log "Local origin: $(baseurl "$LOCAL_BASE_URL")"
log "Cookie/password values are not included in the report."

section "Docker state"
if command -v docker >/dev/null && [[ -f "$ENV_FILE" && -f "$COMPOSE_FILE" ]]; then
 docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps 2>&1 | redact | tee -a "$REPORT" || true
else log "Docker state skipped: Docker, env file, or compose file missing."; fi

section "Public versus local liveness"
request "Public /api/health" GET "$(baseurl "$PUBLIC_BASE_URL")/api/health"
request "Local /api/health" GET "$(baseurl "$LOCAL_BASE_URL")/api/health"
request "Public /api/ready" GET "$(baseurl "$PUBLIC_BASE_URL")/api/ready"
request "Local /api/ready" GET "$(baseurl "$LOCAL_BASE_URL")/api/ready"

section "Authenticated account API"
read -r -s -p "Browser Cookie header value (hidden; Enter to skip): " COOKIE; printf '\n'
if [[ -n "$COOKIE" ]]; then
 read -r -p "Active organization ID: " ORG_ID
 if [[ -n "$ORG_ID" ]]; then
  ENCODED_ORG="$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1],safe=""))' "$ORG_ID")"
  python3 - "$TMP_DIR/org.json" "$ORG_ID" <<'PY'
import json,sys
with open(sys.argv[1],"w",encoding="utf-8") as f: json.dump({"organizationId":sys.argv[2]},f)
PY
  chmod 600 "$TMP_DIR/org.json"
  request "Public GET email accounts" GET "$(baseurl "$PUBLIC_BASE_URL")/api/email-accounts?organizationId=$ENCODED_ORG"
  request "Local GET email accounts" GET "$(baseurl "$LOCAL_BASE_URL")/api/email-accounts?organizationId=$ENCODED_ORG"
  read -r -p "Account ID for manual sync (Enter to skip; current endpoint supports Gmail only): " ACCOUNT_ID
  if [[ -n "$ACCOUNT_ID" ]]; then
   ENCODED_ACCOUNT="$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1],safe=""))' "$ACCOUNT_ID")"
   request "Public POST manual sync" POST "$(baseurl "$PUBLIC_BASE_URL")/api/email-accounts/$ENCODED_ACCOUNT/sync" "$TMP_DIR/org.json"
   if [[ "$LAST_CODE" == "202" ]]; then log "Sync accepted; waiting 35 seconds for worker polling."; sleep 35; fi
  fi
 fi
else log "Authenticated API tests skipped."; fi

section "Optional non-persistent IMAP/SMTP test"
read -r -p "Test IMAP/SMTP now? This does NOT save the mailbox. [y/N] " DO_IMAP
if [[ "$DO_IMAP" =~ ^[Yy]$ ]]; then
 if [[ -z "$COOKIE" || -z "$ORG_ID" ]]; then log "Skipped: session cookie and organization ID are required."
 else
  read -r -p "Mailbox email address: " IMAP_EMAIL
  read -r -p "IMAP hostname: " IMAP_HOST
  read -r -p "IMAP TLS port (usually 993): " IMAP_PORT
  read -r -p "SMTP hostname: " SMTP_HOST
  read -r -p "SMTP TLS port (usually 465): " SMTP_PORT
  read -r -p "Mailbox username (often full email): " IMAP_USER
  read -r -s -p "Mailbox password/app-password (hidden): " IMAP_PASSWORD; printf '\n'; export IMAP_PASSWORD
  python3 - "$TMP_DIR/imap-test.json" "$ORG_ID" "$IMAP_EMAIL" "$IMAP_HOST" "$IMAP_PORT" "$SMTP_HOST" "$SMTP_PORT" "$IMAP_USER" <<'PY'
import json,os,sys
p,org,email,ih,ip,sh,sp,user=sys.argv[1:]
with open(p,"w",encoding="utf-8") as f:
 json.dump({"organizationId":org,"action":"test_imap_smtp","emailAddress":email,"host":ih,"port":int(ip),"smtpHost":sh,"smtpPort":int(sp),"username":user,"password":os.environ.get("IMAP_PASSWORD",""),"tls":True},f)
PY
  chmod 600 "$TMP_DIR/imap-test.json"
  log "Same non-persistent connection test is run through Cloudflare and local origin."
  request "Public IMAP/SMTP test" POST "$(baseurl "$PUBLIC_BASE_URL")/api/email-accounts" "$TMP_DIR/imap-test.json"
  request "Local IMAP/SMTP test" POST "$(baseurl "$LOCAL_BASE_URL")/api/email-accounts" "$TMP_DIR/imap-test.json"
  unset IMAP_PASSWORD
  if [[ "$LAST_CODE" == "200" ]]; then
   read -r -p "Local test returned HTTP 200. Save/update this mailbox? Type SAVE to confirm: " DO_SAVE
   if [[ "$DO_SAVE" == "SAVE" ]]; then
    python3 - "$TMP_DIR/imap-save.json" "$TMP_DIR/imap-test.json" <<'PY'
import json,sys
p,src=sys.argv[1:]
o=json.load(open(src,encoding="utf-8")); o["action"]="connect_imap_smtp"
with open(p,"w",encoding="utf-8") as f: json.dump(o,f)
PY
    chmod 600 "$TMP_DIR/imap-save.json"
    log "Saving through local origin; an existing account with the same organization/provider/email is updated."
    request "Local POST save IMAP/SMTP account" POST "$(baseurl "$LOCAL_BASE_URL")/api/email-accounts" "$TMP_DIR/imap-save.json"
   else log "Mailbox not saved."; fi
  else log "Save skipped because local test did not return HTTP 200."; fi
 fi
else log "IMAP/SMTP test skipped."; fi

section "Read-only PostgreSQL sync snapshot"
if command -v docker >/dev/null && [[ -f "$ENV_FILE" && -f "$COMPOSE_FILE" ]]; then
 docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T web sh -lc 'cd /workspace/packages/db && node -' <<'NODE' 2>&1 | redact | tee -a "$REPORT" || true
const { Client } = require("pg");
(async () => {
 if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set in web container");
 const c = new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:8000}); await c.connect();
 const sql = "SELECT a.id,a.provider,a.status AS account_status,COALESCE(s.status::text,'no_sync_state') AS sync_status,"+
 "to_char(s.last_attempt_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS last_attempt_utc,"+
 "to_char(s.last_success_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS last_success_utc,"+
 "to_char(s.next_attempt_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS next_attempt_utc,"+
 "s.error_count,left(COALESCE(s.last_error,''),250) AS last_error,"+
 "(SELECT count(*)::int FROM email_messages m WHERE m.email_account_id=a.id) AS stored_messages "+
 "FROM email_accounts a LEFT JOIN email_sync_states s ON s.email_account_id=a.id WHERE a.deleted_at IS NULL ORDER BY a.created_at DESC LIMIT 100";
 const r=await c.query(sql);
 const scrub=v=>String(v??"").replace(/(password|passwd|secret|access[_ -]?token|refresh[_ -]?token|authorization)\s*[:=]\s*[^\s,;]+/ig,"$1=[REDACTED]").replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig,"[EMAIL]");
 console.log(JSON.stringify({database_query:"success",account_count:r.rows.length,accounts:r.rows.map(x=>({...x,last_error:scrub(x.last_error)}))},null,2)); await c.end();
})().catch(e=>{console.log(JSON.stringify({database_query:"failed",error:String(e.message||e).replace(/(password|passwd|secret|token)\s*[:=]\s*[^\s,;]+/ig,"$1=[REDACTED]")}));process.exitCode=1;});
NODE
else log "Database snapshot skipped: Docker compose config unavailable."; fi

section "Relevant recent web/worker logs (sanitized)"
if command -v docker >/dev/null && [[ -f "$ENV_FILE" && -f "$COMPOSE_FILE" ]]; then
 (docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --since=60m --tail=500 web worker 2>&1 || true) |
  grep -Ei 'email|mailbox|sync|oauth|imap|smtp|redis|rabbit|postgres|error|warn|exception|failed|denied|timeout|ENOTFOUND|ECONN|TLS' |
  tail -n 180 | redact | tee -a "$REPORT" || true
else log "Logs skipped: Docker compose config unavailable."; fi
section "Finished"
log "Report saved to: $REPORT"
log "Review before sharing; never share cookies, passwords, OAuth codes/tokens, or full mailbox content."
