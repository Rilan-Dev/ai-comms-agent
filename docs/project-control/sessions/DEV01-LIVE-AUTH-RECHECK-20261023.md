# DEV-01 / Forge — live authentication recheck, 2026-10-23

## Outcome and evidence

This checkpoint supersedes the earlier blanket statement that login was impossible. Access is intermittent: the root returned HTTP 307 to `/login?next=%2F`; that exact login route loaded HTTP 200 once with the real email/password form. Subsequent form navigations timed out before submission, including a `waitUntil: commit` diagnostic (so the timeout is not just waiting for a frontend bundle). The ordinary same-origin `/api/auth/login` endpoint accepted the owner-provided credentials with HTTP 200. Authenticated `/api/auth/me` independently returned HTTP 200 with the supplied active account. No alternative identity or elevated session was used.

Browser context loaded that ordinary authenticated session and successfully displayed the actual `/chat` frontend. Existing Chat history includes QA summaries, saved-draft references, email send requests and a WhatsApp pending-approval reference. Those were **already present before this session's interactions**, not newly performed tests, current server confirmations or proof of delivery. Do not create duplicate sends from those historic statements. Current actor/agent grants and pending action status still require authoritative review.

Other requests remained unreliable: `/whatsapp` and subsequent Chat loads timed out; `/api/settings/organization` returned non-JSON HTML in one attempt and timed out in another. Switching the browser diagnostic from HTTP/2 to HTTP/1 did not restore reliable access: it returned a Cloudflare error surface (Click to reveal control, no application controls). Together with the previously observed 522 and successful edge trace, this indicates intermittent origin-path/application availability, not rejected credentials. The exact underlying origin fault remains OPS-01-owned and unproven without server/proxy logs.

No new Chat prompt, email draft, approval, permission change, email send or WhatsApp send was performed in this recheck. A successful login is not proof that downstream AI, database, mailbox or message delivery is healthy. Session cookies are kept only in a restricted local browser-state file outside the checkout. Credentials/session data were not included in GitHub records.

## Fresh repository verification

At Development `3a0eb1f2`, ran seven existing native suites: Chat inline email approval, compose access, saved-draft approval idempotency, WhatsApp route boundary, WhatsApp tool setup, approval queue race and rolling mail summary. **38 passed, 0 failed, 0 skipped.** An initial run against the earlier tip had 37 passed/1 failed: a single-line regex did not match the actual multi-line notice reset. Concurrent FIX-01 commits `81c87781`/`afcd3a29` corrected the test/refresh code; pulled by fast-forward, reran the whole focused group, and confirmed 38/38. No local product source was changed. These are source/pure-behavior checks, not live user-role, provider or delivery acceptance.

## Remaining checks and exact continuation

The [F01–F21 frontend matrix](DEV01-DEVELOPMENT-FRONTEND-ACCEPTANCE-20261023.md) remains the execution checklist. **F01 is partially verified:** normal authentication and one actual Chat page load succeeded; agent/mailbox/permission readiness is not yet established. F02–F21 remain unexecuted in this recheck. Existing transcript content cannot close those cases.

OPS-01: inspect origin/reverse-proxy/Cloudflare request logs for intermittent login, Chat, WhatsApp and organization-context responses; compare the successful login and auth/me routes, and confirm deployed SHA. Restore reliable application requests before DEV-01 continues. No infrastructure restart/deploy was performed here.

DEV-01: once reliable, review the currently stored QA draft/approval states first, use a distinct conversation/test marker for any new work, compare actual authorized inbox records with AI summaries, exercise saved draft/approval pending/rejected/granted and permission-denied cases, then one benign WhatsApp test to the owner's specified number ending 4701 through normal human/provider approval. Never count pending/queued as delivered. Record authoritative action/provider IDs and uncertain send outcomes before any retry. Keep existing source history and ordinary permission controls intact.

Phase 4 remains implementation_in_progress. C3 background registration and standing routines remain gated; this user-authorized one-off test does not activate recurring delivery.


Final frontend probe: authenticated `/mail/approvals` rendered Cloudflare **522 Host Error**, with Browser Working / Cloudflare Working, timestamp 2026-10-23 15:51:04 UTC (21:21:04 Asia/Kolkata), Ray ID `a4f1e6333a40710e`. No approval controls were present. This directly blocks review/approve/reject and is not an application approval decision.
