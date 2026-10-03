#!/usr/bin/env bash
set -euo pipefail

[[ "$(uname -s)" == Linux ]] || { echo 'This installation procedure must run on Linux.' >&2; exit 1; }

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
manifest="$repository_root/dist_electron/build-manifest.json"
install_root="${FORGE_INSTALL_ROOT:-$HOME/.local/share/FORGE/current}"
launcher="${FORGE_LAUNCHER_PATH:-$HOME/.local/bin/forge}"
desktop_file="${FORGE_DESKTOP_FILE:-$HOME/.local/share/applications/forge.desktop}"
staging="${install_root}.new.$$"
backup="${install_root}.previous.$$"

[[ -f "$manifest" ]] || { echo "Build manifest was not found at $manifest. Run npm run package:linux first." >&2; exit 1; }
for path in "$install_root" "$launcher" "$desktop_file"; do
  [[ "$path" != / && "$path" != "$HOME" && "$path" == /* ]] || { echo "Unsafe Linux install path: $path" >&2; exit 64; }
done

cd "$repository_root"
node scripts/verify-build-manifest.mjs
packaged_root="$(node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); const a=m.packagedApplications.find((v)=>v.architectures.includes("x64")); if(!a) process.exit(2); process.stdout.write(a.path)' "$manifest")"
packaged_root="$repository_root/$packaged_root"
[[ -x "$packaged_root/forge" ]] || { echo "The verified Linux application is missing its executable: $packaged_root/forge" >&2; exit 1; }

mkdir -p "$(dirname "$install_root")" "$(dirname "$launcher")" "$(dirname "$desktop_file")"
rm -rf -- "$staging" "$backup"
trap 'rm -rf -- "$staging" "$backup"' EXIT
cp -a "$packaged_root" "$staging"
node scripts/verify-installed-linux-runtime.mjs "$staging"

if [[ -e "$install_root" || -L "$install_root" ]]; then mv -- "$install_root" "$backup"; fi
mv -- "$staging" "$install_root"
rm -f -- "$launcher"
ln -s -- "$install_root/forge" "$launcher"
cat >"$desktop_file" <<EOF
[Desktop Entry]
Name=FORGE
Comment=Local-first intelligent workspace
Exec=$launcher %U
Terminal=false
Type=Application
Categories=Development;
MimeType=x-scheme-handler/forge;
EOF

if ! node scripts/verify-installed-linux-runtime.mjs "$install_root"; then
  rm -rf -- "$install_root"
  [[ -e "$backup" ]] && mv -- "$backup" "$install_root"
  rm -f -- "$launcher" "$desktop_file"
  exit 1
fi
rm -rf -- "$backup"
trap - EXIT

echo "Installed and verified FORGE for Linux at $install_root"
echo "Launcher: $launcher"
