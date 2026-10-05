# Product Completion Plan — Menu-by-Menu Vertical Slices

Date: 2026-10-05
Owner: ChatGPT
Repository: Rilan-Dev/ai-comms-agent

## Objective

Turn the current application from a visual foundation/partial implementation into a production-grade communications agent platform by completing one user-facing menu at a time. A menu is not considered complete until its UI, validation, API/service behavior, persistence, authorization, loading/empty/error/success states, notifications, responsive behavior, accessibility, tests, and browser verification all work together.

This plan does not change the product objective or architecture. Clara remains the reusable AI/RAG/realtime layer; PostgreSQL remains authoritative; Redis/RabbitMQ/Qdrant remain infrastructure; host application owns business tools, email, WhatsApp, scheduling, authorization and persistence mapping.

## Current reality — 2026-10-05

The repository has substantial Phase 4 database work and partial Phase 5 email work, but the product UI is still largely placeholder/demo data. Several visible controls are non-functional, many pages contain hard-coded rows, there is no consistent form validation/error/notification system, and production authentication/provider connections are not complete.

Control documents also contain historical/contradictory entries from the rapid takeover. This plan is the corrective product execution baseline. CHAT_CONTINUITY.md remains the recovery procedure; NEXT_ACTION.md is updated to point to the active implementation slice.

## Non-negotiable Definition of Done for every menu

1. Real persistence through the PostgreSQL repository/service boundary.
2. Server-side authentication and organization authorization.
3. Input validation with shared schemas and field-level messages.
4. Loading, empty, error, retry and success states.
5. User notifications for mutations and recoverable failures.
6. Buttons/actions invoke real handlers; no decorative controls.
7. Destructive/sensitive actions require confirmation/authorization.
8. Idempotency and safe retry for externally-visible operations.
9. Audit event for security-sensitive mutations.
10. Unit/integration tests plus API/authorization tests.
11. Browser verification for happy path, validation failure and error state.
12. Responsive and keyboard-accessible UI.
13. No fake metrics/data presented as live state.
14. No provider secrets in browser or repository.
15. Documentation/control state updated before moving to the next menu.

## Execution order

### 0 — Shared Product UX/Runtime Foundation
- Global error boundary and route-level error states.
- Notification/toast system.
- Form primitives: validation, dirty-state, submit lifecycle, field errors.
- Confirm dialog for destructive/sensitive actions.
- Standard loading skeletons, empty states, retry states.
- API error envelope and client error mapper.
- Accessible buttons/links/dialogs/forms.
- Navigation active states and mobile navigation.
- Replace fake system operational indicators with health-backed status.
- Establish browser verification checklist and reusable test helpers.

### 1 — Agents
First complete vertical slice.
- Agent list: real DB data, search/filter/status.
- Create agent: name/slug/purpose validation.
- Agent detail/edit.
- Version creation/history and current version.
- Deploy/retire with confirmation and authorization.
- Agent policy: allowed tools, send/forward/delete restrictions, sender allow/block lists, rate limits.
- Email bindings: multiple accounts per agent with role.
- WhatsApp binding: exactly one account per agent.
- Agent test/simulation surface.
- Audit trail for config/deploy/policy changes.
- Complete responsive UI.

### 2 — Email Accounts
- Provider selector.
- Gmail OAuth start/callback/state validation.
- Generic IMAP/SMTP secure connection form.
- Zoho OAuth foundation.
- Connection test.
- Connect/disconnect/reconnect.
- Credential encryption and server-only handling.
- Account status/error display and retry.
- Folder/label discovery.
- Agent assignment.
- Account deletion/revocation confirmation.

### 3 — Mail
- Real inbox/thread data.
- Search/filter/date/priority/unread.
- Read/unread, archive, move, labels.
- Thread/message detail.
- Draft composer/autosave.
- Reply/forward.
- Attachment handling with security checks.
- No mock data in production path.

