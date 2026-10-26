# Reply failure after a large mail report — 27 October 2026

After the owner reconnected one mailbox and authorized its assignment, a direct Chrome approval-only reply test reached account discovery and search, then failed before a draft or approval was created. Server classification was Sarvam HTTP422, not a mailbox permission denial.

A read-only replay of that conversation exposed the provider reason:51572prompt tokens plus1500output tokens exceeded the saved model's32000-token context window. The persisted earlier full mail report was included in subsequent prompts without a content budget. Counting40history messages was not a useful bound on their size.

The host now supplies at most24000UTF-8bytes of complete prior conversation turns, keeping a contiguous suffix. It never truncates or rewrites a current request, quoted body, retained turn, or the saved transcript. When an oversized turn is omitted, an explicit host instruction requires fresh authorized retrieval or clarification; missing recipients, bodies, source identities and approval cannot be inferred. The same bound applies before extracting ambient search terms, avoiding a giant stale report becoming search context.

Observed regressions: the unbounded helper failed2of3tests; bounded helper passed3of3. A functional Chat route regression confirms that a reply after a large persisted report reaches saved-draft feedback while the exact current request remains in the model input and the stored history remains intact. Focused reply/history/read-only-recovery suites32/32PASS before adding that route regression, then bounded/discovery6/6PASS. A corrected read-only live replay reached an actual reply-request proposal in round3 without HTTP422 and stopped before mutation.

The byte budget covers persisted history, not every possible model input. Current requests, host rules, authorized ambient records and bounded current-turn tool results remain separate inputs. Provider-wide token accounting and deterministic cross-mailbox latest-source selection remain follow-up concerns; neither is claimed solved by this repair. Fresh full checks, exact deployment and live post-deployment acceptance must be recorded separately.

Fresh candidate gates:158Vitest files/1130tests PASS;115PostgreSQL persistence tests PASS; all six package typechecks, migration declaration/chain and changed-source lint PASS. Deployment and live acceptance remain separate.
