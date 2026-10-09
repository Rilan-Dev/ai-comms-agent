# Lovable UI Migration Inventory

Updated: 2026-10-09
Owner: DEV-01 / Forge
Authority: explicit owner request to migrate the Lovable-generated UI/UX into the existing application while preserving all existing functionality and validation.
Source: `source/lovable-ui/` (Agentic AI Studio, TanStack/Vite reference UI).
Target: `apps/web/src/app/**` (production Next.js application). Keep Next.js routes, server actions/API contracts, authenticated shell, tenant/RBAC boundaries, real PostgreSQL-backed state, validation and error states. Do not transplant the Vite/TanStack runtime or replace live data with source demo data.

## Source design assets reviewed

- `source/lovable-ui/src/styles.css`: warm off-white background, ink foreground, fine neutral borders, restrained green accent, compact radius, DM Sans + Space Grotesk, semantic status tokens, reduced-motion support.
- `source/lovable-ui/src/components/workspace-shell.tsx`: page header/layout and workspace chrome.
- `source/lovable-ui/src/components/ui/**`: shadcn/Radix interaction primitives and Lucide icon language.
- `source/lovable-ui/src/routes/index.tsx`: daily briefing, priority inbox, agent composer and activity-oriented overview.
- `source/lovable-ui/src/routes/mail/inbox.tsx`: three-pane inbox, source filters, conversation list and selected-message detail.
- `source/lovable-ui/src/routes/settings/connections.tsx`: connection status cards and safe/not-connected states.
- `source/lovable-ui/docs/migration/FUNCTIONALITY-MIGRATION.md` and `.lovable/plan/ai-communications-workspace-redesign-2026-10-04.md`: design and migration constraints.

## Migration status (source inspection, not browser acceptance)

| Surface | Target route(s) | Status | Remaining work / acceptance notes |
|---|---|---|---|
| Global semantic theme, typography, compact geometry, focus/reduced-motion | `app/globals.css`, `app/layout.tsx` | ADAPTED | Continue visual consistency review across all routes; no browser pass recorded. |
| Workspace shell, responsive sidebar, top bar, navigation/icons | `components/sidebar.tsx`, `components/top-bar.tsx`, `app/layout.tsx` | ADAPTED | Validate each route's active nav, mobile behavior, icon fit and responsive overflow later. |
| Overview / daily briefing | `app/page.tsx` | ADAPTED | API-backed overview, honest loading/error/empty states; visual/browser verification pending. |
| Inbox | `app/mail/inbox/**` | ADAPTED | Search/filter/read-state/archive/move/refresh and links retained; verification pending. |
| Agents list and create | `app/agents/**` | ADAPTED | Create API, slug/purpose validation and navigation retained. |
| Mail accounts | `app/mail/accounts/**` | ADAPTED | Provider forms, test, save, disconnect/remove, mailbox search retained. |
| Drafts | `app/mail/drafts/**` | ADAPTED | Persisted search, provider sync, edit and delete retained; tenant/query defects routed separately to FIX-01. |
| Threads and thread detail | `app/mail/threads/**`, `app/mail/thread/**` | ADAPTED | Designed list/empty states and existing thread actions retained; verification pending. |
| Compose | `app/mail/compose/**` | ADAPTED | Draft saving and explicit send-approval request retained; no implicit send. |
| Approvals | `app/mail/approvals/**` | ADAPTED | Explicit approve/reject and truthful empty state retained; suspected server tenant-context defect routed to FIX-01 (BKL-012). |
| WhatsApp | `app/whatsapp/**` | CONNECTION FLOW WIRED (source only) | Server page now resolves the authenticated user’s active organization and mounts `WhatsAppClient`; Connect WhatsApp Business opens the existing encrypted Meta Cloud API credential workflow. Keep pending status until actual Meta/webhook verification; end-to-end connection and UI checks remain unverified. |
| Automations | `app/automations/**` | ADAPTED (source only) | Adapt list/editor/status cards; preserve persistence, authorization, validation and execution safeguards. |
| Schedules | `app/schedules/**` | ADAPTED (source only) | Adapt schedule list/form/run states; preserve timezone, recurrence validation and durable job semantics. |
| Chat | `app/chat/**` | ADAPTED (source only) | Apply workspace composer/message layout and loading/error states; preserve Clara backend, auth and safe email-context behavior. |
| AI & Voice | `app/ai-voice/**` | ADAPTED (source only) | Adapt voice workspace, provider/status controls and responsive layout; preserve runtime configuration and session/error handling. |
| Knowledge | `app/knowledge/**` | ADAPTED (source only) | Added tenant-authorized `/api/knowledge` counts and recent email documents; replaced hard-coded zero counts/inert controls with real loading/error/empty states, refresh, and links to mailbox management. Existing worker host adapter writes email knowledge to `knowledge_documents` / `knowledge_chunks`. Semantic embeddings/Qdrant and external-source onboarding remain unimplemented. Tests/typecheck/build/browser and live DB retrieval are not verified. |
| Activity | `app/activity/**` | ADAPTED (source only) | Added Lucide-led event timeline, search/event-type/decision filters, refresh, responsive rows, truthful empty/loading/error states. Uses existing `/api/audit` authorization boundary; tests/typecheck/build/browser verification not run. |
| Audit | `app/audit/**` | ADAPTED (source only) | Reworked audit filters, loading/error/empty states, responsive table, semantic decision labels, refresh and CSV/JSON exports; fixed filters to reload the authorized API and cancel stale requests. API authorization/export safeguards preserved. Browser/runtime verification pending. |
| Operations | `app/operations/**` | ADAPTED (source only) | Adapted infrastructure/status cards, runtime metrics, refresh and explicit loading/error/empty states. Configured Redis/RabbitMQ/Qdrant URLs display as Configured—not Healthy—because the API reports URL presence rather than live connectivity. No runtime health is fabricated. Verification pending. |
| Settings (general, AI providers/runtime, Gmail OAuth, Zoho OAuth) | `app/settings/**` | ADAPTED (source only) | Added compact anchor navigation and grouped sections; normalized card/input geometry across general Settings and all provider subsections. Existing organization/member/password APIs, encrypted provider secrets, OAuth callbacks and runtime configuration preserved. Tests/typecheck/build/browser/accessibility verification pending. |
| Login and setup | `app/login/**`, `app/setup/**` | ADAPTED (source only) | Aligned both screens to compact Lovable cards, semantic icons and consistent controls while preserving login API/session redirect checks, bootstrap token/password validation, and completion flow. Tests/typecheck/build/browser verification pending. |
| Agent detail/version/history and controls | `app/agents/[id]/**` | ADAPTED (source only) | Applied compact Lovable card geometry and Lucide tab/action iconography across overview, immutable version history, policy, channels, configuration test, and activity tabs. Server page continues to resolve authenticated organization context and fetches the agent through organization-scoped repository methods. Static contract coverage added; tests/typecheck/build/browser/accessibility and live API verification pending. |
| Shared UI primitives/icons | existing `apps/web/src/components/**` | PARTIAL / REVIEW | Reuse installed Lucide icons and existing controls; don't add a parallel sidebar or copy incompatible Vite dependencies wholesale. |

