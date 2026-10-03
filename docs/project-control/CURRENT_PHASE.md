# CURRENT_PHASE.md

---

```yaml
phase: 2
phase_name: "Application Foundation and Approved Template"
status: "implementation_complete_awaiting_chatgpt_review"
start_date: 2026-10-03
completion_date: 2026-10-03
architect: "ChatGPT (external)"
developer: "Z.AI"
approved_scope: |
  Create the production-grade application foundation that follows the approved
  Phase 1 architecture. The application template must emerge from the architecture.
  Includes: deep Clara audit, monorepo setup, local infrastructure, Clara
  integration boundary, foundation vertical slice, testing, security verification,
  documentation updates. No Phase 3 work (auth/RBAC).

phase_objective: |
  Produce a bootable application foundation that validates the Phase 1 architecture:
  web app renders, worker boots, shared packages resolve, DB package resolves,
  local infrastructure configuration is valid, Clara integration boundary is
  importable without violating source immutability. A read-only mock email view
  serves as the architecture validation slice.

phase_2_tasks:
  total: 9
  completed: 9
  tasks:
    1: "Read project control + architecture + specs docs"
    2: "Deep Clara audit (full clone, verifier, REUSE_MAP validation, clara-runtime export, tools/MCP re-check)"
    3: "Application foundation (apps/web, apps/worker, packages/{clara-core,shared,db})"
    4: "Local infrastructure (docker-compose for Postgres/Redis/RabbitMQ/Qdrant)"
    5: "Clara integration boundary (packages/clara-core; git submodule at vendor/clara/)"
    6: "Foundation vertical slice (web renders, worker boots, mock email view, health check)"
    7: "Testing (typecheck, build, browser verification)"
    8: "Security verification (no secrets, no client-side keys, no .env committed)"
    9: "Documentation updates (CLARA_REUSE_MAP, CLARA-INTEGRATION, project-control, worklog)"

deliverables:
  # Root configuration
  - package.json
  - pnpm-workspace.yaml
  - tsconfig.base.json
  - .gitmodules
  - .npmrc
  - .env.example
  # Apps
  - apps/web/ (Next.js 15 App Router + TypeScript + Tailwind v4)
  - apps/worker/ (Node.js worker — health-check loop)
  # Packages
  - packages/clara-core/ (Clara integration boundary)
  - packages/shared/ (shared types: agent, email, messaging)
  - packages/db/ (Supabase client factory)
  # Vendor
  - vendor/clara/ (Clara git submodule, pinned to b47e587)
  # Infrastructure
  - infra/docker-compose.yml (local Postgres, Redis, RabbitMQ, Qdrant)
  # Updated docs
  - docs/architecture/CLARA_REUSE_MAP.md (corrected per audit)
  - docs/architecture/CLARA-INTEGRATION.md (§8a audit results added)

forbidden_in_phase_2:
  - "Gmail / IMAP / SMTP / Zoho implementation"
  - "WhatsApp / Meta webhooks implementation"
  - "Email synchronization / indexing"
  - "Production RAG ingestion"
  - "Production agent tools"
  - "Production scheduling / automation"
  - "Production realtime voice / chat"
  - "Production database migrations"
  - "Production deployment"
  - "Beginning Phase 3 (auth/RBAC)"

exit_criteria:
  - "Application boots (web + worker)"
  - "Web application renders (browser verification: pages load, no blank screen, no console errors)"
  - "Worker boots (smoke test: all health checks ok)"
  - "Shared package resolves"
  - "DB package resolves"
  - "Local infrastructure configuration is valid (docker-compose)"
  - "Clara integration boundary importable without violating source immutability"
  - "Deep Clara audit complete; CLARA_REUSE_MAP and CLARA-INTEGRATION updated"
  - "Typecheck pass, build pass, security scan clean"
  - "ChatGPT architect reviews and explicitly approves Phase 2"

next_phase_if_approved: 3  # Authentication / Organization / Users / RBAC
```

---

## Phase 2 status narrative

All 9 Phase 2 tasks completed. The application foundation is a pnpm monorepo with:

- **`apps/web`** — Next.js 15 App Router with TypeScript and Tailwind CSS v4. Renders the operational navigation shell (sidebar + top bar per `UI-UX.md`) and a read-only mock email inbox (architecture validation slice per Task 6). Health check endpoint at `/api/health` verifies package resolution and Clara boundary.
- **`apps/worker`** — Node.js worker process. Phase 2 scope: health-check loop only (no queue consumption yet — that's Phase 9+). Boots, verifies shared/db/clara-core packages resolve, verifies vendored Clara source exists, logs structured JSON, graceful shutdown.
- **`packages/clara-core`** — Clara integration boundary. Re-exports `claraRuntime` and types from the vendored submodule via tsconfig path aliases. Clara source is NOT modified.
- **`packages/shared`** — Shared types: `AgentRequest`, `Tool`, `EmailProvider` interface, `MessagingChannel` interface, intent taxonomy.
- **`packages/db`** — Supabase client factory with anon-key (RLS-enforced) and service-role (server-only) clients.
- **`vendor/clara`** — Git submodule pinned to commit `b47e587` (the Clara reusable library).
- **`infra/docker-compose.yml`** — Local development infrastructure: PostgreSQL 16, Redis 7, RabbitMQ 3.13 (with management UI), Qdrant v1.12.4.

The deep Clara audit (Task 2) completed with key findings:
- Verifier: 106/108 PASS (2 manifest SHA typos — Clara library issue, not file mutations).
- `clara-runtime.ts` actual export is `export const claraRuntime = { ... } as const;` (a const object, NOT a `ClaraRuntime` class). CLARA_REUSE_MAP §2.3 corrected.
- Tools/MCP finding refined: Clara has a narrow host-binding runtime tool interface (`claraRuntime.tools` supporting `rag_search` only); no generic standalone tool/MCP framework. CLARA_REUSE_MAP §2.4 and §2.5 corrected. ISS-005 refined.
- Integration approach: git submodule at `vendor/clara/` with `packages/clara-core/` as the adapter boundary.

Verification:
- Typecheck: 5/5 packages pass.
- Web build: success (routes: `/`, `/mail/inbox`, `/api/health`).
- Worker build: success (dist/index.js produced).
- Browser verification: pages load 200 OK, no blank screen, navigation renders, health check returns 200 healthy.
- Worker smoke test: boots, all checks ok, graceful shutdown.
- Security scan: clean (no secrets, no private keys, no .env files committed — only .env.example with placeholder values).

Phase 2 now awaits ChatGPT architect review. Per the user's STOP instruction, Z.AI must not start Phase 3.
