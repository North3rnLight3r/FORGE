# Optional Semantic Discovery

FORGE `2.5.0-beta` keeps semantic embeddings as a discovery assistant, enabled by default unless the user opts out. A reachable configured embedding provider is required to create vectors. Semantic results never replace current workspace tools or deterministic context.

## Authority and routing

Evidence is applied in this order:

1. explicit files or tools requested by the user;
2. direct current source-code Tool Results;
3. current Git state, history, and diff;
4. current task and runtime state;
5. semantic discovery;
6. durable historical memory;
7. model prior knowledge.

Explicit file/Git requests, debugging and regression investigations, and tool continuations skip semantic retrieval. Broad conceptual questions may use it only when deterministic source-path selection found no sufficient direct source evidence. `file.search` is discovery, not proof: investigations continue with `file.read`, caller/test tracing, and relevant Git evidence.

## Bounds and freshness

One query selects 8 results by default and can never exceed 10. Semantic text is capped at 4,000 estimated tokens even when the configured total context window is larger. The total context budget is an upper bound; FORGE normally assembles a much smaller packet.

Results are deduplicated by source path, content hash, overlapping range, and near-identical vector. Current source, configuration, Git, and task evidence have higher packet priority than semantic records. A file-backed record is ignored when its current modification time or size differs from the indexed revision. Durable records are superseded when their task, memory, conversation, or retained tool-action source is deleted. Stale, archived, superseded, partially rebuilt, incompatible, or failed-index records are not injected.

## Index and memory behavior

The workspace SQLite database stores revisioned chunks and Float32 vector blobs. Existing JSON vectors migrate in place. Rebuild writes are grouped into one sql.js persistence export, files are embedded in bounded groups of 32 with embedding batches of 8, and unchanged chunks are reused. Workspace open indexes or verifies the current workspace; file-watch updates are debounced and reindex only changed paths; task and durable-memory changes refresh only durable sources. Auto Index controls those event-driven updates; Auto Repair performs one bounded rebuild after a degraded or rebuild-required result and publishes failures as runtime events.

The default endpoint is Ollama's OpenAI-compatible loopback API (`http://127.0.0.1:11434/v1`) with `qwen3-embedding:0.6b`. Embedding requests are serialized, use bounded timeouts, and share one model session across a rebuild. For local Ollama, FORGE sends an immediate unload at the end of each query, validation, or indexing session so the model does not remain resident while FORGE is idle.

## Failure behavior

Provider or indexing failure marks semantic health degraded, publishes an error event, and injects no cached partial result. Native FORGE, Hermes selection, deterministic workspace context, durable tasks/memory, and ToolRouter continue without semantic context. Semantic indexing is not required for application startup or normal workspace tools.

Run `npm run profile:semantic-memory` with local Ollama available to reproduce the 66-record rebuild, query, unload, direct-workflow, and repeated-cycle memory measurements. `FORGE_PROFILE_ITERATIONS` controls repeated cycles (1–10).
