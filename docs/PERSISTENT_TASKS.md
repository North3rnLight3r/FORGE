# Persistent Tasks

Tasks belong to the workspace, not a conversation, provider, model, or Hermes session. Their state, steps, checkpoints, artifacts, external references, event history, process tracking, and audit linkage live in `.forge/metadata.sqlite`.

When a task resumes, FORGE reconciles the stored task with the workspace, Git state, tracked processes, and supplied external evidence. It continues from the first dependency-ready unfinished step. Valid tool calls execute directly through the shared `ToolRouter`; task progression pauses only when the task completes, is cancelled/paused, becomes genuinely blocked, or needs information the agent cannot determine.

Tasks preserve retries, timeouts, cancellation, verification checkpoints, atomic-write rollback metadata, redirect events, and bounded audit evidence. Redirect instructions remain pending until the active agent consumes them at a safe continuation boundary. Stop All cancels current router requests and terminates background processes only through their recorded shell request linkage. A successful tool result is observed evidence, not automatic proof that a verification criterion is complete.

Schema v10 removes the retired approval queue and task-step approval column when an existing workspace database is opened. Task steps, checkpoints, events, and Agent Actions remain intact as the durable execution history.
