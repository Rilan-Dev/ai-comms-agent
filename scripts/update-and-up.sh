#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

BRANCH="Development"

# This is the Development release updater: it subsequently runs manual-up.sh,
# which applies migrations and starts services. Never use it to fetch Development
# into Development (or operate on a detached checkout).
CURRENT_BRANCH="$(git symbolic-ref --quiet --short HEAD || true)"
if [[ "$CURRENT_BRANCH" != "$BRANCH" ]]; then
  echo "ERROR: scripts/update-and-up.sh is only for the Development checkout; current branch: ${CURRENT_BRANCH:-detached}." >&2
  echo "Stop. Keep Development fixes on Development; use the separately authorized release workflow to deploy Development." >&2
  exit 1
fi

echo "==> Checking Git working tree..."
if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: You have uncommitted changes."
  echo ""
  echo "The production VPS must run a clean checkout of origin/Development."
  echo "Local edits here are why deploys fall behind and served bundles"
  echo "end up mixing old and new code."
  echo ""
  echo "Recovery options:"
  echo "  1. Keep your edits for review:  git stash push -m 'vps-local-edits' && bash scripts/update-and-up.sh"
  echo ""
  git status --short
  exit 1
fi

echo "==> Fetching latest changes..."
git fetch origin

echo "==> Pulling origin/$BRANCH..."
git pull --ff-only origin "$BRANCH"

echo "==> Running manual deployment..."
if [[ ! -f scripts/manual-up.sh ]]; then
  echo "ERROR: scripts/manual-up.sh not found." >&2
  exit 1
fi

bash scripts/manual-up.sh

echo "==> Update and deployment command completed."
git log -1 --oneline
