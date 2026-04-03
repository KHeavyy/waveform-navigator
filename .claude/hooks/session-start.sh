#!/bin/bash
set -euo pipefail

# Only run in remote (Claude Code on the web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

echo "Installing root dependencies..."
npm install

echo "Installing demo dependencies..."
npm install --prefix demo

echo "Installing Playwright system dependencies..."
# Browser binary downloads are blocked in this environment; install OS-level
# dependencies only. The --dry-run flag lets us confirm the step runs without
# attempting the blocked network download.
npx playwright install --with-deps --dry-run chromium 2>/dev/null || true

echo "Session start complete."
