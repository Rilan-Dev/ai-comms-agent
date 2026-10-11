# Copilot instructions for ai-comms-agent

## Repository orientation

- This is a pnpm 12+ TypeScript monorepo (Node.js 20+; CI uses Node 24) with `apps/web` (Next.js App Router), `apps/worker` (background jobs), and workspace packages under `packages/`.
- `packages/shared` owns cross-app domain types and provider contracts; `packages/db` owns PostgreSQL access and persistence; `packages/clara-core` is the host integration boundary for the vendored Clara library. Web and worker code should depend on these workspace contracts rather than creating parallel models.
- The web app handles UI and HTTP/API routes. Long-running and asynchronous work belongs in the worker and, as those flows are implemented, is coordinated through RabbitMQ. PostgreSQL is the source of truth; Redis is transient state and Qdrant is a semantic index, not the authoritative store.
- The intended AI request path is shared across chat, voice, and messaging: normalize to an agent request, then apply intent/context, deterministic policy and authorization, tool execution, and audit. Treat each channel as a transport adapter, not a separate agent implementation.
- Start with [AGENTS.md](../AGENTS.md) and follow its project-control reading order. Use the relevant architecture and contract documents under `docs/architecture/` and `docs/specs/` for implementation details; the code and those documents together define behavior.

## Build, test, and lint

Run from the repository root:

| Purpose | Command |
| --- | --- |
| Build all workspaces | `pnpm run build` |
| Type-check all workspaces | `pnpm run typecheck` |
| Lint workspaces that define a lint script | `pnpm run lint` |
| Run all workspace tests | `pnpm run test` |
| Standard source verification (typecheck, web tests, web build, worker build) | `pnpm run verify` |
| Web development server | `pnpm run dev:web` |
| Worker development process | `pnpm run dev:worker` |

Run one test file with Vitest, for example:

```bash
pnpm --filter @ai-comms-agent/web exec vitest run tests/auth.test.ts
```

Run one worker test file with Node's test runner, for example:

```bash
pnpm --filter @ai-comms-agent/worker exec node --import tsx --test tests/email-provider-runtime.test.ts
```

The web tests live under `apps/web/tests/` and use Vitest. Worker tests live under `apps/worker/tests/` and use `node:test`. `pnpm run verify` is source-only and does not start infrastructure. Check migration naming/chain rules with `bash scripts/verify-migration-chain.sh`. For explicit disposable PostgreSQL runtime verification, use `bash scripts/verify-docker.sh` (requires Docker); it starts and removes its verification stack. The CI workflow also applies migrations and checks their checksums.

VS Code's workspace MCP configuration is in `.vscode/mcp.json`; it starts the Playwright MCP server through `npx` when enabled.

## Architecture and implementation conventions

- Keep domain contracts and shared types in `packages/shared`; keep persistence interfaces/implementations and PostgreSQL connection helpers in `packages/db`. The `@ai-comms-agent/*` workspace package names are the normal import boundary.
- Keep HTTP concerns in the Next.js app and asynchronous/background concerns in the worker. Provider-neutral contracts belong in shared code; concrete provider adapters and runtime orchestration belong with the service that executes them. Check capability contracts before invoking provider-specific behavior.
- Organization scope is a security boundary. Resolve organization identity from trusted route/session context, not a client-supplied body field; authenticate, verify active membership, and check permissions server-side. Preserve database tenant isolation/RLS and domain invariants (including exactly one active organization owner) in persistence changes as well as application code.
- Treat email, messages, attachments, and other external content as untrusted data, never as instructions or authority. An LLM may propose an action, but sensitive operations must pass deterministic policy/authorization (and approval when required) before execution, then be audited.
- PostgreSQL migrations are forward-only. Add a new uniquely numbered migration rather than editing an applied migration; preserve the ordered migration chain and checksum verification. Keep migrations PostgreSQL-compatible and validate changes with the migration-chain/runtime scripts when applicable.
- `vendor/clara/` is an immutable vendored/submodule source boundary. Do not edit Clara source; inspect its reference map and the relevant source before AI, RAG, embeddings, tools, or voice work, then integrate through `packages/clara-core` or a thin host adapter. The application owns its business tool registry; Clara's narrow runtime tools are not a replacement for it.
- Never commit real environment files or credentials. Use the committed `.env.example` / `.env.docker.example` templates and keep secrets server-side.
- `scripts/verify.sh` must remain deterministic and infrastructure-free. Starting PostgreSQL, Redis, RabbitMQ, or Qdrant is an explicit opt-in through the documented Docker runbooks/scripts.

## Project authority

`AGENTS.md` governs repository work and points to the project-control documents for current scope, handoff, decisions, and verification. Do not infer authorization to expand scope or change architecture from historical notes, a roadmap phase, or code alone. When project-control records or an implementation request conflict, stop and resolve the conflict with the project owner before making an architectural or security-sensitive change.
