# Provider-Neutral Real-Time Email Sync — Implementation Plan

**Status:** approved implementation direction; staged implementation in progress  
**Owner:** DEV-01 / Forge for application code; OPS-01 for provider cloud setup and deployment; FIX-01 / Sentinel for cross-tenant/security defects  
**Goal:** incoming messages appear in the AI Comms Agent inbox automatically, with no manual Sync action, across all providers the account actually supports.

## 1. User-visible service target

- Keep the mailbox connection alive where the provider supports server notifications.
- Aim for a new email to be persisted and visible within a few seconds under normal conditions; this is a target, not a guarantee from every mail provider or network.
- Do not make UI freshness depend on a manual sync button.
- Keep manual/full sync as an optional recovery tool for backfills, provider outages, missed events and user-requested repair.
- Initial mailbox import is a separate state: show progress and keep retrying until it is complete. Do not claim "connected and live" merely because OAuth succeeds.
- Never acknowledge a provider event or advance a sync cursor before its changes have been durably checkpointed.

## 2. Provider strategy (capability-driven; no false universal push claim)

| Provider type | Preferred change signal | Durable reconciliation | Fallback |
|---|---|---|---|
| Gmail / Google Workspace | Gmail API `users.watch` -> Google Cloud Pub/Sub -> authenticated webhook | Decode notification, call Gmail History API from stored history ID, enqueue idempotent sync job, persist changes, then checkpoint history ID | Incremental history poll; full resync on expired history ID |
| Microsoft 365 / Outlook (future adapter) | Microsoft Graph change notifications / subscriptions | Validate notification, use delta queries, renew subscriptions before expiry | Delta polling |
| Generic IMAP provider | Persistent TLS IMAP connection with IDLE where server advertises it | On EXISTS/EXPUNGE/VANISHED, leave IDLE and run UID/UIDVALIDITY/CONDSTORE-aware reconciliation | Bounded polling if IDLE unsupported/disconnected |
| Zoho Mail | Official supported webhook/event mechanism when configured and validated; otherwise IMAP IDLE or provider API polling | Reconcile via Zoho API/IMAP cursor, never trust webhook payload as the complete mailbox state | Bounded polling |
| Other SMTP/IMAP providers | SMTP is outbound only; IMAP IDLE is the inbound notification mechanism | Same UID-based reconciliation | Bounded polling |

A provider-neutral contract exposes *change signals*, not a promise that every provider has a push API. Capabilities are only true after implementation and verification. SMTP never receives inbound messages; it is not a sync mechanism.

## 3. Target event pipeline

1. **Signal:** provider push/webhook or IMAP IDLE reports a mailbox change.
2. **Authenticate:** validate provider identity (Google Pub/Sub OIDC JWT / configured audience and service account, provider-specific webhook signature or authenticated IMAP TLS session). Reject unverified notifications.
3. **Resolve account:** map provider mailbox identity to exactly one connected account using normalized address and provider metadata; never accept tenant/account IDs supplied by an untrusted webhook as authorization.
4. **Queue:** publish an idempotent account-scoped sync event. Webhook handlers return quickly and do not fetch entire messages inline.
5. **Reconcile:** worker fetches changes from provider cursor/history/UID state. Notification bodies are hints, not authoritative message content.
6. **Persist:** upsert messages/threads/folders in PostgreSQL with account/provider scoped unique keys. Preserve failed IDs in durable pending state.
7. **Checkpoint:** commit the provider cursor only after the corresponding writes have succeeded. Use leases and idempotency to prevent duplicate workers.
8. **UI update:** browser uses a short, visibility-aware refresh initially; evolve to SSE/WebSocket or authenticated server events only if needed. UI must query the authenticated organization and never trust a client-supplied organization ID without authorization.
9. **Recovery:** periodic reconciliation remains enabled even for push-enabled accounts, because notifications can be delayed, duplicated, or dropped.
10. **Observability:** record provider, account ID, event ID/history ID, enqueue result, sync latency, fetched/saved/skipped/failed counts, cursor and retry state. Never log tokens, app passwords, message bodies or raw notification secrets.

## 4. Current implementation facts