## Completion rule

A screen is not "migrated" merely because global CSS tokens exist. Mark it ADAPTED only when the route's actual visual hierarchy, responsive layout, controls, icons, validation messages, loading/empty/error states and existing actions have been inspected and adapted. Add static contract assertions for important functionality. Record tests/typecheck/build/browser checks as NOT RUN unless actual output is available.

## Exact remaining screen queue

1. Cross-route responsive/icon/accessibility review and focused test coverage.

Backend follow-up: `apps/worker/src/knowledge/email-knowledge-indexer.ts` is a host adapter for the existing PostgreSQL knowledge-document/chunk contract and is called after persisted email-message writes. It avoids direct Qdrant writes and assigns email knowledge to the organization-shared scope. `packages/clara-core/src/runtime.ts` now limits unassigned-agent queries to shared documents and agent-specific queries to shared plus matching-agent documents. This is source-level only; semantic embeddings/vector index integration, provider/database runtime acceptance, and tests remain pending.

WhatsApp, Automations and Schedules were adapted in source commits `3cf94c7f`, `c2dd6e6e`, and `740b70d2`; focused static contract assertions were added in `2f1eecd5`. Chat was adapted in `dee40027`; AI & Voice in `84652b74`; static contract coverage was extended in `10b87d65`, `ddb35096`, with endpoint assertion correction `f7ed2b42`. These changes have not been run through tests, typecheck, build, browser or runtime verification.

This is an explicit inventory, not a claim that every listed page is already migrated or verified.


## 2026-10-09 — WhatsApp connection-flow correction

- Replaced the static WhatsApp preview route with the existing API-backed client, scoped to the authenticated user's active organization (no development-organization fallback).
- The visible Connect WhatsApp Business CTA now toggles an accessible connection form; the form clearly explains Meta Cloud API credentials and saves via the existing encrypted credential endpoint.
- The UI explicitly distinguishes saved/pending credentials from a verified connection; this source change does not implement Meta Embedded Signup or claim webhook verification.
- Added static contract assertions for authenticated route context, CTA/form continuity and honest verification status. Execution of tests/typecheck/build/browser/Meta webhook verification is pending.


## 2026-10-09 — Activity and Audit screen adaptation

