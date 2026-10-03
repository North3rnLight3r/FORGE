# FORGE User Manual

This manual describes the current `2.5.0-beta` source line. Published `v2.5.0-beta` packages are available for universal macOS, Windows x64, and Linux x64.

## 1. Open a workspace

Choose **Open workspace** to select a project folder or **Home** to use the platform home directory. FORGE reopens the last successful workspace on launch. It opens the directory in place and creates `<workspace>/.forge/metadata.sqlite` for conversations, tasks, memory, layout, Browser state, context records, and action history.

Opening another workspace stops workspace-scoped indexing, terminal/process services, Browser tabs, and FORGE Live before the new services initialize. If an Electron response payload is dropped after the folder opens, the renderer reloads canonical `workspace.info` instead of switching to a null workspace.

## 2. Explorer and editor

- Expand folders to load their direct children.
- Use **New file**, **New folder**, the Explorer context menu, or keyboard shortcuts to create, rename, copy, paste, and delete entries.
- `Ctrl/Cmd+O` opens a workspace; `Ctrl/Cmd+S` saves; `F2` renames; normal Monaco undo/redo shortcuts apply.
- Text files open in Monaco. Markdown supports Edit and Preview. Images, audio, and video use bounded media previews. Binary and executable files show metadata rather than editable text.
- The Explorer shows hidden files by default. Use **Hidden** to toggle them. Protected or vanished paths are skipped when appropriate rather than failing the entire workspace.

Explorer and editor operations remain rooted in the selected project. Agent `file.*` tools can use absolute, home, parent, and hidden paths outside that project.

## 3. Source control

The Source Control panel shows the active branch and changed files. Select a change to stage it and inspect the parsed diff. Enter a message to commit the exact staged set. Pull and Push use the configured repository remote and host credentials.

These operations affect the real repository. Review the branch, staged files, and diff before acting.

## 4. Conversations and context

Configure an OpenAI-compatible inference endpoint and model in **Settings**. Remote endpoints require HTTPS and normally require an API key. Loopback HTTP endpoints such as Ollama are allowed and may be keyless.

FORGE builds a bounded context packet from current documentation, source, Git, tasks, observations, and durable memory. Explicit tool results and current workspace evidence have higher authority than semantic or historical matches. Conversation changes do not delete files, tasks, memory, or Git state.

## 5. Agent execution and Agent Actions

Native FORGE is the active runtime unless a requested Hermes profile has both a reachable endpoint and a compatible structured bridge. Current Hermes support detects the CLI/endpoint and discovers skill metadata; it does not hand Hermes raw filesystem or shell authority.

The agent accepts ordinary requests; do not write tool names or JSON. For example: “Read `./references.txt`, preserve its text, reformat it as readable Markdown in `references.md`, verify the new file, then remove the original.” FORGE offers registered tools to the model, repairs deterministic argument conflicts, validates the call, executes it under the selected policy, and returns observed results. Review the result before asking it to continue if a step is destructive.

Open **Settings → Tooling and autonomy** to choose:

- **Disabled** hides and rejects agent tool execution.
- **Controlled** permits read-only tools; mutations, processes, and network writes require switching to **Allow All**.
- **Allow All** authorizes registered operations within the selected filesystem scope and enabled network capabilities without per-action confirmation. Auditing, cancellation, backups, secret redaction, and OS permissions remain active.
- **Filesystem scope** selects Workspace, Repository, Project Tree, Home, or Full user-accessible filesystem. Project Tree requires its root path. Paths and symlinks are resolved before scope checks.
- **Network access** independently enables Web, Git, Package Manager, or General Network. Web research also remains opt-in in Settings. Workspace source is never uploaded to arbitrary services automatically.
- **Process mode** and the timeout settings control local command duration; background process output is stored under `.forge/task-output`.

The **Tooling** view shows the runtime-owned capability catalog, exact unavailable reasons, schemas, live requests, and persistent action history. Select an available capability in **Run / Test Capability** to inspect its schema, supply JSON arguments, execute it through the same audited router, and cancel it while running. **Stop All** cancels active agent tool requests and tracked task processes. A running request also has its own **Cancel** control.

Controls that remain enforced include:

- operating-system file permissions;
- typed schemas and FORGE-owned execution identity;
- exact executable/argument handling and filtered environments;
- URL, DNS, protocol, and configured network-capability checks;
- timeouts, cancellation, process-tree termination, and bounded output;
- atomic writes, collision refusal, backups/rollback metadata, and dirty-editor checks;
- secret redaction, audit history, and progress-aware repeated-call suppression.

Tools execute with the operating-system permissions of the FORGE process. Disable web research, remove credentials, or close FORGE when those capabilities should not be available.

## 6. Persistent tasks

