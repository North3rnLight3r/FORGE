#!/usr/bin/env bash
set -euo pipefail

[[ "$(uname -s)" == Darwin ]] || { echo 'This update procedure must run on macOS.' >&2; exit 1; }

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repository_root"

# The source checkout is the update channel. Pull or switch to the desired
# commit first; this command never fetches, merges, downloads, or substitutes
# a release artifact from another ref.
npm run package:macos
npm run install:macos

echo 'FORGE for macOS was rebuilt and installed from the current checkout.'
