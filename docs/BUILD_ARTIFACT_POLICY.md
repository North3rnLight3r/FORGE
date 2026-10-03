# 🧪 Build Artifact Policy

Git history preserves source development. GitHub Releases contain only currently supported public binaries. Local packaging output contains only the newest validated build.

`dist_electron/` is generated, ignored by Git, excluded from workspace memory indexing, and cleaned before every standalone package command. Each `npm run package:<platform>` target creates exactly one native platform family from the current checkout. Electron Builder debug state, temporary icons, obsolete versions, and stale release-feed files are removed before the manifest is written.

`dist_electron/build-manifest.json` is the authoritative local artifact selector. It records:

- release version, tag, channel, source commit, and build date;
- platform and observed architectures;
- exact artifact and packaged-app paths;
- byte sizes and SHA-256 hashes;
- packaged executable and `app.asar` hashes.

Every macOS, Linux, and Windows packaging pipeline writes and verifies this manifest. The platform installers read it instead of selecting artifacts by first wildcard match, and each update command packages the current local checkout before invoking its installer. The verifier rejects a missing, malformed, stale, path-escaping, topology-mismatched, size-mismatched, or hash-mismatched record. The macOS installer verifies both the packaged source bundle and its `/Applications` staging copy before it activates the canonical app, then verifies the activated bundle again. The Linux package gate verifies the x64 AppImage, DEB, ELF executable, `app.asar`, version, build provenance, and runtime metadata. The Windows installer selects the exact NSIS record, installs it, and verifies the installed executable, `app.asar`, version, build provenance, and runtime metadata against the same manifest.

The coordinated release workflow keeps each platform's internal manifest and checksum file isolated while downloading CI artifacts. It publishes only the 8 uniquely named package/blockmap assets selected by the three verified platform outputs, plus one freshly generated cross-platform `SHA256SUMS.all`; duplicate basenames fail the release instead of silently overwriting another platform's evidence.

The installer treats system and user Applications directories as distinct installation locations while respecting the default case-insensitive macOS filesystem. A capitalization alias of `/Applications/FORGE.app` is not misclassified as a second bundle.

Old local packages are moved to a timestamped Trash location only after a replacement staging copy has passed manifest validation; a failed activation restores that prior system bundle. Do not index generated binaries, updater caches, `.forge/`, `.obsidian/`, local databases, or packaging output as workspace memory.

Deleting a GitHub Release and release tag removes convenient public access to that historical binary. The underlying source commits remain in Git history. Such cleanup is allowed only after a newer release has passed local and public artifact acceptance, and only for exact audited obsolete release tags.
