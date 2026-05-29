#!/bin/bash
# Fires on Stop. If API surface files changed but README.md or demo/src/ tabs
# were not also modified, blocks the stop and tells Claude to finish the docs.

TOPLEVEL=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0

# All files changed vs HEAD (staged + unstaged)
CHANGED=$(git -C "$TOPLEVEL" diff --name-only HEAD 2>/dev/null | sort -u)

[ -z "$CHANGED" ] && exit 0

# API surface files for this project
API_CHANGED=$(printf '%s\n' "$CHANGED" | grep -E \
  "^src/WaveformNavigator\.tsx$|^src/hooks/useAudioPlayer\.ts$|^dist/index\.d\.ts$" || true)

[ -z "$API_CHANGED" ] && exit 0

README_CHANGED=$(printf '%s\n' "$CHANGED" | grep "^README\.md$" || true)
DEMO_CHANGED=$(printf '%s\n' "$CHANGED" | grep "^demo/src/" || true)

MISSING=""
[ -z "$README_CHANGED" ] && MISSING="README.md"
[ -z "$DEMO_CHANGED" ] && MISSING="${MISSING:+$MISSING and }a demo example in demo/src/tabs/"

if [ -n "$MISSING" ]; then
  API_LIST=$(printf '%s\n' "$API_CHANGED" | tr '\n' ',' | sed 's/,$//' | sed 's/,/, /g')
  printf '{"continue": false, "stopReason": "API surface changed (%s) but %s was not updated. Update the documentation and add or update a demo example before finishing."}\n' \
    "$API_LIST" "$MISSING"
fi
