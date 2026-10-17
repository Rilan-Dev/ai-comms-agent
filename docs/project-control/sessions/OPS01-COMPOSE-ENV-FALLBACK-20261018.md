# OPS-01 Session — Compose environment compatibility
Date: 2026-10-18
Role: OPS-01
Status: HANDOFF — source correction committed; post-fix verification pending.

## User-observed evidence
The manual deployment successfully built/exported the worker image and built/exported the web image. Next.js production compilation and type validation completed. Deployment stopped before migration execution because the installed Docker Compose CLI returned `unknown flag: --environment` for `docker compose config --environment`.

## Correction
- Updated `scripts/manual-up.sh` to prefer `config --environment` but fall back to host `DATABASE_URL` or the `DATABASE_URL` key in the script's `.env` file on older Compose versions.
- Missing or unresolved interpolation still fails closed; the URL is not printed.
- Added `scripts/tests/manual-up-compose-env.test.mjs` to guard the compatibility and fail-closed contract.
- Commits: source `a93176b3cbba730c30a016b4e47a9dd3dd46039c`; newline parsing follow-up `2503f5352a821e4a338a2578fc49e6cd341a11da`; regression test `0386f03fa9534ff2d53db84b7ffbd2b5fe864154`.

## Verification boundary
The user log confirms only image build success. The new Node test, database migrations, Compose startup, container health and live application behavior have not been verified after the correction.

## Next action
Pull latest `main`, run `node --test scripts/tests/manual-up-compose-env.test.mjs`, then `bash scripts/update-and-up.sh`. Report only sanitized error output if another failure occurs; never share DSNs or credentials.
