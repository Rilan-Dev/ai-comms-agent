# Frontend AI repair and Development reconciliation — 25 October 2026

Owner-authorized continuation of the 23 October repair plan. Development is the integration branch; main is read-only.

## Branch reconciliation

- PR43 and PR44 were merged into Development by another operator while acceptance was running.
- PR45 used main as its source. Its two commits were carried onto current Development, conflicts resolved, and replaced by PR46. PR45 was closed without modifying main.
- PR46 merged as cdeeac76. Development subsequently incorporated main through 9468cd72. At 568637f4 there were no commits on main absent from Development.
- Concurrent inbound-webhook, infrastructure and Chat presentation changes are preserved. No unrelated rollback or branch reset was performed.

## Verified delivery and safeguards

- Gmail and IMAP/SMTP owner-labelled test actions completed after one explicit frontend approval each. Independent recipient copies were verified: IMAP delivery in Gmail Inbox; Gmail delivery in the IMAP recipient's Spam folder. The primary owner mailbox was not independently inspected. Provider line wrapping was distinguished from changed content.
- Both reviews displayed the actual sender, To, Cc, subject and exact saved body. A separate manual reply request was rejected through the frontend with no dispatch.
- A WhatsApp template proposal and a distinct rejection proposal persisted through AI chat. The first was accepted by Meta; the second was rejected. Acceptance alone was not reported as delivery.
- The owner approved connecting the existing Meta app to the test WhatsApp account using an account-level callback override to the current website. The old global callback and other app subscriptions were preserved. Verification challenge and Meta subscription reads succeeded.
- Genuine owner-sent incoming messages reached the verified webhook. Concurrent Development commit26ac824c repaired the observed 42P08 parameter error, normalized phone identity and allowed idempotent webhook retries; it was reused instead of duplicated.
- A new labelled free-form message was created through AI chat, reviewed and approved once. Action5c3aeefa-7c8e-4011-ba1d-02c05a1eb243 linked to outbound526fab89-f669-4697-b01b-a83121dc817e. The real provider webhook recorded **read**. Private workspace evidence retains the full provider message ID and screenshot.
- No fake inbound messages or provider receipts were inserted. No approval rule, role or agent grant was weakened. Prior ambiguous or failed messages were not blindly resent.

## Follow-up defects reproduced and repaired

- Long Chat text overflowed its constrained mobile message group. Flex minimum widths and prose wrapping now contain text while tables/code retain their own scrolling.
- Manual forwarding split addresses on the letter n. A component-handler regression reproduced both single-address corruption and comma/newline handling before correction.
- Forward review omitted original content, while dispatch used a mutable provider source. Real PostgreSQL tests reproduced missing review content and mutable dispatch. Both execution paths now send a fresh draft made from the immutable review, keep source-mailbox checks, and require current forwarding/draft/send capabilities.
- Ordinary deployment omitted the running revision. An isolated deployment fixture reproduced inheritance of stale parent metadata. The deployment script now supplies the actual checkout revision to Compose; Docker images and runtime health signals receive the same value.
- Automatic WhatsApp reply drafts contained task instructions and unrelated mailbox context. Dispatcher and provider-request regressions reproduced the wrong generation path. Incoming customer reply drafting now sends only bounded incoming text to generation, performs no ambient knowledge/mailbox retrieval, and retains the existing product approval path. Other authorized task generation is unchanged.

## Verification checkpoint

Baseline568637f4: 826 frontend tests,349 worker tests,41 Clara tests and408 standalone checks passed with no failures/skips. Package type checks and the production web build passed; source lint reported0 errors and18 existing warnings. The earlier combined Linux candidate b8c24a36 passed its full source/build gates plus51 PostgreSQL integration cases.

New deployment fixture: observed RED, then5/5 focused deployment checks GREEN. Customer-reply changes: observed3 failing/1 passing cases, then4/4 GREEN, including provider-request inspection with database configuration present and zero knowledge/email queries.

Final combined Linux verification, image/revision parity and remaining original acceptance cases must be recorded before marking Task8 complete. This checkpoint is not a blanket completion claim. Secrets remain outside the repository.

## Controlled release and live follow-up, 25 October

