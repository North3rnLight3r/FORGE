#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "This update procedure must run on Linux." >&2
  exit 1
fi

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repository_root"

echo "Updating FORGE from the current local checkout: $repository_root"
npm run package:linux
npm run install:linux
