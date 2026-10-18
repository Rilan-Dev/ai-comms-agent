# DEV-01 / Forge — Chat-first, realtime voice, navigation and Mail reader UX

**Session:** DEV01-CHAT-FIRST-WORKSPACE-20261018
**Date:** 2026-10-18
**Role:** DEV-01 / Forge — product development; FIX-01 = substantial defects and source security, OPS-01 = CI/CD, infrastructure and deployment.
**Authorization:** Owner explicitly requested a plan and continued DEV-01 product-development work, with Chat home, inline voice panel, first Chat sidebar link, Mail expanded folder shortcuts, navbar flush to sidebar, and professional HTML mail preview informed by user's Mailflow repository. Previous owner instruction remains commits directly to `main`, no branch or PR.
**Starting ref:** `9081fb89932e44eaa4b6cfb217b1ee1346ba0010`, with concurrent OPS-01 commits already present. The latest main advanced while this session ran; each source write used the current blob SHA.
**Active phase:** Phase 4 database foundation/migrations `implementation_in_progress`, no automatic phase transition or deployment.

## Recovery / source of truth
Read `RULES.md`, `CURRENT_PHASE.md`, `PROJECT_STATE.md`, `NEXT_ACTION.md`, `DECISIONS.md`, `ISSUES.md`, `AGENT_SESSIONS.md`, `AGENT_BACKLOG.md`, `AGENT_MEMORY.md`, `AGENT_HANDOFF.md`, `ZAI_HANDOFF.md`, `agents/DEV-01/MEMORY.md` and `WORKLOG.md`, and `docs/architecture/UI-UX.md`. UI follows existing Lovable theme, Next.js App Router, Clara AI runtime and tenant-authenticated server context. Mailflow reviewed read-only at `frontend/src/components/MessageBodyView.jsx`, `frontend/src/utils/emailFrameDoc.js`, `frontend/src/utils/appEmailHtml.js`, `backend/src/services/emailSanitizer.js`. No external source copied or new dependencies introduced.

## Completed source changes (direct main)
1. Fixed double desktop left margin by removing `md:ml-[248px]` from `apps/web/src/components/top-bar.tsx`; root layout owns sole desktop sidebar offset. Commit `565e5c752`.
2. Chat first sidebar entry, Overview second, Mail folder links Inbox/Drafts/Threads/Accounts expanded by default with independent accessible collapse toggle; removed separate primary Voice item. `apps/web/src/components/sidebar.tsx`, `90ba2b34f`.
3. Preserved old dashboard at `/overview`, made root `/` render authenticated Chat page, retained stable `/chat` deep link. Commits `a1afd493d`, `a3b9c915f`.
4. Extended existing `VoiceWorkspace` with embedded mode, selected-agent initialization and return-to-chat control; ChatClient now lazily opens voice inside Chat with user action rather than independent sidebar page. Existing Clara/provider transport preserved, no second runtime. Commits `ff1e537fc`, `62e25e829`.
5. Corrected Chat toolbar control to be **open-only** while voice mode runs, avoiding a button that could unmount active realtime media without session shutdown; `6b5626486`.
6. Added `apps/web/src/lib/email/html-preview-document.ts` with strict CSP for untrusted formatted email: opaque-origin iframe, no remote images/styles/scripts/network/forms/frames, preserved sender inline CSS/table presentation, privacy note and expand/reduce reader controls. `apps/web/src/app/mail/thread/[threadId]/thread-client.tsx`. `d247cca47e`, `1a71cddfa`. Another concurrent main change exposed the persisted `html_body_sanitized` storage field to tenant-scoped thread reader (commits `057518432`, `49669079f`); its trust boundary needs FIX-01 sanitizer acceptance.
7. Added focused Vitest test sources `apps/web/tests/mail-html-preview.test.ts` and `apps/web/tests/chat-first-workspace.test.ts` (commits `1f70e6408`, `a4d4cb791`), **not executed in monorepo**. Approved phased architecture/UX plan `docs/plans/CHAT_FIRST_WORKSPACE_REDESIGN_20261018.md` (`4d23bbdd0`).

## Executed verification / boundaries
- **Current authenticated GitHub source verification:** 13/13 direct assertions PASSED against actual current repository file contents: root route Chat, Overview preserved, sidebar Chat order and Mail toggle, no navbar duplicate margin, lazy voice import/open-only header/embedded session surface, opaque email iframe, strict CSP and no app `dangerouslySetInnerHTML`, new test files.
- **Not executed:** New Vitest tests, whole pnpm web/worker typecheck, Next build, browser/Playwright/mobile/keyboard, authenticated real tenant and mailbox preview, provider microphone/voice WebSocket/teardown, migrations, deployment or live production acceptance. These are not PASS simply because source assertions passed.
- **CI context only:** User shared Actions run `39079140157` (historical head `2cf9a522...`, conclusion failure); not proof of this session's main code. OPS-01 handles CI/CD. Do not poll or take it over.
- **Key blocker:** Security finding under FIX-01 GitHub issue [#36](https://github.com/Rilan-Dev/ai-comms-agent/issues/36): `html_body_sanitized` may receive unsanitized provider HTML; migration/backfill and sanitizer are not DEV-01 responsibilities. Inline preview is **defense in depth**, not a substitute. Existing FIX-01 issue #26 covers realtime voice lifecycle; verify host session DELETE errors and aborted return-from-voice as part of that source review. OPS-01 still owns deployed revision, database, CI and secrets.

## Current product state
- **Nav / Chat/Voice / first mail preview UX:** code implemented on `main`.
- **Source assertions:** 13/13 pass.
- **Native browser tests, build, authenticated voice/mail:** unverified; full product redesign not production-accepted.
- **Mailflow-level features not yet present:** CID attachment image mapping, explicit proxy/remote image consent, robust sanitized HTML CSS allowlist, safe links, frame content measurement, message collapse and accessibility validation. Do not invent these as completed.
- **Full design and real-world break test checklist:** `docs/plans/CHAT_FIRST_WORKSPACE_REDESIGN_20261018.md`.

## Exact next actions
1. DEV-01 on dependency-equipped latest `main`: run `pnpm --filter @ai-comms-agent/web exec vitest run tests/chat-first-workspace.test.ts tests/mail-html-preview.test.ts tests/live-model-catalog.test.ts tests/voice-provider-relay.test.ts`, `pnpm --filter @ai-comms-agent/web typecheck`, `pnpm --filter @ai-comms-agent/web build`; fix evidenced source/UX errors on main. Check 320/375/768/1440 layouts and keyboard focus.
2. Browser UX scenario: root Chat/Overview navigation, expanded Mail menu on all routes, no left header gap, Chat voice CTA with mic denied/granted, active session and return behavior, agent switch continuity, HTML and text email detail. Test hostile HTML/large messages with fixtures (not actual malicious sender traffic).
3. FIX-01 independently closes #36 server-side sanitization and checks old unsanitized rows before broad HTML preview exposure; FIX-01 verifies #26 voice end-state lifecycle. No bypass of approvals/tenant bindings.
4. OPS-01 runs current-head CI, migrations and deployment; documents matching running SHA and authorized end-to-end web and provider scenarios. Old Actions run `39079140157` cannot validate this commit.
5. DEV-01 implements next polish slice (CID/remote image privacy UX, responsive/accessibility, voice session UX) only after sanitizer and backend transport contract boundaries are signed off; don't idle waiting on OPS/FIX.
