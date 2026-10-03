# FORGE release distribution

Published Stable/Beta releases are distribution and provenance records only. The desktop application does not query GitHub Releases, select a channel, download an updater feed, or replace a local checkout from a release.

The **Update from current checkout** action runs the native `npm run update:<platform>` target (or the FORGE-OS sibling updater on Linux). That target packages the exact source tree in `~/FORGE` and installs the manifest-selected artifact. The source tree may be detached, dirty, or on any local commit; the command never fetches, merges, resets, or changes Git refs.

## Current published beta

`v2.5.0-beta` was published from annotated tag commit `430796e2b4de543f5e9c6b8a8195e407353c9f68` with:

- `FORGE-2.5.0-beta-x86_64.AppImage`
- `FORGE-2.5.0-beta-amd64.deb`
- `FORGE-2.5.0-beta-universal.dmg`
- `FORGE-2.5.0-beta-universal.zip`
- `FORGE-2.5.0-beta-x64.exe`
- payload blockmaps, `SHA256SUMS`, and `build-manifest.json`

GitHub reports the release as a non-draft prerelease, matching the Beta version. Future post-tag changes are not eligible for public publication until the version is incremented.

See [Releasing FORGE](../RELEASING.md) for provenance and publication checks.
