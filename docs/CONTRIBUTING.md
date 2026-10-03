# 🤝 Contributing to FORGE

FORGE is an open-source experiment in durable, model-flexible developer workspaces. Contributions should strengthen the workspace rather than attach the product to one provider, one chat format, or one opaque remote state store.

## 🧭 Before you start

Read [Workspace Philosophy](PHILOSOPHY.md), [Architecture](ARCHITECTURE.md), and [Tool Security](TOOL_SECURITY.md). They define the product boundaries that code changes must preserve.

Good contribution questions include:

- Does this make the project easier to understand across agents and time?
- Does it preserve the project folder as the source of truth?
- Does it keep model authority separate from workspace authority?
- Does it make a developer workflow clearer, safer, or more verifiable?

## 🛠️ Local setup

Requirements: Node.js 22 LTS, npm, Git, and Windows x64, macOS 12+, or Linux x64 for the corresponding native desktop runtime.

```sh
nvm use
npm ci
npm run dev
```

Use `npm run start-renderer` only for focused renderer work. It does not exercise packaged Electron IPC, preload boundaries, or native terminal behavior.

## 🧪 Verify your change

Run the source gate before asking for review:

```sh
npm run typecheck
npm run lint
npm test
npm run build
git diff --check
```

Run packaging only when the change affects build output, the main/preload process, native dependencies, local lifecycle behavior, or a release workflow:

```sh
npm run package:macos
node scripts/verify-build-manifest.mjs
npm run install:macos
forge-session --runtime-info
```

Native packaging procedures are documented in [Native packaging](PACKAGING.md). Run the canonical npm target for the target platform on that platform:

```sh
npm run package:macos
npm run package:linux
```

```powershell
npm run package:windows
```

Windows and Linux artifacts require native Windows/Linux runners because `node-pty` is native. Packaging artifact verification does not replace a packaged-runtime acceptance pass.

Do not claim a packaged-runtime behavior from source-level tests alone. Test the packaged app separately when the change affects IPC, terminal sessions, local update/install behavior, application identity, or macOS behavior.

## 🧱 Work with the architecture

- Keep UI code in `apps/desktop/src/renderer` and privileged behavior in the Electron main process or reusable packages.
- Keep IPC typed and allowlisted; never add a generic Node or shell bridge.
- Use dependency injection and narrow contracts in reusable packages; avoid process-wide mutable singletons and circular ownership.
- Treat model output, renderer input, terminal output, Git metadata, and web content as untrusted.
- Keep normal file operations workspace-contained and preserve rollback, validation, cancellation, redaction, and audit semantics for all actions.
- Keep provider adapters replaceable. Task ownership, execution context, validation, and ToolRouter semantics cannot depend on a provider-specific protocol.

## 📝 Update the documentation

Documentation should lead the next human or agent to the right evidence. Update it with the code when a change affects:

- product philosophy or supported workflows;
- architecture, storage ownership, IPC, or security boundaries;
- terminal behavior or CLI-agent guidance;
- user configuration, releases, packages, or update policy;
- a current limitation, validation result, or release identity.

Use clear emoji-led top-level sections for developer-facing guides, keep paragraphs short, and label historical material instead of silently modernizing it. Add new entry points to the [documentation index](README.md).

## 🔐 Secrets and safety

Never commit API keys, tokens, certificates, `.env` files, local workspace databases, generated package artifacts, or personally sensitive terminal output. Do not bypass runtime validation, workspace containment, or execution logging to make a demo easier.

## 📦 Releases and external writes

Commits, pushes, pull requests, tags, releases, publication, installation, and external web actions are intentional operations. Read [Releasing FORGE](../RELEASING.md) before preparing a release. Verify exact source/tag/artifact provenance; do not replace same-version artifacts or move an already published tag.
