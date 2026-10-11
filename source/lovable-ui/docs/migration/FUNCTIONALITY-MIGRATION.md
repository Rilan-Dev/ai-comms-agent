# Functionality Migration: ai-comms-agent → Lovable workspace

## Goal

Make `Rilan-Dev/ai-comms-agent-bb0a3471` the canonical, Lovable-connected application while preserving its existing Agentic AI Studio UI/UX. Bring the working product functionality from `Rilan-Dev/ai-comms-agent` into this workspace incrementally, adapting it to the destination's TanStack Start/Vite architecture rather than replacing the Lovable app with the source application's framework.

- **UI/UX and Lovable workspace:** `Rilan-Dev/ai-comms-agent-bb0a3471`
- **Functionality reference/source:** `Rilan-Dev/ai-comms-agent`
- **Lovable editor:** https://lovable.dev/projects/32ff3207-199d-464b-b52a-f0b2525ab322
- **Source deployment currently documented in source repo:** Vercel project `ai-comms-agent`; confirm integration ownership before changing deployments.

## Non-negotiable migration rules

1. Do not force-push, rebase, amend, or squash commits already published to the Lovable-connected repository. Its `AGENTS.md` explicitly warns that rewriting published history can damage Lovable project history.
2. Do not overwrite the Lovable app wholesale or replace TanStack Start with Next.js. The destination `AGENTS.md` requires keeping TanStack Start and adapting external product concepts into local route components.
3. Preserve the destination's existing visual design and route/component structure. Connect real data and actions to the existing UI; redesign only when explicitly requested.
4. Treat the source repository as the functional reference, not as a blind directory copy. Its root is a pnpm monorepo; the Lovable app is a separate Vite/TanStack Start application with a different dependency/runtime setup.
5. Never copy secrets, local environment files, production credentials, or real tokens. Bring over safe environment-variable names and example templates only.
6. Preserve source commit/PR history in the source repository. The migration is an application-code integration, not a history rewrite or destructive repository transfer. Keep source PR history linked from migration notes when relevant.
7. Keep provider operations server-side; enforce authentication, organization/agent authorization, audit logging, and secret isolation in the destination architecture. Do not expose OAuth secrets or provider tokens to browser code.
8. Do not claim a feature is migrated or verified until its implementation and evidence exist. Continue development without blocking on CI/Vercel completion, but record validation as pending when it has not been run.

## Migration approach

### Stage 0 — Inventory and mapping

Inventory source and destination routes, packages, API/server handlers, DB migrations/schema, workers/queues, authentication/RBAC, provider adapters, Clara integration, WhatsApp, scheduling, and tests. Map each capability to a destination module and identify incompatible framework assumptions. Keep the source repository unchanged.

### Stage 1 — Destination foundations

Create a destination-native server/domain boundary for configuration, authentication, organization/agent access control, persistence, audit events, and background-job dispatch. Reuse the destination's TanStack Start conventions. Define typed contracts between route UI and server-side functionality before wiring screens.

### Stage 2 — Migrate functional slices

Implement in dependency order, preserving the current Lovable UI:
1. Auth/session and organization/agent context.
2. Database schema/migrations and safe configuration.
3. Email account connections and provider OAuth/IMAP/SMTP flows.
4. Email sync, threading, storage, search, summaries, classification, and drafts.
5. Explicitly authorized sending, with audit trail and idempotency.
6. WhatsApp Business connection, inbound messages, outbound replies, and scheduled summaries.
7. Durable scheduling and recoverable background processing.
8. Clara-powered chat/voice and approved agent tools.
9. Observability, security boundaries, failure/retry handling, and end-to-end integration.

For each slice: implement the server/domain behavior, connect the existing destination screen, add focused tests, update the migration matrix and project-control notes, and then move to the next slice. Avoid fake/demo-only handlers where the source behavior is expected to be real.

### Stage 3 — Cutover

Document required environment variables and infrastructure; configure destination secrets outside Git; apply migrations using a controlled procedure; verify OAuth redirect URLs, provider webhooks, queues/workers, and data ownership; then deliberately choose the production deployment and domain. Do not disable or delete the source deployment until the destination is explicitly accepted.

## Architecture constraints discovered

