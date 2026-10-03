# NEXT_ACTION.md

The single exact next authorized action. Update this file on every commit.

---

## Current next action

```yaml
actor: ChatGPT
role: Chief Architect / Project Controller / Acceptance Gatekeeper

action: |
  Re-review the 8 conditional-approval corrections implemented in this commit.
  Decide one of:
    (a) FINAL APPROVAL — Phase 1 is accepted; issue the Phase 2 Z.AI_HANDOFF.
    (b) FURTHER CORRECTIONS — additional corrections are required;
        issue a new correction handoff listing each correction.

context:
  phase_1_review_status: "CONDITIONAL APPROVAL (2026-10-03) — 8 corrections required"
  corrections_implemented: 8
  corrections_status: "all 8 implemented in this commit"

corrections_to_review:
  1:
    description: "Add Clara Core Reuse Map"
    artifact: docs/architecture/CLARA_REUSE_MAP.md
    coverage: "14 Clara capability areas (AI provider registry, model resolution, agent runtime, tools, MCP, RAG, embeddings, chat, realtime voice, conversation state, telemetry, usage tracking, streaming events, agent versioning)"
    notes: |
      Honest finding recorded: Clara has NO standalone MCP/tool runtime module
      (per Clara WORKLOG.md line 23). Tools are APP-SPECIFIC; MCP is out of
      scope for Phases 1-19. See ISS-005.
  2:
    description: "Correct Supabase decision"
    artifact: docs/project-control/DECISIONS.md (ADR-009)
    change: |
      Replaced ambiguous 'No Supabase' framing with canonical phrasing:
      'No database implementation during Phase 1. PostgreSQL/Supabase
      remains approved infrastructure.' (ADR-009, accepted)
    affected_files:
      - docs/project-control/DECISIONS.md (ADR-009 added)
      - docs/project-control/VERIFICATION_STATE.md (database_status clarified)
      - docs/project-control/RISKS.md (RSK-001 clarified)
  3:
    description: "Add missing domain model document"
    artifact: docs/architecture/DOMAIN_MODEL.md
    coverage: "13 domain entities (Organization, Agent, User, Email Account, Email Message, Thread, Attachment, Memory, Embedding, Automation, Scheduled Task, WhatsApp Connection, Conversation) with DDD-style behavior, invariants, lifecycle, relationships"
  4:
    description: "Add email agent service architecture"
    artifact: docs/architecture/EMAIL_AGENT_ARCHITECTURE.md
    coverage: "6 layers (connector, synchronization workers, indexing, agent runtime, action execution, provider adapters) with end-to-end flow example"
  5:
    description: "Add messaging abstraction"
    artifact: docs/architecture/MESSAGING_CHANNEL_ARCHITECTURE.md
    change: |
      Introduced provider-neutral MessagingChannel interface with
      ProviderAdapter pattern. WhatsApp is one concrete implementation.
      Generalizes ADR-004 to 'one messaging channel instance per channelType
      per agent'. ADR-010 (proposed) records this. WHATSAPP-ARCHITECTURE.md
      is now the WhatsApp-adapter sub-document.
  6:
    description: "Add voice integration architecture"
    artifact: docs/architecture/CLARA_VOICE_INTEGRATION.md
    coverage: "Explicit ownership boundary — Clara owns realtime transport, provider routing, streaming, conversation lifecycle; ai-comms-agent owns email context, business actions, permissions"
  7:
    description: "Add security model"
    artifact: docs/architecture/SECURITY_MODEL.md
    coverage: "5 focus areas (OAuth credentials, encryption, email prompt injection, agent permissions, action approval) with multi-layer defense and test cases"
  8:
    description: "Update PROJECT_STATE.md, NEXT_ACTION.md, worklog.md"
    artifacts:
      - docs/project-control/PROJECT_STATE.md (this file)
      - docs/project-control/NEXT_ACTION.md (this file)
      - worklog.md
    change: "Recorded CONDITIONAL APPROVAL, 8 corrections, conditional-approval correction work"

artifacts_to_review (new):
  - docs/architecture/CLARA_REUSE_MAP.md
  - docs/architecture/DOMAIN_MODEL.md
  - docs/architecture/EMAIL_AGENT_ARCHITECTURE.md
  - docs/architecture/MESSAGING_CHANNEL_ARCHITECTURE.md
  - docs/architecture/CLARA_VOICE_INTEGRATION.md
  - docs/architecture/SECURITY_MODEL.md

artifacts_to_review (updated):
  - docs/project-control/PROJECT_STATE.md
  - docs/project-control/NEXT_ACTION.md (this file)
  - docs/project-control/VERIFICATION_STATE.md
  - docs/project-control/DECISIONS.md (ADR-009 accepted, ADR-010 proposed)
  - docs/project-control/ISSUES.md (ISS-005 added)
  - docs/project-control/RISKS.md (RSK-001 clarified)
  - worklog.md

review_dimensions:
  - "Did the 8 corrections address the conditional-approval concerns?"
  - "Is the MessagingChannel abstraction (ADR-010) sound? Ratify or correct."
  - "Is the ISS-005 finding (Clara has no standalone MCP/tool runtime) correctly handled?"
  - "Are the 6 new architecture documents consistent with existing docs?"
  - "Is the project ready for FINAL Phase 1 approval and Phase 2 authorization?"

after_decision:
  if_final_approved: |
    Issue the Phase 2 Z.AI_HANDOFF with the full handoff template
    (see docs/project-control/RULES.md §7). Phase 2 = "Application foundation
    and approved project template" — see docs/plans/ROADMAP.md for the
    approved Phase 2 scope. Update PROJECT_STATE.md, VERIFICATION_STATE.md,
    CURRENT_PHASE.md, and this file.
  if_further_corrections: |
    Append a section to docs/project-control/ISSUES.md (or DECISIONS.md if
    architectural) describing each required change, then update this
    NEXT_ACTION.md to point at the new correction handoff. Z.AI will
    implement the further corrections and re-commit.
```

---

## What Z.AI must NOT do next

- Z.AI must not start Phase 2 implementation.
- Z.AI must not create `package.json`, Next.js scaffold, or any application template.
- Z.AI must not create database migrations.
- Z.AI must not deploy anything.
- Z.AI must not modify the architecture without ChatGPT approval.

Z.AI is in **STOP** state, awaiting ChatGPT's final Phase 1 approval decision (or further corrections).

---

## History

| Date | Action |
|---|---|
| 2026-10-03 | Initial: ChatGPT to review Phase 1 documentation package |
| 2026-10-03 | ChatGPT issued CONDITIONAL APPROVAL with 8 required corrections |
| 2026-10-03 | Z.AI implemented all 8 corrections (this commit). Next action: ChatGPT to re-review and grant FINAL approval or issue further corrections. |
