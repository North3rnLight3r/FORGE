# FORGE Architecture

## System intent

FORGE is a local-first workspace runtime. The project folder—not a provider, model, or chat transcript—owns source, documentation, Git chronology, tasks, conversations, durable memory, and execution evidence.

```text
workspace files + Git + tasks + memory + observations
                           │
                           ▼
                 FORGE Intelligence
          bounded context + authority ordering
                           │
                           ▼
              Native FORGE / adapter
                           │
                           ▼
                  FORGE ToolRouter
       files · Git · shell · tasks · web · GitHub
                           │
                           ▼
       structured results + events + SQLite evidence
```

The Electron main process owns privileged operations. Preload exposes a typed allowlist. The sandboxed renderer owns presentation and never receives raw Node.js, filesystem, shell, credential, or network APIs.

## Ownership boundaries

- **WorkspaceService** owns the opened root and contained file behavior.
- **StorageService** owns `.forge/metadata.sqlite` and atomic persistence.
- **Workspace Intelligence** collects and ranks evidence without requiring a completion.
- **Agent runtime** reasons over a FORGE context packet and requests semantic tools.
- **ToolRouter** normalizes and validates provider calls, applies persisted execution/network/filesystem policy, invokes services, bounds results, supports cancellation, and records outcomes.
- **Platform adapters** implement native terminal, packaging, updater, and FORGE-OS differences without changing the shared workspace contract.

Conversation deletion never silently deletes files, Git, tasks, memory, or semantic records. A provider switch does not change workspace ownership.

## Package map

| Package | Responsibility |
| --- | --- |
| `@forge/workspace` | Root-confined files, metadata, previews, and watching |
| `@forge/git` | Repository inspection and mutations |
| `@forge/storage` | SQLite schema, persistence, recovery, and workspace records |
| `@forge/intelligence` | Context compilation, semantic indexing/retrieval, health/provenance |
| `@forge/ai` | OpenAI-compatible transport and current Agent compatibility |
| `@forge/agent-runtime` | Runtime profiles, Hermes detection/fallback, skill discovery |
| `@forge/tool-runtime` | Tool contracts, validation, context, cancellation, result types |
| `@forge/agent-tools` | Tool definitions, router, service execution, audits, rollback metadata |
| `@forge/tasks` | Durable task state and reconciliation |
| `@forge/memory` | Durable knowledge classification/retrieval |
| `@forge/shell` | Shell/background processes and PTYs |
| `@forge/web` | External HTTP controls |
| `@forge/forge-live` | Contained loopback preview |
| `@forge/os-integration` | Linux/FORGE-OS platform behavior |
| `@forge/updater` | Provider-neutral release eligibility/discovery |
| `@forge/ipc` | Shared renderer/main contracts and runtime events |

## Intelligence authority

Context is bounded and ordered. Explicit tool results, current file content, Git state, task/checkpoint evidence, and recent observations have higher authority than optional semantic matches or durable historical memory. Semantic retrieval validates current source paths/revisions and fails closed to an empty semantic contribution.

The default 32,000-token context budget is configurable. Semantic context and auto-indexing default on; vector creation requires a working OpenAI-compatible embedding provider. Failures are represented in index state and runtime events, with optional bounded automatic repair.

## Agent runtime

Native FORGE performs inspect, request, observe, and continue cycles. It has no small fixed call/round ceiling; elapsed runtime and progress-aware unchanged-state duplicate suppression bound a run. Runtime events are operation notifications with workspace identity, never hidden reasoning.

Hermes detection, endpoint reachability, profile resolution, and progressive skill metadata discovery exist. Hermes is not activated merely because its executable is present. A compatible bridge must accept FORGE context, expose ToolRouter as the only tool surface, stream structured events, and leave workspace/storage/credential ownership in FORGE.

## Tool execution and safety

Execution mode and filesystem/network scope are persisted user settings. Disabled exposes no tools; Controlled exposes read operations and rejects mutations/processes; Allow All authorizes registered capabilities within selected filesystem and network scope without repeated prompts. Provider-authored internal IDs, task links, and reasons are discarded or replaced by FORGE-owned execution context. The Tooling UI consumes the ToolRouter capability catalog and generic schema runner rather than maintaining a second tool list.

Filesystem scopes are Workspace, Repository, Project Tree, Home, and Full user-accessible filesystem. Requested paths are canonicalized through realpath (including symlink targets) and checked against the configured scope; shell cwd uses the same policy after ToolRouter authorization. OS permissions remain authoritative. Safety/resource boundaries also include schema/size limits, exact executable/argument arrays, filtered environments, URL/DNS/redirect validation, network-capability declarations, timeouts, cancellation, process-tree termination, atomic file replacement, collision refusal, backup/rollback metadata, dirty-editor protection, bounded/redacted output, and execution-state audits.

The principle is **bound resources, not agency**.

## Persistent tasks and recovery

Tasks, steps, dependencies, attempts, checkpoints, artifacts, process observations, events, and audit references belong to the workspace. Resume begins by reconciling current Git/files/processes/external evidence with the last verified checkpoint. Missing evidence does not become success, and another model's statement is not a checkpoint.

## Platform identity

Runtime parity means shared source commit, version, behavior, UI contract, and provenance—not byte-identical native binaries. Each platform records and verifies its own executable and `app.asar` hashes:

- Linux: AppImage/DEB and FORGE-OS runtime contract;
- macOS: universal DMG/ZIP and installed bundle/session launcher;
- Windows: x64 NSIS, native `node-pty`/ConPTY resources, installed executable and `app.asar`.

`forge-runtime.json` and `build-manifest.json` bind artifacts to source commit and build date.

## Source authority

1. Source under `apps/`, `packages/`, and `scripts/`.
2. Current root and active `docs/` documentation.
3. Package configuration and CI workflows.
4. Generated artifacts only as validation evidence.
5. `docs/archive` only as historical evidence.
