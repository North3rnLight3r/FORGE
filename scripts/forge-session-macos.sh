#!/usr/bin/env bash
set -euo pipefail

app_path="${FORGE_APP_PATH:-/Applications/FORGE.app}"
executable="$app_path/Contents/MacOS/FORGE"
info_plist="$app_path/Contents/Info.plist"
runtime_metadata="$app_path/Contents/Resources/forge-runtime.json"

fail() {
  echo "forge-session: $*" >&2
  exit 69
}

metadata_value() {
  local key="$1"
  /usr/bin/plutil -extract "$key" raw -o - "$runtime_metadata" 2>/dev/null || true
}

[[ "$(/usr/bin/uname -s)" == "Darwin" ]] || fail 'This launcher is for macOS.'
[[ -x "$executable" ]] || fail "FORGE is not installed at $app_path. Run npm run install:macos from a packaged FORGE checkout."
[[ -r "$info_plist" && -r "$runtime_metadata" ]] || fail "FORGE at $app_path is incomplete. Reinstall the current packaged runtime."

bundle_version="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$info_plist" 2>/dev/null || true)"
runtime_version="$(metadata_value version)"
runtime_platform="$(metadata_value platform)"
runtime_commit="$(metadata_value gitCommit)"
[[ "$bundle_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$ ]] || fail 'The installed FORGE bundle has an invalid version.'
[[ "$runtime_version" == "$bundle_version" && "$runtime_platform" == 'darwin' && "$runtime_commit" =~ ^[0-9a-f]{40}$ ]] || fail 'The installed FORGE UI and runtime metadata do not match. Reinstall the current packaged runtime.'

case "${1:-}" in
  --version)
    printf '%s\n' "$bundle_version"
    exit 0
    ;;
  --runtime-info)
    printf 'FORGE v%s\nCommit: %s\nBundle: %s\nExecutable: %s\n' "$bundle_version" "$runtime_commit" "$app_path" "$executable"
    exit 0
    ;;
esac

exec "$executable" "$@"
