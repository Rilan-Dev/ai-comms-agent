# Catch-up unread eligibility and live continuation — 27 October 2026

## Source repair

Returning-owner catch-up previously selected provider-read messages because selection used only personal review coverage. It also allowed mail read after selection to reach generation/publication. New real PostgreSQL regressions reproduced all three failures before changes.

Catch-up now requires unread incoming mail at selection, rechecks read state before a generation claim and publication, and rechecks it before releasing canonical bodies to the model. Scheduled fixed-window coverage keeps its existing independent semantics. Provider-read state does not create personal acknowledgements, mutate content revisions, or mark anything read. A new unread reply remains eligible while the already-read original stays excluded.

Verification on the exact candidate: selection/review/crash-recovery suite20/20, canonical authorization/lease suite6/6, full web Vitest157files1126tests, DB TypeScript and changed-source lint. The selection suite includes5000-source keyset pagination, stale leases, revoked grants, separate user review and scheduled coverage. Disposable fixture checks enforce a separate localhost/tmpfs database; production data was not reset.

This is a dependency repair, not activation of the default Overview briefing. Provider flag reconciliation, canonical folder-copy selection, durable worker registration, current personal grants, Overview rendering and per-item provider read controls remain outstanding. The briefing and configuration activation flags remain off.

## Live reply evidence and limitation

The deployed1474a239 repair created a saved same-thread acknowledgement and a pending human approval in the original failing conversation. The action remained unapproved and uncompleted when checked again; no delivery is claimed. Its source was the older matching mailbox message rather than the globally newest message. Therefore cross-mailbox latest-source selection remains an open defect despite successful draft/approval creation. Prompt guidance and a synthetic discovery test do not prove deterministic source selection.

## Browser control and changed live data

The owner requested direct Chrome controls instead of desktop Computer Use. Testing switched to the Chrome extension's page/Playwright controls, with no subsequent desktop input. Login succeeded and Overview, Chat, Drafts, Inbox and Approvals were inspected. The temporary frame-tree timeout was recoverable through a screenshot and subsequent page controls.

A read-only Chat comparison then returned no assigned mailboxes. Read-only production inspection confirmed zero bindings for the requested agent. Audit events recorded deletion of both earlier accounts on26October at17:18:47UTC and17:19:01UTC, after the earlier reply test. A replacement IMAP account was created at20:46:39UTC and remained pending verification. This explains why the old mail/draft views cannot be used as the current acceptance fixture. Preserve these concurrent changes; do not restore deleted credentials or broaden access silently. Mailbox-dependent live acceptance must use a currently verified account and authorized assignment.

The owner subsequently confirmed that one mailbox had been re-enabled and authorized using it for actions. A fresh check found the replacement connected but still unassigned. Direct Chrome Channels controls assigned only that mailbox to Sarvam AI with its previous Primary role; the UI showed Channels saved and the persisted assignment. No deleted second mailbox was restored. A new approval-only reply test was then started against the replacement mailbox.
