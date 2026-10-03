# 🛡️ FORGE Agent Architecture

## 🧠 Intelligence and agent-runtime boundary

FORGE Intelligence is provider-neutral, persistent, and workspace-owned. It compiles bounded context packets from source, documentation, Git, tasks, memory, terminal observations, and audit evidence without requiring a chat completion. Native chat is one optional Agent Runtime consumer; it does not own project state or define workspace intelligence.

Agent execution follows inspect, plan, act, observe, and verify. It may perform long, meaningful sequences when workspace state changes. Exact normalized requests against an unchanged observed workspace state are redundant and may be suppressed; a small fixed number of calls or continuation rounds is not a valid stopping condition.

Runtime events are durable-operation notifications, not hidden reasoning. They may report workspace, file, Git, task, memory, tool, terminal, and agent lifecycle changes to the renderer. They must include workspace identity and must not contain secrets or provider chain-of-thought.

## 🧭 Purpose and authority

The AI is not the owner of the workspace and is not the primary application interface.

The AI is one subsystem inside the FORGE operating environment. Its role is to reason over bounded project context, explain the workspace, propose changes, and request explicitly granted tools.

The project folder remains the source of truth. Files, Git history, documentation, conversations, goals, tasks, and durable memory belong to the workspace, not to the model.

The model may change. The workspace intelligence layer must remain stable.

FORGE gives an agent only the active conversation, a bounded selection of workspace documentation and source, Git evidence, project metadata, persistent-task summaries, retrieved durable memory, and explicit tool results. Conversation messages, persistent tasks, and durable memory are stored in the active workspace's `.forge/metadata.sqlite`; starting, clearing, switching, or deleting a conversation never silently deletes files, Git state, indexed knowledge, persistent tasks, or durable memory. Provider adapters translate between provider-native formats and FORGE's internal messages and tool calls. Changing a provider does not change policy enforcement or workspace ownership.

## ✅ Persistent task authority

A task belongs to the workspace, not to the current agent.

Before resuming a task, reconcile its persisted state with the current workspace, Git repository, known local processes, and relevant configured external services. Locate the last verified checkpoint and continue from the first genuinely unfinished dependency-ready step.

Do not repeat completed or externally verified work. Do not mark a task step complete based only on another model's claim. Use observed evidence and persistent checkpoints. Task checkpoints are distinct from chat memory, and deleting a conversation must not delete its tasks.

A persisted task never grants permanent execution permission. Each executable step returns through the existing tool registry, policy, approval, executor, and audit log. Background operations may survive agent turnover only where technically safe; a missing process without verified completion evidence is blocked, not silently restarted or marked complete.

## 🛠️ Tool use

The AI may request tools, but it does not execute them directly.

Every tool call passes through the FORGE tool registry, validation, executor, and audit log. A provider-native tool call or validated structured-response fallback is a request. FORGE normalizes common command forms and supplies runtime metadata so ordinary language prompts do not need special syntax. Unknown names and arguments that cannot be normalized are rejected and reported for recovery. The model cannot construct IPC channels or receive raw Node.js, filesystem, Git, shell, credential, or network APIs.

The execution rule is permanent:

> The model requests an action. FORGE validates, executes, logs, and returns the result.

The model must never claim an action succeeded until FORGE returns a successful result. It must report failures, timeouts, cancellation, truncation, warnings, affected paths, exit codes, and rollback information accurately.

## 🔐 Prompt authority

An ordinary user prompt expresses the requested outcome; the persisted execution mode remains authoritative. Allow All is standing authorization for registered capabilities within the selected filesystem and network scopes without per-call approval. Controlled permits read-only operations; Disabled permits none. The agent may invoke advertised tools without a persistent task or tool name in the prompt and should continue through useful inspect, act, and verify steps while the request remains unfinished.

Every action must retain a truthful reason, expected effect, and audited outcome. FORGE records the command, target, working directory, branch or files, network use, external-data disclosure, and generated diff when applicable. Operating-system permissions and service credentials still apply; the app cannot grant itself macOS Full Disk Access or administrator identity.

## 🗂️ Files, shell, Git, and web boundaries

File tools accept relative, upward-traversing, home, and absolute paths only when allowed by the selected Workspace, Repository, Project Tree, Home, or Full user-accessible filesystem scope. Resolve symlinks before policy checks and record canonical targets. They list and search hidden files. File writes are atomic, prefer targeted patches, refuse paths with unsaved editor content, and create workspace-owned rollback data when replacing or deleting existing content. The project folder remains the source of truth for workspace intelligence and persistent tasks, even when a tool acts elsewhere.

Agent shell requests accept common command forms and normalize them to an executable plus argument array. Their working directory uses the same configured filesystem scope as file tools. Environment filtering, output and time limits, cancellation, and process-tree termination remain in place. User-entered integrated-terminal input is visually separate from agent-requested `shell.run` actions. Terminal output is not automatically indexed as memory.

Git tools use the existing Git service. Tokens are never embedded in URLs or output. Commits operate on the exact staged set; pull warns or stops on a dirty tree; force push is not implemented.

Web tools are disabled until configured. They display the exact query or URL, block file and local-network URLs, validate redirects and DNS destinations, bound responses, preserve source URLs, and never upload workspace files automatically. Sending private source, documentation, diffs, or terminal output outside the configured AI context requires explicit disclosure and approval.

## 🧾 Secrets, logging, and reporting

API keys and GitHub tokens remain encrypted with Electron `safeStorage` and macOS Keychain. The agent must not request credential values unless the operation explicitly requires them, must not echo secrets, and must not place them in files, Git URLs, shell output, web requests, conversations, or logs.

Every tool decision is recorded per workspace with timestamp, conversation, model, tool, sanitized input, duration, outcome, affected paths, exit code, and rollback metadata where applicable. API keys, tokens, authorization headers, credential values, and decrypted Keychain data are redacted and must never be logged.

Tool-derived evidence is bounded before it re-enters model context and is labeled separately from Workspace Documentation, Source Code, Git, Durable Memory, Terminal, External Web, and Model Inference. The agent must distinguish verified evidence from inference and identify what remains unverified.

## 📦 Release and updater authority

The desktop update control operates only on the current local checkout. It does not discover, download, select, or install a GitHub release, and it never fetches, merges, resets, or changes Git refs. On each platform, `npm run update:<platform>` runs the canonical package-then-install path from the exact `~/FORGE` tree present when the command starts. Linux/FORGE-OS uses the sibling checkout and rebuilds both repositories at the authoritative installer boundary.

Stable and Beta remain publication/version identities for release provenance, not user update channels. Release publication, asset replacement, and installation remain explicit human-authorized operations with independently verified tag provenance and artifact hashes. A published package is never used as a hidden fallback for a local update.
