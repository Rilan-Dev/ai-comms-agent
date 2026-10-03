# OBSERVABILITY.md — Observability Architecture

This document defines observability: metrics, traces, structured logs, latency budgets, and alerting. Per the master operating prompt §16, observability must be defined before implementation. Phase 1 defines what to track; Phases 17 and 18 implement and verify.

---

## 1. Pillars

Three pillars: structured logs, metrics, traces. Plus an audit pillar (covered in `SECURITY.md §15` and `DATA-MODEL.md §11`).

- **Logs**: structured JSON, emitted to stdout by the API and workers, collected by a log aggregator (Vercel's built-in logs for the API; worker host's log drain for workers; optionally a third-party like Logtail, BetterStack, or Axiom).
- **Metrics**: Prometheus-style (counters, gauges, histograms) exported by the API and workers, scraped and stored (likely Axiom or BetterStack; could be self-hosted Prometheus).
- **Traces**: OpenTelemetry-style spans, propagated via `traceparent` header (W3C Trace Context). Tracing from API request → queue message → worker → audit.

The exact observability vendor is selected in Phase 2 (Application foundation). The contract is vendor-neutral.

---

## 2. What to track (per master prompt §16)

| Metric | Type | Source | Alert |
|---|---|---|---|
| Email sync latency | histogram | `email.sync` worker | p95 > 30s sustained 5 min |
| Provider errors | counter | all email/WhatsApp/AI/voice call sites | rate > 1% of total |
| Queue latency | histogram | RabbitMQ publish → ack | p95 > 60s sustained 5 min |
| Processing latency (parse/index/classify) | histogram | per worker | p95 > 10s sustained 5 min |
| Embedding latency | histogram | `embedding.generate` worker | p95 > 5s sustained 5 min |
| AI latency (chat/tool) | histogram | agent runtime | p95 > 8s sustained 5 min |
| Tool latency | histogram | per tool | p95 > 5s sustained 5 min |
| WhatsApp latency (inbound → outbound) | histogram | `whatsapp.inbound` + `whatsapp.outbound` | p95 > 5s sustained 5 min |
| Voice latency (TTFA, TTFT, total) | histogram | `voice.telemetry` | TTFA p95 > 1500ms sustained 5 min |
| Realtime TTFA | histogram | voice-core latency-tracker | (same as above) |
| Provider usage (tokens, seconds, cost) | counter | `ai_usage_events` | daily cost > budget (per-org) |
| Failed jobs | gauge | per queue DLQ depth | DLQ depth > 0 (warn), > threshold (critical) |
| Retries | counter | per queue | retry rate > 10% of ack rate |
| Scheduled job execution | counter/gauge | `scheduled_job_runs` | missed fire rate > 1% |
| Action approvals (pending/elapsed) | gauge | `email_actions` | pending > 100 per org (warn) |
| Audit events (rate, dropped) | counter | `audit.persist` worker | dropped > 0 (critical) |

Plus infrastructure metrics (CPU, memory, disk, network) from Vercel and the worker host.

---

## 3. Structured logs

Every log line is JSON with:

```json
{
  "timestamp": "2026-10-03T12:34:56.789Z",
  "level": "info|warn|error|debug",
  "service": "api|worker.email-sync|worker.voice-telemetry|...",
  "message": "human-readable summary",
  "correlation_id": "uuid",
  "request_id": "uuid or null",
  "user_id": "uuid or null",
  "organization_id": "uuid or null",
  "agent_id": "uuid or null",
  "queue_message_id": "uuid or null",
  "error": { "name": "...", "message": "...", "stack": "..." } | null,
  "duration_ms": 123 | null,
  "metadata": { ... }
}
```

Log levels:
- `error`: something failed and was not auto-recovered.
- `warn`: something unusual but not a failure (e.g., retried, fallback used).
- `info`: normal operation (request completed, queue acked, audit persisted).
- `debug`: verbose (only enabled in non-production).

PII (email bodies, WhatsApp message bodies, full names) is **not** logged. Identifiers (UUIDs) are logged. Errors include stack traces in non-production; in production, stack traces are truncated to the first 5 frames.

---

## 4. Tracing

OpenTelemetry-style spans:

```text
Span: api.POST /api/chat/stream
  ├─ Span: auth.verify
  ├─ Span: agent.resolve
  ├─ Span: agent.runtime.execute
  │    ├─ Span: intent.classify
  │    ├─ Span: context.assemble
  │    │    ├─ Span: rag.retrieve (Qdrant)
  │    │    └─ Span: conversation.history
  │    ├─ Span: policy.evaluate
  │    ├─ Span: tool.execute (email.read)
  │    │    └─ Span: provider.call (Gmail API)
  │    └─ Span: audit.persist
  └─ Span: response.stream
```

Spans are propagated across process boundaries via `traceparent` (W3C Trace Context):

