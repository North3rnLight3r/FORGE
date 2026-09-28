# FORGE User Configuration

This guide describes the current `2.5.0-beta` settings contract. Settings are application-global and stored under Electron's platform user-data directory, not inside a workspace. Workspace state remains in `<workspace>/.forge/metadata.sqlite`.

## Inference provider

| Setting | Default | Rules |
| --- | --- | --- |
| API base URL | `https://api.openai.com/v1` | HTTPS is required remotely; HTTP is allowed only for loopback hosts. Embedded credentials are rejected. |
| Model | `gpt-5.6-sol` | Editable; refresh lists provider models and validate checks an exact ID. |
| API key | none | Required by most remote providers; loopback providers may be keyless. |

Environment fallbacks are `OPENAI_BASE_URL`, `OPENAI_MODEL`, and `OPENAI_API_KEY`. Saved values take precedence. GPT-5.6 tool-capable requests use the Responses API path; compatible models may use Chat Completions. Provider transport does not change the ToolRouter contract.

## Credentials

Inference, embedding, and GitHub tokens are encrypted with Electron `safeStorage`. On macOS this is backed by Keychain; Windows uses the available OS protection. FORGE refuses to save a secret when asynchronous secure storage is unavailable.

Secrets are never stored in `.forge`, provider-visible tool arguments, Git URLs, action-log payloads, or generated documentation. The Git askpass helper reads credentials only from the environment of the Git operation.

## Web research and GitHub

Web Research is off by default and has no environment-variable bypass. Enabling it makes bounded public-web tools available to the agent. URL parsing, DNS/redirect checks, protocol restrictions, response limits, and redaction remain enforced. Workspace files are never uploaded automatically.

GitHub username/token settings support authenticated Git operations and configured GitHub tools. Remove the token to make those authenticated capabilities unavailable.

## Semantic context

| Setting | Default |
| --- | --- |
| Enabled | `true` unless explicitly disabled |
| Provider | OpenAI-compatible |
| Base URL | `http://127.0.0.1:11434/v1` |
| Model | `qwen3-embedding:0.6b` |
| Context budget | `32000` tokens; allowed range `4000`–`128000` |

Environment fallbacks are `FORGE_EMBEDDING_BASE_URL`, `FORGE_EMBEDDING_MODEL`, and `FORGE_EMBEDDING_API_KEY`. Enabling embeddings does not make them authoritative: current source, Git, tasks, and explicit tool evidence remain higher priority. Index refresh runs on workspace/file/task/memory changes while Auto Index is enabled; failures are reported and Auto Repair can attempt one bounded rebuild.

Use **Refresh provider models**, **Validate embedding model**, and **Rebuild semantic index** after changing the endpoint or model.

## Agent runtime

- **Native FORGE runtime** is the default and current execution path.
- **Hermes when its headless bridge is available** stores a requested profile, optional executable/command, and optional HTTPS-or-loopback endpoint.

Hermes availability alone does not activate it. FORGE requires a reachable, compatible structured bridge; otherwise Native FORGE remains active. Skill roots are discovered progressively from workspace/repository locations, configured Hermes roots, and the Linux system root where applicable. Skill bodies are not injected into every turn.

`FORGE_AGENT_MAX_RUNTIME_MS` may bound a Native FORGE run between one minute and one hour; the default is 15 minutes. There is no small fixed tool-call or continuation-round limit. Repeated identical calls against an unchanged observed workspace revision are suppressed as lack of progress.

## Update channel

- **Stable** (default): strictly newer stable semantic versions only.
- **Beta**: strictly newer beta, release-candidate, or stable versions; alpha versions are rejected.

Legacy `preview` values normalize to `beta`. Both channels reject equal versions, downgrades, drafts, malformed versions, unsupported prerelease identifiers, unsafe release data, and missing updater metadata.

## Tool execution

**Settings → Tooling and autonomy** stores Disabled, Controlled, or Allow All execution; Workspace, Repository, Project Tree, Home, or Full user-accessible filesystem scope; separate Web, Git, Package Manager, and General Network capabilities; process mode/timeouts; background-task, continuation, and argument-repair preferences; and auto-index/repair toggles. Controlled allows reads; Allow All authorizes mutations/processes inside selected scopes without repeated prompts. OS account permissions remain authoritative.

Tool definitions declare semantic inputs, side effects, scope, timeouts, audit behavior, network capability, cancellation, and result bounds. The Tooling panel reads the live registry catalog, shows unavailable reasons and schemas, runs capabilities through the audited ToolRouter, supports cancellation/Stop All, and displays persistent action history.

## Files not to commit

Do not commit application state or generated artifacts unless a release procedure explicitly requires a staged metadata file:

- `.forge/`
- `.obsidian/`
- `dist_electron/`
- `apps/desktop/out/`
- local settings, caches, logs, or decrypted credentials

See [Tool Security](docs/TOOL_SECURITY.md), [Semantic Context](docs/SEMANTIC_CONTEXT.md), and [Release Channels](docs/RELEASE_CHANNELS.md).
