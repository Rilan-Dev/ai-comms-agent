# ISS-026 Runtime Verification Report (OPS-01 checklist)

**Verifier:** FIX-01 / Sentinel (acting on user request; OPS-01 not in session)
**Date:** 2026-10-16
**Commit under test:** `99fd6793 fix(ISS-026): agent-scoped email context`
**Target deployment:** https://ai-comms-agent.vercel.app (Vercel)
**Target DB:** Supabase `aca` schema (organization `0e55fa86-18f3-4784-998f-ab652c641e99`)

## Checklist & Results

### ✅ Step 1 — SQL executes against the real Supabase schema

Verified that `agent_email_accounts` table exists in the `aca` schema with all columns referenced by the new JOIN:

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| agent_id | uuid | NO | — |
| email_account_id | uuid | NO | — |
| role | text | NO | 'primary'::text |
| created_at | timestamp with time zone | NO | now() |

Schema source: `supabase/migrations/0002_application_domain.sql:143`.

**Result:** ✅ PASS. JOIN column names match the migrated schema.

### ✅ Step 2 — `loadEmailContext` SQL scenarios (apps/web/src/app/api/chat/stream/route.ts)

Ran the exact SQL from the route against live Supabase for the Sarvam Chat Agent (`37bad2fc-992a-43a5-8122-f296e72968ca`) with a temp binding to the only connected mailbox in the org (`mohamedrilan.dev@gmail.com`, account_id `eb557569-bfe6-4849-894f-19eeb553b929`, 6969 messages).

Each scenario INSERTs/UPDATEs the binding inside a transaction that is rolled back at the end. The DB is left unchanged.

| Scenario | Binding | Rows returned | Verdict |
|----------|---------|---:|---------|
| D — no binding | (none) | 0 | ✅ PASS — agent without binding = zero email context |
| A — primary binding | role='primary' | 20 | ✅ PASS — primary can read inbox |
| B — read_only binding | role='read_only' | 20 | ✅ PASS — read_only can read inbox |
| C — send_only binding | role='send_only' | 0 | ✅ PASS — send_only cannot read inbox |
| E — OpenAI agent, no binding | (none) | 0 | ✅ PASS — second agent without binding = zero |
| E2 — cross-agent isolation | OpenAI=primary, Sarvam=send_only | OpenAI=20, Sarvam=0 | ✅ PASS — primary sees mail, send_only does not |

**Result:** ✅ PASS — all 6 scenarios behave correctly per ISS-026 spec.

### ✅ Step 3 — `groundContext` SQL scenarios (packages/clara-core/src/runtime.ts)

Repeated the same 6 scenarios against the rewritten `email_messages` direct query inside `groundContext()`. This is the second violation site — the hybrid retriever path that's called via `claraRuntime.createChatTurn({ ragMode: "hybrid" })` from BOTH the web chat route AND the realtime voice path.

Used lookup terms `["mohammed", "rilan", "ksa"]` and textQuery `"mohammed | rilan | ksa"` (matching Sarvam's actual search behavior for sender-specific queries).

| Scenario | Binding | Rows returned | Verdict |
|----------|---------|---:|---------|
| D — no binding | (none) | 0 | ✅ PASS |
| A — primary binding | role='primary' | 20 | ✅ PASS |
| B — read_only binding | role='read_only' | 20 | ✅ PASS |
| C — send_only binding | role='send_only' | 0 | ✅ PASS |
| E — OpenAI no binding | (none) | 0 | ✅ PASS |
| E2 — cross-agent isolation | OpenAI=primary, Sarvam=send_only | OpenAI=20, Sarvam=0 | ✅ PASS |

**Result:** ✅ PASS — all 6 scenarios behave correctly. The runtime RAG path is also agent-scoped.

### ⚠️ Step 4 — Live `/api/chat/stream` on Vercel — DEFERRED (Vercel has not auto-deployed `99fd6793`)

Queried `https://ai-comms-agent.vercel.app/api/chat/stream` with the Sarvam Chat Agent (no email bindings in DB) and message "Show me my last 5 emails".

**Expected post-fix behavior:** Response mentions agent-scoped empty state ("No locally synchronized emails or drafts were found for this agent's bound mailboxes").

**Actual behavior (observed at 06:48, 06:53, 06:58 UTC — 10-20 minutes after push):** Response dumps 20 organization-scoped emails (Indeed alerts, OpenAI newsletter, Labelbox). This is the PRE-ISS-026 behavior.

**Conclusion:** Vercel has NOT auto-deployed commit `99fd6793`. The response still contains the OLD empty-result message ("Results may be incomplete as only 20 records are available.") instead of the NEW one ("for this agent's bound mailboxes"). Vercel's GitHub integration appears to require a manual deploy trigger for this project — this is consistent with what the user noted earlier in the conversation ("Vercel auto-deploy may be disabled").

**Result:** ⚠️ DEFERRED — runtime SQL is verified correct (Steps 1-3), but live endpoint verification cannot PASS until Vercel deploys `99fd6793`. The user must trigger a manual Vercel deploy (or wait for the auto-deploy queue to drain) before this step can be re-run.

## Aggregate Verdict

| Step | Result |
|------|--------|
| 1. Schema check | ✅ PASS |
| 2. `loadEmailContext` SQL scenarios | ✅ PASS (6/6) |
| 3. `groundContext` SQL scenarios | ✅ PASS (6/6) |
| 4. Live Vercel endpoint | ⚠️ DEFERRED — Vercel hasn't deployed `99fd6793` |

**ISS-026 source remediation is verified correct at the SQL level against the live Supabase schema.** Cross-agent mailbox isolation holds for all role permutations (primary / read_only / send_only / no binding) on BOTH violation sites (web route + clara-core runtime). The live Vercel endpoint verification is pending the deployment of `99fd6793` to production — OPS-01 should re-run Step 4 once Vercel deploys the commit.

## Test Artifacts

- `/home/z/my-project/scripts/verify-iss026-step1-schema.mjs` — schema + bindings inventory
- `/home/z/my-project/scripts/verify-iss026-step2-bindings.mjs` — loadEmailContext SQL scenarios
- `/home/z/my-project/scripts/verify-iss026-step3-groundcontext.mjs` — groundContext SQL scenarios
- `/home/z/my-project/scripts/verify-iss026-step4-live.mjs` — live Vercel endpoint check
