# Chat-first communications workspace — UX redesign and acceptance plan

**Date / Owner:** 2026-10-18 · DEV-01 / Forge · owner-authorized product-design iteration · direct commits to `main`, no branch.
**Phase authority:** Phase 4 database foundation remains `implementation_in_progress`; this is an approved incremental product UX slice, not a phase transition or production acceptance.
**Reference:** Existing Next.js App Router, Clara voice runtime/host-authorized transport and tools, `source/lovable-ui` styling; mail-preview security principles from `Rilan-Dev/mailflow` (read only, no architecture/third-party code import).
**Security:** No cross-tenant access, credential exposure, bypass of approval, or untrusted email content in app DOM.

## Product information architecture
- `/`: chat-first main page powered by the existing authenticated ChatPage and ChatClient, including its no-agent, no-Postgres and authorization-error states.
- `/chat`: stable deep link to the same text-chat experience, with agent selection and existing conversation/thread history intact.
- `/overview`: preserved operations dashboard, not deleted. Its existing links and metrics remain available.
- Sidebar first: **Chat**, **Overview**, **Agents**, **Mail** (always expanded by default), then WhatsApp, Automations, Schedules, Knowledge, Activity, Audit, Operations, AI Provider Setup, Settings. No duplicate primary Voice menu.
- Mail nested: **Inbox**, **Drafts**, **Threads**, **Accounts**. Mail label opens Inbox; dedicated button collapses/expands independently, with accessible `aria-expanded` and `aria-controls`.
- Navbar belongs to the main layout content column, aligned at the 248px sidebar boundary. Do not apply a second 248px offset within `TopBar`; on mobile, nav is full-width and sidebar is an overlay.

## Chat and realtime voice interaction
- Chat is the canvas. Its toolbar exposes an explicit **Live voice** action; clicking mounts the *existing* `VoiceWorkspace` in the Chat content area using a lazy dynamic import. No permission or microphone request until the user explicitly starts a session.
- Preserve the currently selected agent in voice mode, keep underlying text chat state (draft, active conversation, streamed messages) while switching modes, and avoid switching agent mid-voice.
- Voice panel contains start/stop, actual transport ready/connecting/failed status, live transcript, interruption, mute, language, approval queue, and **Back to chat**. Return should invoke voice-session shutdown and release microphone/socket before hiding; the parent Chat toolbar MUST NOT unmount the voice component directly while voice mode is open.
- `/ai-voice` remains a backward-compatible route until all legacy links and subscriptions have migrated; do not delete it or conflate standalone voice history with chat text storage.
- Realtime speech uses Clara + server-authorized provider relays; sensitive email sends remain approval-gated. Never treat a persisted host session or mere mic permission as confirmed provider connectivity.

## Mail reader design
- Thread detail defaults to rich HTML when `html_body` exists, otherwise readable plain text. Keep explicit HTML/Text toggle and sender/from/date/thread metadata, reply and forward approvals, attachments section.
- HTML renders in an **opaque-origin, scriptless sandboxed iframe**, with a restrictive frame CSP: remote images and tracking, scripts, object/embed, remote CSS/fonts, form posts and network fetches blocked. Do not interpolate mail HTML into the parent app's React tree.
- Sender's table, typography and inline styles should remain legible; constrain images, table overflow, small viewports, quoted blocks and long words. Reader shows a remote-content privacy note, easy expand/reduce, and sufficient scroll area. The separate MailFlow repo confirms sandboxed HTML, remote-image default block/proxy, and measured preview experience are important patterns; import no MailFlow implementation without architecture review.
- **Follow-on UX:** stable frame sizing without huge whitespace; safe inline-CID image resolution via an authenticated per-message endpoint, trusted-origin proxy with explicit user consent for remote images, secure external-link confirmation, per-message collapse and keyboard/focus management. Route provider ingestion/HTML missing or sanitizer security defects to FIX-01; owner reviews any new sanitizer/proxy dependency before importing one.

## Phased deliverables and current status

