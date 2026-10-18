# DEV-01 / Forge — Chat-first workspace, embedded voice, navigation and mail reader (2026-10-18)

## Authorization / recovery
- **Owner:** Explicit request "Act as DEV-01 / Forge", recover repository without prior chat, plan and execute Chat as main, Chat-side voice, Mail expanded by default, navbar alignment, email HTML preview with Mailflow reference. Standing owner instruction: commit directly to `main`, create no branches/PRs. No phase transition/deployment authorized.
- **Started GitHub main:** `9081fb89932e44eaa4b6cfb217b1ee1346ba0010`. Current phase `Phase 4 implementation_in_progress`. Governing records read: `CURRENT_PHASE.md`, `NEXT_ACTION.md`, `PROJECT_STATE.md`, `VERIFICATION_STATE.md`, `AGENT_SESSIONS.md`, `AGENT_BACKLOG.md`, `ISSUES.md`, `DECISIONS.md`, `AGENT_MEMORY.md`, `AGENT_HANDOFF.md`, `AGENT_EVENTS.md`, DEV-01 `MEMORY.md`/`WORKLOG.md`, `docs/plans/ROADMAP.md`. Historic notes mentioning feature branches/old unmerged changes are not authoritative over current main.
- **Other roles:** FIX-01 owns substantial runtime/security incidents (#26 realtime transport, #32/#33 WhatsApp, and newly opened #36 email HTML sanitization). OPS-01 owns full CI, database/migration/runtime environment, Vercel, credentials and production deployment; OPS migration work appears at top of `NEXT_ACTION.md`.
- **CI:** User-linked run [39079140157](https://github.com/Rilan-Dev/ai-comms-agent/actions/runs/39079140157) was completed **failure**, source SHA `2cf9a52266af0fd69df809b40f482bb0eb95fb5c` (not our starting/latest main). It is not evidence against this UI slice. Job log URL was not available (BlobNotFound). Did not poll/retry/alter CI workflows.

## Source investigation and committed slice
1. `apps/web/src/app/page.tsx` used to render Overview. Moved that exact page source to `apps/web/src/app/overview/page.tsx` and made root render existing authenticated `ChatPage`, with local `dynamic = "force-dynamic"` for Next static config. Existing `/chat` route retained.
2. `apps/web/src/components/sidebar.tsx`: Chat first, Overview second; Mail links to Inbox and starts expanded with Inbox, Drafts, Threads, Accounts; separate accessible expander button. Removed redundant AI & Voice primary menu entry; `/ai-voice` deep-link route remains.
3. `apps/web/src/components/top-bar.tsx`: fixed double `md:ml-[248px]` offset **concurrently** on main by another DEV-01 source commit `565e5c75`; did not overwrite. `layout.tsx` still owns sole sidebar margin.
4. `apps/web/src/app/chat/chat-client.tsx`: lazy-loads established `VoiceWorkspace` in Chat via Live voice header and composer actions; selected agent bound, text draft preserved, agent switching disabled while voice is open. Prior header toggle later hardened via concurrent DEV-01 commit `6b562648` to avoid abrupt live-session unmount.
5. `apps/web/src/app/ai-voice/voice-workspace.tsx`: supports embedded mode, initial selected agent and in-panel Back to chat. Reuses existing Clara /api/voice/session, STT/TTS transports and approval policy. Cleanup stops tracks/sockets and best-effort DELETE of active host lifecycle when unmounted; no claim that provider actually connected.
6. `packages/db/src/email/repository.ts`: thread SQL now aliases `html_body_sanitized AS html_body` after an org-scoped JOIN. Previously UI checked `m.html_body` while thread returned `m.*` so formatted email appeared missing. Another concurrent DEV-01 implementation added `apps/web/src/lib/email/html-preview-document.ts`, thread iframe with **opaque sandbox** and remote-content-denying CSP, HTML/Text toggle and Expand preview, tests in `apps/web/tests/mail-html-preview.test.ts`. Removed duplicate unused helper created during overlapping development to preserve one implementation.
7. Inspected owner's `Rilan-Dev/mailflow` repo: `frontend/src/components/MessageBodyView.jsx`, `frontend/src/utils/emailFrameDoc.js`, `frontend/src/utils/emailFrameHeight.js`, `backend/src/services/emailSanitizer.js`. Adopted conceptual reader design (isolated sender layout, CSP, sizing/privacy) but did **not** copy complex server sanitizer.
8. **Security issue #36** filed to FIX-01: `mailbox-sync-worker.ts` appears to write raw `message.html_body` directly to `html_body_sanitized`, violating `SECURITY.md §14` ingest allowlist requirements. Rendering a sandboxed iframe is defense-in-depth only, **not** proof source HTML is sanitized. Ingest fix, historical row backfill/quarantine are excluded from DEV-01 role; OPS-01 owns rollout.
9. Detailed phased design and abuse/edge-case QA at `docs/plans/CHAT-FIRST-VOICE-MAIL-UX-20261018.md`. New `apps/web/tests/workspace-shell.test.ts` Vitest source contract regression suite authored to protect navigation, route, embedded voice, double offset, mail HTML alias and opaque sandbox.

## Verification — strict boundary
- **Actually checked against fresh committed GitHub blobs:** 14/14 independently authored source invariants passed: homepage Chat, Overview preserved, nav order and Mail default, header offset, Chat voice lazy import/selected agent/return, voice media/host cleanup, mail HTML alias, opaque CSP, and new test presence. This is a static source-contract check **NOT** an executed React/Vitest/browser flow.
- **NOT EXECUTED:** New `workspace-shell.test.ts` Vitest, existing `mail-html-preview.test.ts`, all full pnpm web/worker suites, TypeScript/build, DB migration, browser at required breakpoints, actual provider WebSocket/microphone, mailbox HTML from real provider/old DB rows, cross-tenant negative tests, deployment and production acceptance. No private full dependency-equipped repo checkout in this chat execution runtime; Browser connector not available from originating browser context. Do not transfer old unrelated 23/23 module test results into this UI's acceptance.
- **Concurrency guard:** Direct-main independent commits existed during this session; re-fetched latest source before every edit, preserved current top-bar/html preview fixes, removed accidentally duplicated unreferenced module rather than overwriting another agent's work.

## Pending UX work (owned DEV-01)
- Complete compact voice panel UX (focus handoff and return, mobile heights, active-session exit failure feedback) while leaving provider/transport root bugs to FIX-01.
- Implement a genuine organization-scoped `/mail/threads` list; current route is a static "No live mailbox connected" placeholder even when inbox threads exist. Add real pagination/search rather than fabricating demo data.
- Enhance mail reader sender metadata/collapsed thread/attachment states and safe external-link policy after FIX-01 completes HTML ingest sanitization.
- Maintain accessibility, empty/error/loading states, 320/390/768/1024/1440px screenshot regression and content persistence.

## Exact next action
On dependency-equipped **current main** run:
```bash
pnpm --filter @ai-comms-agent/web exec vitest run tests/workspace-shell.test.ts tests/mail-html-preview.test.ts
pnpm --filter @ai-comms-agent/web typecheck
pnpm --filter @ai-comms-agent/web build
pnpm --filter @ai-comms-agent/worker test
pnpm --filter @ai-comms-agent/worker typecheck
bash scripts/verify-migration-chain.sh
```
If any failure, fix DEV-01 UI contract regression directly on `main`; route substantial runtime issues to FIX-01 and environment/CI/deployment to OPS-01. Then authenticated browser manual QA: root redirect/auth, old bookmarks, Mail group expanded on Chat, navbar no gap at tablet widths, unsent chat draft survives opening/closing voice, STT session starts only on explicit user Start, teardown clears microphone and host session, HTML/Text in a real account thread and blocked remote tracking image, empty/long HTML and org-negative tests. Verify actual deployed SHA before claiming live acceptance. Next independent DEV-01 code slice: real Threads listing + responsive/focus polish. No branches/PRs/deployment in this session.
