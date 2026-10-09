# Two-repository synchronization contract

## Goal
Preserve the Lovable UI and migrate source functionality without blindly mirroring incompatible application trees.

- Source: Rilan-Dev/ai-comms-agent
- Lovable: Rilan-Dev/ai-comms-agent-bb0a3471

## Ownership boundaries

| Area | Owner | Rule |
|---|---|---|
| Lovable screens, visual components, route tree, theme | Lovable repo | Never overwrite from source |
| Next.js routes, source worker, Next-specific wiring | Source repo | Never copy wholesale into Lovable |
| Framework-neutral shared domain logic | Shared-core paths below | Sync in both directions via PR |
| Credentials, tokens, real env files | Secret manager | Never commit or sync |
| DB migrations, framework adapters | Source is reference | Port deliberately; review, do not blindly mirror |
| Git history | Each repo | Preserve; no force push or history rewrite |

## Shared-core mapping
- Source path: packages/ai-comms-shared/
- Lovable path: src/lib/ai-comms-shared/

Only framework-neutral code belongs in these paths. UI components, route handlers, auth/session adapters, database drivers, and provider SDK transport code remain framework-specific unless deliberately redesigned.

## Automation and required setup
Both repos include .github/workflows/sync-shared-core.yml. A change to the mapped shared-core path creates a branch and pull request in the other repository; it never pushes directly to the other default branch. Sync commits include [shared-sync] to prevent ping-pong loops.

Add an Actions secret named CROSS_REPO_SYNC_TOKEN in BOTH repositories. Use a fine-grained token with contents read/write and pull-request permissions for both private repos. Never put this token in source code or committed environment files.

## Limits and safety
- This sync only transports the shared-core directory. It does not make all app files identical or imply all source functionality has been migrated.
- Conflicting framework-specific behavior must be ported deliberately and covered by parity tests.
- Review and merge sync PRs normally. No force-push, rebase, squash, or history rewrite.
