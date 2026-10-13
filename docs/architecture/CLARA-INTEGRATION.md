# CLARA-INTEGRATION.md — Clara Reuse, Adapt, and Application-Specific Plan

This document defines how `ai-comms-agent` integrates with the Clara reusable AI library at `Rilan-Dev/ai-reusable-libraries`. Per the master operating prompt §4 and §5, Clara is the permanent reference for AI, RAG, voice, agent runtime, and related capabilities. The rule is: **do not recreate Clara functionality; reuse directly, adapt through a thin adapter, or — only if genuinely necessary — write application-specific code**.

This is a Phase 1 document. Phase 2 begins with a deep audit of Clara (per ISS-002) to validate every "reuse" and "adapter" claim below.

---

## 1. What Clara provides (recap)

From `clara-core/README.md`, `AGENTS.md`, and `REFERENCE-MAP.md`, Clara provides:

| Clara module | Capability |
|---|---|
| `ai-core` | AI provider/model resolution, governance, providers (OpenAI, Gemini, Sarvam, TEI), multilingual embeddings, model catalog |
| `ai-governance` | Usage tracking, entitlements, live catalog, resolver |
| `agent-versioning` | Agent version/diff/projection/db |
| `voice-core` | Voice provider resolution, providers (ElevenLabs, Sarvam), realtime identity/generation-coordinator/latency-tracker/reconnect-policy/ui-state-machine, metering |
| `assistant` | Assistant config, language policy, realtime events, conversation context, OpenAI realtime |
| `rag` | Config, cross-lingual, diversify, grounding, knowledge-topics, turn-guidance, query-embedding-cache |
| `ingest` | Factory, types, chunkers (recursive), parsers (pdf, text, html, docx, xlsx) |
| `graph` | Core types, graph-store, graph-retriever |
| `knowledge-bases` | Core models, db, snapshots, reindex, ai-overrides, analytics, embedding-index, config-builder, worker (ingest-poller, ingest-worker) |
| `organisations` | Agent AI types, AI settings DB, agent AI settings DB |
| `phone` | Twilio, Vonage providers (not directly used here — WhatsApp is separate) |
| `cloud-jobs` | Queue abstraction |
| `embed` | Public embed runtime (NDJSON, search, public-token) |
| `ai-platform-core` | Clara runtime |
| `admin` | Vector store, vector store KB, ingest (chunker, web-loader, document-loader) |
| `lib` | Redact, quota-admission, plan-guard |

Source: `clara-core/source/src/modules/`. Immutable byte-for-byte source copies — never modified.

---

## 2. Integration decision matrix

For each capability, we decide: **REUSE** (use Clara directly), **ADAPTER** (wrap Clara with a host-specific adapter), or **APP-SPECIFIC** (write new code, only if genuinely necessary).

