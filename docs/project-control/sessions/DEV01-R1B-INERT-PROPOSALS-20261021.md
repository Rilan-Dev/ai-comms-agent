# DEV-01 / Forge — R1b inert routine proposals — 2026-10-21

## Invocation, authority and scope

Owner said to continue independently and identify what actions are needed from their side. Worked strictly as DEV-01 / Forge on already scoped Email Command Center R1a/R1b work; owner approved continuation of the previous proposed plan's **Task 1 pure draft/preview**. C3 worker registration, R1b persistence/confirmation execution, scheduling activation, external WhatsApp sending and migration changes were explicitly excluded pending separate authorizations and runtime verification. FIX-01 and OPS-01 ownership unchanged.

Recovered current GitHub `main` at `45ef5a825a9a094e9e75a16b84c30e6887f42cf9`; compared to the prior DEV-01 handoff head `6016cd5a`, discovering 18 intervening upstream commits touching IMAP, auth/agent pages, regression tests and FIX-01 logs, but not the new routine proposal files. Inspected `NEXT_ACTION.md`, existing `RoutineTrigger`, R1a `nextRoutineOccurrences`, worker tests, package exports and the 2026-10-20 Superpowers R1b phased implementation plan. Current phase remains 4 `implementation_in_progress`.

## Product slice actually authored on main

- `packages/shared/src/routines/types.ts` — added pure `RoutineDraft`, `RoutineDestination`, `RoutineProposalPreview` contracts: all inputs are untrusted proposal data, with **no actor identity, permissions, stored job, standing delivery grant or send authority**. Commit `99e6435d`.
- `packages/email-agent-runtime/src/routines/proposals.ts` — `normalizeRoutineDraft` validates only allowlisted keys/typed supported digest tasks, bounded distinct mailbox UUIDs, calendar/interval/once/event triggers, explicit one-off offsets, locale/IANA zone, limits, quiet hours, verified-shape WhatsApp destination references and optional template metadata; `routineConfigHash` canonicalizes and hashes material settings; `previewRoutineDraft` uses existing R1a clock preview and exposes status **`preview_only`** and warnings rather than creating any jobs. Commit `e00f6cb6`.
- `apps/worker/tests/routine-proposal.test.ts` — 8 focused cases covering inert draft normalization, nested unknown-field rejection, mailbox ID bounds/duplicates, trigger errors, content/time limits, WhatsApp template/recipient shape, change-sensitive config hash and preview-only status; commits `8a9b6286` and `78e32f45`.
- Package API/public type exports added in `packages/shared/src/index.ts`, `packages/email-agent-runtime/src/index.ts`, and `packages/email-agent-runtime/package.json`; commits `15a50a44`, `d0088c77`, `205023f4`.
- No runtime scheduler, DB, feature flag, agent tool registration, HTTP route, mail access, delivery, provider calls or migration operations changed.

## Verification facts (precisely scoped)

- The connector environment cannot clone a private GitHub repository into the local shell (`Could not resolve host: github.com`) and has no `pnpm`. GitHub connector fetch/write operations did work.
- **Executed locally** against a faithfully authored stand-alone copy of the new pure validator plus a **simplified temporary R1a time-preview substitute**, with Node v22 native TypeScript stripping. The eight independent Node assertion cases first failed against missing stub implementations (**0/8**, RED), then passed after the validator was added (**8/8**, GREEN). The surrogate clock only confirms preview wiring and counts; it does **not** verify R1a DST/time-zone behavior or the checkout's actual source/module installation.
- Local targeted `tsc --noEmit` returned exit 0 for the new proposal implementation against matching **local interface shims** for the shared contract and crypto. This is **not** a repository package typecheck. New GitHub test source was also authored, but **its exact `node --import tsx` execution was not performed** here.
- **NOT RUN at current main tip:** the upstream seven R1a routine-time tests, new 8 repository worker tests, real shared/email-runtime/worker TypeScript, full worker/web/Clara/DB suites, disposable PostgreSQL, authenticated browser, WhatsApp/provider acceptance or CI/Vercel/deployment. Previous C3 29/29 and 6/6 receipts refer to older SHAs and do not imply current-tip green.
- This session makes **no claim of deployed, schedulable or operational routines**. GitHub source commit success proves only source publication.

## Lessons and limitations

- Strict parsing must fail closed on nested unknown keys and privileged client/model fields; validation of a syntactic mailbox UUID is not grant authorization. Task 2 service must reauthorize real active user/agent/account grants and never trust these draft IDs as access rights.
- A configuration fingerprint must cover timing, scope, destination and content constraints; it cannot stand in for verified consent or model authority. Canonical mailbox order avoids false consent changes solely from reordering selected accounts.
- For event proposals, `email.received` is intentionally narrow and preview has no predictable next fire; this **does not enable event automation**.
- For WhatsApp proposals, recipient and template format checks do not confirm that recipients are verified, sender accounts are authorized, Meta templates are approved, or export is permitted.
- Isolated local RED/GREEN and stub-based tsc cannot be represented as a green entire monorepo; preserve the real host commands and checked SHA in the next verification record.
- Existing obfuscated build-hook incident remains unresolved for OPS-01 assessment; run the tests on a sanitized, dependency-equipped checkout, not a potentially affected environment.

## Next exact DEV-01 action

1. On a clean sanitized `main` checkout, run:
   `cd apps/worker && node --import tsx --test tests/routine-time.test.ts tests/routine-proposal.test.ts`.
   From root: `pnpm --filter @ai-comms-agent/shared typecheck`; `pnpm --filter @ai-comms-agent/email-agent-runtime typecheck`; `pnpm --filter @ai-comms-agent/worker typecheck`. Record current `git rev-parse HEAD`, actual results/errors and post-run `git status --short`; any substantial unexpected cross-feature defect belongs to FIX-01.
2. Preserve C3 current-tip/source-grant/lease/grounding acceptance and eventual C4 authenticated five-day UX as independent authorized development. Do **not** register the catch-up worker until required negative/retry security checks pass.
3. R1b Task 2 transactional proposal persistence, revision-bound confirmation, R2 user tools/UI, and R3/R4 scheduling/WhatsApp live execution require review/authorization and a fresh migration-tip check. Until authorized, keep all routines inert; no external recipient or provider credential should be collected through chat.
