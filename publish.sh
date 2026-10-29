#!/usr/bin/env bash
# Copies the source documents next to the page. The page reads site/docs/;
# the root files remain the source for GitHub and the Basic Specs check.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$here/site/docs"
cp "$here/README.md" "$here/RELEASE-NOTES.md" "$here/site/docs/"
cp "$here"/docs/*.md "$here/site/docs/"
touch "$here/site/.nojekyll"
if [ ! -f "$here/site/state.json" ]; then
  echo "publish: site/state.json is missing; run python3 tools/scan.py" >&2
  exit 1
fi
echo "site/docs rebuilt from README, RELEASE-NOTES and docs/"
