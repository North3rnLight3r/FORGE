# Hermes Runtime Integration

## Ownership

FORGE remains authoritative for the active workspace, `.forge/metadata.sqlite`, durable memory, conversations, tasks, tool execution, audit records, rollback data, and renderer state. Hermes is optional runtime infrastructure: it can provide skills, MCP orchestration, planning, and model-facing behavior only through a FORGE-owned adapter.

## Current implementation

**IMPLEMENTED**

- `@forge/ai` exposes `HermesBridge`, a provider adapter that sends Hermes model requests to Ollama's OpenAI-compatible `/v1` API and normalizes structured tool calls back to FORGE semantic tool names.
- `Agent` adds the shared FORGE intelligence layer to both native and Hermes messages. It carries the same evidence hierarchy, personality, task decomposition, verification behavior, and safety boundary to either model transport.
- `@forge/agent-runtime` probes `GET <endpoint>/models`, activates the HTTP bridge when the endpoint is reachable, and retains native fallback when it is not. A Hermes CLI is optional for version and skill discovery.
- The desktop runtime passes both profiles through the same context compiler, memory retriever, continuation loop, `ToolRouter`, execution policy, audit events, task checkpoints, and cancellation.
- Settings accept `FORGE_AGENT_RUNTIME`, `FORGE_HERMES_ENDPOINT`, `FORGE_HERMES_MODEL`, and `FORGE_OLLAMA_MODEL` environment defaults without putting credentials in a workspace.
- Skills are discovered from `.forge/skills`, repository `skills`, configured Hermes roots, and `/usr/share/forge/skills` only on Linux. FORGE indexes frontmatter metadata; it does not inject every skill body into every model turn.

The bridge deliberately does not start Hermes-native filesystem or shell executors. Those would bypass FORGE's router, validation, execution-context injection, audit log, rollback, cancellation, and visible-browser boundary. Hermes supplies model behavior through Ollama; FORGE remains the only execution authority.

## Bridge contract

The bridge accepts a bounded FORGE context packet and provider-visible semantic tool schemas, sends them to the selected Ollama model, and returns structured assistant text or one normalized tool call. The desktop continuation loop executes that call through `ToolRouter`, records the result, and sends bounded evidence back to the same provider. A missing model, crashed endpoint, malformed tool call, or incompatible response fails closed for that invocation and leaves Native FORGE available.

Required event mapping remains owned by the desktop runtime: planning, tool requested, tool started/completed/failed, step completed, task completed/cancelled, provider changed, and model changed.

## Platform behavior

Detection uses a configured command or `hermes` from `PATH`, and derives the Hermes home directory from `HERMES_HOME` or the current user home directory. It does not use brittle fixed macOS, Windows, or Linux executable paths. Linux-only FORGE-OS skills are gated by `process.platform === 'linux'`; no FORGE-OS service behavior is enabled on Windows or macOS.
