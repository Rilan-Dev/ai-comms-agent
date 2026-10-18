# DEV-01 / Forge — Chat-first navigation, embedded realtime voice, and mail-reader UX

**Date:** 2026-10-18  
**Owner authorization:** explicit "Act as DEV-01 / Forge" + five UX redesign requirements; direct development on existing `main`, no branches or PRs per owner's established workflow.  
**Project phase:** Phase 4 `implementation_in_progress`; this plan is an authorized bounded product-development slice, **not** a Phase 4 transition, production deployment, nor an override of FIX-01/OPS-01 responsibilities.  
**Source of truth:** `docs/project-control/CURRENT_PHASE.md`, `NEXT_ACTION.md`, `PROJECT_STATE.md`, `VERIFICATION_STATE.md`, `AGENT_SESSIONS.md`, `AGENT_BACKLOG.md`, `AGENT_MEMORY.md` and DEV-01 role-local records.  
**Starting snapshot:** `9081fb89932e44eaa4b6cfb217b1ee1346ba0010`. Other agents commit concurrently: reread each file SHA before edits; do not overwrite independent fixes.

## Product decision: one conversation entry point

The user's first view after authentication is **Chat** at `/`. Keep `/chat` as a compatible deep link and preserve the former overview screen at `/overview`. The primary sidebar begins with Chat, then Overview, Agents, Mail, WhatsApp, Automations, Schedules, Knowledge, Activity, Audit, Operations, AI Provider Setup, Settings. Do not maintain a duplicate top-level voice item; move voice entry into Chat while retaining `/ai-voice` as a legacy deep link until acceptance.

Mail is a first-class navigation group, **expanded by default** even when another route is active. Children prioritize actual tasks: Inbox → Drafts → Threads → Accounts. The group expander is a separate labeled button from the Inbox navigation link, with `aria-expanded`, keyboard support, and unambiguous active states.

The desktop content wrapper owns the **single** 248px sidebar offset. Navbar occupies 100% of its already-offset parent; it must not add a second `md:ml-[248px]`. Mobile uses a focus-managed off-canvas sidebar and full-width main content. No overlapping header, clipping, or horizontal scrollbar at 320, 375, 390, 768, 1024, 1440px.

## Page layout and interaction contract

### Chat (default)
- Compact heading with selected agent, status indicating *text request* not provider-online proof, agent selection, and **Live voice** action.
- Scrollable conversation area, persistent composer, empty prompts, responsive keyboard controls (Enter submits, Shift+Enter newline), loading/error messages and disabled actions during processing.
- Choosing Live voice lazy-loads the **existing Clara-backed VoiceWorkspace within Chat**, preserving unsent text and existing chat state. Voice opens in a Chat content panel, not a new route or popup. Its voice session is **not** assumed connected until the real provider/relay ready signal. Reuse existing host-authorized /api/voice/session, approval boundaries, transport status, mute/end/interruption and transcript; do not build a second vendor socket implementation.
- The voice panel receives the currently selected agent. Agent switching is blocked during an active voice panel. Exit via **Back to chat** must request end session and free microphone/socket/audio resources. On unexpected navigation/unmount, best-effort end request + immediate media teardown. If network/API termination fails, surface a truthful error and keep the user able to retry; OPS/FIX handle runtime reliability, not DEV inventing a success signal.
- **Future integration (not implied done):** a unified transcript/timeline and voice-to-text context continuity require a server contract and privacy/retention review. Existing text chat and voice turn stores are not silently merged.