- The inbox server page reads persisted PostgreSQL messages; it does not directly connect to a mail provider.
- The inbox client previously refreshed only after user actions/search changes. The current branch adds a 5-second, visibility-aware refresh of the inbox API so newly persisted mail can appear without clicking Sync.
- The worker has a periodic mailbox loop and a two-minute stale-account eligibility threshold. This is fallback polling, not instant push.
- Gmail adapter still reports `sync_webhook: false` until the new Pub/Sub receiver and watch lifecycle are verified. Source now includes watch/profile/stop methods, a worker renewal loop, authenticated webhook, and durable immediate-sync trigger (`pending_push_at` + `next_attempt_at`); live notification delivery and History API end-to-end behavior remain unverified.
- IMAP/SMTP adapter currently reports `sync_idle: false`; a persistent, reconnecting IDLE session is not implemented. Do not advertise IDLE until the socket lifecycle and recovery tests pass.
- Zoho webhook support must be validated against the actual API/account capabilities; keep polling/IMAP fallback where a push integration is unavailable.
- Provider sync and browser refresh are separate: provider signal -> DB persistence -> UI refresh. UI polling alone cannot fix provider ingestion failures.
- The previous Gmail batch Content-ID mapping fix and persistence-checkpoint fix are in the current feature line, but the latest test suite/typecheck and production behavior must be rerun/observed after deployment.

## 5. Implementation work packages

### RT-01 — Inbox live refresh (started)
- Poll the authorized inbox endpoint every five seconds while the tab is visible; refresh immediately when tab becomes visible.
- Keep current filters/account selection, avoid overlapping requests, silently retry transient failures.
- Keep manual refresh/sync available as a recovery action, not a normal requirement.
- Test filter preservation, visibility pause/resume, no overlapping requests, and fresh messages appearing in the first page.

### RT-02 — Gmail Pub/Sub push (highest-priority provider)
- Source added: webhook route verifies RS256 JWT signatures using Google's published X.509 certificates, validates issuer/audience/expected service-account identity/time claims, and fails closed if configuration is absent. Add deeper JWT/notification tests and verify real Pub/Sub configuration before enabling the capability.
- Decode Pub/Sub envelope and base64url payload; validate mailbox address/history ID.
- Resolve the connected Gmail account from trusted DB records; do not accept account/organization IDs from webhook body.
- Enqueue a stable idempotency key based on provider/account/history ID.
- Implement `users.watch` registration at connect/reconnect and renewal at least daily (Google watch expires within seven days); persist expiry/history ID and surface renewal errors.
- Worker uses Gmail History API from stored history ID; process message additions, label changes and deletions, and fall back to full sync if history cursor expired.
- Keep periodic history reconciliation as loss recovery. Gmail push notifications normally arrive within seconds but may be delayed/dropped and are rate-limited.
- Add unit tests for valid/invalid JWT, wrong audience/identity, malformed Pub/Sub payload, unknown mailbox, duplicate notification, expired history cursor, and checkpoint-after-persist.

### RT-03 — Generic IMAP IDLE
- Refactor the adapter/worker boundary to support a long-lived IDLE listener separate from short request/command connections.
- Check server CAPABILITY; use IDLE only when advertised, terminate/reissue before the server's idle timeout, and obey protocol continuation/DONE sequencing.
- On event, enqueue account-scoped reconciliation; don't parse notification count as message content.
- Reconnect with bounded exponential backoff, jitter, socket keepalive and health telemetry; ensure shutdown releases all sockets.
- Enforce one listener lease per account across worker replicas; no unbounded connections.
- Add mock TLS IMAP server tests for EXISTS, disconnect/reconnect, unsupported IDLE, timeout/reissue, duplicate events and lease contention.

### RT-04 — Zoho and future provider adapters
- Confirm current Zoho supported webhook options, verification and event payload contract against official docs and a real test account before enabling.
- Where provider push isn't available, use the existing adapter's strongest cursor plus IDLE if it exposes IMAP.
- Add Microsoft Graph as a separate future provider adapter for Outlook/Exchange; do not pretend generic IMAP equals native Graph support.
- Capabilities are runtime evidence, not aspirational documentation.

### RT-05 — Durable queue, cursor and operations
- Audit RabbitMQ configuration, Redis lease credentials, consumer startup and production DB alignment; a connected OAuth badge is not proof that sync is running.
- Ensure event publication, message persistence and cursor checkpoint behavior are retry-safe and idempotent.
- Add initial-import state/progress and clear last-sync/error telemetry to account settings.
- Keep manual sync as a recovery command only; normal ingestion starts automatically on account connection and continues without browser activity.
- Ensure worker is a long-running service; Vercel functions are not the place to hold IMAP IDLE sockets.