- Activity now uses the existing organization-authorized audit API with refresh, event/decision filters, semantic decision states, responsive timeline rows, and explicit loading/empty/error states.
- Audit now reloads when filters change, aborts stale requests, presents a compact responsive table and semantic decision states, and retains CSV/JSON export links with current filters. Existing audit API authorization remains authoritative.
- Added source-contract assertions for API usage, tenant authorization, filters, exports, and honest empty states. Tests/typecheck/build/browser and live data were not run.


## 2026-10-09 — Operations screen adaptation

- Adapted the Operations page with compact Lovable-style infrastructure cards, status icons, runtime metric cards, refresh, and honest loading/error/empty states.
- Corrected presentation semantics: when the existing API only confirms that Redis/RabbitMQ/Qdrant URLs are configured and explicitly says runtime connectivity is worker-owned, the UI displays “Configured” in a neutral style rather than a false green “Healthy” status. The API and authorization behavior were not changed.
- Added focused static contract assertions for API usage, authorization and truthful configured-versus-healthy presentation. Tests/typecheck/build/browser and live dependency connectivity were not run.


## 2026-10-09 — Settings navigation adaptation (source only)

- Added a horizontally scrollable, keyboard-reachable section nav linking to organization, mail OAuth, AI provider, Clara runtime, members/roles and workspace links. Wrapped the existing settings subsections with stable anchors and descriptive headers.
- Existing OAuth client management, AI provider/runtime endpoints, organization membership edits, password change flow, and server-side secret handling remain in place. This is a partial adaptation; provider subcomponents still need a detailed visual/accessibility review.
- Added `apps/web/tests/settings-page-contract.test.ts` source assertions for anchors, endpoint continuity and secret handling. Test/typecheck/build/browser checks were not run.


## 2026-10-09 — Settings and provider-settings adaptation

- Applied the Lovable compact neutral visual system across general organization Settings and AI provider/runtime, Gmail OAuth and Zoho OAuth subsections, including Lucide section iconography and compact card/input geometry.
- Preserved existing organization/member API calls, role/status update behavior, password-change flow, provider/model fetch/save behavior, hidden/encrypted secrets, OAuth callback-origin guidance, Zoho data-center selection and edit/delete safeguards.
- Added focused static contract assertions for settings API paths and credential protections. Tests/typecheck/build/browser and live OAuth/provider verification were not run.


## 2026-10-09 — Settings and authentication route continuation

- Settings now has anchored navigation for its main subsections. Gmail and Zoho OAuth status messages now expose failures through role=alert and destructive styling while successful saves remain role=status; added contract assertions for this behavior.
- Removed duplicate Lucide icon import declarations from login and setup pages (source cleanup to prevent duplicate-import compile failures). Added auth page contract tests for login API continuity, safe local redirect validation, bootstrap token secrecy, password/slug validation and single icon imports.
- Commits: OAuth alert semantics 0f51e38e / 1bce974d, assertions 7f7d75a2 / 6dc64267, login/setup import cleanup 7a2d8fef / 2029c978, auth tests 2714dc08.
- Tests/typecheck/build/browser and keyboard/screen-reader checks were not run. Login/setup remain partial until full visual/accessibility review.


## 2026-10-09 — Agent detail/version/history visual adaptation

- Applied compact Lovable geometry and Lucide iconography to agent detail, version history, policy, channel binding, configuration test, activity and deploy/pause confirmation surfaces. Adapted server-rendered loading/not-found/error surfaces and the new-agent entry page.
- Preserved organization-scoped server reads, JSON object validation, deploy/pause confirmation, policy/channel APIs, and agent-specific audit loading. Added static source-contract assertions.
- Found a pre-existing functional gap in `apps/web/src/app/agents/new/page.tsx`: the Create agent button only enables based on name and has no submit/API handler. The actual working create flow is in `agents-client.tsx`; do not treat the standalone page as functionally complete. Dedicated fix/redirect remains next backlog item.
- Tests/typecheck/build/browser/accessibility/runtime checks were not run.


## 2026-10-09 — Canonical agent creation route

- Removed the standalone non-persisting `/agents/new` form and redirected it to `/agents#new-agent`, the existing organization-scoped creation flow with slug validation, persistence, notifications and transactional initial version/policy setup. This avoids maintaining two divergent creation flows.
- Added a static contract assertion for the redirect and canonical form anchor. Tests/typecheck/build/browser checks were not run.


## 2026-10-09 — Agent detail route source hardening (follow-up)

- Fixed the Activity tab heading to use the imported ActivityIcon symbol (the JSX referenced an unimported Activity name). Added aria-label to the section navigation, aria-pressed to the active section buttons, and shrink-0 to keep tabs usable on narrow screens.
- Added apps/web/tests/agent-detail-page-contract.test.ts source assertions for authenticated organization-scoped loading, not-found handling, navigation accessibility, existing API endpoints, version JSON validation, and explicit deploy/pause confirmations.
- Commits: fbc9a8db; test source 6640a8a2. Tests/typecheck/build/browser checks not run.
