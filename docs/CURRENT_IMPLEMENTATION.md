# Current FORGE Implementation

This is a source-oriented inventory for the `2.5.0-beta` line, reconciled on 2026-09-28 against the current working tree.

## Desktop boundary

- `apps/desktop/src/main/index.ts` composes workspace, Git, storage, intelligence, semantic indexing, tasks, tools, shell/terminal, Browser, FORGE Live, settings, runtime profiles, updater, and typed IPC.
- `apps/desktop/src/preload/index.ts` exposes only allowlisted typed IPC and event subscriptions.
- `apps/desktop/src/renderer` owns the React/Monaco interface and has no direct Node.js access.
- Folder selection returns canonical `WorkspaceInfo`; the renderer re-reads `workspace.info` if a successful open loses its payload.

## Workspace data

`<workspace>/.forge/metadata.sqlite` stores workspace-owned conversations, goals, persistent tasks/steps/checkpoints/events, durable memory, layout, Browser bookmarks/history, project observations, semantic index state/records, and action records. Schema v10 removes legacy approval-era shapes while preserving execution and task links. Corrupt primary databases may recover from a verified backup while preserving the original file.

## Intelligence and agents

- `@forge/intelligence` assembles provider-neutral, bounded, authority-ordered context.
- Current source/Git/task/tool evidence outranks semantic and historical memory.
- Semantic embeddings and event-driven indexing default on; a configured provider is required for vectors, and failure injects no semantic evidence while leaving ordinary tools operational.
- Native FORGE runs the current agent loop. It is bounded by elapsed runtime and suppresses only redundant identical calls against unchanged observed workspace state.
- `@forge/agent-runtime` detects Hermes and skills but keeps Native FORGE active without a compatible structured execution bridge.
- The shared renderer uses a bounded Three.js aurora, bundled typography, animated glass surfaces, opt-out sounds, reduced-motion handling, and typed live context/memory/process telemetry without granting Node.js authority to the renderer.

## Tools

`@forge/tool-runtime` owns definitions/contracts, schema validation, execution context, cancellation, and result shapes. `@forge/agent-tools` supplies implementations for policy-scoped files/shell paths, Git, terminal evidence, Browser/web, GitHub, tasks, and durable memory. Settings persist Disabled/Controlled/Allow All, filesystem/network scopes, process timeouts, and indexing behavior. Tooling renders the live registry catalog and generic schema runner.

The retired per-call approval queue/session-grant layer remains absent; persisted mode/scope policy is enforced at ToolRouter. Audit rows use execution states such as requested, running, succeeded, failed, cancelled, and validation-failed. Task redirects persist as task events until consumed at a safe agent continuation boundary.

## Platform services

- Terminal chooses native shell arguments per platform and carries a small non-secret environment.
- FORGE Live serves contained workspace files only on loopback and reuses Browser navigation policy.
- FORGE-OS integration is gated to Linux/FORGE-OS runtime conditions; Windows and macOS do not inherit Linux service behavior.
- Update discovery applies Stable/Beta semantic policy before configuring Electron Updater.

## Packaging

Every native package stages `build/forge-runtime.json`, embeds source commit/build date/version, writes `dist_electron/build-manifest.json`, and verifies artifact topology, hashes, architecture, updater metadata, executable, and `app.asar`. Windows and macOS install scripts select the manifest artifact and verify the installed runtime; Linux packaging verifies AppImage/DEB output for its native runner.

Generated `apps/desktop/out` and `dist_electron` files are evidence only, never source authority.
