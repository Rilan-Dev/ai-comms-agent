# RISKS.md — Open Risks

Open risks that may affect the project. Each risk has an ID, date identified, likelihood, impact, owner, mitigation, and status.

Statuses: `identified`, `mitigating`, `materialized`, `retired`.

---

## RSK-001 — Supabase project not provisioned; database design is documentation-only

- **Identified:** 2026-10-03
- **Likelihood:** high (will materialize if not addressed before Phase 4)
- **Impact:** high (blocks all database work)
- **Owner:** ChatGPT (provisioning decision) + Z.AI (schema implementation)
- **Status:** identified
- **Description:** The data model is fully documented in `docs/architecture/DATA-MODEL.md`, but no Supabase project exists. Provisioning requires Supabase credentials (URL, anon key, service-role key) which the user has not yet provided for this project. The Prima service token in the chat is for Z.AI's own backend, not for Supabase.
- **Mitigation:** Before Phase 4, the user provisions a Supabase project and provides the connection strings via Vercel project env vars (not in the repo). Z.AI then inspects the project (per `RULES.md §11`) before applying any migration.

---

## RSK-002 — Clara library deep audit deferred to Phase 2

- **Identified:** 2026-10-03
- **Likelihood:** medium
- **Impact:** medium (integration seams may surface surprises)
- **Owner:** Z.AI
- **Status:** mitigating (tracked in ISS-002)
- **Description:** Phase 1 used a depth-1 clone and read Clara's high-level docs + spot-checked key type files. Some integration seams (e.g., exact adapter signatures, host-boundary files that need wrapping) may not be visible without a deeper read.
- **Mitigation:** Phase 2 begins with a full clone and runs Clara's `verify-extraction.mjs`. The Clara integration plan (`docs/architecture/CLARA-INTEGRATION.md`) explicitly flags every "adapter" and "host-boundary" item that needs Phase 2 validation.

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
- **Mitigation:** Phase 2 will produce a thin end-to-end vertical slice (auth + one read-only email view) to de-risk the architecture early. Detailed in `docs/plans/ROADMAP.md` Phase 2 exit criteria.

---

## Risk history

| ID | Date identified | Date retired | Summary |
|---|---|---|---|
| (none retired yet) | | | |