- API → RabbitMQ: `traceparent` in message metadata.
- RabbitMQ → Worker: extracted from message metadata, set as current span context.
- Worker → Provider: `traceparent` in HTTP header (if provider supports it; otherwise just internal span).

Traces are exported to the tracing backend (selected in Phase 2 — likely Axiom, BetterStack, or self-hosted Tempo/Jaeger).

---

## 5. Latency budgets

End-to-end latency budgets for user-visible operations:

| Operation | Budget (p95) | Rationale |
|---|---|---|
| Chat first token | 2s | User is waiting |
| Chat complete response | 10s | Depends on tool complexity |
| WhatsApp inbound → outbound | 5s | User expects quick reply |
| Voice TTFA | 1.5s (cold), 800ms (warm) | Voice is real-time |
| Email sync (single message) | 30s | Background; user not waiting |
| Email search | 2s | User is waiting |
| Embedding generation | 5s | Background |
| Scheduled job fire → complete | 60s | Background |

Budgets are per-org-overridable (for enterprise deployments with stricter SLAs). Actual latencies are tracked per turn / per message and surfaced in the admin dashboard.

If a budget is consistently exceeded, the architecture is reviewed — not the budget. The budget is a contract.

---

## 6. Alerting

Alerts fire on:

- DLQ depth > 0 (warn) or > threshold (critical, per queue)
- Queue depth growing (consumer lag, sustained 5 min)
- Ack rate < publish rate (consumer stalled, sustained 5 min)
- Retry rate > 10% of ack rate (something is wrong)
- Error rate > 1% of total requests (per route)
- p95 latency > budget (sustained 5 min)
- Audit drop count > 0 (critical)
- Provider auth failures > threshold (token revocation likely)
- Worker host down (no ack in 5 min)
- Vercel build/deploy failure
- Supabase project unavailable

Alerts route to:

- Email (always)
- Slack/Teams (per-org config, if integrated)
- PagerDuty (critical-only, per-org config)

Phase 17 wires these alerts. Phase 18 verifies they fire correctly under failure conditions.

---

## 7. Dashboard

Admin-only observability dashboard (`/admin/observability`) shows:

- Request rate, error rate, p95 latency per API route
- Queue depth, ack/publish rate, DLQ depth per queue
- Worker count, CPU/memory per worker
- Provider call rate, error rate, cost per provider
- Voice TTFA histogram
- Audit event rate, audit drop count
- Recent alerts

Per-org dashboard (`/{org}/activity`) shows:

- Agent activity (turns per day, tokens per day, cost per day)
- Email sync status per account
- WhatsApp message volume per agent
- Scheduled job execution history

---

## 8. Retention

- **Logs**: 30 days hot, 90 days cold (searchable). Older is sampled.
- **Metrics**: 1 min resolution for 30 days, 1 hour resolution for 1 year, 1 day resolution for 5 years.
- **Traces**: 7 days (full fidelity), 30 days (sampled 10%).
- **Audit events**: 7 years (compliance default; per-org configurable).

Retention is operational — configured at the observability vendor, not in code.

---

## 9. Cost observability

AI/voice cost is tracked per call in `ai_usage_events` (per `DATA-MODEL.md §9`). Aggregates:

- Per-org daily/weekly/monthly cost
- Per-agent cost
- Per-provider cost
- Per-model cost
- Cost trend (week-over-week)

Per-org budget alerts (when daily cost exceeds X% of monthly budget). Budgets are user-configurable per organization.

Cost is also surfaced in the per-org dashboard as a current-month total vs. budget.

---

## 10. Privacy and PII

- **No PII in logs**: email bodies, WhatsApp message bodies, full names, phone numbers are not logged. UUIDs are logged.
- **No PII in metrics**: metrics are aggregate counts/histograms, never individual messages.
- **No PII in traces**: span attributes are IDs, not content.
- **Audit events**: do contain some PII (e.g., `actor_id`, `target_id`) but not message bodies. Audit events are RLS-enforced and admin-only.
- **PII in PostgreSQL**: encrypted where sensitive (credentials). Message bodies are not encrypted at column level (PostgreSQL disk encryption + RLS is the boundary). Phase 17 review may add column-level encryption for highly sensitive fields if compliance requires.

---

## 11. What is deferred to Phase 17

- Concrete observability vendor selection (Axiom / BetterStack / self-hosted).
- Metric export implementation (Prometheus client library).
- Trace export implementation (OpenTelemetry SDK).
- Alert routing (Slack/Teams/PagerDuty).
- Dashboard implementation (admin and per-org).
- Log drain configuration (Vercel + worker host).

Phase 17 also defines the SLOs (service-level objectives) per route and per queue, and the SLA enforcement (per-org, if monetized — but per `RULES.md §5` this is not a SaaS billing product, so SLAs are operational, not contractual).
