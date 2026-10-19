# C2 final merged-suite failures

Executed pnpm test and separately pnpm --filter @ai-comms-agent/web test. Worker166passed/13failed; web471passed/40failed with20failed files. These are not passing full suites. Headings below are preserved from final logs; FIX-01/OPS-01 retain triage ownership.

## final-workspace-tests

- apps/worker test: ✖ Clara retrieval searches email chunks by query terms without requiring an exact full phrase
- apps/worker test: ✖ worker vector adapter sends deterministic chunk and source metadata
- apps/worker test: ✖ message deletion and account purge remain separately account-scoped
- apps/worker test: ✖ explicit null sender and folder values clear prior vector metadata
- apps/worker test: ✖ failed provider HTTP response never confirms a vector purge
- apps/worker test: ✖ a successful HTTP response must explicitly confirm the mutation
- apps/worker test: ✖ malformed successful HTTP response cannot silently complete a job
- apps/worker test: ✖ malformed cross-scope or partial identities never trigger privileged Clara requests
- apps/worker test: ✖ registry creates registered providers and rejects duplicates
- apps/worker test: ✖ worker publishes due mailboxes and consumes account-scoped sync jobs
- apps/worker test: ✖ Clara retrieval isolates shared knowledge from other agents
- apps/worker test: ✖ tests/whatsapp-send-tool.test.ts
- apps/worker test: ✖ tests/whatsapp-tool-runtime.test.ts

## final-web-tests

