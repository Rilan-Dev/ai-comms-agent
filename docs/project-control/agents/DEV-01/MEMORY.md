# DEV-01 Role-Local Memory

This is durable memory for DEV-01. It supplements, but never overrides, shared APCP memory or repository authority.

## Read before work
- docs/project-control/AGENT_MEMORY.md
- docs/project-control/AGENT_EVENTS.md
- docs/project-control/AGENT_SESSIONS.md
- docs/project-control/AGENT_HANDOFF.md
- docs/project-control/AGENT_BACKLOG.md
- this file
- current project-control state and applicable architecture/plan

## Record
- recurring issues;
- role-specific mistakes and prevention;
- successful patterns;
- failed approaches;
- environment-specific observations;
- lessons that should be promoted to AGENT_MEMORY.md when cross-agent.

## Do not store
Secrets, tokens, passwords, private keys, or sensitive personal data.

<!-- Append durable DEV-01 lessons below. -->


### 2026-10-09 — Draft discoverability
- For bounded, organization-scoped persisted draft lists, client-side search across subject, body, recipients, and mailbox address improves discoverability without changing the API trust boundary.
- Render a separate no-match state; do not tell users there are no drafts when their current query simply matches none.
- Keep source/runtime verification claims separate: a successful GitHub source write is not a test, build, browser, provider, or deployment pass.
- Related: `apps/web/src/app/mail/drafts/drafts-client.tsx`, commit `8ccf1cb24039cb3bc745a51576a73ee68007e946`.

### 2026-10-09 — Lovable UI adaptation
- Treat `source/lovable-ui` as the authoritative visual reference for this task: warm off-white/ink/soft green palette, DM Sans body typography, Space Grotesk display typography, restrained 6px-ish radius, thin borders, compact icon-led navigation, and spacious editorial overview layout.
- The Lovable project uses Vite/TanStack Start; the current product remains Next.js. Copy design patterns/tokens and adapt components, never transplant framework bootstrapping or replace server/API behavior.
- Preserve real API-backed values, auth/session boundaries, organization scope, form validations, loading/empty/error states and approval/audit behavior. Preview-only controls from the design reference must not replace working application actions.
- Source edits made through GitHub API are not tests. Clearly record typecheck/build/browser/runtime checks as pending unless actually executed.
