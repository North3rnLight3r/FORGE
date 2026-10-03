#!/usr/bin/env bash
set -euo pipefail

[[ "$(uname -s)" == Linux ]] || { echo 'This uninstall procedure must run on Linux.' >&2; exit 1; }

install_root="${FORGE_INSTALL_ROOT:-$HOME/.local/share/FORGE/current}"
launcher="${FORGE_LAUNCHER_PATH:-$HOME/.local/bin/forge}"
desktop_file="${FORGE_DESKTOP_FILE:-$HOME/.local/share/applications/forge.desktop}"
for path in "$install_root" "$launcher" "$desktop_file"; do
  [[ "$path" != / && "$path" != "$HOME" && "$path" == /* ]] || { echo "Unsafe Linux uninstall path: $path" >&2; exit 64; }
done

rm -rf -- "$install_root"
rm -f -- "$launcher" "$desktop_file"
echo 'Removed the user-local FORGE Linux runtime, launcher, and desktop entry.'
