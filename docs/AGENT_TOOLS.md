# FORGE Agent Tools

FORGE tools are provider-neutral execution capabilities. A model receives only stable tool names and semantic schemas; it never receives an executor, Node API, shell, credential, IPC channel, or internal task metadata.

## Runtime flow

```text
Plain-language request → provider tool call → deterministic normalization
               → schema validation → runtime-context injection → policy/scope check
               → Tool Router → Executor → structured, audited result → agent continues
```

`@forge/tool-runtime` owns registry, validation, request/result contracts, and execution context. `@forge/agent-tools` owns the shared definitions and router. `@forge/shell` owns child processes and PTYs, while `@forge/web` owns configured external HTTP controls. The workspace, Git, task, storage, AI, and IPC packages remain authoritative for their domains.

Execution policy is persisted in Settings. Disabled hides and rejects tools; Controlled exposes and executes read-only operations; Allow All authorizes registered operations within the configured filesystem and network scopes without per-call authorization. OS permissions, schema/path validation, timeouts, cancellation, atomic writes/rollback, secret redaction, loop protection, and audit logging remain in effect.

## Tool metadata

Definitions describe a tool's name, purpose, Zod input/output schemas, side-effect category, workspace relationship, timeout, audit metadata, cancellation behavior, target/effect description, network capability, and bounded-result behavior. The ToolRouter catalog is the source for provider definitions and the Tooling UI. A capability test requires each registered definition to report an executor and be represented in the generic schema runner.

Representative capabilities include bounded file/terminal/Git inspection; atomic file create/write/patch/move/delete operations with rollback metadata; shell and background-process execution; Git mutations; visible browser navigation and interaction; configured web/GitHub operations; and durable task creation, checkpoints, cancellation, and process tracking.

## Context, audits, and recovery

Provider-visible schemas contain only operation arguments. FORGE injects workspace, conversation, model, request, task-step, and audit identity after normalization. Provider-authored `taskContext`, `reason`, and internal identifiers are discarded. Task linkage comes only from the active FORGE task runtime. `file.read` removes redundant offset/line selectors deterministically; empty list/search paths normalize to `.`. No path is invented when a request is ambiguous.

Filesystem scopes are Workspace, Repository, Project Tree, Home, and Full user-accessible filesystem. All file and agent-shell targets are resolved through realpath and checked against the selected scope. Project Tree requires a user-selected root; Repository requires an observed Git root. Network capabilities and process timeouts are separate settings. Tool results/audits identify canonical resolved paths where applicable.

Every execution records sanitized inputs, execution state, duration, result summary, affected paths, exit code, and rollback metadata where relevant. The Tooling panel shows the dynamic capability catalog, per-request cancellation, Stop All, generic Run/Test, and persistent audit history. Background task processes are linked to task steps and can be terminated through their recorded shell request IDs.

Tool results are bounded and redacted before returning to the agent. Missing files, optional executables, page changes, transient network failures, and comparable recoverable errors return structured evidence so the agent can choose another valid action. Unknown tools and invalid schemas fail before execution. Cancellation, timeouts, and progress-aware loop protection prevent runaway work without introducing an approval pause.
