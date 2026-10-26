# Gemini tool schemas and provider acceptance — 27 October 2026

## Deployed dependency fixes

Development ca0b5dce2d40c13b931266cd21de86d434b63c39 was built and deployed through the existing SSH/Compose path. Web and worker both reported that exact revision, running state and passing health. Web image8a772cae15ada1d0cb2ca1129f1e1c5470d1de8c068499be697d002181657d91; worker4084dafabe8807a713510097b8e04f3af86a7fb4128ab5f00b8c8302d38c1034. Private backup and rollback tags are under aca-workspace-backup-ca0b5dce. Migration verification76files/76applied/0pending passed read-only. Configuration and briefing activation flags remain off. Main was not changed.

That release contains the provider-read catch-up dependency repair and bounded persisted Chat history. Fresh source evidence before release:158Vitest files1130tests,115PostgreSQL tests, all six package typechecks, migration checks and changed-source lint passed. Default Overview briefing activation remains unfinished.

## Direct Chrome acceptance and provider boundaries

The owner authorized the re-enabled single mailbox, which was connected and assigned. An approval-only natural-language reply test after deployment returned no confirmed operation; the exact-source control then returned Sarvam HTTP400. A read-only replay identified content_filter from the provider. No action existed for the replacement mailbox; do not replay on an assumption that a draft/send was saved. This does not close the natural-language latest-source defect.

The owner explicitly authorized temporary Gemini testing and restoration of Sarvam. A guarded, owner-authorized transaction changed only chat_provider/chat_model, appended a test-switch audit, and verified that the fingerprint of all other fields stayed unchanged. The subsequent live test failed before any mutating tool call: Gemini rejected additionalProperties inside functionDeclarations.parameters. Sarvam/sarvam-105b-conversations was immediately restored through a guarded, audited transaction; the other-field fingerprint still matched. No voice, embedding, prompt, temperature, limits or approval settings were changed.

## Source correction

The host stores standard JSON Schema, including nested additionalProperties constraints. Gemini's parameters field accepts its narrower Schema object. The documented parametersJsonSchema field accepts the full JSON Schema and is mutually exclusive with parameters. The adapter now uses that field, preserving the original schema and all host authorization controls. [Official FunctionDeclaration reference](https://ai.google.dev/api/generate-content?hl=en#FunctionDeclaration).

The actual runtime transport regression reproduced HTTP400 before the one-field correction, then passed while asserting full nested schema preservation and parsed host tool names/arguments. It does not substitute a synthetic model response for live provider acceptance.

A read-only diagnostic applied the identical wire correction within its isolated process and used a prepared Gemini override, leaving saved Sarvam settings intact. It passed the original schema-rejection layer but received404: the saved gemini-2.5-flash was no longer available to new users on this account. The provider's model inventory still listed it, so catalog presence alone is not proof of generation availability. The provider-recommended gemini-3.8-flash was listed; one read-only generation attempt returned503/high demand. No mutating tool was executed. These provider restrictions and temporary capacity limits remain separate from source verification.

Full renewed source checks and any later deployment/live results must be appended explicitly. Do not claim an email was delivered, an approval passed live, or all requested scenarios completed from this checkpoint.

Renewed candidate checks:159Vitest files1131tests,115PostgreSQL tests,all6package types,migration declaration/chain,changed-source lint and diff checks PASS. The later read-only Gemini3.8 diagnostic stalled and was stopped after verifying its exact process; the web/worker were not stopped. A final database check confirms exact Sarvam restoration, all other fields unchanged and0replacement-mailbox actions. Restore audit direction was corrected with a new append-only confirmation event; no old audit was edited.

### Verified release428d990d — 27 October 2026

Deployed exact428d990d1a9d45ac10d3365c3fc1871f9f92ca77 from Development. Interrupted build was detected with read-only revision/process checks, then resumed against the same clean source and guarded live predecessor; no application rollback or unrelated service restart. Web image dc7d8ba615a6718f6f8a8b747a0327705161b53d42164e99a436b086ba941d1c, worker f1d2617371ce3788492470f8702cd026c929196fc73d0dc6f007a9b823417859; both running with exact release labels, health PASS. Public HTTPS /api/health200 and/login200. Migration ledger76/76/0pending read-onlyPASS. Final persisted settings sarvam/sarvam-105b-conversations, other-field fingerprint unchanged; one owner-authorized connected Primary mailbox;0replacement-mailbox actions. Briefing/configuration flags remain off. Direct Chrome earlier verified assignment/restored provider; final Chrome control failed to initialize its session assets, including after reset. Respect owner prohibition on desktop Computer Use. Remaining live AI reply/approval/delivery, catch-up activation, provider-read reconciliation and wider UI work are not accepted. Provider content filter/model availability/capacity and Chrome reconnection remain explicit limits. No email/WhatsApp delivery claimed.
