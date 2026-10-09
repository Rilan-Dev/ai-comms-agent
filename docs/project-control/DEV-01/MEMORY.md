# DEV-01 / Forge — Role-local Memory

## Durable development lessons

- **2026-10-09 — Lovable UI migration:** The committed Lovable source is a Vite/TanStack app, while the production application remains a Next.js monorepo. Port design language and route presentation, not the source runtime or mock-data behavior.
- **2026-10-09 — Migration status discipline:** Global CSS tokens do not prove every route is migrated. Track every user-facing route in `docs/project-control/LOVABLE_UI_MIGRATION.md`; mark only screens actually inspected/adapted and state whether verification ran.
- Preserve current API routes, organization context, RBAC, persisted data, frontend validation, loading/empty/error states, idempotency, and explicit approval/send safeguards while changing presentation.
- Keep design tokens semantic (background/foreground/border/accent/status) and use the installed Lucide icon set. Avoid introducing a second shell or framework dependencies just for styling.
- Route substantial defects to FIX-01 and deployment/infrastructure work to OPS-01; continue independent UI work without polling CI/Vercel.
