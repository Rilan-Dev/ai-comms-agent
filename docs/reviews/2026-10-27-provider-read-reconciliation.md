# Provider read-state reconciliation

Phase A of the returning-owner catch-up continuation now refreshes existing incoming messages using bounded provider metadata. IMAP reads UID, flags and a bounded Message-ID header with BODY.PEEK; Gmail reads message metadata. Neither path marks provider mail read. Full canonical refetch is required when IMAP identity changes or cannot be established. Only a successful complete metadata response establishes absence; transport and malformed responses cannot delete messages.

Migration 0058 adds an independent durable keyset sweep cursor and coverage timestamps. Existing ingestion/history cursors remain unchanged. Partial sweeps and failed checks cannot count as fresh personal catch-up coverage. The current sync lease fences canonical deletion/refetch and final page publication. Source revision and tenant/account checks reject stale flag writes.

Catch-up preparation, generation and display require complete read coverage no older than five minutes. A provider-read message invalidates a saved catch-up while its immutable history remains stored. Personal acknowledgement stays separate. The API returns a retryable read-status response while coverage is unavailable.

Verification: observed failing tests before implementation, then 9 real PostgreSQL reconciliation/freshness tests and 22 selection/review/restart tests passed. Local worker type checking and changed worker/storage source lint passed; 34 adapter/orchestration tests passed. The broader source snapshot passed six package type checks, migration declaration/chain checks, 115 PostgreSQL application tests and 159 Vitest files / 1133 tests. The later lease-side-effect fence additionally passed the targeted worker test and PostgreSQL stale-lease check.

Not yet production acceptance: migration 0058 and this code have not been deployed. Briefing rollout remains disabled until background generation and original Overview integration pass acceptance. Direct Chrome login succeeded; live Overview still explicitly reports catch-up disabled. Latest-email reply/provider reliability, scheduled digest delivery, and complete live scenario testing remain outstanding.
