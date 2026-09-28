# IPC to UI Capability Audit

**Audited:** 2026-09-28

This audit compares every canonical `IPC_CHANNELS` entry with the Electron renderer source. The contract test in `packages/ipc/test/ipc.test.ts` repeats the comparison: a new channel must have a renderer invocation or be added here with its exact reason.

Every channel is allowlisted by preload and registered by the desktop main process. Renderer surfaces cover workspace and file operations, source control, updates, settings, semantic index status and rebuild, conversations, workspace memory, Agent Actions, terminals, persistent tasks, Browser, FORGE Live, and FORGE-OS.

## Intentional direct-IPC exceptions

These endpoints have no direct renderer invocation. They are either a read model already supplied by another renderer route or deliberately withheld because the current user flow has a narrower, safer control. They remain callable only through the typed preload bridge; none grants an unreviewed renderer capability.

| Channel | Exact reason | Existing user surface |
| --- | --- | --- |
| `markdown.parse` | The editor renders Markdown locally. | Markdown preview in the editor. |
| `git.branches` | No branch-switching UI is intentionally exposed. | Source Control shows the current branch. |
| `git.log` | The dashboard supplies the bounded recent-commit view. | Intelligence panel recent commits. |
| `git.unstage` | The current source-control view only stages files. | Source Control stage action. |
| `meta.goal.update` | Goals are currently summary-only after creation. | Intelligence panel goal creation and summary. |
| `meta.goal.delete` | Goals are currently summary-only after creation. | Intelligence panel goal summary. |
| `settings.platform.capabilities` | The settings UI presents runtime-specific availability. | Settings runtime and semantic sections. |
| `context.health.get` | The intelligence panel receives the same health fields through meta.dashboard. | Intelligence metrics. |
| `agent.explainProject` | The chat composer is the single user-directed entry point. | Workspace AI chat. |
| `agent.reviewChanges` | The chat composer is the single user-directed entry point. | Workspace AI chat. |
| `agent.conversations.append` | Conversation mutation is owned by agent.ask and the conversation controls. | Workspace AI chat and Workspace Data controls. |
| `terminal.remove` | Terminal sessions remain available for their observable lifecycle. | User Terminal create, cancel, and restart controls. |
| `tasks.get` | The task panel uses the bounded workspace task list. | Workspace Tasks panel. |
| `tasks.cancel` | Stop All provides the currently exposed cancellation control. | Agent Actions Stop All. |
| `tasks.redirect` | The Agent Actions runner exposes task.redirect with task selection. | Agent Actions Run / Test Capability. |
| `tasks.retry.step` | Run / Resume Task owns retry progression. | Workspace Tasks Run / Resume Task. |
| `forge-live.restart` | Go Live exposes start and stop while running. | Header Go Live control. |
| `forge-live.copy-url` | Open Preview is the exposed live-preview action. | Header Open Preview control. |
| `forge-os.session.action` | FORGE-OS routes session controls through reviewed desktop launchers. | FORGE-OS session controls. |

The table is intentionally specific: it records the currently unavailable direct control instead of implying it exists. Adding a direct UI action requires removing or revising its exception and retaining the automated coverage check.
