# FORGE 2.5.0-beta

## Living intelligence

The `v2.5.0-beta` release introduces the shared living-intelligence experience across macOS, Windows, Linux, and FORGE-OS:

- northern-lights FORGE identity, bundled typography, animated glass surfaces, and a bounded Three.js aurora field;
- typed live telemetry for the selected artifact packet, semantic records, FORGE memory, active tools, tasks, terminals, and index state;
- event-correlated tool and durable-task activity so fast operations remain visible;
- reliable opt-out system sounds, reduced-motion support, hidden-window animation suspension, and WebGL fallback behavior;
- a 32 MB pre-allocation direct-read guard and clearer permission errors.

The release also carries forward the post-2.4 recovery and parity work:

- workspace-open response recovery: if the open operation succeeds but Electron drops or nulls the response payload, the renderer reloads canonical `workspace.info` instead of storing a null workspace;
- malformed workspace-database recovery from a verified backup while preserving the corrupt original;
- bounded semantic context that keeps explicit tool results, current source, Git, and task/runtime evidence authoritative;
- shared runtime and packaging parity across Linux, macOS, and Windows, including embedded commit metadata, manifests, native architecture checks, and installed-runtime verification;
- branch/runtime audit and documentation consolidation.

Linux, macOS, and Windows packages are built from the same annotated source tag; platform-native package hashes remain distinct. The desktop update action is local-source-only: it rebuilds the checkout on the machine and does not consume release feeds.

## Published `v2.4.0-beta`

The published release added the native semantic-context foundation and coordinated cross-platform packaging:

- optional OpenAI-compatible embeddings, disabled on fresh installs;
- lazy semantic routing with bounded results, deduplication, source freshness checks, Float32 storage, and batched persistence;
- provider-neutral FORGE Intelligence and Native FORGE execution using the shared ToolRouter;
- Hermes CLI/endpoint discovery, skill metadata discovery, and safe Native FORGE fallback;
- Linux AppImage/DEB, universal macOS DMG/ZIP, Windows NSIS, blockmaps, SHA-256 sums, and build manifests.

## Execution model

The current runtime does not contain the retired FORGE approval queue, approval grants, session permissions, or approval IPC. Valid calls to registered and available tools execute through the shared router. Schema validation, root confinement, OS permissions, timeouts, cancellation, rollback/atomic-write protections, redaction, bounded results, network controls, loop-progress protection, and execution-state audit records remain enforced.

## Published-release facts

- Tag: `v2.4.0-beta`
- Tagged commit: `ff798b91a1a027a4891214c4da6549fc3336d210`
- Published: 2026-08-26
- Assets: Linux x64 AppImage/DEB, universal macOS DMG/ZIP, Windows x64 NSIS, blockmaps, `SHA256SUMS`, and build manifest
- GitHub currently reports the release as a normal release rather than a prerelease, despite the beta version and workflow intent
- Apple notarization and Windows publisher signing are not claimed

Older milestone details remain in [CHANGELOG.md](CHANGELOG.md) and [`docs/archive/releases`](docs/archive/releases).
