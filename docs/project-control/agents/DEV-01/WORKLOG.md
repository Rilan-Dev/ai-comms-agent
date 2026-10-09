# DEV-01 Role-Local Worklog

Append-only operational history for DEV-01. This is not the source of authorization.

## Entry format

### <SESSION-ID> / <DATE>
- **Task:** <task>
- **Authorization:** <reference or safe-maintenance classification>
- **Started from:** <commit/ref>
- **Actions:** <what was done>
- **Files/code:** <paths>
- **Evidence:** <tests/checks/observations>
- **Blockers/dependencies:** <none or exact>
- **Lesson:** <reusable lesson or none>
- **Next action:** <exact next action>

<!-- Append new entries below. -->


### DEV01-DRAFT-SEARCH-20261009 / 2026-10-09
- **Task:** Continue the authorized connected-mailbox product slice.
- **Authorization:** Existing development-first owner instruction and `docs/project-control/NEXT_ACTION.md` connected-mailbox action.
- **Started from:** GitHub `main`; product change committed as `8ccf1cb24039cb3bc745a51576a73ee68007e946`.
- **Actions:** Recovered repository controls and role boundaries; added Drafts search across subject, body, recipients, and mailbox address, plus a no-match state; recorded central session, lesson, and cross-agent routing.
- **Files/code:** `apps/web/src/app/mail/drafts/drafts-client.tsx`; `docs/project-control/AGENT_SESSIONS.md`; `AGENT_MEMORY.md`; `AGENT_BACKLOG.md`; `AGENT_EVENTS.md`; `NEXT_ACTION.md`.
- **Evidence:** GitHub accepted the source and control-plane updates. No local test, typecheck, build, browser check, runtime migration, provider connection, or deployment verification was executed.
- **Blockers/dependencies:** FIX-01 owns BKL-008 (Drafts tenant context and Inbox SQL search placeholders). Zoho/IMAP provider credentials and live runtime are not available in this session.
- **Lesson:** A source commit is not verification evidence; record only what was actually observed.
- **Next action:** Trace and complete Zoho/IMAP sync persistence, ensure provider-synced drafts appear in Drafts, and wire persisted mail/drafts to authorized Clara tools without waiting for CI/Vercel.
- Follow-up: added a static contract assertion in `apps/web/tests/mail-draft-action-contract.test.ts` for the search input, all four searchable fields, and no-match state. Commit `b0fd74f45a06a1cb8e2f3c4c152d242314711d39`. The test was not executed in this session.


### DEV01-CHAT-EMAIL-CONTEXT-20261009 / 2026-10-09
- **Task:** Connected-mailbox sync and chat email access.
- **Authorization:** `docs/project-control/NEXT_ACTION.md` connected-mailbox vertical slice.
- **Actions:** Inspected the chat route and provider worker/adapters. Confirmed chat previously passed conversation text to Clara without querying PostgreSQL email records. Added organization-scoped email context for email-related prompts, constrained to connected accounts and both organization IDs, limited to 20 rows, with untrusted-content delimiters. Added static contract assertions.
- **Commits:** Chat changes include `b9db5774a5b8c2177e606298804d4e1704b75d53` and follow-up corrections through `5c84fd4bd105586ed26272168fdee68b999ae94c`; test contract `93d353864256a49368ecaf4354aec0bfffb05889`.
- **Important finding:** `mailbox-sync-worker.ts` currently selects only Gmail; `ZohoAdapter.sync()` and `ImapSmtpAdapter.sync()` return empty added/updated/deleted arrays. IMAP list/get/search and draft methods are worker placeholders. Thus Zoho and IMAP/SMTP mail sync is not complete yet.
- **Evidence:** GitHub accepted source commits. No test suite, typecheck, build, live chat, provider auth, or sync run was executed; no runtime PASS claimed.
- **Next action:** Implement provider-specific sync + message parsing and safely generalize the worker; connect a host-owned, authorized email.read/draft tool to chat. FIX-01 owns BKL-008.

### DEV01-ZOHO-SYNC-20261009 / 2026-10-09
- **Task:** Implement actual Zoho sync path and generalize the connected-mailbox worker.
- **Authorization:** Existing development-first connected-mailbox vertical slice in `docs/project-control/NEXT_ACTION.md`.
- **Started from:** GitHub `main` after the chat email-context source slice.
- **Actions:** Added Zoho paginated initial import using a folder/offset cursor; added bounded newest-page refresh after initial completion; added encrypted credential snapshot support for refreshed Zoho tokens; generalized worker adapter dispatch and startup for Gmail/Zoho; throttled completed account syncs; updated static sync contracts. IMAP is explicitly excluded from polling until its real UID/FETCH parser is implemented, to avoid marking an empty sync as successful.
- **Files/code:** `apps/worker/src/email/zoho-adapter.ts`, `apps/worker/src/email/mailbox-sync-worker.ts`, `apps/worker/src/index.ts`, `apps/web/tests/gmail-mailbox-sync.test.ts`, `docs/project-control/NEXT_ACTION.md`.
- **Commits:** `403884433e7c2085b5a16e61b9a140e6f0670642`, `7c1afaf285cd7eef2346d99c322d4c1b9bb0e9ff`, `1906efe6253d6586fe07bdb6150722d9eeb0560f`, `41a15f05bfab6c540264c439eb1225126513d0a2`, `00665ee353efb8ff80d5a0af4ca0f7c225630f41`, `597c07ad49ccf8fd409302a46331d004fcef9e01`, `f2df3efc1c31a553b00fe39d114339affb85c6ab`, `c354bf7d3e07158d9417f5e02b00bdd574dba651`, `eb3c8d45ae2f947a252c06f6f00541a3b77208ac`, `77e03fa89ad63c2ddf45aa6034666d93f6ed8645`.
- **Evidence:** GitHub accepted source commits; source text confirms the Zoho sync method now lists folders and paginates messages, and worker dispatch supports Zoho. No test runner, typecheck, build, live Zoho API, PostgreSQL import, or chat turn was executed. No PASS claimed.
- **Known limitation:** IMAP/SMTP sync is not yet implemented and remains excluded from the polling query. End-to-end acceptance is pending.
- **Next action:** Implement IMAP UID-based search/FETCH and RFC822 parsing, complete provider-specific sync state, then test provider sync-to-PostgreSQL-to-Clara chat. Do not wait for CI/Vercel; FIX-01 still owns BKL-008.
