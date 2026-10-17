# FIX-01 / Sentinel — Chat membership nullability build failure

- **Session:** `FIX01-CHAT-MEMBERSHIP-NULL-20261018`
- **Date:** 2026-10-18
- **Repository/branch:** `Rilan-Dev/ai-comms-agent`, `main`
- **Authorization:** User explicitly requested repository/agent-state recovery, recent-commit root-cause tracing, smallest authorized correction, regression protection, and a durable record of symptom/root cause/failed approaches/remedy/prevention/evidence/next action. Do not expand unrelated scope. Route environment defects to OPS-01.

## Symptom and evidence

User's Docker Compose build output showed the worker image built successfully. The web image compiled successfully with Next.js 15.5.27, then type validation failed at `apps/web/src/app/api/chat/stream/route.ts:384` with TS18047: `subject.membership` is possibly null. Separately, a host-shell `pnpm --filter @ai-comms-agent/worker build` invocation failed before running because `pnpm: command not found`.

## Root cause

The chat route constructs a trusted `ToolContext` using `subject.membership.role`. The shared `AuthSubject` type permits `membership: null`. The `authorize()` implementation delegates to `requireOrganizationMember()`, which throws when the user is not a member and checks that membership is active, but TypeScript cannot infer that stronger runtime invariant through the shared return type. The route needs explicit local narrowing.

## Failed approaches considered and rejected

- Do not default a missing membership role to `member`, `viewer`, or another role.
- Do not use a non-null assertion or cast to suppress the error.
- Do not weaken authorization or broadly refactor the shared auth contract for this local compiler issue.
- Do not route the source-level TS error to OPS-01. Only the separate host-native pnpm availability issue is environment/toolchain scope.

## Remedy

- Commit `4a71cfcf553c7f2be5286b2a1d36fbb749b845d9`: explicit fail-closed 403 response immediately after `authorize()` if membership is absent. This narrows the value before trusted tool context creation.
- Commit `182cf3de1ab5f7cd783ebcab5ab536aae7afabf9`: regression assertion checks that the membership guard and 403 response exist and the guard precedes trusted context construction in `apps/web/tests/chat-host-tool-loop.test.ts`.
- Governance commits record this in shared memory, FIX-01 memory/worklog, central event/session/issue records, verification state, continuity and next action.

## Prevention lesson

When a shared authorization type is intentionally broader than the invariant guaranteed by a helper, explicitly narrow at the sensitive call site. Never replace missing authorization context with a default role or unsafe assertion. Keep source defects distinct from local tooling/deployment defects. A committed test is not evidence of execution.

## Verification boundary

Source changes and static regression source are committed. The provided pre-fix log proves worker image build success and web typecheck failure before this correction. No post-fix Docker build, focused test run, migration, browser, or deployed runtime check has been observed. No PASS is claimed.

## Next action

1. Pull latest `main` in the user's checkout.
2. Rerun `docker compose -f infra/docker-compose.manual.yml up -d --build`.
3. If the build succeeds, run the focused `chat-host-tool-loop.test.ts` via the repository's test command and report actual output.
4. OPS-01 handles host-native pnpm setup if native commands are required; do not change application source to work around the missing host command.
