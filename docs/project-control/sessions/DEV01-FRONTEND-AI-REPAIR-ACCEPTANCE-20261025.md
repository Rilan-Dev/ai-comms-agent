# AI communications repair — current acceptance record

Updated 25 October 2026, 14:30 Asia/Calcutta. **Repair acceptance complete with the evidence limits below. Automated gates, threaded reply drafting, explicit human review and fresh WhatsApp delivery pass.**

Development contains current main commits. PR45 was replaced by PR46 to avoid modifying main; PR46 is merged. Current running application source: `4898fa3303702f98e465d15dcd38fa530fd3495f`. Both web and worker labels match; authenticated Operations shows this revision, PostgreSQL and approval schema Healthy, zero degraded checks. Concurrent autonomous-send and Scheduled AI Agent changes were preserved. No role, grant or policy toggle was changed by this repair.

Exact Linux candidate: **1,809 tests passed** (web928, worker372, Clara41, standalone409, PostgreSQL59), zero failures/skips; all package types, lint (18 existing warnings), web/worker builds and migration-chain checks passed. Evidence: `work/channel-final-linux-gates.log`, `work/channel-final-release.log`. Guarded deployment made no migration changes and waited for active dispatch/synchronization work.

| Case | Current result | Evidence / practical limit |
|---|---|---|
| 01 Connected mailboxes | PASS | Both original connected mailboxes loaded with capabilities. |
| 02 Standard rolling summary | PASS | Explicit filters/window, canonical dedupe, matched/included counts and sync limit. |
| 03 Detailed summary wording | PASS | Same scoped records and coverage as standard request. |
| 04 Nonexistent sender search | PASS | Zero actual local results with sync limitation. |
| 05 Latest three unread | PASS | Matched41/included3/has_more true; bounded read recovery verified. |
| 06 IMAP draft exact body | PASS | Quoted body persisted without operating instructions. |
| 07 Provider Draft synchronization | PASS | Persisted provider-saved draft; SMTP draft/sent flags corrected. |
| 08 Send without human approval | PASS, policy-qualified | Original restricted mode denied dispatch. Concurrent administrator-enabled autonomous mode is preserved; new regressions prove explicit draft-only/manual-review requests still restrict it. No new permission was granted. |
| 09 IMAP create + approval request | PASS with retry history | Actual persisted draft and action; intermittent model no-call turns retained as failures. |
| 10 IMAP approval by draft ID | PASS | Approved action51cb0a6c completed and recipient copy independently verified. |
| 11 Manual IMAP request | PASS | Draft2cd2338a created approval2430c785, exact review shown and explicitly rejected; database confirms no provider result. |
| 12 AI existing-message reply draft | PASS, fresh final release | Natural subject/sender/mailbox request in original long chat saved03134f9d. Provider draft[Gmail]/Drafts:11 independently read: exact body, matching In-Reply-To and References source. Original local thread retained; zero send requests. Prior failed turns retained as history. |
| 13 Long-history Gmail draft | PASS | Same original long conversation saved exact draft2f22eea6, provider-synced, zero send requests with autonomous mode enabled. |
| 14 Fresh Gmail draft | PASS | Exact sender/To/Cc/body persisted and reviewed. |
| 15 AI Gmail approval request | PASS | Real pending request, separately approved once. |
| 16 Manual Gmail request | PASS | Separate labelled request persisted and explicitly rejected. |
| 17 Edit exact draft ID | PASS | Exact replacement persisted, scope and sender retained. |
| 18 Invalid Compose recipient | PASS | not-an-email rejected with no invalid draft/send. |
| 19 WhatsApp readable account name | PASS | Meta Test Phone resolved without technical account ID. |
| 20 WhatsApp proposal | PASS, fresh final release | Action7420bd75 exact recipient/body remained pending with no queued message despite autonomous_send=true. Human approved once through website. |
| 21 Closed-window safety | PASS, prior live + automation | requires_template, zero free-form dispatch. Current genuine inbound window is open; no clock manipulation. |
| 22 Allowed WhatsApp delivery | PASS after owner credential refresh | Fresh action4ef0668c stayed pending/noqueue, then manually approved once. Exact labelled body delivered to the owner number; provider ID wamid.HBgMOTE5NjI5NTM0NzAxFQIAERgSNzEyODNBNThGQjYxMDJBMDlGAA==, database and frontend Delivered, no provider error. Prior7420bd75 failed131005 and was not replayed or reclassified. Earlier5c3aeefa Read remains separate. |
| 23 Second distinct WhatsApp proposal | PASS | Distinct pending template proposal13331542 persisted. |
| 24 Reject WhatsApp proposal | PASS | Explicit rejection persisted, no dispatch. |
| 25 Fresh navigation / serving revision | PASS, historical limit retained | Fresh Chat/WhatsApp/Operations load; current4898 revision, HTTP200, healthy web/worker. Historical502 process cause remains unproven because old host logs are unavailable. |
| 26 Both email providers + receipt | PASS | Gmaildc023c31 and IMAP51cb0a6c completed once; independent connected CC copies verified (Spam/Inbox). Primary owner mailbox was not inspected. |

Final-release mobile chat: at390px document390/log343/scroll343; at320px document320/log273/scroll273. Desktop viewport restored; current chat console has no captured errors. Inbox320/390/768 checks are historical evidence.

WhatsApp subscription and account callback now point to the owner-approved current website while preserving the other app subscription/global callback. Genuine Hi was received. Updated customer-reply generation returned **“Hi! How can I help you today?”** from that stored inbound message, with no internal markers. This generation-only probe created no action and sent nothing; a new end-to-end inbound proposal after deployment is not yet claimed. Provider-request regressions prove zero ambient mailbox/knowledge retrieval.

Safe error classification, reply metadata, current-turn draft-only/manual-review guards and WhatsApp-only planning are included in the fully verified deployed release. Error classification logs only allowlisted categories/provider HTTP status, never raw credentials, email or vendor response text.

Screenshots: `final-threaded-draft-20261025.png`, `final-whatsapp-human-review-20261025.png`, `final-mobile-chat-320-20261025.png`, `final-release-health-20261025.png`, and earlier `whatsapp-read-receipt-20261025.png`. Logs: `work/final-reply-proof.log`, `work/final-provider-reply-proof.log`, `work/final-wa-policy-proof.log`, `work/final-meta-permissions.log`. Task8 acceptance is complete; the matrix distinguishes fresh, historical and automated evidence.

Follow-up: directly inspected Meta at the owner's request. Recipient is allowed, permissions Ready for testing, no required actions, test phone Connected/High quality, token user has an app role. No visible cause for131005 found. The temporary token later expired at09:00UTC/14:30IST; current diagnostics now show401/code190/subcode463. That later expiry does not explain away the prior valid-token sending rejection. Meta Generate token and website phone editor are prepared for human-controlled credential replacement, with webhook settings retained. Do not reuse earlier Read evidence as a pass for the failed final action.

Final owner-refresh follow-up: the user completed credential replacement. Read-only checks confirm the saved token valid, required scopes and app role present, correct phone/account and subscriptions. One fresh labelled AI request4ef0668c remained pending with no queued message; website approval once led to genuine provider Delivered with no error. Current web/worker remain4898fa33. Evidence: work/refreshed-meta-permissions.log, work/refreshed-wa-pending-proof.log, work/refreshed-wa-delivery-proof.log, outputs/whatsapp-final-delivered-20261025.png. The previous131005 cause remains unproven; successful replacement does not establish why that earlier token failed.