| Capability | Decision | Notes |
|---|---|---|
| AI provider resolution (OpenAI, Gemini, Sarvam, TEI) | REUSE | `ai-core/resolve.ts`, `factory.ts`, `providers/*` |
| AI governance (usage, entitlements, catalog) | REUSE | `ai-governance/core/*` |
| AI usage persistence | ADAPTER | `ai-governance/core/usage-db.ts` reads Clara's schema; our adapter writes to our `ai_usage_events` (mirrors Clara's shape) |
| AI provider config storage | ADAPTER | `organisations/core/ai-settings-db.ts` reads Clara's schema; our adapter wraps Supabase queries |
| Agent versioning (version, diff, projection) | REUSE | `agent-versioning/core/*` |
| Agent deployment | REUSE | `agent-versioning/core/*` (deployment projection) |
| Agent runtime | REUSE | `ai-platform-core/clara-runtime.ts` |
| Chat streaming (NDJSON, SSE) | ADAPTER | `embed/core/ndjson.ts` reused; SSE transport is app-specific (Next.js Route Handler) |
| RAG grounding/retrieval | REUSE | `rag/grounding.ts`, `rag/turn-guidance.ts` |
| RAG config (cross-lingual, diversify, knowledge-topics) | REUSE | `rag/*` |
| Embedding generation | REUSE | `ai-core/multilingual-embeddings.ts` |
| Embedding cache | REUSE | `rag/query-embedding-cache.ts` |
| Ingest (parsers, chunkers) | REUSE | `ingest/*` |
| Knowledge bases (core models, db, reindex, analytics) | ADAPTER | `knowledge-bases/core/*` reused; DB adapter wraps Supabase |
| Knowledge bases (worker) | ADAPTER | `knowledge-bases/worker/*` reused; our worker host runs them |
| Vector store (Qdrant) | REUSE | `admin/core/vector-store.ts`, `admin/core/vector-store-kb.ts` |
| Voice provider resolution (ElevenLabs, Sarvam) | REUSE | `voice-core/resolve.ts`, `factory.ts`, `providers/*` |
| Voice realtime (identity, generation-coordinator, latency, reconnect) | REUSE | `voice-core/realtime/*` |
| Voice metering | REUSE | `voice-core/metering.ts` |
| Voice telemetry persistence | ADAPTER | `voice-core/realtime/latency-log.ts` reused; persistence adapter writes to our `voice_telemetry` |
| OpenAI realtime | REUSE | `assistant/api/openai-realtime.ts` (transport-specific, per Clara's AGENTS.md) |
| Gemini Live | REUSE | `assistant/api/*` + relay scripts |
| Sarvam voice | REUSE | `assistant/api/sarvam/*` + `scripts/sarvam-wire.mjs` |
| Conversation context | REUSE | `assistant/api/conversation-context.ts` |
| OpenAI model catalog | REUSE | `assistant/api/openai-catalog.ts` |
| Language policy | REUSE | `assistant/core/language-policy.ts` |
| Realtime events | REUSE | `assistant/core/realtime-events.ts` |
| Sentence splitting (voice) | REUSE | `assistant/core/voice/sentence-split.ts` |
| Public embed (clara.js) | REUSE (if/when exposed) | `public/embed/clara.js` |
| Redaction (PII) | REUSE | `lib/redact.ts` |
| Quota admission | REUSE | `lib/quota-admission.ts` |
| Plan guard | N/A | `lib/plan-guard.ts` — SaaS billing; not used (per `RULES.md §5`) |
| Cloud jobs (queue) | ADAPTER | `cloud-jobs/queue.ts` reused; our adapter wraps RabbitMQ |
| Email (Gmail, IMAP, SMTP, Zoho) | APP-SPECIFIC | Clara does not provide email; we build the `EmailProvider` adapter model |
| WhatsApp | APP-SPECIFIC | Clara does not provide WhatsApp; we build the WhatsApp integration |
| Scheduling | APP-SPECIFIC | We build scheduled jobs (PostgreSQL-backed) |
| Automation rules | APP-SPECIFIC | We build automation rules |
| Auth (login, password sessions) | APP-SPECIFIC | We build PostgreSQL-backed application authentication; no hosted auth dependency |
| RBAC | APP-SPECIFIC | We build RBAC |
| Webhook receivers (WhatsApp, Gmail, Zoho) | APP-SPECIFIC | We build webhook handlers |
| Approval workflow | APP-SPECIFIC | We build the approval policy engine |
| UI | APP-SPECIFIC | We build the Next.js UI |

---

## 3. Adapter pattern

For ADAPTER items, the pattern is:

```typescript
// Clara interface (immutable, from clara-core/source)
import { ClaraAICore } from '@clara/ai-core';

// Our host adapter
class AICoreAdapter {
  constructor(private clara: ClaraAICore, private hostDb: HostDB) {}

  async resolveAgentConfig(agentId: string): Promise<AgentAIConfig> {
    // 1. Read from our DB (Supabase) using our schema
    const ourConfig = await this.hostDb.query('agent_ai_settings', { agent_id: agentId });
    // 2. Map to Clara's expected shape
    const claraConfig = mapToClaraShape(ourConfig);
    // 3. Call Clara
    return this.clara.resolveAgentConfig(claraConfig);
  }
}
```

The adapter:
- Reads/writes our schema (Supabase).
- Maps between our schema and Clara's expected shapes.
- Calls Clara for the actual capability.
- Adds host-specific concerns (auth, tenancy, audit) that Clara does not own.

The adapter does **not**:
- Re-implement Clara's logic.
- Modify Clara's files.
- Add a second abstraction layer on top of Clara.

---

## 4. Host-boundary concerns (per `clara-core/AGENTS.md §6`)

The following are explicitly host-boundary concerns (Clara does not own them; we provide adapters):

- Identity (users, sessions, MFA)
- Tenancy (organizations, memberships)
- Secrets (env vars, encrypted credentials)
- HTTP/Next.js handlers (route handlers, server actions)
- Vendor webhooks (WhatsApp, Gmail Pub/Sub, Zoho)
- Deployment (Vercel, worker host)
- Database access (Supabase queries)
- File storage (Supabase Storage)
- Email provider integration (Gmail, IMAP, Zoho) — application-specific
- WhatsApp integration — application-specific
- Scheduling — application-specific
- Approval workflow — application-specific

These are app-specific. Clara's existing primitives (e.g., `lib/redact.ts` for PII redaction, `lib/quota-admission.ts` for rate limiting) are reused where they fit.

---

## 5. Package layout (Phase 2)

Phase 2 produces the application foundation. Likely layout (subject to ChatGPT approval in Phase 2):

```text
ai-comms-agent/
├── apps/
│   ├── web/                    # Next.js app (Vercel)
│   │   ├── app/                # App Router
│   │   ├── components/
│   │   ├── lib/
│   │   └── package.json
│   └── worker/                 # Worker host (Node, RabbitMQ consumers)
│       ├── src/
│       │   ├── consumers/      # one file per queue
│       │   ├── adapters/       # Clara adapters
│       │   ├── email/          # EmailProvider + Gmail/IMAP/Zoho adapters
│       │   ├── whatsapp/       # WhatsApp integration
│       │   ├── scheduling/     # Scheduled jobs
│       │   ├── approvals/      # Approval policy engine
│       │   └── audit/          # Audit persistence
│       └── package.json
├── packages/
│   ├── shared/                 # Shared types, schemas, utilities
│   └── db/                     # Supabase client, migrations, RLS helpers
├── supabase/
│   └── migrations/             # NNNN_description.sql
├── docs/                       # (this directory — already exists)
├── package.json                # Workspace root
├── pnpm-workspace.yaml         # (if pnpm)
└── turbo.json                  # (if turborepo)
```

Clara is imported as a dependency (`@clara/ai-core`, `@clara/voice-core`, etc. — or a single `@clara/core` package, depending on how Clara is published). If Clara is not yet published as a package, Phase 2 may git-submodule or vendored-copy it (with explicit ChatGPT approval).

The exact package layout is a Phase 2 decision (subject to ChatGPT approval per `RULES.md §6`).

---

## 6. Clara version pinning

Clara is pinned to a specific commit in `package.json` (or git submodule). Upgrades are:

1. Read Clara's `WORKLOG.md` and `IMPLEMENTATION-PLAYBOOK.md` for changes since the pinned version.
2. Run Clara's `scripts/verify-extraction.mjs` to validate integrity.
3. Run our full test suite against the new Clara version.
4. ChatGPT review of any breaking changes.
5. Update pin, commit, deploy.

We do not auto-upgrade Clara. Every upgrade is explicit and reviewed.

---

## 7. What this integration plan explicitly does NOT do

- Does not modify Clara source files (they are immutable byte-for-byte copies).
- Does not add a second abstraction layer on top of Clara's interfaces.
- Does not vendor Clara into our repo (we depend on it as a package or submodule).
- Does not recreate AI/RAG/voice/agent-runtime capabilities that Clara already provides.
- Does not silently import unrelated SaaS architecture from Clara's `doable-source` directory (which is reference-only, per Clara's AGENTS.md).
- Does not use Clara's `lib/plan-guard.ts` (SaaS billing — per `RULES.md §5`).
- Does not use Clara's `phone/` module (Twilio/Vonage — we use WhatsApp, which is separate).