### Email reader
- Inbox row click must reach tenant-scoped thread data and show actual sender, recipient, subject, timestamp, body and attachments/status affordances. The current DB thread query did not alias `html_body_sanitized` to UI's `html_body`; this is a concrete source mismatch corrected during this session.
- Default to formatted HTML *when stored*, with an accessible HTML/Text toggle and preformatted plain-text fallback. Preserve sender tables, inline formatting, spacing and line breaks.
- **Security is not a styling option:** HTML stays inside an opaque-origin `iframe sandbox=""`, with script/network/form/remote-image/font/frame/embedding blocked via the frame CSP; avoid `allow-same-origin`, `allow-scripts`, `dangerouslySetInnerHTML` in the parent app, remote tracking pixel auto-load, and sending cookies to third-party resources. An internal scroll region/expand control is preferable to unsafe parent DOM sizing. Links may be intentionally disabled until robust URL filtering/safe-open policy is implemented.
- **FIX-01 blocker:** `apps/worker/src/email/mailbox-sync-worker.ts` writes `message.html_body` into `html_body_sanitized` without obvious parsing/sanitization. Issue [#36](https://github.com/Rilan-Dev/ai-comms-agent/issues/36) routes server-side allowlist, CSS/URL defense and historical backfill to FIX-01. DEV-01 may implement the isolated view, but must NOT claim stored email sanitization is in place; OPS-01 owns safe migration/deploy.
- Reference: `Rilan-Dev/mailflow` `frontend/src/components/MessageBodyView.jsx`, `frontend/src/utils/emailFrameDoc.js`, `frontend/src/utils/emailFrameHeight.js`, `backend/src/services/emailSanitizer.js`. Reuse design lessons only; no wholesale copy.

## Phased delivery and gates

| Slice | Responsibility | Definition of done / gate |
|---|---|---|
| **UX-01 navigation baseline** | DEV-01 | `/` displays Chat, former homepage at `/overview`; Chat first; Mail expanded, Inbox/Drafts/Threads visible; navbar single offset; mobile keyboard and breakpoints tested |
| **UX-02 embedded realtime voice** | DEV-01 presentation; FIX-01 transport defects | Voice action inside Chat opens current transport safely; open/ready/transcribing/speaking/error/ended states truthful; retries, mute/interrupt/end, back-to-chat, agent lock, media cleanup; real providers tested by OPS-01 |
| **UX-03 mail detail/HTML** | DEV-01 reader; FIX-01 ingestion security | DB alias + HTML/Text toggles, blank/large email handling, safe iframe with CSP and no trackers; FIX-01 completes sanitization and backfill separately before broad production acceptance |
| **UX-04 usability polishing** | DEV-01 | Compose/focus and scroll behavior; accessible controls and focus return; empty/loading/failure states; responsive touch targets; navigation and session test matrix |
| **UX-05 verification/rollout** | DEV-01 tests, FIX-01 incidents, OPS-01 CI/deploy | Vitest + TypeScript + Next/worker builds, DB migration/test tenant denial, browser playwright, provider microphone/WebSocket, Gmail/Zoho/IMAP previews, production revision screenshots; owners explicitly sign off |

## Real-world failure/abuse matrix (must test, not just demo)

| Scenario | Expected handling |
|---|---|
| No agent or database disconnected at `/` | Honest create-agent / DB unavailable state; no broken client import |
| Existing `/chat`, `/ai-voice`, `/overview` bookmarks | Keep working through transition; no redirect loop |
| Mobile 320px, 390px; tablet 768px | Sidebar overlay focus trap/Escape; header full width; controls wrap and are keyboard accessible |
| Mail group on Chat route | Expanded initially; Inbox/Drafts/Threads one tap; accessible collapse and reopen |
| Unsaved draft in Chat, click Live voice, return | Draft survives; no unintended text send |
| Text streaming busy; attempt voice/agent switch | Disable conflicting action; do not orphan SSE; show progress |
| Microphone denied, insecure origin, disconnected Wi-Fi | Explicit error, not false "active"/"connected"; offer retry; no host action without auth |
| Close or navigate away during live voice | Stop tracks/socket/audio immediately, end host lifecycle best-effort; no ghost connected or duplicate session |
| Provider relay reconnect, interrupted TTS, overlapping turns | No duplicate answers/audio, no leaked secrets; transcript ordering preserved |
| Email with no HTML or 250KB+ HTML | Plain-text fallback / bounded frame handling, no frozen viewport |
| Malicious email markup with scripts, external CSS/images, form, iframes, javascript: links | No script execution, no tracking requests, no parent access; server-side sanitize/backfill tracked under FIX-01 #36 |
| HTML email dark backgrounds, wide tables, blocked images | Readable contrast/layout, internal scroll and explicit blocked-image notice; retain plain text |
| Cross-organization thread URL, message search and mailbox grants | Server-side authorization rejects; no first-load cross-tenant leakage |
| Failed send/reply/forward approval | Keep approval state truthful; no action bypass or silent send |
| Vercel build-rate-limit, DB migration drift, unavailable provider API | OPS-01 handles deployment/infrastructure; DEV-01 continues independent UI source, no false production acceptance |

## Current bounded implementation status

- UX-01 source implemented: `apps/web/src/components/sidebar.tsx`, `apps/web/src/app/page.tsx`, `apps/web/src/app/overview/page.tsx`, top-bar single-offset change already concurrently present on main.
- UX-02 initial source implemented: `apps/web/src/app/chat/chat-client.tsx` lazy Chat-contained `VoiceWorkspace`, `apps/web/src/app/ai-voice/voice-workspace.tsx` optional embedded mode, agent carry-over and best-effort cleanup. **Not** evidence of live provider readiness.
- UX-03 initial source: `packages/db/src/email/repository.ts` aliases HTML body for thread UI; an isolated CSP/sandbox reader and toggle were also committed concurrently; the duplicated helper was removed to avoid parallel implementations. FIX-01 #36 is a source security gate.
- No full monorepo install/build/browser or live provider test was executed in this session. Latest referenced Actions run `39079140157` is a failed run on `2cf9a522`, not current `main`; logs were unavailable. CI/CD/deployment work remains OPS-01.

## Exact continuation

1. **DEV-01**: On current main, run `pnpm --filter @ai-comms-agent/web exec vitest run tests/workspace-shell.test.ts tests/mail-html-preview.test.ts`, `pnpm --filter @ai-comms-agent/web typecheck`, `pnpm --filter @ai-comms-agent/web build`; then focused Chat/Voice and mail tests plus browser at 320/390/768/1440px; fix actual source regressions, commit directly to main. Avoid duplicating another agent's concurrent file changes.
2. **FIX-01**: Investigate issue #36 server-side HTML ingestion and historical rows; repair as separate security work. Existing realtime connection defects/issues remain FIX-01, not DEV-01 UI work.
3. **OPS-01**: Run authorized current-head CI/DB migrations and deploy only source that has passed the appropriate checks; test actual provider socket and authenticated email rows, compare deployed revision to current main. Do not request secrets in chat.
4. **DEV-01 next independent work** after first build: proper Threads list (currently a placeholder), searchable conversation history in Chat, compact embedded voice mode styling, responsive/focus/scroll polish, provider-independent voice entry and accessible keyboard flows. Test them against real work scenarios before marking done.
