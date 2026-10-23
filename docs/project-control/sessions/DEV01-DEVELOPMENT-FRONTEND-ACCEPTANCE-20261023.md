# DEV-01 / Forge — Development recovery and frontend acceptance, 2026-10-23

## Authority and current position

Owner explicitly requested the latest Development checkout, direct work/push on Development, preservation of existing project-control memory, and live AI inbox/draft/email permission and WhatsApp testing. Recovered Development at `ab7292fbb00263bb817ab2874ab4f66e10946f0f`. Checkout was clean: there was no uncommitted product code to rescue. Main was independently fast-forwarded to its current upstream before the owner specified Development; no commits were pushed to main during this continuation. All new records from this session belong to Development. Earlier main-only workflow notes are historical. Phase 4 remains `implementation_in_progress`.

## Completed source work versus acceptance

| Area | Current source state | Remaining acceptance |
| --- | --- | --- |
| C1/C2 catch-up | Private mailbox grants, immutable selection/revisions, review/snooze, resumable bounded batches | Current database/tenant/revocation and end-to-end regression gates |
| C3 generation | Worker core, canonical source loader, Clara adapter and negative-test source exist | Current DB/lease/provider checks; worker remains unregistered, not activated |
| C4 frontend | Overview-first five-day entry, paginated source coverage, readable canonical subject/sender/time | Authenticated source, priority, partial/error, responsive/keyboard and two-user tests |
| R1a timing | Calendar/daily/weekly, elapsed intervals and one-off preview | Clock/DST and browser acceptance; preview creates no job |
| R1b and delivery | Phased design and exact-scope consent requirement | Persisted routine proposal/approval, delivery ledger and approved integration; no standing routine activated |
| Chat email | Explicit From/To, profile guidance, reviewed drafts and human send-approval source | Actual user/agent grants, approval/denial, provider send and received-message proof |
| WhatsApp | Explicit policy choices and approval-only host tools | Bound/connected account, provider policy, user permission, approval and delivery proof |
| AI provider setup | Guided capability/vendor/key/model UI source | Current typecheck/build and deployed authenticated/browser/provider acceptance |

Existing upstream FIX-01 work includes recipient validation, email approval idempotency, inbox SQL fixes, user-facing model output guards and latest stale-import correction. OPS changes include supply-chain and frozen-install protections. These are recovered source changes, not newly implemented or deployed by this session.

## Fresh verification in this session

On exact Development source above, executed the checked-in native Node tests for catch-up entry/coverage/source details, routine preview, chat compose/identity, user-facing answers, recipient handoff, WhatsApp tool setup, build-entrypoint integrity, supply-chain protections and branch-guard file. **54 passed, 0 failed, 0 skipped.** The branch-guard file contributes no named Node test case in this aggregate; the 54 count comes from runner output. Many cases are source-contract assertions; this is not live AI, full application, provider or browser acceptance. No new dependency install, full typecheck/build, full-suite or database run is claimed. Earlier 2026-10-19 results are historical and do not establish current-tip acceptance.

## Live frontend result — BLOCKED

Target `https://aca.starcitytechnical.com/login`. Playwright with installed Chromium, explicit environment HTTPS proxy, and the environment-provided proxy CA trusted through an isolated browser NSS store reached **HTTP 522**. Page states Browser Working / Cloudflare Working / Host Error: connection to origin timed out. Page timestamp 2026-10-23 15:31:45 UTC (21:01:45 Asia/Kolkata). Earlier direct browser navigation timed out; initial trust-store mismatch was corrected without disabling certificate validation. The final 522 is the access blocker.

Local screenshot: `/workspace/.onboarding/ai-comms-agent/live-20261023/login.png` (outside Git). No login form was available. Supplied credentials were not submitted, saved or committed. Actual account permissions, mailboxes, inbox content, model configuration and deployed SHA remain unknown. **Zero test emails, drafts, approvals or WhatsApp messages were created.** No existing permission or account policy was altered.

## Prepared frontend scenario checklist

