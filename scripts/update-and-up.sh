#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

BRANCH="main"

echo "==> Checking Git working tree..."
if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: You have uncommitted changes."
  echo "Commit or safely stash them before updating."
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