### RT-06 — Acceptance tests
- New test email delivered from an independent sender; measure provider delivery -> worker signal -> DB commit -> inbox visibility.
- Test Gmail push; test generic IMAP IDLE; test each supported Zoho mode; test fallback poll with push disabled.
- Restart worker, drop broker connection, expire/duplicate notification and simulate temporary provider outage; verify no permanent loss or duplicate messages.
- Verify tenant isolation: an event for account A can never be stored or surfaced under organization/account B.
- Run worker/web tests and typechecks after changes. Do not claim real-time readiness until provider-to-DB and DB-to-browser latency are measured on deployed infrastructure.

## 6. Operational prerequisites

- Gmail push requires a Google Cloud project, Gmail API enabled, Pub/Sub topic/subscription, Gmail service account publish permission, authenticated push delivery configuration, OAuth scopes and a reachable HTTPS endpoint. Configure secrets/identities in deployment settings, never in Git.
- Current source expects server-side environment variables: `GMAIL_PUBSUB_TOPIC` (fully qualified `projects/<project>/topics/<topic>`), `GMAIL_PUBSUB_PUSH_AUDIENCE` (exact audience configured on the push subscription), and `GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT` (exact OIDC token email used by Pub/Sub). The Gmail watch-renewal worker remains disabled if these values are absent. Grant `gmail-api-push@system.gserviceaccount.com` permission to publish to the topic and configure the subscription to send OIDC-authenticated HTTPS push requests with the expected audience and service account.
- Rotate any app password or token that was pasted into a chat, issue, log or source file before testing. Use OAuth where possible; otherwise use a new server-side secret in the secret manager.
- Deploy the long-running worker separately from Vercel web. Confirm both use the intended same PostgreSQL database and healthy RabbitMQ/Redis.
- Keep a bounded fallback poll even after push is enabled.

## 7. Official references

- Gmail push notifications and Pub/Sub: https://developers.google.com/workspace/gmail/api/guides/push
- Gmail synchronize clients / history reconciliation: https://developers.google.com/workspace/gmail/api/guides/sync
- Gmail batch requests: https://developers.google.com/workspace/gmail/api/guides/batch
- Gmail IMAP/SMTP and OAuth: https://developers.google.com/workspace/gmail/imap/imap-smtp
- IMAP IDLE protocol (RFC 2177): https://www.rfc-editor.org/rfc/rfc2177
- Microsoft Graph change notifications: https://learn.microsoft.com/graph/api/resources/webhooks
- Microsoft Graph mail delta queries: https://learn.microsoft.com/graph/delta-query-messages
- Google Pub/Sub push authentication: https://cloud.google.com/pubsub/docs/authenticate-push-subscriptions

## Exit criteria

The feature is accepted only when: automatic startup sync works on account connect; push/IDLE signal paths are authenticated; each account is reconciled idempotently; failed persistence never advances a cursor; periodic recovery is active; UI refreshes without user action; cross-tenant isolation tests pass; and measured delivery-to-inbox latency is documented per provider. CI status alone is not the acceptance criterion.


### RT-02 implementation update — 2026-10-16

Source has been started on `feature/provider-realtime-email-sync`: `GmailAdapter.getMailboxProfile/registerMailboxWatch/stopMailboxWatch`; `gmail-watch-worker.ts` registers watches and renews those expiring within 24 hours on a 5-minute check loop; `POST /api/webhooks/gmail` verifies the Google-signed OIDC token and schedules account-scoped reconciliation by setting durable `next_attempt_at`; the sync worker prioritizes that trigger. The receiver intentionally does not trust Pub/Sub mailbox payloads for organization/account identity. This is **source progress, not acceptance**: test/typecheck/live setup have not run; the History API worker path uses the existing stored cursor and still needs explicit push-path regression coverage. Keep `sync_webhook: false` until verified.


Watch-worker behavior: it checks every five minutes for newly connected Gmail accounts with no watch and for watches expiring within 24 hours; this avoids waiting half a day to begin push delivery for accounts connected while the worker is already running.


Push-during-sync durability: migration `0049_email_sync_pending_push.sql` adds `email_sync_states.pending_push_at`. The webhook updates it alongside `next_attempt_at`; successful sync clears only a push timestamp no newer than the sync claim's `last_attempt_at`. A notification received mid-sync remains pending and schedules a follow-up reconciliation. This design still requires DB/concurrency regression tests and migration execution before acceptance.


Gmail follow-up hardening: watch failures now use stored retry backoff (5 minutes with exponential growth capped at 6 hours); successful watch registration persists refreshed OAuth credentials and clears retry metadata. The webhook skips notifications already covered by the persisted Gmail history cursor and acknowledges intentionally paused sync accounts. These are source changes only; their tests and runtime behavior remain unverified.
