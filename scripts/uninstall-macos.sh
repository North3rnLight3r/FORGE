#!/usr/bin/env bash
set -euo pipefail

[[ "$(uname -s)" == Darwin ]] || { echo 'This uninstall procedure must run on macOS.' >&2; exit 1; }

installed_app="/Applications/FORGE.app"
installed_launcher="/usr/local/bin/forge-session"
osascript -e 'tell application id "com.kaeganscott26.forge" to quit' >/dev/null 2>&1 || true
if pgrep -fl '/FORGE.app/Contents/MacOS/FORGE' >/dev/null; then
  echo 'A FORGE process is still running. Close it and retry.' >&2
  exit 1
fi

if [[ -d "$installed_app" ]]; then
  trash_path="$HOME/.Trash/FORGE.app.removed-$(date -u +%Y%m%dT%H%M%SZ).$$"
  mkdir -p "$HOME/.Trash"
  mv -- "$installed_app" "$trash_path"
  echo "Moved $installed_app to $trash_path"
else
  echo "$installed_app is not installed."
fi
sudo rm -f -- "$installed_launcher"
echo 'Removed the FORGE macOS application and stable session launcher.'
