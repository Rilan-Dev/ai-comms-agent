# DEV-01 Session — Interactive host tool loop and WhatsApp approval

- **Date:** 2026-10-17
- **Owner:** DEV-01 / Forge
- **Branch:** main
- **Scope:** Connect host-authorized tool calls to interactive chat; implement human approval and Meta template compliance for WhatsApp; register send only as a proposal tool.

## Source changes

- Interactive chat constructs ToolContext from the authenticated server subject and invokes only per-agent allowlisted tools. It bounds tool execution, caps serialized tool results, and passes host context as untrusted system data.
- Added feature permissions email.read, whatsapp.read, and whatsapp.send with role mappings and migrations 0038/0039.
- Added whatsapp_send_actions persistence, outcome states, and agent-binding-required flag (migrations 0035, 0037, 0040).
- WhatsApp manual and scheduled/product outbound paths now create pending approval actions instead of directly queueing messages.
- Added organization-scoped approval queue/decision endpoints and UI. Approvals recheck connected account, current agent binding for agent-originated actions, and Meta's 24-hour inbound customer-service window.
- Added Meta template submission/status synchronization and supported text-body template delivery. Approval and worker both recheck live template status; the worker rechecks the inbound 24-hour window and agent binding immediately before sending. Unsupported media/dynamic-header/button templates fail closed.
- Registered whatsapp.send as a sensitive proposal-only tool: it inserts a pending action and has no direct provider-queue path.

## Source evidence

- Regression sources: apps/web/tests/chat-host-tool-loop.test.ts, apps/web/tests/whatsapp-send-approval.test.ts, apps/worker/tests/whatsapp-tool-runtime.test.ts, apps/worker/tests/whatsapp-send-tool.test.ts, apps/web/tests/cross-surface-product-contract.test.ts, apps/web/tests/rbac.test.ts.
- Project-control records updated: NEXT_ACTION.md, PROJECT_STATE.md, VERIFICATION_STATE.md, TOOL-CONTRACTS.md, API-CONTRACTS.md, SECURITY_MODEL.md, AI-ARCHITECTURE.md, WHATSAPP-ARCHITECTURE.md, and worklogs.

## Verification boundary

- Source writes were accepted by GitHub on main.
- Tests, typecheck, lint, web/worker builds, migration execution, browser UI, live Meta template submission/status, actual provider sends, and deployment have not been run or verified.
- Do not claim delivery based on a pending approval or queue response. Provider status and end-to-end evidence remain required.

## Next action

Run focused tests/typechecks when a dependency-equipped checkout is available; inspect the Next.js import boundary because the web route currently imports worker runtimes; apply migrations through the normal process; then verify approved template and 24-hour text scenarios against Meta. Do not block independent source work on CI/Vercel polling.