- ✖ provider verification owns cleanup around live provider discovery
- ✖ inbox source contains no escaped-newline literals and sender search remains parameterized
- ✖ Settings has keyboard-reachable anchors for each major settings group
- ✖ agent detail keeps organization-scoped server loading and not-found state
- FAIL  tests/agent-detail-page-contract.test.ts [ tests/agent-detail-page-contract.test.ts ]
- FAIL  tests/email-accounts-lifecycle.test.ts [ tests/email-accounts-lifecycle.test.ts ]
- FAIL  tests/login-setup-page-contract.test.ts [ tests/login-setup-page-contract.test.ts ]
- FAIL  tests/mail-folder-mutation-contract.test.ts [ tests/mail-folder-mutation-contract.test.ts ]
- FAIL  tests/settings-page-contract.test.ts [ tests/settings-page-contract.test.ts ]
- FAIL  tests/auth-boundary.test.ts > production authentication boundary > has a public login page and auth endpoints
- FAIL  tests/auth-boundary.test.ts > production authentication boundary > applies hierarchical minimum-role guards to members, admins, and owners
- FAIL  tests/email-account-repository-contract.test.ts > Postgres email account repository contract > never returns soft-deleted accounts through normal account reads
- FAIL  tests/gmail-adapter.test.ts > GmailAdapter > returns refreshed credentials using the shared EmailCredentials contract
- FAIL  tests/gmail-adapter.test.ts > GmailAdapter > advertises the provider capability matrix
- FAIL  tests/gmail-mailbox-sync.test.ts > Gmail automatic mailbox synchronization > uses paginated initial sync before history-based incremental sync
- FAIL  tests/gmail-mailbox-sync.test.ts > Gmail automatic mailbox synchronization > dispatches persisted mailbox accounts to Gmail or Zoho adapters and includes Zoho in due-account selection
- FAIL  tests/gmail-mailbox-sync.test.ts > Gmail automatic mailbox synchronization > implements IMAP UID-based folder sync and parses RFC822 headers and bodies
- FAIL  tests/gmail-webhook.test.ts > Gmail Pub/Sub webhook > rejects a correctly signed token with 'wrong audience'
- FAIL  tests/gmail-webhook.test.ts > Gmail Pub/Sub webhook > rejects a correctly signed token with 'wrong service account'
- FAIL  tests/gmail-webhook.test.ts > Gmail Pub/Sub webhook > rejects a correctly signed token with 'unverified service account'
- FAIL  tests/gmail-webhook.test.ts > Gmail Pub/Sub webhook > rejects a correctly signed token with 'expired token'
- FAIL  tests/gmail-webhook.test.ts > Gmail Pub/Sub webhook > rejects a correctly signed token with 'wrong issuer'
- FAIL  tests/gmail-webhook.test.ts > Gmail Pub/Sub webhook > rejects a correctly signed token with 'future-issued token'
- FAIL  tests/gmail-webhook.test.ts > Gmail Pub/Sub webhook > rejects an invalid notification payload after authenticating the push
- FAIL  tests/gmail-webhook.test.ts > Gmail Pub/Sub webhook > rejects a malformed Pub/Sub envelope
- FAIL  tests/gmail-webhook.test.ts > Gmail Pub/Sub webhook > does not create sync state for an unknown mailbox
- FAIL  tests/gmail-webhook.test.ts > Gmail Pub/Sub webhook > does not create sync state for an ambiguous mailbox
- FAIL  tests/gmail-webhook.test.ts > Gmail Pub/Sub webhook > does not queue a paused mailbox
- FAIL  tests/gmail-webhook.test.ts > Gmail Pub/Sub webhook > deduplicates notifications already covered by the stored history cursor
- FAIL  tests/gmail-webhook.test.ts > Gmail Pub/Sub webhook > queues a new Gmail history ID durably
- FAIL  tests/live-model-catalog.test.ts > realtime voice selection and relay integration > authorizes org credentials before returning documented options
- FAIL  tests/lovable-ui-migration.test.ts > Lovable Agentic AI Studio UI adaptation > preserves the Next.js authenticated shell while aligning the responsive workspace sidebar
- FAIL  tests/lovable-ui-migration.test.ts > Lovable Agentic AI Studio UI adaptation > keeps the overview backed by persisted API data and truthful loading/error states
- FAIL  tests/lovable-ui-migration.test.ts > Lovable Agentic AI Studio UI adaptation > keeps Compose approval safeguards and gives Threads a consistent designed empty state
- FAIL  tests/lovable-ui-migration.test.ts > Lovable Agentic AI Studio UI adaptation > keeps Clara chat connected to the authenticated streaming API with Lovable iconography
- FAIL  tests/lovable-ui-migration.test.ts > Lovable Agentic AI Studio UI adaptation > adapts Activity to the Lovable timeline while retaining persisted organization events and filters
- FAIL  tests/lovable-ui-migration.test.ts > Lovable Agentic AI Studio UI adaptation > adapts agent detail, version history, policy and channels without changing API safeguards
- FAIL  tests/lovable-ui-migration.test.ts > Lovable Agentic AI Studio UI adaptation > adapts realtime voice visuals without changing Clara-owned session and safety boundaries
- FAIL  tests/lovable-ui-migration.test.ts > Lovable Agentic AI Studio UI adaptation > keeps the migrated workspace on compact responsive geometry and accessible interaction states
- FAIL  tests/lovable-ui-migration.test.ts > Lovable Agentic AI Studio UI adaptation > provides keyboard-managed confirmation dialogs and accessible chat status
- FAIL  tests/mail-draft-action-contract.test.ts > Mail draft and sensitive action contracts > injects only organization-scoped synchronized mail into email-related chat turns
- FAIL  tests/mail-threads-workspace.test.ts > Mail Threads interaction and realtime Chat usability > restores keyboard focus after returning from a live conversation without losing the chat draft
- FAIL  tests/manual-deploy-migration-host.test.ts > manual deployment migration host boundary > rewrites Docker-only hostname for host-side psql while preserving the container URL
- FAIL  tests/migration-verification.test.ts > Manual deployment migration boundary > applies the PostgreSQL migration chain before starting the application
- FAIL  tests/migration-verification.test.ts > pnpm workspace lockfile integrity > contains exactly one workspace lockfile document
- FAIL  tests/product-completion-contract.test.ts > Activity/Audit/Operations product contracts > does not present fabricated Overview metrics
- FAIL  tests/whatsapp-idempotency-conflict-target.test.ts > WhatsApp outbound idempotency conflict target > keeps idempotency scoped to the organization and payload conflict handling
- FAIL  tests/whatsapp-send-approval.test.ts > WhatsApp send approval safety boundary > registers whatsapp.send only as an approval-request tool
- FAIL  tests/workspace-shell.test.ts > Embedded realtime voice in the chat workspace > opens voice from both the chat header and composer without route navigation
