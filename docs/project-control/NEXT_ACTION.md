# NEXT_ACTION.md

The single exact next authorized action. Update this file on every commit.

---

## Current next action

```yaml
actor: ChatGPT
role: Chief Architect / Project Controller / Acceptance Gatekeeper

action: |
  Review the Phase 1 documentation package in this repository. Decide one of:
    (a) APPROVE — Phase 1 is accepted; issue the Phase 2 Z.AI_HANDOFF.
    (b) REJECT  — Phase 1 has fundamental gaps; issue a correction handoff listing each gap.
    (c) CORRECT — Phase 1 is mostly accepted but specific corrections are required;
                  issue a correction handoff listing each correction.

artifacts_to_review:
  - README.md
  - AGENTS.md
  - worklog.md
  - docs/project-control/PROJECT_STATE.md
  - docs/project-control/CURRENT_PHASE.md
  - docs/project-control/VERIFICATION_STATE.md
  - docs/project-control/DECISIONS.md
  - docs/project-control/ISSUES.md
  - docs/project-control/RISKS.md
  - docs/architecture/ARCHITECTURE.md
  - docs/architecture/DATA-MODEL.md
  - docs/architecture/AI-ARCHITECTURE.md
  - docs/architecture/REALTIME-VOICE-ARCHITECTURE.md
  - docs/architecture/EMAIL-PROVIDER-ARCHITECTURE.md
  - docs/architecture/WHATSAPP-ARCHITECTURE.md
  - docs/architecture/EVENTS-AND-QUEUES.md
  - docs/architecture/SECURITY.md
  - docs/architecture/OBSERVABILITY.md
  - docs/architecture/UI-UX.md
  - docs/architecture/DEPLOYMENT.md
  - docs/architecture/CLARA-INTEGRATION.md
  - docs/specs/PRODUCT.md
  - docs/specs/PROVIDER-CONTRACTS.md
  - docs/specs/TOOL-CONTRACTS.md
  - docs/specs/AUTHORIZATION.md
  - docs/specs/EVENT-CONTRACTS.md
  - docs/specs/API-CONTRACTS.md
  - docs/plans/ROADMAP.md

review_dimensions:
  - "Architecture — does the design match the product objective and Clara reuse rules?"
  - "Data model — entities, relationships, indexes, constraints, RLS boundaries"
  - "Provider contracts — email adapter model, capability discovery, WhatsApp, AI providers"
  - "AI architecture — agent runtime, tool registry, intent→policy→authorization→execution→audit"
  - "Realtime voice — Clara reuse, transport, cancellation, telemetry"
  - "Email synchronization — queues, idempotency, retries, DLQ, cursor tracking"
  - "Security — auth, RBAC, credential encryption, prompt injection, SSRF, HTML sanitization"
  - "Observability — metrics, traces, latency budgets"
  - "Deployment — Vercel + Supabase architecture"
  - "Roadmap — phase sequence, dependencies, exit criteria"

after_decision:
  if_approved: |
    Issue the Phase 2 Z.AI_HANDOFF with the full handoff template
    (see docs/project-control/RULES.md §7). Phase 2 = "Application foundation
    and approved project template" — see docs/plans/ROADMAP.md for the
    approved Phase 2 scope.
  if_rejected_or_corrected: |
    Append a section to docs/project-control/ISSUES.md (or DECISIONS.md if
    architectural) describing each required change, then update this
    NEXT_ACTION.md to point at the new correction handoff.
```

---

## What Z.AI must NOT do next

- Z.AI must not start Phase 2 implementation.
- Z.AI must not create `package.json`, Next.js scaffold, or any application template.
- Z.AI must not create database migrations.
- Z.AI must not deploy anything.
- Z.AI must not modify the architecture without ChatGPT approval.

Z.AI is in **STOP** state, awaiting the next ChatGPT architect instruction.