---

## 8. Phase 2 deep-audit tasks (per ISS-002)

Before Phase 2 implementation:

1. Full clone of `Rilan-Dev/ai-reusable-libraries` (not depth-1).
2. Run `clara-core/scripts/verify-extraction.mjs` — validates the immutable extraction manifest.
3. Read every file referenced in this integration plan.
4. Validate that the adapter signatures match Clara's actual exports.
5. Identify any Clara files that need host-boundary wrapping (per `clara-core/AGENTS.md §6`).
6. Identify any Clara files that have hidden coupling (e.g., `doable-source/AI_RAG_ARCHITECTURE.md` notes that `engine-resolver.ts` directly imports Doable SQL — these need adapter wrapping, not direct use).
7. Update this document with any corrections from the audit.
8. Record audit results in `worklog.md` and `VERIFICATION_STATE.md`.

The deep audit is a Phase 2 task (or earlier if ChatGPT directs).

---

## 8a. Phase 2 deep-audit results (2026-10-03)

The Phase 2 deep audit was performed on 2026-10-03. Results:

### Audit method

- Full clone of `Rilan-Dev/ai-reusable-libraries` (42 commits, 108 extracted files).
- Read `clara-core/AGENTS.md`, `README.md`, `REFERENCE-MAP.md`, `IMPLEMENTATION-PLAYBOOK.md`, `WORKLOG.md` in full.
- Inspected `clara-core/extraction-manifest.json` (108 entries, schema_version 1, immutable: true, status: in_progress).
- Ran a target-side verifier (the original `verify-extraction.mjs` requires the Clara-AI-Platform source repo, which we don't have; our verifier checks that every `target_path` exists in HEAD and its blob SHA matches `source_blob_sha`).
- Read `clara-core/source/src/modules/ai-platform-core/clara-runtime.ts` in full.
- Searched for all tool/MCP references in `clara-core/source/src/`.
- Traced imports of `clara-runtime.ts`.

### Verifier result

- **106/108 PASS** (target blob SHA matches manifest).
- **2/108 FAIL** — both are manifest recording errors (typos in `source_blob_sha`), NOT file content mutations:
  - `clara-core/source/src/modules/rag/knowledge-topics.ts`: manifest SHA is 41 chars (malformed — SHA-1 is 40 chars); actual git blob SHA is the 40-char prefix.
  - `clara-core/source/src/modules/language-core/config-types.ts`: manifest SHA differs from actual at 1 hex position (39 chars vs 40 chars).
- Conclusion: the extracted files are present and have valid git blob SHAs. The 2 mismatches are Clara library manifest typos to report upstream. The extraction is effectively immutable.

### Key finding: `clara-runtime.ts` actual export

The original `CLARA_REUSE_MAP.md §2.3` described the export as a `ClaraRuntime` class. This was **incorrect**. The actual export is:

```typescript
export const claraRuntime = {
  async resolveProvider(ctx, surface = "chat") { ... },
  async resolveVoice(ctx) { ... },
  async retrieve(ctx, query, options?) { ... },
  async createChatTurn(request): Promise<ClaraAgentTurn> { ... },
  async startRealtimeSession(ctx) { ... },
  tools: {
    list() { return [{ name: "rag_search", description: "..." }]; },
    async invoke(ctx, name, input) {
      if (name !== "rag_search") throw new Error("Unsupported Clara tool: " + name);
      // delegates to claraRuntime.retrieve()
    },
  },
} as const;
```

This is a **const object literal**, not a class. The `CLARA_REUSE_MAP.md §2.3` has been corrected.

### Key finding: Tools and MCP (ISS-005 refined)

The original `CLARA_REUSE_MAP.md §2.4` stated Clara has "no standalone tool runtime". This was imprecise. The accurate finding:

- Clara has a **narrow host-binding runtime tool interface** (`claraRuntime.tools`) supporting `rag_search` only.
- There is **no generic standalone application tool/MCP framework**.
- The `enableMcp: boolean` flag exists in `rag/config.ts` but has no backing implementation.
- ai-comms-agent owns its application `ToolRegistry` for email, WhatsApp, scheduling, approvals, etc.
- The host `kb.search` tool wraps `claraRuntime.retrieve()` for KB retrieval.

`CLARA_REUSE_MAP.md §2.4` and `§2.5` have been corrected. `ISS-005` has been refined.

### Integration approach chosen (Phase 2)

Clara is integrated as a **git submodule** at `vendor/clara/` (pinned to commit `b47e587`). The `packages/clara-core/` package is the host adapter boundary — it re-exports Clara's `claraRuntime` and types via tsconfig path aliases (`@/modules/*` → `vendor/clara/clara-core/source/src/modules/*`). Clara source files are **not modified** (per `clara-core/AGENTS.md §4`).

### Hidden coupling identified

- `clara-runtime.ts` uses `@/modules/*` import aliases — these are resolved via tsconfig `paths` in `packages/clara-core/tsconfig.json`. The host's `apps/web` and `apps/worker` do NOT directly import Clara source; they import from `@ai-comms-agent/clara-core` (the adapter package). This keeps the coupling boundary clean.
- `doable-source/AI_RAG_ARCHITECTURE.md` notes that `engine-resolver.ts` directly imports Doable SQL — this file is NOT in the extracted `clara-core/source/` and is NOT used by our integration. We use `claraRuntime` (the host-binding layer) which is "intentionally outside the extracted Doable source" per the file's own comment.

### Audit artifacts

- Target-side verifier script: `<workspace>/scripts/clara-verify-target.py` (preserved in the original Z.AI workspace, not committed to the repo — recreate locally if needed).
- Full clone: `<workspace>/work/clara-lib-full/` (preserved for reference in the original workspace; the committed integration uses the git submodule at `vendor/clara/`).

---

## 9. Decision authority

Any change to this integration plan (e.g., "we need to recreate capability X because Clara's version doesn't fit") is an architectural decision. Z.AI proposes; ChatGPT approves/rejects/corrects; Z.AI implements. The decision is recorded in `DECISIONS.md`.