| Phase | Scope | Status | Acceptance condition |
| --- | --- | --- | --- |
| A — Nav foundation | Chat-first home/sidebar, preserve Overview, Mail expanded folders, topbar aligned | SOURCE IMPLEMENTED | Desktop/mobile route/keyboard checks and no 248px double inset |
| B — Unified chat/voice | Chat toolbar voice CTA, lazy embedded VoiceWorkspace, safe exit, agent context | SOURCE IMPLEMENTED | No mic before Start; connect/interrupt/reconnect/end with real relay; no active session leak |
| C — Mail HTML foundation | Opaque CSP email preview, responsive HTML and text fallback, expand | SOURCE IMPLEMENTED (partial UX) | Mail rendering tests with real authorized inbox message and hostile HTML fixtures |
| D — Interaction polish | Mobile 320/375/768/1440, focus, loading/empty/error states, safe voice exit, draft persistence, mail readability/CID and accessibility | PENDING | Keyboard and screen-reader walkthrough; WCAG contrast, reduced motion and resizing |
| E — Release validation | New and existing automated suites, Next + worker typecheck/build, browser E2E, multi-organization/provider, metrics | PENDING — OPS/FIX DEPENDENCIES | Full CI + security/voice/mailflow acceptance on matching deployed SHA |

## Real-world break-tests (must not silently skip)
1. **First login / no agents:** Chat landing explains missing agent, create button; unauthenticated user still redirected to login; API never serves organization data to a wrong tenant.
2. **SSE interrupted / provider unavailable:** Chat keeps user's text and shows a recoverable error; do not lose draft or show false success. Switching text/voice must not discard a pending assistant stream.
3. **Voice without mic / permission denied:** Button opens view only; Start requests permission; deny yields explicit error, no connected badge, no lingering open microphone.
4. **Voice slow WebSocket / reconnect:** Host session != ready socket; connecting, timeout, restart and interruption distinguish states. Back must not silently abandon active authorization, provider audio, or DB voice session (FIX-01 owns session teardown correctness).
5. **Agent switching / organizations:** Header agent selection freezes while voice active; org A's conversation/voice/account data cannot be presented under org B. Test rapid switching and delayed API responses.
6. **Mail evil HTML:** Inline JS, `onerror`, `javascript:` URLs, `<form>`, nested iframe, remote image pixels, @import, external fonts, CSS URL tricks and table overflow cannot run/load or navigate parent. Test malformed 100KB HTML and plain-text-only messages.
7. **Mail permissions:** Attachments and per-account body retrieval require authorized organization/account/thread; no plain HTML rendered on wrong tenant. All sends, replies, forwards remain explicit approval requests.
8. **Accessibility/responsive:** 320px mobile sidebar overlay focus trap; Mail folder toggle `aria-expanded`; desktop header seamless at sidebar edge; narrow composer scroll and voice status are announced without focus loss.
9. **History:** Deep links to `/overview`, `/chat`, `/mail/inbox`, `/mail/threads`, `/ai-voice` remain valid; browser back/history does not orphan voice session.
10. **Deployment:** OPS-01 records actual commit hash running at `aca.starcitytechnical.com`; CI run 39079140157 is on historical SHA `2cf9a522...` and does not validate these new main commits; no production claims until revision parity and live verified.

## Tests & commands for next execution
```bash
pnpm install --no-frozen-lockfile
pnpm --filter @ai-comms-agent/web exec vitest run tests/chat-first-workspace.test.ts tests/mail-html-preview.test.ts tests/live-model-catalog.test.ts tests/voice-provider-relay.test.ts
pnpm --filter @ai-comms-agent/web typecheck
pnpm --filter @ai-comms-agent/web build
pnpm --filter @ai-comms-agent/worker test
pnpm --filter @ai-comms-agent/worker typecheck
pnpm --filter @ai-comms-agent/worker build
bash scripts/verify-migration-chain.sh
```
Full CI is manual-only; OPS-01 runs/builds/deploys, FIX-01 investigates any substantial voice lifecycle or insecure/missing mail-body pipeline defects. DEV-01 owns iterative UX fixes and regression protection on `main`. Record actual test and browser evidence before declaring each exit condition.

## Next action by DEV-01
Inspect the new focused Vitest failures (if any) in a dependency-equipped checkout and fix source regressions on current `main`. Then implement phase D UX polish: secure mail preview handling of CID and remote content with explicit consent (requires architecture approval for new server sanitizer/proxy), mobile/accessibility checks, and voice exit lifecycle UX coordinated with FIX-01. Do not block independent product work waiting for OPS-01 deployment.
