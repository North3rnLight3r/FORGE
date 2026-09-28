# FORGE Documentation

These documents describe current `2.5.0-beta` source behavior unless explicitly marked as historical. Source under `apps/`, `packages/`, `scripts/`, and `.github/workflows/` remains authoritative when documentation and implementation disagree.

## Start here

- [Project README](../README.md) — product overview, installation, development, and documentation map.
- [User Manual](../UserManual.md) — daily desktop use, plain-language agent workflows, policy settings, and troubleshooting.
- [User Configuration](../UserConfig.md) — providers, credentials, execution/scope policy, semantic context, runtimes, and update channels.
- [Project Status](PROJECT_STATUS.md) — current implementation, published-release boundary, and known limitations.
- [Architecture](ARCHITECTURE.md) — ownership, data flow, packages, and runtime boundaries.

## Runtime and capabilities

- [Agent Tools](AGENT_TOOLS.md) — provider-neutral ToolRouter flow and execution records.
- [Tool Security](TOOL_SECURITY.md) — persisted execution policy, filesystem/network scopes, OS boundaries, and audit controls.
- [Tooling Guide](TOOLING_GUIDE.md) — user-facing capability inventory.
- [Persistent Tasks](PERSISTENT_TASKS.md) and [Task Recovery](TASK_RECOVERY.md) — durable execution and reconciliation.
- [Semantic Context](SEMANTIC_CONTEXT.md) — event-driven indexing, embedding health, discovery, and authority ordering.
- [Hermes Runtime](HERMES_RUNTIME.md) — implemented detection/fallback and required bridge contract.
- [Integrated Terminal](TERMINAL.md) — user PTY and agent-process separation.
- [FORGE Live](Architecture/FORGE_LIVE.md) — loopback static preview.
- [Platform Runtime Contract](PLATFORM_RUNTIME_CONTRACT.md) — native platform parity.

## Development and release

- [Contributing](CONTRIBUTING.md)
- [Packaging](PACKAGING.md)
- [Build Artifact Policy](BUILD_ARTIFACT_POLICY.md)
- [Release Channels](RELEASE_CHANNELS.md)
- [Releasing FORGE](../RELEASING.md)
- [Current Release Notes](../RELEASE_NOTES.md)
- [Changelog](../CHANGELOG.md)

## Product principles

- [Workspace Philosophy](PHILOSOPHY.md)

## Historical material

Dated audits, implementation logs, superseded planning/review documents, security prompts, and old release verification records are retained in [`archive/`](archive/README.md). They preserve evidence and chronology but do not describe current runtime behavior.
