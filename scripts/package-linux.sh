#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "This packaging procedure must run on Linux." >&2
  exit 1
fi

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repository_root"

for command in node npm python3 make g++; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required command is unavailable: $command" >&2
    echo "node-pty requires Python 3, make, and a C/C++ compiler for native Linux installation." >&2
    echo "Install python3 and build-essential (Debian/Ubuntu) or python3 and base-devel (Arch), then rerun." >&2
    exit 1
  fi
done

for required_file in package.json package-lock.json scripts/prepare-node-pty.mjs scripts/stage-runtime-metadata.mjs scripts/write-build-manifest.mjs scripts/verify-build-manifest.mjs; do
  if [[ ! -f "$required_file" ]]; then
    echo "Required project file is missing: $required_file" >&2
    exit 1
  fi
done

# Linux packaging does not need peer-only macOS and Windows packagers. Keep
# optional dependencies because Rollup distributes its native Linux binary as
# one, even though it is required at runtime by Vite and Vitest.
npm ci --omit=peer
npm run typecheck
npm run lint
npm test
npm run clean
npm run build
npm run stage:linux-runtime-metadata
npx electron-builder --linux --x64 --publish never
node scripts/write-build-manifest.mjs x64 linux
node scripts/verify-build-manifest.mjs

version="$(node -p "require('./package.json').version")"
output_directory="$repository_root/dist_electron"
shopt -s nullglob
appimage_artifacts=("$output_directory"/FORGE-"$version"-*.AppImage)
deb_artifacts=("$output_directory"/FORGE-"$version"-*.deb)

if (( ${#appimage_artifacts[@]} == 0 || ${#deb_artifacts[@]} == 0 )); then
  echo "Expected AppImage and DEB artifacts for FORGE $version were not produced." >&2
  find "$output_directory" -maxdepth 1 -type f -print 2>/dev/null || true
  exit 1
fi

pty_root="$output_directory/linux-unpacked/resources/app.asar.unpacked/node_modules/node-pty"
pty_node="$(find "$pty_root" -type f -name pty.node -print -quit 2>/dev/null || true)"
if [[ -z "$pty_node" ]]; then
  echo "The Linux package is missing its unpacked node-pty native module." >&2
  exit 1
fi

echo "Linux packaging succeeded for FORGE $version:"
printf '  %s\n' "${appimage_artifacts[@]}" "${deb_artifacts[@]}"
echo "  Verified node-pty: $pty_node"
echo "  Verified AppImage, DEB, runtime provenance, and build manifest"
sha256sum "${appimage_artifacts[@]}" "${deb_artifacts[@]}" > "$output_directory/SHA256SUMS"
