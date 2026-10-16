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

### ⚠️ Step 4 — Live `/api/chat/stream` on Vercel — DEFERRED (Vercel has not auto-deployed)

Queried `https://ai-comms-agent.vercel.app/api/chat/stream` with the Sarvam Chat Agent (no email bindings in DB) and message "Show me my last 5 emails".

**Expected post-fix behavior:** Response mentions agent-scoped empty state ("No locally synchronized emails or drafts were found for this agent's bound mailboxes").

**Actual behavior (observed at 06:48, 06:53, 06:58, 09:51, 09:57 UTC — multiple checks across ~3 hours):** Response still dumps 20 organization-scoped emails (Indeed alerts, OpenAI newsletter, Labelbox). This is the PRE-ISS-026 behavior.

**Build blocker discovered (commit `d264682`, PR #27):** Between my ISS-026 fix (`99fd6793`) and the live verification, PR #27 (`fix/voice-transport-contract`) merged with a TypeScript build error:

```
./src/app/ai-voice/voice-workspace.tsx:163:11
Type error: Property 'playsInline' does not exist on type 'HTMLAudioElement'.
```

This blocked Vercel from building main — neither `99fd6793` nor `d264682` could deploy. I fixed the build blocker in commit `613a019d fix(voice): drop imperative audio.playsInline + guard event.streams[0]` — removed the redundant imperative `audio.playsInline = true;` (the JSX `<audio playsInline />` already sets the attribute declaratively) and added an `if (!remoteStream) return;` guard on `event.streams[0]` (noUncheckedIndexedAccess makes it `MediaStream | undefined`). tsc clean, 20/20 tests pass (5 voice-realtime + 13 chat-memory-regression + 2 chat-authorization).

**Conclusion:** Vercel build is unblocked. Vercel's GitHub auto-deploy for this project appears to require a manual trigger (consistent with prior observations in this conversation). The user must:

1. Open the Vercel project dashboard → Deployments → "Redeploy" or trigger a new deployment for the latest main commit (`613a019d`).
2. Wait for the build to complete (typically 1-3 minutes).
3. Re-run: `node scripts/verify-iss026-step4-live.mjs`
4. Expected post-deploy: response says "No locally synchronized emails or drafts were found for this agent's bound mailboxes." instead of dumping 20 org-wide emails.

**Result:** ⚠️ DEFERRED — runtime SQL is verified correct (Steps 1-3), build blocker is fixed (`613a019d`). Live endpoint verification cannot PASS until Vercel deploys `613a019d` to production. The user must trigger the deploy manually.

## Aggregate Verdict

| Step | Result |
|------|--------|
| 1. Schema check | ✅ PASS |
| 2. `loadEmailContext` SQL scenarios | ✅ PASS (6/6) |
| 3. `groundContext` SQL scenarios | ✅ PASS (6/6) |
| 4. Live Vercel endpoint | ⚠️ DEFERRED — Vercel auto-deploy pending; build blocker fixed in `613a019d` |

**Build blocker chronology:**
- `99fd6793` (ISS-026 fix) pushed at 06:38 UTC
- `d264682` (PR #27 voice transport contract) merged after — introduced `audio.playsInline` TS error
- Vercel build failed at `d264682` (user shared log: `F5kt5h3FTtfKZfQ4E3tavnvew2z1`)
- `613a019d` (voice build blocker fix) pushed at 09:47 UTC — tsc clean, 20/20 tests pass
- Vercel auto-deploy still pending at 09:57 UTC (10 minutes after `613a019d` push)

**ISS-026 source remediation is verified correct at the SQL level against the live Supabase schema.** Cross-agent mailbox isolation holds for all role permutations (primary / read_only / send_only / no binding) on BOTH violation sites (web route + clara-core runtime). The live Vercel endpoint verification is pending the deployment of `99fd6793` to production — OPS-01 should re-run Step 4 once Vercel deploys the commit.

## Test Artifacts

- `/home/z/my-project/scripts/verify-iss026-step1-schema.mjs` — schema + bindings inventory
- `/home/z/my-project/scripts/verify-iss026-step2-bindings.mjs` — loadEmailContext SQL scenarios
- `/home/z/my-project/scripts/verify-iss026-step3-groundcontext.mjs` — groundContext SQL scenarios
- `/home/z/my-project/scripts/verify-iss026-step4-live.mjs` — live Vercel endpoint check
