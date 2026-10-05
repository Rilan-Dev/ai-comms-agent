# RISKS.md — Open Risks

Open risks that may affect the project. Each risk has an ID, date identified, likelihood, impact, owner, mitigation, and status.

Statuses: `identified`, `mitigating`, `materialized`, `retired`, `accepted`.

---

## RSK-001 — Supabase project not provisioned; database implementation deferred to Phase 4

- **Identified:** 2026-10-03
- **Likelihood:** high (will materialize if not addressed before Phase 4)
- **Impact:** high (blocks all database work)
- **Owner:** User (provisioning) + Z.AI (schema implementation)
- **Status:** identified
- **Description:** PostgreSQL/Supabase remains approved infrastructure (ADR-009, ADR-002). Phase 2 is foundation-only — no database implementation during Phase 2. The data model is fully documented in `docs/architecture/DATA-MODEL.md` and `docs/architecture/DOMAIN_MODEL.md`, and the `packages/db/` package provides the Supabase client factory, but no Supabase project exists yet. Provisioning requires Supabase credentials (URL, anon key, service-role key) which the user has not yet provided for this project. The Prima service token in the chat is for Z.AI's own backend, not for Supabase.
- **Mitigation:** Before Phase 4, the user provisions a Supabase project and provides the connection strings via Vercel project env vars (not in the repo). Z.AI then inspects the project (per `RULES.md §11`) before applying any migration. The phrase "No Supabase" is deprecated (per ADR-009); the canonical phrasing is "No database implementation during Phase 2. PostgreSQL/Supabase remains approved infrastructure."

---

## RSK-002 — Clara library deep audit (RETIRED in Phase 2)

- **Identified:** 2026-10-03
- **Retired:** 2026-10-03
- **Likelihood:** (was: medium)
- **Impact:** (was: medium — integration seams may surface surprises)
- **Owner:** Z.AI
- **Status:** retired
- **Description (original):** Phase 1 used a depth-1 clone and read Clara's high-level docs + spot-checked key type files. Some integration seams (e.g., exact adapter signatures, host-boundary files that need wrapping) may not be visible without a deeper read.
- **Retirement reason:** Phase 2 deep Clara audit completed (2026-10-03). Full clone performed; extraction manifest inspected; target-side verification performed (106/108 manifest checks passed; two failures identified as manifest SHA recording errors, not file content mutations); `claraRuntime` export verified (`export const claraRuntime = { ... } as const`); narrow `rag_search` tool interface verified; no generic standalone application ToolRegistry/MCP framework found; no hidden coupling found in the audited extracted source. The remaining two verifier failures are manifest recording defects (upstream Clara library issue), not integration risks. This risk is retired. See ISS-002 (resolved) for full audit findings.
- **Historical note:** This risk was recorded in Phase 1 and mitigated by the Phase 2 deep audit. It is retained here for historical continuity per the append-only audit trail principle.

---

## RSK-003 — Email provider capability matrix needs validation against real APIs

- **Identified:** 2026-10-03
- **Likelihood:** high
- **Impact:** medium (capability discovery is correct in principle; specific capability flags need validation)
- **Owner:** Z.AI (Phases 5-8)
- **Status:** identified
- **Description:** The email provider adapter model assumes Gmail, IMAP/SMTP, and Zoho support different subsets of capabilities. The exact capability matrix (e.g., "does Zoho support labels?", "does Gmail expose folders via the API or only via IMAP?") must be validated against real APIs during Phases 5-8.
- **Mitigation:** Each provider phase (5: abstraction, 6: Gmail, 7: IMAP/SMTP, 8: Zoho) includes a capability-validation step in its exit criteria. If a provider lacks a capability the architecture assumed, the capability flag is corrected (not the architecture).

---

## RSK-004 — WhatsApp Business API requires Meta approval (lead-time risk)

- **Identified:** 2026-10-03
- **Likelihood:** high
- **Impact:** high (blocks Phase 13)
- **Owner:** User / ChatGPT
- **Status:** identified
- **Description:** WhatsApp Business API requires a Meta Business Account, a registered WhatsApp Business phone number, template-message approval, and (in some cases) embedded signup approval. Lead times can be days to weeks. Phase 13 (WhatsApp integration) cannot complete end-to-end without this.
- **Mitigation:** Begin the Meta Business Account and WhatsApp Business registration process **before** Phase 13 — ideally during Phase 11 (Agent runtime). The user owns this; Z.AI cannot accelerate it. Phase 13 can begin with the official test number for development but cannot ship without the user-approved production number.

---

## RSK-005 — Worker host not yet selected (see ISS-004)

- **Identified:** 2026-10-03
- **Likelihood:** medium
- **Impact:** medium (blocks Phase 9 implementation)
- **Owner:** ChatGPT
- **Status:** identified
- **Description:** See ISS-004. The worker host decision affects env-var layout, secret management, and observability. If deferred too long, Phase 9 implementation will stall.
- **Mitigation:** ChatGPT decides worker host before Phase 9. ADR-007 lists the candidate hosts.

---

## RSK-006 — Long delivery timeline (19 phases)

- **Identified:** 2026-10-03
- **Likelihood:** high
- **Impact:** low (governance choice, not a defect)
- **Owner:** ChatGPT
- **Status:** accepted
- **Description:** The 19-phase roadmap is long. Each phase has a ChatGPT review gate. This is by design (master operating prompt §26) but means real user-visible features do not appear until Phase 5+.
- **Mitigation:** Phase 2 produced a thin end-to-end vertical slice (web renders, worker boots, mock email view) to de-risk the architecture early. Detailed in `docs/plans/ROADMAP.md` Phase 2 exit criteria. Phase 2 is now complete and awaiting ChatGPT acceptance.

---

## Risk history

| ID | Date identified | Date retired | Summary |
|---|---|---|---|
| RSK-002 | 2026-10-03 | 2026-10-03 | Clara deep audit completed in Phase 2; no hidden coupling found; 2 manifest SHA typos are upstream Clara defects, not integration risks. Risk retired. |


## RSK-007 — Phase 4 migration runtime evidence pending

- **Identified:** 2026-10-06
- **Likelihood:** medium
- **Impact:** high
- **Owner:** ChatGPT
- **Status:** mitigating
- **Description:** Phase 4 migration files are implemented, but runtime execution against PostgreSQL has not yet been independently evidenced in this session.
- **Mitigation:** CI now provisions disposable PostgreSQL, applies all migrations, and executes runtime invariant checks. No Phase 4 acceptance will be claimed until runtime evidence is green.
