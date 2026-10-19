# DEV-01 / Forge — Role-local Memory

## Durable development lessons

- **2026-10-09 — Lovable UI migration:** The committed Lovable source is a Vite/TanStack app, while the production application remains a Next.js monorepo. Port design language and route presentation, not the source runtime or mock-data behavior.
- **2026-10-09 — Migration status discipline:** Global CSS tokens do not prove every route is migrated. Track every user-facing route in `docs/project-control/LOVABLE_UI_MIGRATION.md`; mark only screens actually inspected/adapted and state whether verification ran.
- Preserve current API routes, organization context, RBAC, persisted data, frontend validation, loading/empty/error states, idempotency, and explicit approval/send safeguards while changing presentation.
- Keep design tokens semantic (background/foreground/border/accent/status) and use the installed Lucide icon set. Avoid introducing a second shell or framework dependencies just for styling.
- Route substantial defects to FIX-01 and deployment/infrastructure work to OPS-01; continue independent UI work without polling CI/Vercel.


- 2026-10-09 — WhatsApp connection continuity: The visible /whatsapp route was a static mock while the real whatsapp-client.tsx was orphaned. Trace page-to-client wiring before inventing new APIs. Tenant-scoped server pages must pass the authenticated active organization; never fall back to the seeded dev org. A credential save is not Meta connectivity or webhook verification, so keep status pending until the real verifier confirms it.

## 2026-10-19 — C1 private catch-up

Implemented C1; session `sessions/DEV01-CATCHUP-C1-20261018.md` records evidence and limits. Next: C2 stable manifests/coverage. Read authorization must revalidate evidence IDs/revisions as well as top-level sources; forward only allowed output fields. Prove audit atomicity with forced failure, not only successful audit rows. Multiple permissive RLS policies combine with OR: private content needs restrictive isolation plus trusted application predicates. Strict real PostgreSQL migration execution and structural checker results are separate evidence. Never equate focused green checks with full-suite acceptance.

## 2026-10-19 — DEV01-CATCHUP-C2-20261019

C2 complete locally, final merge/push receipt in session.34SQL,25domain,37web,3integrity checks pass; typechecks/build pass. Preserve source/review scoping and UUID cursor UI compatibility. Claim canonical sources, reauthorize scheduled mutations, retain precise server boundaries and compare manifest provenance counts. Prior C1 support sessions finished; independent C2 reviewer complete, FIX-01 compatibility/security support complete, OPS-01 restore/read-only incident assessment complete. No hidden active implementer task remains. Next C3 orchestration/grounding and C4 browser acceptance; security incident and broader suites retain role owners.


## 2026-10-19 — owner-requested commit and recovery checkpoint

Preserved concurrent main changes and both sides of eight documentation conflicts. Current status: C1/C2 focused implementation done; C3 integration then C4 browser acceptance next. Security and broad-suite follow-up remain FIX-01/OPS-01. See docs/project-control/sessions/DEV01-CURRENT-HANDOFF-20261019.md. Lesson: after a rejected push, inspect and integrate current upstream; never overwrite shared project memory or force push.
