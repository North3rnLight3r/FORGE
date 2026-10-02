# FORGE Project Status

Last audited: 2026-09-28 · source version `2.5.0-beta` (current working tree; changes remain uncommitted).

## Current source

`main` implements the local-first Electron desktop, provider-neutral workspace intelligence, Native FORGE agent execution, the autonomous ToolRouter, persistent tasks, optional semantic context, a sandboxed Browser, FORGE Live, and coordinated Linux/macOS/Windows packaging.

The published annotated `v2.5.0-beta` tag resolves to `430796e2b4de543f5e9c6b8a8195e407353c9f68`. It adds the living-intelligence UI, complete artifact-packet telemetry, activity indicators and sounds, and retains the 2.4 recovery, bounded-context, and cross-platform packaging work.

## Implemented

| Area | Current behavior |
| --- | --- |
| Workspace | Open project/Home in place, Explorer/editor root confinement, lazy loading, text/media/binary classification, workspace-open null-payload recovery |
| Editor | Monaco text editing, Markdown preview, save/undo/redo, create/rename/copy/delete, dirty-path protection |
| Git | Status, log, branches, diff, stage/unstage, exact-staged commit, pull, and push |
| Storage | Schema v10 workspace SQLite, atomic persistence, verified backup recovery, conversations, tasks, memory, layout, Browser state, observations, semantic records, action history |
| Intelligence | Provider-neutral bounded context, authority/freshness metrics, explicit-evidence priority, default-on semantic retrieval/indexing, visible degradation, and bounded repair |
| Agent runtime | Native inspect/tool/observe/continue loop, deterministic provider argument normalization, structured recovery classes, runtime deadline, and unchanged-state repeated-call suppression |
| Tool runtime | Persisted Disabled/Controlled/Allow All modes, policy-scoped realpath resolution, dynamic capability catalog/schema runner, direct audited execution, cancellation, rollback metadata, and redaction |
| Tasks | Durable definitions, dependencies, checkpoints, redirect events, process reconciliation, retries, pause/cancel, Stop All, and handoffs; not a general cross-restart supervisor |
| Terminal | Cross-platform PTY, filtered non-secret environment, resize/restart/cancel, Windows ConPTY support |
| Browser/web | Sandboxed public HTTP(S) Browser, tabs/bookmarks/history, bounded page reads/finds, URL/DNS/redirect validation |
| FORGE Live | Contained loopback static server, ports 5500–5599, in-memory reload client, Browser preview |
| Runtime profiles | Native active; Hermes command/endpoint detection, reachability, skill metadata, and safe fallback |
| Packaging | Linux AppImage/DEB, universal macOS DMG/ZIP, Windows x64 NSIS, runtime metadata, manifests, hashes, updater YAML, installed-runtime verifiers |
| Living UI | Shared v2.5 identity, bounded Three.js aurora, glass surfaces, reduced-motion support, opt-out sounds, and real context/memory/process telemetry |

## Execution-security state

The old approval queue, grants, risk tiers, and session permissions remain retired. Current policy is persisted as Disabled, Controlled, or Allow All and scopes registered operations; Allow All is standing authorization within selected scope.

Enforced boundaries remain: semantic schema validation, configured filesystem/network scopes after realpath resolution, exact shell arguments, filtered environments, OS permissions, URL/network controls, timeouts, cancellation, process-tree termination, atomic writes and backup/rollback metadata, dirty-editor checks, output limits, redaction, progress-aware loop protection, and durable execution records. The Tooling view covers registered ToolRouter capabilities through a generic runner; complete GUI exposure/coverage for every independent IPC capability across Browser, FORGE Live, FORGE-OS, settings, and updates is still outstanding.

## Published release

[`v2.5.0-beta`](https://github.com/North3rnLight3r/FORGE/releases/tag/v2.5.0-beta) was published on 2026-08-31 with Linux x64, universal macOS, and Windows x64 packages plus updater metadata, blockmaps, `SHA256SUMS`, and a build manifest. GitHub reports it as a non-draft prerelease.

The published macOS package is not claimed as Developer ID notarized, and the Windows package is not claimed as publisher signed. Integrity/provenance and platform signing are separate assertions.

## Known limitations

1. Hermes cannot become the authoritative executor until a tested structured bridge exposes FORGE's ToolRouter as its only tool surface.
2. Semantic discovery requires a separately available OpenAI-compatible embedding provider; the setting defaults on and reports degraded state when the provider is unavailable.
3. Persistent tasks reconcile observed processes and artifacts but do not provide a general cross-restart supervisor for every external operation.
4. Public packages lack established Apple notarization and Windows publisher signing.
5. Post-tag source changes require a strictly newer semantic version and annotated tag before publication.
6. Release verification must continue to check GitHub's prerelease flag independently from the version string.
7. Controlled mode is currently read-only rather than an interactive per-operation approval prompt.
8. Capability coverage is dynamic for registered tools, but a repository-wide automated comparison of every user-operable IPC operation against renderer surfaces has not yet been established.

Validation claims belong in the commit/release evidence that produced them. Historical records are in [`docs/archive`](archive/README.md).