- `547631aa` contains customer-reply isolation and revision propagation; `2fe3f6de` isolates the deployment fixture from inherited verifier Git settings. The latter passed **1,629 non-database checks plus51 PostgreSQL integration tests**, zero failures/skips, package types, lint (18 existing warnings), web/worker builds and migration-chain verification on pinned Linux tooling.
- Both production services now run `2fe3f6de8e64cf62950adc824723bc5b5521ae6a`. Web image45d81c9a03df, workerff9995a9ff32; labels and runtime revision match. Authenticated Operations shows the release, PostgreSQL and approval schema Healthy. HealthHTTP200. Production Development checkout fast-forwarded; no migration changes, original infrastructure untouched, fresh backup and rollback images retained.
- The live customer-reply generation path, given the genuine stored Hi and no knowledge base, returned “Hi! How can I help you today?” without internal markers. This generation-only check created no action and sent no message; a fresh end-to-end inbound proposal is not claimed.
- Mobile Chat fits390px and320px: document widths match viewport; log scroll width equals client width343px/273px. Desktop viewport restored.
- Original case11 now passes: manual IMAP draft2cd2338a-75e1-4bc4-b1cc-e754fe0d570c created approval2430c785-124b-42f2-8a92-6db9d3665e79, complete exact saved review shown, then explicitly rejected. Database confirms rejected and no provider result. No email sent.
- AI existing-message reply drafting remains open. Incorrect cross-mailbox test references were identified and corrected; quoted exact body was supplied; fresh/full chat still raised an execution error and no labelled draft persisted. Isolated planning with one,16 email and18 combined registered tools selects email.draft_reply successfully; that does not substitute for frontend acceptance.
- `bb15969a` adds allowlisted failure categories/provider HTTP status, never raw vendor, SQL, credential or mail content. Six focused checks and typecheck pass; full Linux verification and deployment are in progress to diagnose the remaining execution failure.
- Current26-case acceptance matrix is retained in the workspace repair validation report. Cases12/13/25 remain qualified/open; no blanket all-pass claim.

Diagnostic release checkpoint: `bb15969ae2c47a9c31119c11f44afd465189f295` passed1,632 non-database checks and51 PostgreSQL integration cases, zero failures/skips, full types/lint/build/migration verification. Deployed web64e8222e49f0 and worker5a136863c7c1 both report this exact revision, HTTP200. Safe classification is now live; original case12 is being reproduced for diagnosis. Prior2fe release remains the verified customer-reply/mobile/manual-approval checkpoint.

## Reply threading correction (in progress)