All scenarios below are **BLOCKED / NOT EXECUTED**, not passed. Execute after OPS restores the origin. Use a clearly labeled synthetic test subject/body; do not reproduce private inbox content into external test messages. Email test recipient defaults to the owner's supplied account address for a self-test, after confirming that recipient in reviewed Compose. WhatsApp recipient is the owner-authorized `+919629534701`; send one clearly labeled test only after normal permission, human approval and provider checks. If the product supports a properly configured no-approval policy, validate only that existing policy; absence of permission must deny. Do not weaken global production approval rules to create a test path.

| ID | Scenario | Required evidence / expected behavior |
| --- | --- | --- |
| F01 | Login and active agent | Authenticated user, selected tenant/agent, connected primary From options |
| F02 | Existing inbox summary | Compare AI output with actual scoped inbox/count/time window; source links, no invented mail |
| F03 | Unread/24-hour summary | All bounded matches, exact range, unread filter and honest omissions/freshness |
| F04 | Five-day catch-up | Selected lookback, clear priorities/evidence; no invented last-visit claim |
| F05 | Empty inbox/filter | Explicit empty result, no invented summary |
| F06 | Read denied/unbound mailbox | Clear denial, no leaked subject/body or cross-agent context |
| F07 | AI draft to self | Review exact From/To/subject/body, save once, verify Drafts; no delivery |
| F08 | Ambiguous From/To | Ask for missing selection, reject invalid recipient; preserve user edits |
| F09 | Actor write denied | Draft/send denied even if agent tool is enabled; no persistence/delivery |
| F10 | Agent draft/send tool denied | Clear distinction from user permission; no bypass via chat |
| F11 | Human approval pending | Request once; pending is not sent; provider has no delivery yet |
| F12 | Human approval rejected | Explicit rejection, no queued/external send |
| F13 | Human approval granted | Review exact immutable content, authorize once, verify provider Sent and received message |
| F14 | Without human approval | Attempt direct send; deny or keep pending under mandatory approval; no unauthorized delivery |
| F15 | Repeated request/reload | Stable draft/approval identity; no duplicate send |
| F16 | Post-review edit or stale scope | Re-review changed content; deny revoked/foreign grants and stale approval |
| F17 | AI WhatsApp request | Exact authorized number, benign test text, actual binding/policy/permission disclosed |
| F18 | WhatsApp permission denied/pending | No send; truthful denial/pending; no auto-enabling tools |
| F19 | WhatsApp approved | One approved attempt, provider message ID/status; distinguish accepted from delivered |
| F20 | Provider/network failure | Visible recoverable error, no success claim, uncertain result reconciled before retry |
| F21 | UI usability | Clear approval/status copy, keyboard/mobile, loading/error recovery and conversation continuity |

## Owners, in-progress work, blockers and exact next actions

- **DEV-01:** This session completes repository recovery, additive handoff and test preparation; live frontend acceptance is blocked. After recovery, resume F01, F02/F03, F07 and approval-positive/negative cases, then WhatsApp F17–F19, recording actual IDs/statuses with private content redacted. No agent is running unattended browser sends from this record.
- **OPS-01:** Origin HTTP 522 is routed in central backlog. Inspect origin availability, listener/reverse proxy/firewall/resources and deployed SHA using approved operations; preserve production state. This session does not deploy/restart infrastructure. Then confirm HTTPS login readiness.
- **FIX-01:** Substantial application defects discovered during resumed tests; no new application defect established by HTTP 522. Existing runtime/security and prior build-hook credential exposure follow-up remain open until evidence closes them.
- **Product next:** Run remaining current C3 grant/revision/lease/provider tests and C4 authenticated UX gates before registration; then R1b scoped consent and delivery-ledger work under existing roadmap. The owner's chosen once-per-exact-scope routine approval remains the design constraint.
- **Security:** Prior build-hook incident cleanup is source-complete, but clean-host/credential-rotation and production readiness cannot be inferred from passing integrity checks. Supplied passwords/tokens must never be copied into GitHub records.

## Shared lesson

Branch names in historical sessions are not current authorization. Recover the owner-selected remote branch explicitly; preserve historical evidence and add a dated checkpoint. An HTTP 522 login page blocks all authenticated acceptance: source tests and an approval UI cannot prove mail or WhatsApp delivery.