- Source `ai-comms-agent`: pnpm monorepo, Node.js >=20, workspace scripts for web and worker, PostgreSQL 15+ reference runtime, and a Clara reusable-library dependency. Source project-control documentation currently describes development-first continuation and pending runtime validation.
- Destination `ai-comms-agent-bb0a3471`: Lovable-connected Vite/TanStack Start application using React 19 and its own dependency graph. Its `AGENTS.md` explicitly prohibits a wholesale Next.js runtime migration.
- Therefore, migrate domain behavior and compatible shared modules; translate framework-specific routes, server handlers, auth integration, and build/runtime wiring to TanStack Start instead of copying the source root over the destination.

## Working migration matrix

| Capability | Source of truth | Destination status |
|---|---|---|
| Lovable UI/UX and routes | destination repository | Preserved; added Connections route and sidebar entry on migration branch |
| Authentication and RBAC | source behavior/contracts | Inventory, then adapt to destination |
| PostgreSQL schema/migrations | source repository | Inventory and port through controlled migrations |
| Email providers and sync workers | source repository | Public account contracts and focused contract tests added; server/runtime integration not yet implemented |
| WhatsApp | source repository | Inventory, then adapt webhooks and worker execution |
| Scheduling/queues | source repository | Inventory infrastructure assumptions before porting |
| Clara chat/voice/tools | source + Clara reusable library | Preserve Clara as shared reference; adapt integration |
| Tests and verification | both repositories | Port/add destination-native tests; report actual evidence |
| Git history and old PRs | source repository | Leave intact; link relevant source PRs rather than rewriting history |

## Progress log

### Slice 1 — Connections workspace (implemented on migration branch)

- Added `src/routes/settings/connections.tsx` with the existing `WorkspaceShell` styling and clear cards for Gmail, Zoho Mail, IMAP/SMTP, and WhatsApp Business.
- Added Connections to the existing sidebar navigation; no new sidebar or replacement shell was introduced.
- The UI explicitly reports all integrations as **not connected** and does not present fake connect actions. It explains that provider flows remain unavailable until the secure server-side foundation is migrated.
- Source behavior reviewed: `apps/web/src/app/api/email-accounts/route.ts` in the source repo includes organization-scoped authorization, database-required fail-closed behavior, repository-backed account operations, audit events, encrypted credential loading for reconnect, and IMAP/SMTP connection testing. These are behavioral requirements for the destination port, not code to copy wholesale.
- Validation: GitHub writes completed. No local typecheck, route generation, tests, provider runtime, or deployment verification has been run for this slice.

### Slice 2 — Email account contracts (implemented on migration branch)

- Added `src/lib/email-account-contract.ts` with Zod schemas for the source provider set (`gmail`, `zoho`, `imap_smtp`, `microsoft_graph`), connection statuses, browser-safe account summaries, organization-scoped list input, and the supported account actions found in the source route.
- Public account summaries use a strict schema so undeclared fields (including accidental secret fields) are rejected rather than silently passed through.
- Added `src/lib/email-account-contract.test.ts` for summary validation, strict field rejection, required organization context, the full source provider identifier set, and supported action validation.
- This is a shared contract boundary only: no database connection, server handler, OAuth callback, or provider connection is claimed to exist yet.

### Slice 3 — Configuration validation foundation (implemented on migration branch)

- Added `src/lib/email-connection-readiness.ts`, a pure evaluator that reports safe boolean flags and treats blank/whitespace configuration values as missing.
- Added `src/lib/email-connection-readiness.test.ts` covering missing configuration, persistence prerequisites, OAuth completeness, and whitespace-only values.
- Added `.env.example` documenting server-only variable names without real secrets. The actual credential key format still needs to match the eventual encryption implementation before production use.
- A first attempt to expose readiness flags through a public server function was removed because an unauthenticated endpoint should not disclose infrastructure configuration. The Connections page does not expose readiness or secret/configuration state.
- Updated `src/routeTree.gen.ts` to register `/settings/connections` and its route types so the committed route map knows about the new page.
- Validation remains pending: files were written through GitHub; no local test, typecheck, build, provider connection, or deployment verification has been run.
## Next implementation action

Port the email persistence foundation as a complete vertical slice: select and lock the destination-compatible PostgreSQL client/runtime dependency, port the required email-account schema and migration prerequisites, implement a server-only database pool and tenant-scoped repository, and enforce identity/organization authorization before exposing list/delete/actions. Then add integration tests and connect the page to the real list API. Do not enable connect buttons until encrypted credential storage, audit logging, and provider-specific OAuth/IMAP flows are implemented.