- AI reply drafting succeeded on2fe/bb: draftsf74a7d76-57e2-4306-a9b1-09a615090468 andc47c46b8-31a0-4734-802d-5f12f223d45b contain the exact requested quoted body, synchronized to IMAP; tool audit confirms email.draft_reply success. Earlier malformed/cross-mailbox/error turns are not counted as passes.
- Independent inspection exposed a further defect: those drafts used new local threads and lacked In-Reply-To despite an available original Message-ID. No reply was sent.
- Commit `9b3065f5` on Development preserves the scoped source thread and validated RFC headers in one transaction, carries metadata through provider draft synchronization and immutable approved snapshots, checks reply metadata under the approval lock, and keeps full References during IMAP draft/send reconstruction. Gmail draft requests include their explicit provider thread ID and RFC headers. Existing plain drafts stay plain; no schema migration or data backfill.
- Real PostgreSQL source/thread tests:5 failing/1 passing against old source, then6/6 GREEN. Added two real approval tests fail against old source and pass with the correction; combined database focus35/35. Six provider/header tests fail against old source and pass with the correction. Focused web25/25 and worker12/12, all package types and changed-source lint pass.
- Gmail threading requirements were checked against [Google's official thread guide](https://developers.google.com/workspace/gmail/api/guides/threads). This does not expand the Gmail adapter's native reply capability or change account grants.
- Exact9b3065f5 full Linux verification is running; do not deploy or claim final threading acceptance until it passes and a fresh live draft verifies its stored/provider headers.

## Development reconciliation and current final acceptance

- Concurrent upstream commits48ee9d5b..b32dd7b7 added administrator-controlled autonomous sending and the unified Scheduled AI Agent. These were already deployed independently; the saved test agent policy currently has autonomous_send=true. No role, grant or policy toggle was changed by this repair. Integrated them as2cec1780, retained both worklog append sections, and kept main untouched.
- `be567ebc` constrains draft-only Chat runtimes before handlers, including out-of-scope provider-returned tool names; ordinary draft creation/editing without an explicit send request is also draft-only. The shared executor records denied attempts. Allowed draft operations still run current authorization.
- `d6131b6d` gives the current user's explicit human-review instruction precedence over the existing autonomous policy, for email and WhatsApp. The trusted host context derives this restrictive flag from instructions outside quoted payloads; email loops and scheduled task contexts propagate it. Default autonomous behavior stays unchanged when no extra review is requested.
- Observed RED: both outbound handlers auto-approved despite require_human_approval=true; after correction, those cases remain pending, while the corresponding false cases still auto-approve. Parser/payload and draft-only-mode cases also pass. Three stale source assertions were corrected for the unified scheduling route and the additional sanitized planner-history step without dropping authorization checks.
- Exact `d6131b6dcb30249b1292219febbfe6b6e0a5f57f` passed **1,787 tests**: web912, worker366, Clara41, standalone409, PostgreSQL59; zero failures/skips, all package types, lint (18 existing warnings), web/worker builds and migration gates. Deployed web3e8f56f1dc2d and worker9d2f65f7a433 with matching revision and HTTP200. No migration changes. Browser Operations confirms current release and database/approval health.
- The original long conversation now created exact Gmail draft2f22eea6-8c57-4e4d-8d3a-efc76fb80f8b, provider-synced, with **zero send requests** while autonomous mode was enabled.
- A natural reply request in that same long conversation still produced no tool call. `bb37c071` extends independent planning only to fully identified current reply requests (explicit mailbox plus source UUID, or quoted title/sender). Reference-dependent replies keep history. Two new cases were RED then GREEN; focused39/39 and types pass. No blind mutation replay or send occurred.
- Integrated concurrent scheduling feedback correctione51fe75c as `dbcd7a87`; full combined Linux verification is running. The final reply-header and delivery acceptance remains open until that exact candidate is verified and deployed.
- Retained test-tool tags had been pruned by another deployment. Restored the isolated tools from retained9b source image and runtime base from the current live image: Node24.22.1, pnpm12.8.1 and lockfile SHA25643004fb492a900bb0d3a552ba7cd2d43adb297399e1d3b4e899db96dc7d06f47 match. Isolated database remains aca_repair_test; no production credentials supplied to tests.

## WhatsApp-only planning correction (final checks pending)

The final live WhatsApp approval request made no tool call and created no action; saved permissions and binding were still present. Inspection showed the generic word “message” triggered ambient email loading and the full email/scheduler tool set even for a self-contained WhatsApp-only request. `bdcdfc57` scopes such requests to WhatsApp tools, excludes unrelated old failures when recipient/text are complete, skips ambient email/WhatsApp injection, and uses a restrictive host skipGrounding flag for tool planning. Explicit email-summary-to-WhatsApp requests retain both channels and their normal read authorization. Unrelated provider-returned tool names are denied before handlers. Privacy regression was observed RED (knowledge/email queries despite the requested scope), then GREEN with one provider request and no retrieval. Focused27/27, package types and source lint pass. Current8-case addition requires the complete combined release gates and fresh live acceptance. Concurrent0dc19652 only added scheduling evidence; preserved both worklog additions. No main changes, grants or policy toggles were made.

## Final release acceptance — 25 October, 14:30 IST

- Exact `4898fa3303702f98e465d15dcd38fa530fd3495f` passed **1,809 tests**, zero failures/skips: web928, worker372, Clara41, standalone409, PostgreSQL59. All package types, lint (18 existing warnings), web/worker builds and migration checks passed. Guarded rollout completed with matching web/worker labels, healthy containers and HTTP200. No migration changes. Authenticated Operations confirms this revision and zero degraded checks.
- The original long conversation now successfully handles the natural title/sender/mailbox reply request. Local draft `03134f9d-f240-433b-ae36-71d50d5eeb32` retained original thread, exact quoted body and reply header, synchronized to `[Gmail]/Drafts:11`. Independent read-only IMAP provider inspection confirmed exact body, matching In-Reply-To and References containing the source ID. **Zero send requests** for this draft.
- Fresh WhatsApp request `7420bd75-d340-411b-90a9-6799ade6aaa7` contained the exact labelled harmless test body and recipient. It stayed **pending**, with **no queued message**, while the saved autonomous_send policy remained true. Explicit human review therefore took precedence. The website displayed complete review; approved this test once.
- Meta then rejected dispatch with **131005 Access denied**; action/message are failed and there is no provider message ID. Read-only diagnostics show the token is valid, includes whatsapp_business_messaging and whatsapp_business_management, can read the correct phone and its owning account, and both app subscriptions remain present. No blind retry or access expansion. Asked the owner to inspect Meta API Setup/account sending restrictions; fresh final delivery is **externally blocked**, not a pass. Earlier genuine Read receipt remains separately valid historical evidence.
- Current Chat mobile geometry passes at320 (document320/log273/scroll273) and390 (document390/log343/scroll343); desktop override reset. No captured console errors on current chat. Existing Inbox responsive evidence is historical.
- Development is current with origin and contains current main; main untouched. Task8 remains in progress solely pending resolution and verification of the current Meta sending rejection. Reports must preserve this distinction; do not mark all scenarios passed.

### Direct Meta investigation and credential handoff

Owner was unsure how to inspect Meta, so checked directly without changing access. API Setup lists the owner's recipient among the allowed test recipients. Permissions page shows both WhatsApp permissions Ready for testing; app Testing reports complete; Required actions reports none. WhatsApp Manager shows the bound test phone Connected with High quality; expanded alerts contain informational notices, no sending restriction. Read-only app-role check confirms the saved token's user has an app role. These checks do not establish the cause of131005; do not claim it fixed.

The temporary token subsequently expired at **2026-10-25 09:00 UTC (14:30 IST)**. Fresh diagnostics confirm HTTP401, code190/subcode463. This later expiry is separate from the earlier131005 rejection while the token was valid. Prepared Meta Step1 (Generate token) and website Edit WhatsApp phone for owner-controlled credential replacement; browser security policy requires a human to perform credential replacement. Leave all webhook settings unchanged. Resume only after save/verification, then create/review one fresh labelled request; the failed action has no provider ID, and must not be represented as delivered. Earlier valid-token evidence remains in the diagnostic log; current-expiry log is separate.

## Completed acceptance after owner refresh

The owner completed credential replacement through the website. Saved-token read-only diagnostics passed: validity, messaging/management scopes, app role, correct phone/account, both subscriptions. A fresh AI request `4ef0668c-a14f-4853-8279-52e0d8ff2111` saved the exact QA-20261025-REFRESH body and owner recipient. Verified pending status and no queued message before human approval. Approved once in the frontend. Provider then confirmed **Delivered**, also displayed by the website, with no provider error and ID `wamid.HBgMOTE5NjI5NTM0NzAxFQIAERgSNzEyODNBNThGQjYxMDJBMDlGAA==`. No failed action was replayed. The earlier131005 cause remains unproven; do not infer a missing grant or claim every old failed message was delivered.

Web and worker still serve exact4898fa33. **Task8 repair acceptance complete**: 1,809 automated tests, build/type/lint/migration gates, guarded deployment, current reply/header/body/no-send proof, fresh human-review/WhatsApp delivery, both earlier independent email CC receipts and the qualified26-case report. See [acceptance matrix](DEV01-FRONTEND-AI-REPAIR-ACCEPTANCE-20261025.md) and [chronological decisions](DEV01-FRONTEND-AI-REPAIR-DECISIONS-20261025.md). Historical502 process cause, primary owner mailbox receipt and future credential expiry remain evidence limits; they are not concealed passes or newly introduced source defects. No main changes, role/grant expansions or autonomous policy changes.

Final receipt advanced to **Read**, confirmed by provider webhook state and the frontend. The final evidence screenshot was visually checked and shows the QA-20261025-REFRESH text with Read. Final read-only acceptance check passed against unchanged4898fa33; no repeated send.
