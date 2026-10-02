#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != Darwin ]]; then
  echo 'This update procedure must run on macOS.' >&2
  exit 1
fi

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
expected_origin='https://github.com/North3rnLight3r/FORGE'
cd "$repository_root"

[[ "$(git branch --show-current)" == main ]] || { echo 'FORGE must be on main before updating.' >&2; exit 65; }
origin="$(git config --get remote.origin.url)"
[[ "${origin%.git}" == "$expected_origin" ]] || { echo "FORGE has an untrusted origin: $origin" >&2; exit 65; }
[[ -z "$(git status --porcelain -- . ':(exclude).obsidian/**')" ]] || { echo 'FORGE has source changes outside .obsidian; refusing to update.' >&2; exit 65; }

before="$(git rev-parse HEAD)"
obsidian_stashed=false
if [[ -n "$(git status --porcelain -- .obsidian 2>/dev/null)" ]]; then
  git stash push --include-untracked --message 'FORGE macOS updater local Obsidian state' -- .obsidian >/dev/null
  obsidian_stashed=true
fi

restore_obsidian() {
  if [[ "$obsidian_stashed" == true ]]; then
    git stash pop --index 'stash@{0}' >/dev/null
    obsidian_stashed=false
  fi
}

rollback() {
  status=$?
  if [[ $status -ne 0 ]]; then
    echo 'macOS update failed; restoring the source checkout and local Obsidian state.' >&2
    git reset --hard "$before" >/dev/null
  fi
  restore_obsidian
  exit "$status"
}
trap rollback EXIT

git fetch --prune origin main
git merge-base --is-ancestor HEAD origin/main || { echo 'Local FORGE history has diverged from origin/main.' >&2; exit 65; }
git merge --ff-only origin/main

./scripts/package-macos.sh
npm run install:mac

# Packaging embeds build provenance in this tracked generated bundle. Restore
# its committed source projection after the installed package has been verified.
git restore -- apps/desktop/out/main/index.js
restore_obsidian
trap - EXIT

echo 'FORGE for macOS is updated, verified, installed, and opened.'
