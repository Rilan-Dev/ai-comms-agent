# DEV-01 / Forge — C3 multi-mailbox batch scope correction — 2026-10-20

## Recovered GitHub truth and new operator evidence
- Started this continuation at `main` `202b58633d81a42c48ad97239406e5796cdd6d19`; checked recent main commits, C3 canonical loader, C2 coverage/access, generation adapters, tests, and package scripts.
- The owner supplied a development-host console result for the three existing focused briefing suites: **27 tests, 27 passed, zero failed/skipped/cancelled**, 881.252828 ms. This is user-supplied host execution evidence; the output does **not** show a git SHA, so commit identity for that run is unverified. It predates the new source fix in this session.
- Phase 4 remains `implementation_in_progress`. No production migration/deploy or feature flag activation.

## Symptom and root cause
The canonical C3 loader derived `scopeVersion` from only `claim.sources.map(s => s.mailboxId)`, then compared it against the manifest's immutable full-mailbox `scope_version`. Batches can legitimately contain sources from only one mailbox of a multi-mailbox manifest. Because the C1 scope fingerprint includes the mailbox selection, a valid subset had a different fingerprint and failed closed, blocking C3 generation for otherwise authorized sources.

## Remedy (direct main)
- Source commit `f036d6bf434ee710aaa7e53d2444c18fa74bcb62`.
- `packages/db/src/briefings/canonical-sources.ts`: first read the principal-scoped manifest's stored mailbox IDs, reauthorize **all** of its mailbox grants and agent bindings and compare the derived scope fingerprint with the manifest; separately ensure every source claimed by the bounded batch is within that full authorized set. No canonical body leaves the transaction before these checks.
- `packages/db/src/index.ts`: exports the small fail-closed `requireClaimedMailboxScope` helper.
- `apps/worker/tests/briefing-c3-wiring.test.ts`: two additional tests for multi-mailbox batch subset and source-level regression of the full-manifest resolver call; denied/empty mailbox sets still fail closed.
- No SQL migration, grant bypass, cross-tenant handling change, new provider, scheduler, or live execution added.

## Verification and limits
- **PASSED (owner's host output, previous code):** 27/27 focused Node tests. Precise commit from output not supplied.
- **PASSED (read-only source assertions only, new commit):** GitHub source checked to fetch manifest before scope resolution, resolve from `row.mailbox_ids`, compare full-scope version and reject any claimed mailbox outside the granted manifest.
- **NOT RUN for new commit:** 29 expected focused Node tests, 4 package typechecks, PostgreSQL multi-mailbox/revocation/lease fixture, workspace full suites, builds, Clara live provider and C4 authenticated browser journey. Passing the prior 27 tests cannot be re-used as post-fix verification.
- **No environment defect was repaired** and no production changes were performed.

## Failed approach / prevention lesson
Using the batch mailbox subset as input to authorization was over-restrictive and semantically incorrect even though single-mailbox tests passed. A personal briefing must re-check grants for the entire immutable manifest, then authorize the batch as a subset. Add real disposable-DB multi-mailbox tests in C3 acceptance; source-level checks do not prove live SQL behavior.

## Exact next authorized task
On the owner-host checkout (clean fast-forward `main`):
```bash
git pull --ff-only origin main
cd apps/worker
node --import tsx --test tests/briefing-worker.test.ts tests/briefing-c3-wiring.test.ts tests/briefing-generation.test.ts
cd ../..
pnpm --filter @ai-comms-agent/db typecheck
pnpm --filter @ai-comms-agent/clara-core typecheck
pnpm --filter @ai-comms-agent/email-agent-runtime typecheck
pnpm --filter @ai-comms-agent/worker typecheck
```
If any check fails, DEV-01 should fix the concrete source defect before adding runtime registration. Next, exercise multi-mailbox manifest, grant revocation after claim, stale/deleted source, batch lease expiry, and two-device isolation with an authorized **disposable** PostgreSQL fixture. Only after those pass may DEV-01 add a disabled-by-default worker registration; OPS-01 owns production DB and deployment. Then C4 authenticated journey acceptance follows. FIX-01 owns unrelated existing runtime/security defects.
