#!/usr/bin/env bash
# fork/sync.sh — re-sync this fork onto upstream with our minimal delta re-applied.
#
# Usage:  bash fork/sync.sh <frontmatter-commit-sha>
#
# Policy: track upstream as-is except (1) the agent-frontmatter port (a commit,
# cherry-picked) and (2) build trims applied idempotently by fork/customize.mjs.
set -euo pipefail

FRONTMATTER_COMMIT="${1:-}"
STAMP="$(git log -1 --format=%cd --date=format:%Y%m%d 2>/dev/null || echo manual)"

echo "==> Fetching upstream"
git fetch upstream --no-tags

echo "==> Snapshotting current dev to archive/dev-pre-upstream-sync-${STAMP}"
git branch -f "archive/dev-pre-upstream-sync-${STAMP}" dev

echo "==> Resetting dev to upstream/dev"
git switch dev
git reset --hard upstream/dev

if [ -n "$FRONTMATTER_COMMIT" ]; then
  echo "==> Cherry-picking frontmatter port ${FRONTMATTER_COMMIT}"
  git cherry-pick "$FRONTMATTER_COMMIT"
else
  echo "!! No frontmatter commit SHA passed; re-apply the agent-frontmatter commit manually."
fi

echo "==> Restoring fork tooling from the snapshot and applying build trims"
git checkout "archive/dev-pre-upstream-sync-${STAMP}" -- fork/
node fork/customize.mjs

echo "==> Done. Review 'git status' / 'git diff', then commit if you want the trimmed build tracked."
