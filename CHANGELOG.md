# 🗂️ FORGE Changelog

> This file preserves dated implementation and release history. For the supported product, start with the [documentation index](docs/README.md), [project status](docs/PROJECT_STATUS.md), and [current release notes](RELEASE_NOTES.md).

## Unreleased

- Added persisted Disabled/Controlled/Allow All execution modes; filesystem scope selection from workspace through the user-accessible filesystem; independent network capabilities; process limits; background, argument-repair, and semantic-index settings.
- Added policy-aware canonical path resolution for file and shell tools, including repository traversal, selected project trees, home/full scope, symlink resolution, scope-denial evidence, and deterministic file.read/file.list argument normalization.
- Added a ToolRouter-derived capability catalog and schema-driven Run/Test interface, audited `tool.execute` IPC, Stop All, durable task redirect events, tracked background process cancellation, and policy-aware native recovery evidence.
- Made semantic context and event-driven indexing default-on with visible indexing failures and one bounded automatic degraded-index rebuild when enabled.
- Added `task.redirect` as a canonical registered task capability and replaced recursive task-step continuation with a state-driven advancement loop.
- Recorded these changes in the user manual and architecture/tooling documentation; available verification and any remaining gaps are reported from the current worktree rather than inferred from prior release history.
- Fixed the Intelligence layer so it reports the complete provider-neutral artifact packet instead of exposing only optional semantic-retrieval counters.
- Replaced millisecond cache freshness with monotonic invalidation revisions so rapid file or memory changes cannot leave an older intelligence packet active.
- Added event-correlated agent, tool, and durable-task telemetry with completion visibility for fast operations.
- Repaired synthesized system sounds by unlocking Web Audio from pointer or keyboard interaction and restoring audible tap, completion, and warning levels.
- Advanced the shared renderer to `2.5.0-beta` with an adaptive Three.js aurora field, glass transitions, animated Explorer/Browser/Intelligence surfaces, bundled typography, a new forge mark, and opt-out interface sounds.
- Added typed live intelligence telemetry for context utilization, semantic records, FORGE memory, running tools, durable tasks, and terminal processes, with hidden-window, reduced-motion, device-pixel-ratio, and WebGL safeguards.
- Added a 32 MB pre-allocation file-read guard and actionable `EACCES`/`EPERM` guidance while preserving permission-tolerant traversal.
- Recovered workspace opening when Electron returns a null or missing successful response payload: the renderer now reloads canonical `workspace.info`, preserves cancellation, and has focused regression coverage for folder and Home opening.
- Consolidated public documentation around the current autonomous `2.5.0-beta` runtime and cross-platform package contract. Dated audits, implementation logs, superseded plans/reviews, and older release verification records now live under `docs/archive/`.
- Repaired the `2.4.0-beta` semantic-context memory regression without reverting the current runtime: retrieval is lazy/tool-first and capped, stale/failed records inject nothing, vectors use Float32 blobs, sql.js index writes are batched, file updates are incremental, and local Ollama unloads after each operation. Native FORGE, Hermes, FORGE Live, Browser/Home, updates, tasks, memory, and ToolRouter remain on the current line.
- Separated model-visible tool arguments from runtime execution metadata. Providers no longer see or supply `reason`, nested `taskContext`, task-creation conversation identity, or task-process execution IDs; FORGE now injects workspace, conversation, model, request, and optional task/step linkage internally and persists task/step audit columns in schema v8.
- Completed the autonomous ToolRouter migration: valid registered operations execute directly without the retired approval queue/session-grant layer, while containment, validation, cancellation, rollback, redaction, network controls, and execution-state auditing remain enforced.
- Replaced browser-native text prompts with routed in-app dialogs for file/folder creation, rename, goals, metadata tasks, persistent tasks, release workflows, task pause, and conversation rename. New files activate the editor immediately.
- Added an allowlisted `workspace.open.home` route and Home controls on every desktop platform. Explorer now loads folders on demand; bounded memory discovery and model `file.list`/`file.search` skip unreadable, vanished, cache, and container-storage subtrees rather than failing the entire home workspace.
- Added a renderer routing contract test that rejects buttons without click or form-submit behavior.
- Made external web research opt-in by default, preserving automatic bounded public reads only after the user enables the capability.
- Consolidated active install/update and workspace guidance across README, User Manual, User Configuration, and Project Status.
- Removed the stray tracked `tatus` ANSI diff artifact in commit `4a54d32`; its forensic history remains in [the archived tooling runtime audit](docs/archive/audits/TOOLING_RUNTIME_AUDIT_2026-08-21.md).
- Ollama now receives every currently available `ToolRouter.providerDefinitions()` capability, safe legacy aliases resolve, and invalid model-invented task UUID metadata is discarded while valid workspace task links remain.
- Removed the numeric context-health score while preserving README presence, file counts, goals, tasks, memory, retrieval rank, and per-source relevance.
- Platform-specific updater metadata supports macOS, Windows, and Linux; source update entry points are `npm run update:mac`, `npm run update:win`, and FORGE-OS `./update.sh`.
- macOS local installation now stages and verifies the replacement universal bundle before activation, validates installed executable and `app.asar` hashes against the build manifest, and restores the Trash backup if activation fails. The stable `/usr/local/bin/forge-session` path continues to report the canonical bundle's version and source commit across upgrades without requesting administrator authentication when the launcher is unchanged.
- Documentation now distinguishes shared-source runtime parity from platform-native artifact hashes and records the corresponding FORGE-OS runtime identity contract.

