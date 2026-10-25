# Frontend AI repair — decisions and tradeoffs

Decisions below are recorded in chronological order. No deferred minor review findings were recorded.

Ruling: Use a separate clone and repair branch in this projectless workspace — no active managed worktree or project checkout was attached; this isolates changes without touching a user's branch — cost if wrong: an extra local checkout, no production effect.

Ruling: Known-red baseline is explicitly authorized for investigation by the approved plan; continue diagnosis rather than asking again whether to investigate — cost if wrong: extra local test work only.

Ruling: Preserve concurrent Development features by merging its current revision into the isolated repair branch — deployed app is Development, while main includes relevant security fixes — cost if wrong: larger integration review, no feature rollback.

Ruling: Preserve each tracked file's stored line endings; set clone-local core.autocrlf=false/core.eol=lf — avoid mass formatting changes — cost if wrong: incidental checkout formatting only.

Ruling: Use separate explicit integration test config and dedicated aca_repair_test database; ordinary tests must not need database credentials — CI creates the dedicated database and refuses other database names/remote hosts — cost if wrong: integration needs its documented extra command.

Ruling: Keep deprecated verifiedEmailToolSummary as compatibility export while production Chat/voice use the new receipt path — no current production caller remains — cost if wrong: legacy consumers need migration later.

Ruling: UI scope-switch/SSE races are verified with Task6, and WhatsApp account/inner audit behavior with Task5, where those interfaces are repaired — preserve task boundaries while retaining all release gates — cost if wrong: later tests may require revisiting this commit.

Ruling: For unquoted Body: prose, require explicit quoting/fencing instead of heuristically removing operating instructions or silently saving an inferred message — exact boundaries are ambiguous — cost if wrong: one extra user clarification. Normal drafting requests without literal Body: continue through AI drafting and human review.

Ruling: WhatsApp selection is implemented with readiness in Task5 rather than touching its shared runtime twice — same tested account-scope contract — cost if wrong: Task5 may require adapting current receipt metadata.

Ruling: Keep per-folder provider UID rows as storage evidence; deduplicate reports by exact RFC Message-ID only for IMAP within one mailbox — the observed copies are correct per-folder representations, not corrupt inserts — cost if wrong: unusual reused Message-IDs could need provider-specific identity refinement. No historical mail was deleted.

Ruling: Replace four SQL-string report tests with real PostgreSQL behavior cases covering their organization/binding scope, window boundaries, canonical counts and filters — moving SQL into a shared report query made source matching obsolete — cost if wrong: any unrepresented SQL contract requires another behavioral regression.

Ruling: Continue verification in an isolated SSH test environment after workstation virtual memory exhausted and the disposable local DB stopped — user authorized server testing; Docker limits protect production, no production environment or outbound network is supplied — cost if wrong: temporary server disk/CPU use. Candidate/image lockfile SHA256 matches43004fb4. Server22/22 database tests and shared/db/runtime/worker/web typechecks all passed; full suite/production deployment still pending.

Task 5: Ruling: Move the two Vitest worker files to .spec.ts and include them explicitly in the web Vitest runner; the worker Node runner cannot execute vi mocks. No tests removed; existing cases now execute with their intended framework. Correct stale registration assertions to include the existing generic Tool cast — cost if wrong: runner coverage needs another explicit glob. Task5 base is ec5053d8 (brief was generated before Task4 commit).

Task 5: Ruling: Keep same-turn proposal idempotency scoped to the host turn (rather than accept a model-selected idempotency key); corrected the new fixture to replay the same host turn — changed turns must remain distinct — cost if wrong: cross-turn retry requires explicit reconciliation. Scope-change/render checks are completed in Task6; live delivery remains Task8's release acceptance, as specified.

Task 6: Ruling: Match host/proxy timestamps before any502 fix. Proxy15 recorded connection refused for /chat at2026-10-23T15:49:09; current web container began17:53:56 and has no prior incident logs. Immediate cause is upstream unavailability; process failure cause remains unproven. Use verified application health during Task8 release, do not change AI/database behavior to guess at this incident — cost if wrong: a separate host incident may need historical runtime evidence.

Task 6: Ruling: Run supported-browser responsive/keyboard/hydration acceptance on the exact deployed candidate in Task8; initial SSR and scope loaders are verified here, and no browser framework is added — cost if wrong: live acceptance may require revisiting the UI commit. This is a retained release gate, not a skipped check.

Task 7: Ruling: Production changed to ca9a5a5c during this repair. Stashed only this task's uncommitted work, merged latest Development as11d4e86e, reapplied changes, and kept the stronger upstream assertions in two test conflicts. Preserve Sarvam lifecycle/privacy/installed-constraint acceptance fixes and rerun gates — cost if wrong: larger review surface, no concurrent feature rollback. The named stash is retained until work is safely committed. Live read-only constraint inspection confirms0053 phone/template CHECKs are validated on production; no missing-constraint migration is inferred.

Task 7: Ruling: Linux updater contract tests still assumed main although the approved deployment helper is explicitly Development-only; retain the branch and clean-checkout guards and test rejection of main. Missing Dockerfile/compose mounts were isolated verification harness omissions, not product defects. Restore recursive root lint and add explicit package-source lint coverage — cost if wrong: an unrepresented deployment path needs its own guard test. Full provisional runs: web773, worker346, database35, web standalone325, all pass; final verification must use a fresh worktree of the committed candidate, not the earlier overlay.

