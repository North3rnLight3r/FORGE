#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This packaging procedure must run on macOS (Darwin)." >&2
  exit 1
fi

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repository_root"

for command in node npm lipo; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required command is unavailable: $command" >&2
    exit 1
  fi
done

for required_file in package.json package-lock.json scripts/prepare-node-pty.mjs scripts/stage-runtime-metadata.mjs scripts/write-build-manifest.mjs scripts/verify-build-manifest.mjs; do
  if [[ ! -f "$required_file" ]]; then
    echo "Required project file is missing: $required_file" >&2
    exit 1
  fi
done

npm ci
npm run typecheck
npm run lint
npm test
npm run clean
npm run build
npm run stage:mac-runtime-metadata
npx electron-builder --mac --universal --publish never
node scripts/write-build-manifest.mjs universal
node scripts/verify-build-manifest.mjs

version="$(node -p "require('./package.json').version")"
output_directory="$repository_root/dist_electron"
shopt -s nullglob
dmg_artifacts=("$output_directory"/FORGE-"$version"-*.dmg)
zip_artifacts=("$output_directory"/FORGE-"$version"-*.zip)

if (( ${#dmg_artifacts[@]} == 0 || ${#zip_artifacts[@]} == 0 )); then
  echo "Expected DMG and ZIP artifacts for FORGE $version were not produced." >&2
  find "$output_directory" -maxdepth 1 -type f -print 2>/dev/null || true
  exit 1
fi

pty_root="$output_directory/mac-universal/FORGE.app/Contents/Resources/app.asar.unpacked/node_modules/node-pty"
pty_node="$(find "$pty_root" -type f -name pty.node -print -quit 2>/dev/null || true)"
spawn_helper="$(find "$pty_root" -type f -name spawn-helper -print -quit 2>/dev/null || true)"
if [[ -z "$pty_node" || -z "$spawn_helper" ]]; then
  echo "The universal package is missing unpacked macOS node-pty resources." >&2
  exit 1
fi

pty_architectures="$(lipo -archs "$pty_node")"
helper_architectures="$(lipo -archs "$spawn_helper")"
if [[ "$pty_architectures" != *arm64* || "$pty_architectures" != *x86_64* || "$helper_architectures" != *arm64* || "$helper_architectures" != *x86_64* ]]; then
  echo "Universal macOS node-pty resources are missing an expected architecture." >&2
  echo "pty.node: $pty_architectures" >&2
  echo "spawn-helper: $helper_architectures" >&2
  exit 1
fi

echo "macOS packaging succeeded for FORGE $version:"
printf '  %s\n' "${dmg_artifacts[@]}" "${zip_artifacts[@]}"
echo "  Verified node-pty: $pty_node ($pty_architectures)"