## ✨ 2026-08-09 — FORGE 2.3.0-beta.1 release record and runtime hardening

### Release and implementation

- Published `v2.3.0-beta.1` as **FORGE v2.3 Beta** from tagged commit `302ff52b87e415d357c6fe5039869c742d5ecb24`.
- Filters provider tool definitions to only currently available and enabled capabilities, avoiding avoidable agent failures.
- Adds paginated workspace listings, ranged reads, typed GitHub mutations, explicit repository-write commit policy, and declared shell network profiles.
- Adds bounded workspace-memory administration, explicit conversation/task deletion semantics, and browser/terminal lifecycle hardening.
- Adds the release-version guard, plain-English agent tool guide, current release record, and refreshed configuration/manual/release guidance so future version bumps can be checked consistently.

### Validation and release evidence

- The tagged workflow [31323231310](https://github.com/kaeganscott26/FORGE/actions/runs/31323231310) completed successfully and published the universal DMG, universal ZIP, two blockmaps, and `beta-mac.yml`; their observed SHA-256 digests are in [the archived v2.3 verification record](docs/archive/releases/V2.3.0_BETA1_VERIFICATION.md).
- After the documentation and release-tooling refresh, `npm run verify:release-version`, `npm run typecheck`, `npm run lint`, `npm test` (27 files; 112 passed, 1 skipped), `npm run build`, and `git diff --check` passed.
- Independent downloaded-artifact comparison, mounted-DMG/app runtime acceptance, updater installation, Developer ID signing, and notarization are still unverified. The public release is currently not marked as a GitHub prerelease even though its SemVer tag and FORGE update channel are beta; future release checks must verify that flag.

## ✨ 2026-08-09 — FORGE 2.2.0-beta.3 browser and context-runtime hardening

### Implementation

- Rebuilt the protected Browser around independent native tabs, reliable BrowserView attachment, a default FORGE home, back/forward/reload controls, and close/select tab behavior.
- Added workspace-owned browser bookmarks and visit history with a schema-v7 migration; records remain private to the active workspace and do not create model context by themselves.
- Added the Browser home update/status panel and a current GitHub repository route.
- Preserved the public HTTP(S) boundary and made browser-to-agent page reading an explicit approved action.
- Bounded durable-memory input during retrieval and agent handoff to prevent large notes from producing WASM out-of-bounds faults during context assembly.

### Validation

- `npm run typecheck`, `npm run lint`, focused storage/memory/IPC tests, and `npm run build` passed before release packaging.
- Native browser validation loaded and rendered `https://www.north3rnlight3r.com/` through the native compositor path after the zero-height surface regression was fixed.

Release provenance, workflow evidence, public hashes, and mounted-DMG acceptance are recorded in the beta.2 verification record after publication.

## ✨ 2026-08-07 — FORGE 2.1.0-beta.2 reset and UI/file workflow repair

### Why

The broken release line was discarded back to commit `8350aab` after reports that UI actions returned no visible result, AI model catalogs did not load, and panel resizing made the editor unreadable. The superseded GitHub releases `v1.1.0-beta.1` and `v1.1.0-beta.2` were removed with their release tags. The intermediate `v2.1.0-beta.1` publication was also removed because corrected artifacts must be identified as beta.2; no beta.1 package is supported for installation.

### Implementation

- Added recursive explorer rendering with independent folder expand/collapse, selection, context actions, new file/folder, rename, delete, and copy/paste.
- Added collision-safe workspace copy semantics and keyboard shortcuts for explorer file management.
- Removed the extension allowlist from text reads; UTF-8 text is editable regardless of extension and binary content is rejected clearly.
- Expanded Monaco language identification for major coding languages and reset the editor model when switching files.
- Clamped persisted panel dimensions, corrected them during window resize, and added narrow-window layout fallbacks.
- Added automatic provider model catalog loading for saved remote credentials and loopback Ollama-compatible endpoints, including `models` payloads.
- Converted previously ignored renderer action failures into visible notices.

### Validation

The current source passed typecheck, lint, 25 test files / 100 tests, production build, and `git diff --check`. Release identity is `2.1.0-beta.2`, public name **FORGE beta 2.1**, and target tag `v2.1.0-beta.2`. DMG acceptance is isolated from `/Applications` and source installation.

GitHub Actions run `31193206048` passed from the exact tagged commit and published the five beta.2 assets. The public DMG digest matched GitHub's reported SHA-256 and its read-only mounted runtime loaded the repaired packaged UI. No existing application installation was replaced.

## 2026-08-07 — FORGE 1.1.0-beta.1 publication

- Merged the persistent-task and final workflow repairs through PRs #12–#15. The verified application payload and annotated `v1.1.0-beta.1` tag point to `8350aab8d498073b2335dfb8a1d7caa227865514`; `main` later advanced only for the draft-release asset lookup fix.
- Passed typecheck, lint, all 25 test files / 96 tests, production build, zero-vulnerability production audit, exact-commit ARM64/universal packaging, manifest validation, both ZIP tests, both DMG checks, and universal executable/native-module architecture inspection.
- Verified the packaged editor, Command-key save/undo/redo, duplicate open flow, terminal selection styling, Codex 0.147.0, Ollama 0.32.1, and one real local `file.read` tool round trip. FORGE recorded the Ollama call as one automatic Tier 0 success in 3 ms and returned the actual file content.
- The tag workflow passed source validation and unsigned universal packaging, then exposed a draft-only API 404 in asset lookup. Changed the lookup to `gh release view`, uploaded the five manifest-selected assets serially with `beta-mac.yml` last, downloaded them again, and verified every SHA-256 against the manifest and GitHub digest.
- Published the GitHub Pre-release and reinstalled its downloaded universal ZIP at `/Applications/FORGE.app` after moving earlier bundles recoverably to Trash. One physical FORGE app remains. It reports `1.1.0-beta.1`, packaged `app.asar`, and embedded release commit `8350aab`.
- Signing and notarization remain unavailable. The public beta is ad-hoc signed/unsigned, macOS reports no usable signature, and unattended trusted replacement is not claimed.

## 2026-08-06 — FORGE 1.1.0-beta.1 release preparation

The authoritative version is now `1.1.0-beta.1`, with logical Beta and Stable updater choices. Stored Preview settings migrate to Beta; Beta permits newer beta, rc, or stable versions and rejects alpha. Packaging now cleans stale output, writes an exact hash-bearing build manifest, and makes installation and serial upload select artifacts from that manifest.

Agent tool continuation now permits a capped three-round/five-call Tier 0 sequence so structured missing-path recovery can actually inspect the root and continue in one user turn. Any approval-required request stops the loop. Foreign or invented task links are removed before execution and cannot attach evidence across workspaces.

The final beta repair pass opens a newly created blank file immediately, adds save/open/undo/redo shortcuts, gives user PTYs a bounded non-secret CLI environment, and supports keyless loopback OpenAI-compatible providers. A live local Ollama `llama3.2:3b` request returned a structured file-tool call; FORGE still validates and approval-gates it before any workspace action. Task checkpoint approval projection is now separate from step-evidence projection.

The development-runtime money test created and saved `draft-2.txt`, reopened the duplicate through the human collision prompt, ran Codex 0.147.0 and Ollama 0.32.1 inside the FORGE PTY, and configured Ollama without an API key. `llama3.2:3b` requested `file.read`; FORGE recorded one automatic Tier 0 success in 3 ms and the local model answered `draft-two-content` from the observed result. Small-model plain-JSON calls are promoted only when they exactly match an offered tool, repeated calls are deduplicated, and loopback providers see a focused file-tool catalog.

After the final repair, a clean `npm ci` source gate passed typecheck, lint, 25 test files / 95 tests, production build, and `npm audit --omit=dev` with zero vulnerabilities. npm reported one unapproved install script in the transitive Windows-only `electron-winstaller`; it did not execute and is outside the macOS beta path.

Before the conversion, the complete repair/task-engine source gate passed 21 files / 78 tests, typecheck, lint, and production build. The beta conversion then passed focused IPC, updater, and task checks (3 files / 20 tests). The 4.5 GB historical local packaging tree was fully hashed in `docs/archive/PRE_BETA_RELEASE_AUDIT.md` and moved recoverably to Trash. Installed applications and all GitHub Releases/tags remain untouched pending final beta acceptance.

This is preparation evidence, not release proof. Exact final-main packaging, local installed runtime checks, public workflow/assets, downloaded hash equality, public installation, updater behavior, and post-verification historical cleanup remain open.

## 2026-08-06 — Persistent task engine and active runtime repair

### Why

Long-running work was recoverable only from conversation transcripts. Terminal input could be detached from the current renderer session, workspace scanning could stop after a guessed missing path, and GPT-5.6 tool calls used a Chat Completions combination the provider rejects. The repair treats the workspace database and observed runtime state as authority.

### Implemented architecture

- Added schema-v4 tasks, steps, task/step dependencies, checkpoints, artifacts, external references, approvals, and events without replacing conversations, memory, layouts, projects, goals, or action logs.
- Added `@forge/tasks` with dependency-aware reconciliation, provider/model-independent persistence, PID/Git inspection, no-repeat completion rules, retry/cancellation semantics, safe handoffs, and a 26-step release template.
- Added Tier 0/1/2 task tools through the existing registry/policy/audit runtime and a dedicated renderer Tasks view.
- Added detached background process start with workspace-contained output. Process start remains distinct from verified step completion; missing PIDs fail closed for evidence review.
- Added root-first context/file discovery and structured `ENOENT` recovery.
- Kept xterm mounted across session changes, routed input through the active-session reference, enforced PTY workspace ownership, rejected writes after exit, and restored writable restart behavior.
- Routed GPT-5.6 tool turns through `/v1/responses` while retaining Chat Completions compatibility for other provider models.
- Changed tag CI to draft-first, serial hash-safe uploads and updater-metadata-last publication.

### Validation status

`npm ci` completed with zero reported vulnerabilities. Typecheck, lint, all 21 test files/78 tests, and the production build pass. ARM64 and universal DMG/ZIP packaging completed; both DMGs pass `hdiutil verify`, both ZIPs pass archive testing, and the packaged native PTY is ARM64 in the ARM build and x86_64/ARM64 in the universal build.

An isolated real packaged universal app reported Preview `1.1.0-alpha.3`, `runtime: packaged`, and `file:// packaged app.asar`. Trusted renderer keyboard events sent `pwd` through xterm/preload/IPC to the PTY, `exit` produced code 0, exited input was rejected, and Restart produced a writable PTY in the canonical workspace. A `Persistent Task Verification` record and Markdown handoff survived renderer reload, conversation switching, and a full packaged-application stop/start while retaining the originating conversation and first unfinished step.

The package is ad-hoc signed with no TeamIdentifier; Gatekeeper rejects it as having no usable signature. A live user-configured GPT-5.6 request, remote GitHub workflow/release checks, installation over `/Applications/FORGE.app`, and updater behavior remain unverified. Exact source-commit provenance must be rebuilt after the feature commits; these uncommitted packages embed baseline `d3c34d9` and are validation artifacts only.

## 2026-08-06 — FORGE 1.1.0-alpha.3 logical Preview discovery

### Why

Post-publication review found that alpha.1 and alpha.2 passed FORGE's user-facing logical `Preview` value into Electron Updater as a provider channel. GitHub prerelease tags use SemVer identifiers such as `alpha`, `beta`, and `rc`; there is no reliable provider release named `preview` to bridge those concepts. The prior local SemVer gate correctly rejected downgrades, and the packages, assets, and tag provenance remain valid, but the immutable clients cannot discover conventional future prerelease tags through that mapping.

Alpha.2-to-alpha.3 is therefore a one-time manual migration. Alpha.1 and alpha.2 and all published assets remain untouched. No duplicate compatibility release or `v1.1.0-preview.2` tag is created.

### Updater boundary

- Added `@forge/updater` as a provider-independent release-discovery package.
- Retrieves a maximum of 50 published GitHub Releases from the fixed FORGE repository, with a ten-second timeout, one-megabyte body limit, JSON content check, strict Zod schema, and no credential headers.
- Rejects drafts, unpublished entries, malformed tags, GitHub prerelease/version mismatches, unsupported prerelease identifiers, missing metadata, and metadata URLs outside this repository's HTTPS release-download path.
- Stable accepts only strictly newer stable SemVer. Preview accepts only strictly newer `alpha`, `beta`, `rc`, or stable SemVer and chooses the highest compatible candidate regardless of API order.
- Configures Electron Updater only after selection, derives its internal metadata channel from the chosen release, resets `allowDowngrade=false`, and revalidates the updater-returned version before download.
- Preserves automatic-download gating, metadata checksum verification, progress, diagnostics, signing warnings, installation, and restart state.
- Keeps `Preview` as UI vocabulary; provider-specific metadata names remain internal.

### Validation status

- `npm ci` audited 532 packages with zero vulnerabilities. Typecheck, lint, all 20 files / 61 tests, and production build pass.
- The first full run exposed the existing macOS case where `fs.watch` omitted a notification entirely. `NodeFileSystem` now runs a serialized 250 ms snapshot fallback alongside native events. The focused file passed 20 consecutive runs, and the complete suite then passed.
- ARM64 and universal packaging pass. The ARM app/PTY binaries are arm64; the universal app, `pty.node`, and `spawn-helper` contain x86_64 and arm64 slices. Universal ZIP integrity and DMG verification pass; signing is ad-hoc with no TeamIdentifier.
- A packaged candidate loaded its nonblank renderer through `file://` inside `app.asar`, reported alpha.3/Preview/packaged/darwin arm64, opened FORGE, read `AGENTS.md`, rejected unknown IPC, streamed PTY `pwd`, and rejected cwd escapes.
- A loopback mock provider exercised the actual packaged tool pipeline without sending project context externally: Tier 0 `file.read` ran automatically with Tool Result evidence, Tier 1 `file.create` displayed a diff and remained absent until Run Once, and Tier 2 `shell.run` was rejected without execution. All decisions remained in the audit log, and the verification identifiers were absent from AIFRED and INTERVENTION stores.
- Packaged Stable and Preview checks against the current public release set both returned `not-available`: alpha.2 and v1.0.1 were rejected as older than alpha.3.
- These pre-commit artifacts correctly embed baseline main `4a0207a0d0e721c031a4687f10ce4aa12d43277e` and are not publishable. The complete suite, packaging, runtime checks, hashes, and diagnostics must be repeated from the exact merged release commit.

## 2026-08-06 — FORGE 1.1.0-alpha.2 updater release

### Why

Installed alpha.1 verification found that assigning Electron Updater's channel re-enabled downgrade checks. A persisted Stable preference therefore offered v1.0.1 to alpha.1. Signature validation prevented installation, but the offer and download violated FORGE's forward-only channel policy. Alpha.1 and all of its assets remain immutable; alpha.2 is the new vehicle for the fix.

### Updater boundary

- Retains the post-channel `allowDowngrade=false` guard merged through PR #10.
- Adds a provider-independent SemVer eligibility gate before download and changes Electron Updater to `autoDownload=false`.
- Rejects malformed, equal, and older versions on every channel.
- Restricts Stable to newer normal semantic versions and requires explicit Preview selection for alpha, beta, or release-candidate versions.
- Verifies the order `1.0.1 < 1.1.0-alpha.1 < 1.1.0-alpha.2 < 1.1.0-beta.1 < 1.1.0` in the IPC contract tests.
- Keeps update detection, download, installation, and restart as distinct states; the unsigned release cannot claim trusted unattended installation.

### Release-candidate validation before commit

- `npm ci`, typecheck, lint, all 19 test files / 55 tests, and the production build passed.
- ARM64 packaging passed; the app executable, `pty.node`, and `spawn-helper` are arm64.
- Universal packaging passed; all three executables contain x86_64 and arm64 slices, ZIP integrity and DMG verification passed, and the app is ad-hoc signed with no TeamIdentifier.
- A packaged universal runtime probe loaded the renderer through `file://` inside `app.asar`, reported alpha.2/Preview/packaged/darwin arm64, opened the FORGE workspace, read `AGENTS.md` through IPC, rejected an unknown channel, streamed `pwd` through the PTY, and rejected a terminal cwd escape.
- This pre-commit package embeds baseline main commit `00ea8383`; it is validation evidence only and is not eligible for publication. Exact release-commit rebuild, full packaged tool/audit/isolation probes, tag, workflow, asset comparison, updater transition, and installed-app evidence remain mandatory before completion.

### Committed-candidate validation

- Committed the alpha.2 source and metadata as `7ad23e6`, then repeated `npm ci`, typecheck, lint, all 55 tests, production build, ARM64 packaging, and universal packaging from that clean commit.
- Packaged diagnostics embedded the complete `7ad23e6edab9a4cb438b124a38e2784587edb5f3` source SHA.
- A configured provider requested `file.read`; Tier 0 ran automatically, produced bounded Tool Result evidence, and recorded a sanitized successful action.
- A Tier 1 `.forge/alpha2-tool-runtime-verification.txt` creation showed its diff and stayed absent until Run Once approval; approval created the exact content and retained affected-path and rollback metadata.
- A Tier 2 `/bin/pwd` agent request stayed pending until rejection, never executed, and retained a zero-duration rejected audit action.
- The three alpha.2 FORGE conversation/action identifiers were absent from both AIFRED and INTERVENTION stores.
- With Stable explicitly saved, the alpha.2 packaged updater identified v1.0.1 as older, returned `not-available`, and did not download it.
- A later exact-commit suite exposed the known macOS case where `fs.watch` reports only the watched directory and the prior filter discarded that signal. The watcher now reconciles its snapshot on directory-level events instead of returning silently; its focused lifecycle/watcher test passed ten consecutive runs after the fix.
- The final tag target includes this watcher repair and must be rebuilt and rechecked before publication.

## 2026-08-06 — FORGE 1.1 tool runtime, terminal, and preview channels

### Why

FORGE needed a safe boundary between model reasoning and machine authority. Tool calling is now explicitly a request: the stable workspace runtime validates, authorizes, executes, logs, and returns results. This preserves the project folder as source of truth and keeps providers replaceable.

### Architecture and security

- Added `@forge/agent-tools`, `@forge/tool-policy`, `@forge/shell`, and `@forge/web` with dependency-injected services and no circular package ownership.
- Added provider-native calls plus strict provider-neutral fallback, Zod input/output validation, unknown/malformed rejection, stable definitions, risk/approval/boundary/timeout/audit/cancellation metadata, and bounded result continuation.
- Added Tier 0 automatic reads, Tier 1 explicit/exact-scope expiring session permissions, and Tier 2 always-explicit execution. Workspace changes clear all session permissions.
- Added contained filesystem operations with realpath/symlink checks, literal search, atomic writes, targeted patches, diffs before approval, BOM/mode preservation, `.forge/backups/` rollback data, and dirty-editor rejection.
- Reused protected Git service for all agent Git tools. Added argument-array shell execution with environment filtering, timeout, output cap, cancellation, and process-group termination.
- Added default-off web search/fetch/open with HTTP(S), credential, local/private network, DNS, redirect, content-type, response-size, and timeout controls.
- Added schema-v3 `action_log` persistence with workspace isolation, filters, sanitized input, decision, duration, result, paths, exit code, and rollback metadata.
- Enabled Electron renderer sandbox and web security, changed preload to sandbox-compatible CommonJS, retained context isolation/no Node integration, fixed the IPC allowlist, denied new windows, and blocked unexpected navigation.

### Terminal and UI

- Added main-process `node-pty` lifecycle and xterm.js UI with multiple sessions, workspace cwd, resize, streaming, termination, restart, clear visible, copy output, running/exited state, and exit codes.
- Added Agent Actions approval/result/audit UI and separate labels for user terminal versus agent shell requests.
- Added bounded/redacted tool results as agent context and context-source labels for Workspace Documentation, Source Code, Git, Durable Memory, Terminal, Tool Result, External Web, and Model Inference.
- Added web enablement and Stable/Preview updater selection to Settings and release channel to build diagnostics.

### Release engineering

- Updated all workspace versions to `1.1.0-alpha.1`; development reports `1.1.0-alpha.1-dev`.
- Added `release:preview` and `release:stable`, stable-default updater behavior, prerelease-aware GitHub workflow logic, and non-Latest GitHub Pre-release creation.
- Unpacked `node-pty` native files from `app.asar`, excluded unused cross-architecture prebuild copies, and retained Electron Builder rebuilds. The universal app, `pty.node`, and `spawn-helper` all contain x86_64 and arm64.
- Added root postinstall repair for missing Electron vendor app and macOS PTY helper execute permission. `npm run dev` now launches the native Electron app in this checkout.

### Validation on feature branch

- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `npm test`: pass, 19 files / 54 tests.
- `npm run build`: pass.
- `npm run package:mac`: pass, arm64 DMG/ZIP/blockmaps.
- `npm run package:mac:universal`: pass after excluding unused `node-pty/prebuilds`; universal DMG/ZIP/blockmaps/YAML.
- Packaged arm64 and universal CDP probes: pass for `file://` app.asar renderer, sandbox-compatible preload, preview diagnostics, workspace/Git metadata, Terminal/Agent Actions UI, PTY streaming, and workspace escape rejection.
- Packaged configured-provider probe: stable `file.read` Tier 0 execution and Tool Result disclosure passed; a Tier 1 file creation stayed absent until its displayed diff received Run Once approval; a Tier 2 shell request stayed unexecuted and produced a retained rejection audit record.
- Packaged AIFRED/FORGE/INTERVENTION probes confirmed separate conversation and action stores.
- Signing: ad-hoc/unsigned; TeamIdentifier absent; notarization not performed.

### Deferred release work

PR #9 merged the feature branch as `0c73ba8`; the remote feature branch was removed and local `main` matched `origin/main`. Two feature-branch GitHub workflow runs passed source validation, universal packaging, and artifact upload; the final run used the current Node 24-based official actions without deprecation annotations. Clean merged-main installation, typecheck, lint, all 54 tests, production build, arm64 packaging, and universal packaging passed again.

At that checkpoint, the final release-metadata commit, exact embedded-commit verification, annotated tag, GitHub Pre-release workflow/assets, stable-channel feed check, `npm run install:mac`, duplicate-install report, and installed-app runtime diagnostics still remained; the following publication finding records their outcome.

### Alpha.1 publication finding

- Published annotated `v1.1.0-alpha.1` from release commit `6d9037f`; the GitHub workflow, Pre-release, five universal assets, remote hashes/architectures, embedded commit, local install, and installed diagnostics passed.
- Confirmed v1.0.1 remains GitHub Latest, so Stable v1.0.1 installations are not offered the preview.
- The installed alpha on a persisted Stable preference incorrectly offered v1.0.1 as an update because the Electron Updater channel setter re-enabled downgrade checks. The unsigned downgrade downloaded but failed code-signature validation and was not installed.
- Added a follow-up policy that explicitly resets `allowDowngrade=false` after channel selection. Unit checks pass, and a packaged Stable-channel check reports v1.1.0-alpha.1 up to date while identifying v1.0.1 as disallowed downgrade.
- The published alpha.1 tag and assets remain immutable. This guard requires a new preview version before the milestone can be called fully released.

## 2026-08-06 — Version 1.0.1 release repair

### Release and installed-binary audit

- Confirmed PR #7 is merged, Issues #5 and #6 are closed through it, and the remote feature branch was deleted after merge.
- Confirmed the three feature-branch commits are represented on `main` by squash merge `ad610fa`.
- Confirmed the annotated `v1.0.0` tag points to pre-PR commit `86ed05c`, while the five v1.0.0 release assets were replaced afterward from the workspace-intelligence build.
- Matched the uploaded universal DMG, ZIP, and `latest-mac.yml` SHA-256 digests to the local refreshed artifacts.
- Matched `/Applications/FORGE.app` to the refreshed universal `app.asar` and found a second stale `~/Applications/FORGE.app` with the same bundle identifier, old renderer code, and no `app-update.yml`.

### v1.0.1 repair scope

- Bumped the root, desktop, and every workspace package through npm so generated lockfile workspace versions remain consistent.
- Added non-secret build diagnostics for version, exact Git commit, build date, runtime, renderer source, platform, and architecture, with a Settings copy action.
- Made packaged renderer loading target the compiled `index.html` directly through `file://` inside `app.asar`.
- Added an explicit GitHub updater feed and kept renderer polling active between update discovery and download completion.
- Expanded automated coverage for cross-workspace operation rejection, active-thread/layout persistence, required context evidence classes, prompt ordering, and diagnostic formatting.
- Replaced the flat, noisy durable-memory inventory with classified Architecture, Documentation, Source Code, Memory, and Configuration groups.
- Excluded machine-specific `.obsidian` and generated state from default indexing, made reindexing idempotent by path, and filtered retrieval to actual query matches.
- Added heuristic relevance scores and selection reasons to grouped context disclosure.
- Replaced ambiguous **Delete** controls with **Remove indexed copy** and **Forget memory** confirmations that explicitly preserve project files.
- Documented concept extraction and cross-document relationship traversal as the next knowledge-graph layer; v1.0.1 does not misrepresent that larger semantic graph as complete.
- Final validation, package hashes, installed-runtime evidence, GitHub tag, workflow, and release results will be recorded after publication.

## 2026-08-06 — Workspace UX and AI context architecture milestone

### Why this milestone exists

- Reframed FORGE's AI from a generic assistant into workspace intelligence grounded in the project folder.
- Kept feature scope tied to FORGE's philosophy: local-first operation, durable project memory, and a connected graph of source, Markdown, Git, metadata, architecture, and conversations.
- Explicitly rejected unrelated generic IDE roadmap work.

### Conversation and storage architecture

- Added schema version 2 with `conversation_threads`, thread linkage on messages, and `workspace_state` for active conversation and layout.
- Migrated legacy unthreaded messages non-destructively into an **Imported conversation**.
- Added multiple named conversations per workspace, selection, rename, first-prompt automatic titles, New Chat, and Clear Chat.
- Enforced project ownership for every thread lookup so IDs from a different workspace cannot be read or selected.
- Defined Clear Chat as deleting only the active thread's message rows. It intentionally preserves memories, indexing, project metadata, layout, Git state, other conversations, and future embeddings/search indexes.
- Kept API/GitHub credentials app-global and Keychain-backed while keeping conversation and layout state inside the project folder.

### Workspace UX

- Replaced the fixed workspace grid with drag handles between Explorer/editor, editor/workspace intelligence, context/chat, and workspace/source control.
- Persisted clamped panel dimensions per workspace with debounced IPC saves.
- Consolidated dashboard and durable memory into the workspace-intelligence region and made the AI panel a thread-oriented project surface.
- Added context-source disclosure beneath the latest response.

### AI models and prompt assembly

- Changed the default for new configurations from `gpt-4o` to `gpt-5.6-sol`, the current resolved flagship GPT-5.x target at implementation time.
- Preserved all previously saved/environment model IDs and removed allowlist assumptions.
- Added provider model listing, exact validation, manual future-model entry, and actionable unsupported-model errors.
- Updated Chat Completions to use `max_completion_tokens`, with a narrow `max_tokens` retry for older compatible endpoints.
- Added an automatic FORGE philosophy system frame before every user prompt.
- Added priority/budget-based evidence assembly from architecture/project documents, metadata/goals, Git status/history, relevant or changed source snapshots, package metadata, file inventory, and retrieved memories.
- Bounded prior messages separately so each thread maintains continuity without allowing unbounded context growth.

### Future extension points

- Added provider-neutral interfaces for context sources and budgeting, architectural memory, project timeline, AI diff review, context inspection, intent navigation, and the composed workspace-intelligence boundary.
- Deferred implementations intentionally; these contracts establish architectural seams without claiming incomplete features.

### Files and subsystems affected

- `packages/storage`: schema, migration, threads, workspace state, and layout.
- `packages/ai`: provider model operations, context assembly, Agent framing, and intelligence interfaces.
- `packages/ipc`: typed layout, model, conversation, and context-source channels.
- `apps/desktop/src/main`: secure settings and workspace-bound orchestration.
- `apps/desktop/src/renderer`: resizable layout, model controls, memory, and conversation UX.
- Tests, ESLint configuration, CI validation, environment example, and all affected product/developer documentation.

### Validation and tradeoffs

- Repaired the memory test so it uses an isolated temporary workspace instead of the repository's live `.forge` database.
- Added storage isolation/clear-preservation tests and AI context/provider tests.
- Added the missing ESLint 9 flat configuration and included lint in the release workflow.
- Passed typecheck, lint, all 14 test files/30 tests, and the production Electron build before packaging.
- Built the current ARM64 macOS app, DMG, ZIP, and update blockmaps with Electron Builder 26.15.3. Packaging passed; signing remained unavailable because no Developer ID identity is configured.
- Initial smoke-start exposed a blank white window. Chrome DevTools Protocol network evidence showed `http://localhost:5173/` returned 404 because Electron Vite's renderer root pointed at `apps/desktop` instead of `apps/desktop/src/renderer`.
- Corrected the renderer root, then verified Vite connected, React mounted one root child, and the window rendered the FORGE header and welcome content. The previous missing-native-Electron blocker is also no longer present.
- Character budgeting is deterministic and provider neutral but is not yet token aware.
- Memory reindex deduplication, embeddings, persisted hybrid search, signed update validation, and renderer sandbox hardening remain deferred.

### GitHub delivery and v1.0.0 asset refresh

- Committed the implementation as `d5458db` and the synchronized documentation/tooling as `7f8bd85` on `agent/workspace-context-architecture`.
- Pushed the feature branch and opened draft pull request #7 against `main`.
- Built the universal DMG and ZIP and verified the executable contains `x86_64` and `arm64`; ZIP integrity passed.
- Verified the universal packaged app reaches a complete document, mounts React, and renders FORGE from a `file://` URL inside `app.asar`. Vite remains a compile-time tool only; the release does not use localhost.
- Replaced all five assets on the existing GitHub v1.0.0 Release at the user's direction: DMG, ZIP, both blockmaps, and `latest-mac.yml`.
- Confirmed every remote asset SHA-256 digest matches the corresponding local artifact and updated the published release notes.
- Documented the same-version limitation: existing 1.0.0 installs require one manual DMG replacement because update comparison cannot treat another 1.0.0 build as newer. Future automatic-update releases must increment the version.

## 2026-08-05 — Version 1.0.0 release preparation

### Repository audit

- Confirmed `main` started clean at `6d5bef6` and matched `origin/main` before work.
- Verified the old `dist_electron` package was version 0.1.0, ARM64-only, ad-hoc signed, and not installed in `/Applications` or `~/Applications`.
- Found and corrected shell heredoc text accidentally committed inside `.gitignore`.
- Found placeholder GitHub publisher and Apple signing values in `package.json`.
- Confirmed the Electron npm package initially lacked its native `Electron.app`; restored it with Electron's installer.
- Confirmed no valid Apple code-signing identity is installed on this Mac.

### Packaging and update workflow

- Set the application and desktop package versions to 1.0.0.
- Set product name `FORGE`, bundle ID `com.kaeganscott26.forge`, repository metadata, deterministic artifact names, and GitHub publisher coordinates.
- Added `electron-updater` and typed update IPC for status, checks, installation, and opening the latest release.
- Added title-bar update and release controls.
- Added in-app AI and GitHub settings with masked status, save/remove controls, and connection tests.
- Stored API and GitHub secrets outside projects using asynchronous Electron `safeStorage` backed by macOS Keychain.
- Routed HTTPS GitHub pull/push credentials through an ephemeral `GIT_ASKPASS` environment without modifying remote URLs.
- Added `npm run install:mac` to rebuild, update an existing app bundle in place, and reopen it without an uninstall.
- Added current-architecture, universal, local-install, and GitHub-publish scripts.
- Replaced the push-on-every-commit packaging workflow with validation, manual artifact, and version-tag release paths on Node.js 22.
- Enabled ASAR packaging and preserved unsigned local/release fallbacks.
- Upgraded Electron Builder to 26.15.3 to remove high and critical release-toolchain advisories.
- Pinned Monaco Editor 0.53.0 with DOMPurify 3.4.13 after the newer Monaco dependency line introduced sanitizer advisories; final `npm audit --omit=dev` reports zero vulnerabilities.

### Application icon

- Replaced the previous icon with a generated 1024×1024 FORGE mark.
- Design: a forged-metal F/anvil, layered code documents, and connected memory nodes in charcoal, molten amber, and cyan.
- Removed the old generated iconset and ICNS source; Electron Builder now derives the packaged ICNS from `ForgeIcon-1024.png`.

### Configuration and documentation

- Rewrote README as the product, installation, update, build, release, privacy, and documentation entry point.
- Added `UserManual.md`, `UserConfig.md`, `.env.example`, `.nvmrc`, and this developer log.
- Updated the OpenAI provider to honor `OPENAI_BASE_URL` and `OPENAI_MODEL` in addition to `OPENAI_API_KEY`.
- Sanitized rendered Markdown with DOMPurify and pinned Monaco's nested sanitizer to the patched release.
- Replaced the stale project-status report with the 1.0.0 release state.

### Stale repository content removed

- Removed the tracked Obsidian workspace and third-party plugin bundles.
- Removed Perplexity/reference prompts, incomplete Markdown code fragments, obsolete root architecture notes, and the old build continuation prompt.
- Removed the unrelated `zz-cf-lib` templates.
- Removed the duplicate `docs/USER_GUIDE.md` in favor of the root user manual.
- Removed the old iconset and ICNS artifacts.
- Preserved `.forge/metadata.sqlite` because it is ignored local user data.

### Validation record

- Baseline typecheck passed.
- Baseline production source build passed.
- Baseline test suite initially passed 20 of 21 tests because the current macOS session returned `EMFILE` even in a standalone Node watcher probe. The watcher now falls back to polling when native watcher allocation is exhausted.
- Final test suite passed all 12 test files and all 21 tests with the fallback in place.
- FORGE 1.0.0 ARM64 DMG and ZIP built successfully with Electron 43.3.0.
- Final universal DMG and ZIP built with Electron Builder 26.15.3 and passed DMG checksum, ZIP integrity, update-feed checksum, and Intel/Apple Silicon architecture checks.
- `npm run install:mac` updated and opened `~/Applications/FORGE.app`; the final installed bundle matches version 1.0.0 and `com.kaeganscott26.forge`.
- Settings-enabled installed app remained running; the generated Git ask-pass helper is mode `0700`, contains no credential, and the encrypted settings file is deferred until the first user save.
- Packaged metadata verified: product name FORGE, version 1.0.0, bundle ID `com.kaeganscott26.forge`, custom `icon.icns`, and embedded `app-update.yml`.
- Apple Developer ID signing and notarization remain unavailable until real credentials are configured.

### Custom icon generation prompt

Create a premium macOS icon for a local-first AI-native developer workspace. Combine an abstract forge/anvil with layered code documents, connected memory nodes, and a geometric F. Use a charcoal forged-metal base, molten amber core, restrained cyan accents, strong small-size silhouette, no text, no watermark, and no Electron atom logo.

## 2026-08-05 — Version 1.0.0 publication

- Committed release preparation as `86ed05c` and pushed it directly to `main`.
- Created and pushed the annotated `v1.0.0` tag.
- GitHub Actions passed dependency installation, typechecking, all 21 tests, the production build, and unsigned universal macOS packaging.
- Published the universal DMG, ZIP, update feed, and blockmaps to the public GitHub Release.
- Electron Builder's parallel publishers initially created two release records for the same new tag. Consolidated the assets into release `365969109`, removed only the accidental duplicate record, regenerated the DMG blockmap from the exact published DMG, and applied `RELEASE_NOTES.md`.
- Changed the workflow to create or update one tag release before Electron Builder starts parallel asset publication, preventing the race on future tags and making reruns idempotent.
- Committed the serialized release fix as `eb71e05`, reran the original tag workflow, and confirmed attempt 2 completed successfully with all five assets replaced as one matching publication set.
- Confirmed the first release is public at `https://github.com/kaeganscott26/FORGE/releases/tag/v1.0.0`.