### 4 — WhatsApp
- One Business account per agent enforcement.
- Meta OAuth/configuration.
- Webhook verification and status.
- Conversation/contact list.
- Send/receive lifecycle.
- Delivery/read/failure states.
- Template management.
- Rate-limit/error handling.
- Agent routing and command execution.

### 5 — Agent Intelligence / Knowledge
- Clara provider configuration.
- RAG/indexing status.
- Email indexing.
- Search/retrieval diagnostics.
- Daily/24h/1/2/3-day summaries.
- Important/action-item extraction.
- Prompt-injection defenses and source attribution.

### 6 — Automations & Schedules
- Rule builder with validation.
- Trigger/action configuration.
- Durable schedules, timezone and missed-fire behavior.
- Run history/retry/cancel.
- WhatsApp daily summaries.
- Approval boundaries for sensitive actions.

### 7 — Chat
- Persistent conversations.
- SSE streaming.
- Cancellation.
- Tool-call rendering.
- Approval cards.
- RAG citations/source cards.
- Error/retry and reconnect behavior.

### 8 — Realtime Voice
- Clara realtime session.
- Mic permissions and device state.
- Transcript/assistant response.
- Interrupt/cancel/reconnect.
- Provider selection.
- Latency telemetry.
- Clear failure/recovery UI.

### 9 — Settings / Organization / Members
- Organization profile.
- Member invitation/removal/role changes.
- Session/security controls.
- AI/provider settings.
- Notification preferences.
- Webhook/provider settings.

### 10 — Activity / Audit / Operations
- Real activity stream.
- Audit filters/search.
- Authorization decision visibility.
- Queue/sync/provider/voice health.
- Export where required.
- No fabricated activity rows.

### 11 — End-to-End Product Completion
- Full E2E scenarios across email → AI → approval → send → WhatsApp → schedule → voice.
- RLS/cross-tenant tests.
- Security tests.
- Accessibility/mobile verification.
- Load/latency checks.
- Deployment verification and production readiness.

## Phase discipline

The existing roadmap phases remain the architectural source of truth. Work may be implemented as vertical slices when dependencies are already present, but a roadmap phase is not marked complete until its documented exit criteria and ChatGPT acceptance are satisfied.

No production credential provisioning or external provider activation will be faked. Where user-owned OAuth/provider credentials are required, the implementation will provide the complete secure flow and a truthful configuration-required state.

## Current implementation slice

Slice 0 — Shared Product UX/Runtime Foundation, followed immediately by Slice 1 — Agents.

Acceptance gate for Slice 0:
- All global mutation surfaces have consistent validation/error/loading/success behavior.
- Notifications work.
- Route errors are recoverable.
- Browser verification demonstrates the foundation.
- Control docs identify Slice 1 Agents as the only next product slice.

Acceptance gate for Slice 1:
- Agents are real persisted records and no longer hard-coded.
- Create/edit/version/deploy/policy/channel binding workflows are functional.
- All actions have authorization, validation, notifications and error handling.
- Tests and browser verification are green.


## Execution log — 2026-10-06

Slice 0 is materially implemented in the shared application shell (notifications and recoverable route errors). Slice 1 Agents implementation is active under ChatGPT ownership: PostgreSQL persistence, CRUD, version history, deployment/retirement, policy, audit, configuration testing, email binding, single-WhatsApp binding, validation, and responsive UI are now present. **Slice 1 is not accepted yet**; GitHub runtime/type/build verification and browser verification remain required before moving to Email Accounts.


## Continuation log — 2026-10-06

Development is intentionally continuing without waiting for CI/Vercel jobs. Before advancing the product acceptance gate, ChatGPT corrected the persisted email credential repository contract so the actual PostgreSQL `ciphertext` column is read correctly, and replaced the `/mail/accounts` demo page with a PostgreSQL-backed account surface plus an authorized disconnect endpoint. Provider connection activation remains truthful: OAuth/IMAP configuration is not fabricated when user-owned provider credentials are absent.
