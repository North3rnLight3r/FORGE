# Tool Runtime Reliability and Security

FORGE persists a user-selected execution mode. Disabled exposes no tools; Controlled permits read-only tool effects; Allow All authorizes registered operations within separately configured filesystem and network scopes without per-call authorization. No mode bypasses OS account permissions, asks FORGE to escalate privileges, or authorizes arbitrary external disclosure.

Execution remains constrained by engineering boundaries: provider calls are normalized before schema validation; runtime/task/audit context is injected privately; resolved file and agent-shell paths are checked against Workspace, Repository, Project Tree, Home, or Full user-accessible filesystem scope; tool timeouts, cancellation, and process-tree controls bound execution; writes retain atomic/rollback behavior where supported; and secret values are redacted from conversations and audit records. The model cannot obtain raw Electron, Node, credential, IPC, or filesystem APIs.

The audit log is observability in addition to policy enforcement. It records sanitized request inputs, lifecycle state, duration, outputs, affected paths, exit code, rollback data, model/conversation identity, and task linkage. External web data and browser content remain labeled and bounded before model reuse. Stop All cancels active router requests and attempts to terminate only background processes linked to recorded task shell request IDs; if that linkage is absent, task state is not falsely reported as stopped.

Hermes and every provider use the same `ToolRouter`. Hermes must not expose an independent filesystem, shell, browser, or credential executor inside FORGE; its semantic requests are validated and executed through the shared runtime.