Ruling: Review the complete implementation before Task8 production migration/deployment, while final mechanical verification finishes; release acceptance is an operational gate rather than new feature implementation. Review base ca9a5a5c is the currently deployed ancestor merged into this branch, so concurrent upstream features are preserved and excluded from the repair diff — cost if wrong: any later source fix must receive regression coverage and renewed full verification. Backup restoration passed independently (65 application tables,73 ledger rows); backup stays mode600 on the owner server.

Final: Ruling: Production delivery, browser responsiveness/hydration and host stability were set aside by reviewer because Task8 is pending — retain as explicit release acceptance gates; automation alone does not establish them — cost if wrong: live failures remain unverified until acceptance.

Final: Ruling: Historical 502 process cause was set aside for insufficient retained evidence — keep only established proxy connection refusal and verify new release health — cost if wrong: a recurrence needs retained host logs.

Final: Ruling: Distinct IMAP deliveries reusing the same RFC Message-ID were set aside consistently with Task4's identity decision — preserve per-mailbox exact-ID canonical report identity without deleting storage rows — cost if wrong: unusual reused IDs can undercount and need provider-specific identity refinement.

Task 7: Ruling: Complete-answer validation replaces immediate ordinary voice token emission — an untrusted completion claim cannot be withdrawn after it is spoken. Runtime tests reproduced the unsafe SSE claim, then passed. Existing JSON Voice and Chat already sanitize through userFacingChatAnswer; new route controls confirmed that behavior without additional product edits. Three source-contract expectations were updated to the new emission boundary while preserving empty-response and authorization checks — cost if wrong: ordinary voice first-text latency increases until the provider finishes, intentionally trading that latency for truthful output.

Ruling: Use a separate release Compose file on the existing application network and preserve production environment/ports. Disable development seeding in production; the production identity adapter already uses ordinary local authentication, so no access is expanded. Preserve the shared Development checkout and deploy explicitly pinned verified images from the isolated candidate — cost if wrong: operators must use the recorded release Compose/revision rather than rebuilding the older shared checkout.

Task 8: Ruling: Another authorized rollout merged PR43 as c5a24e14 and deployed it while final gates finished; the guard stopped before any write. Verified git tree8c32d5b7 matches candidate d02c3206 exactly (no source differences), and0055 is already applied. Preserve that checkout/environment, retain both its current images and original pre-repair rollback images, verify rather than rewrite migrations, and complete release with the exact verified artifacts plus recorded revision/health metadata. Require no approved/executing/queued dispatch before recreation — cost if wrong: one additional brief app restart; no source rollback or data reset.

Task8 Ruling: Add recovery of already-authorized read facts when optional final model wording fails, and fix duplicate read-only emission — audit showed email.accounts.list and email.messages.list succeeded before the first unread-response failure; exact original exception was not retained, so do not invent its provider cause. Route tests reproduce duplicate output and final-generation failure/unsafe-planning/empty output, then pass. Recovery requires an entirely successful registered read-only batch, cannot run for mutation requests, denials or approval-shaped read results, never reruns a tool and never emits a cursor. It reports actual counts and at most10 scoped record headers, explicitly labels recovery and sync limits — cost if wrong: reduced preview detail during provider failure; no extra data access or dispatch.

Task8 Ruling: Mobile layout observed conversation log273px but scroll481px, message group218px but scroll334px; flex auto minimum widths kept long email addresses and AI tables from fitting. Add min-width0 to constrained flex items and wrapping for prose; preserve table/code local horizontal scrolling and exact stored message text. Browser regression evidence is the actual deployed DOM measurement; no mirrored CSS assertion added for this reversible presentation fix. Final build and browser GREEN still required.

Task8 Ruling: Preserve the concurrent administrator-enabled autonomous-send feature and scheduler changes already on Development/live, while retaining saved grants/settings. A current draft-only instruction restricts runtime tools before execution, and an explicit current human-review instruction overrides standing autonomous policy. This reconciles the original no-unapproved-send requirement with the owner's existing configured mode without broadening access — cost if wrong: an ambiguous request may stay in review rather than send; no new permission is granted.

Task8 Ruling: Fully specified new drafts, and fully identified reply drafts, do not need unrelated old transcript failures or ambient mailbox/WhatsApp context. Keep reference-dependent requests on normal sanitized history and always retain the persisted transcript. An identical Gmail prompt failed in the original long chat and saved in a fresh chat before the fix; current long-chat exact draft and zero send requests are verified — cost if wrong: optional historic writing preferences can be omitted for an otherwise complete request; permissions and approval checks still run.

Task8 Ruling: Reply drafts must retain original local/provider thread identity and RFC headers through synchronization and immutable approved snapshots, rather than treating a Re: subject as a threaded reply. Scoped source and header validation plus approval-lock comparisons are covered by real PostgreSQL RED→GREEN tests; malformed or foreign sources fail closed, historical drafts are not rewritten — cost if wrong: malformed legacy source headers require manual correction instead of silently creating a new conversation.

Task8 Ruling: Restore pruned verification tags only from retained image artifacts with the same Node/pnpm/lockfile, then rerun the exact combined release gates. Preserve every concurrent source feature and refuse rollout if serving source/images moved — cost if wrong: temporary test disk/CPU and another guarded verification cycle; no production reset.

Task8 Ruling: Scope self-contained WhatsApp-only planning to WhatsApp tools and skip unrelated ambient email/knowledge retrieval; explicit email-summary-to-WhatsApp requests keep both channels. Live original request now creates a pending action and privacy regression is RED→GREEN — cost if wrong: cross-channel requests must explicitly mention email to retrieve it; no grant is added.

Mobile layout tradeoff clarification: long tables and code retain local horizontal scrolling; if the layout choice is wrong, a future browser-specific overflow needs another presentation fix. Exact stored message contents are retained.