Tasks belong to the workspace and survive conversations and agent changes. A task stores structured steps, dependencies, verification criteria, attempts, checkpoints, artifacts, process observations, events, and audit references.

Use **New task** for a custom workflow or **Release workflow** for a generated release checklist. **Run / Resume Task** reconciles saved state with current Git, files, processes, and external evidence. Missing completion evidence leaves a step waiting or blocked; another model's claim is never sufficient.

Pause, resume, retry, cancel, delete, or copy a handoff from the Tasks panel. To redirect a running task, open **Tooling → Run / Test Capability**, select `task.redirect`, and provide its task ID and the instruction in the JSON arguments; the task stores it until the agent reaches a safe continuation boundary. **Stop All** also cancels tracked task processes. Deleting a conversation does not delete tasks or memory. Deleting a task removes that task and its checkpoints but not project files or Git history.

## 7. Terminal

The Terminal panel creates a real PTY initially rooted in the workspace, and commands may change to any accessible directory. Agent `shell.run` can also use an absolute or parent working directory. Terminal output is not automatically indexed as durable memory.

On macOS, grant the installed **FORGE.app** Full Disk Access in **System Settings → Privacy & Security → Full Disk Access** and relaunch it to reach privacy-protected locations. This is a macOS user setting; FORGE cannot grant it to itself. Full Disk Access does not provide administrator identity or override file ownership and system integrity protections.

FORGE passes a small non-secret environment so common user CLIs can resolve without copying API keys into the PTY. On Windows it uses the native command shell/ConPTY path; on Unix-like systems it uses the configured login-shell behavior. Restart recreates an exited session, and Cancel terminates the process tree.

## 8. Browser and web research

The embedded Browser uses a sandboxed `WebContentsView` for public HTTP(S) pages. Local files, credential-bearing URLs, unsafe redirects, and disallowed local-network destinations are blocked. Tabs, bookmarks, and history belong to the active workspace.

Web research is disabled on a fresh install. When enabled, bounded `web.search`, `web.fetch`, `browser.read`, and `browser.find` evidence may be provided to the configured model. FORGE never uploads workspace files automatically.

## 9. FORGE Live

For a workspace containing `index.html`, choose **Go Live** and then **Open Preview**. FORGE serves contained regular files on loopback, preferring `127.0.0.1:5500` and trying through port 5599. It injects an in-memory reload client into HTML responses and never rewrites source files. Stop Live before changing workspaces or when the preview is no longer needed.

## 10. Semantic context

Semantic context and automatic indexing are enabled by default. Configure an OpenAI-compatible embedding endpoint/model in Settings, validate the model, then use **Rebuild semantic index** if the status is empty or degraded. Defaults are Ollama at `http://127.0.0.1:11434/v1` with `qwen3-embedding:0.6b` and a 32,000-token context budget. A reachable embedding provider is required for semantic vectors; direct file/Git tools still work when embedding is unavailable.

Workspace open, file changes, and task/memory changes refresh the index incrementally while **Automatically index workspace knowledge** is enabled. **Automatically repair a degraded semantic index** permits one bounded rebuild attempt after a reported degraded/rebuild-required state. Check the real record counts, model, dimensions, last index time, and error in Settings → Embedding and semantic memory; refresh and rebuild are separate operations.

## 11. Updates and installation

The update control is source-local. It never queries release channels, downloads a published build, merges a remote ref, or resets your checkout. Pull or switch to the exact source you want first; FORGE packages and installs that current checkout.

Use the **Update from current checkout** control for a verified local build. Windows source updates require FORGE to be closed. See [Packaging](docs/PACKAGING.md) and [Release distribution](docs/RELEASE_CHANNELS.md).

## 12. Troubleshooting

| Symptom | Action |
| --- | --- |
| Workspace remains unopened | Retry **Open workspace**; if the folder opened but metadata was dropped, current builds recover through `workspace.info`. Inspect `.forge/metadata.sqlite` recovery errors if initialization still fails. |
| Git controls fail | Confirm the selected folder is a Git repository and the remote/credentials work outside FORGE. |
| Model is unavailable | Refresh the provider catalog, validate the exact ID, and verify endpoint/key settings. |
| Local model does not call tools | Use the built-in conversation path with a tool-capable OpenAI-compatible model; a raw terminal chat is the model vendor's CLI and has no hidden FORGE bridge. |
| Semantic context is degraded | Validate the embedding endpoint/model or disable semantic context; ordinary workspace tools continue to work. |
| Windows install refuses | Close every FORGE process, then rerun `npm run update:windows` from the checkout you want to install. |
| macOS blocks launch | Verify the package source/hash, then use the normal macOS security UI. FORGE does not clear quarantine or disable Gatekeeper. |

Configuration details are in [UserConfig.md](UserConfig.md). Current capability details are in [docs/AGENT_TOOLS.md](docs/AGENT_TOOLS.md).
