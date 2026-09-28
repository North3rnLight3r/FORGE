# 🧠 Workspace Before Model

FORGE is built around one principle: **the agent is replaceable; the project memory is not.**

## The problem with model-owned context

AI-assisted programming is fast until the useful context is trapped inside one session, one provider, or one tool. Change agents, clear a chat, open a different terminal, or come back later and the project has to be explained again.

That is not primarily a model problem. It is an ownership problem.

FORGE makes the workspace own the durable record: source files, documentation, architecture, Git history, task checkpoints, terminal evidence, decisions, conversations, and memory stay attached to the project instead of to one LLM.

## Intelligence is not the agent

FORGE separates two responsibilities that are often bundled together.

**Workspace intelligence** organizes what the project knows. It collects evidence, ranks relevance, tracks chronology, preserves durable decisions, filters stale context, and prepares the smallest useful context package for the next task.

**The agent** reasons and acts. That agent may be Codex, Ollama, a hosted OpenAI-compatible model, Claude Code, OpenCode, or another runtime introduced later.

FORGE should not need to become a better chatbot every time a better model appears. It should make each model inherit a better workspace.

## Same project, different agents

A broad refactor may suit Codex. Offline work may suit Ollama. A specialist CLI may be better for another job. Those choices should change the executor, not reset the project.

FORGE keeps stable:

- the real project directory;
- architecture and documentation;
- Git evidence and chronology;
- task state and verified checkpoints;
- durable memory and prior decisions;
- terminal observations and tool history;
- the capabilities the workspace exposes to agents.

The model changes. The environment does not.

## Tool capability belongs to the workspace

A local model should not become non-agentic simply because it is local. If an Ollama model can reason well enough to use a tool, FORGE should be able to expose the same filesystem, Git, shell, task, search, and project-context capabilities that a hosted model receives.

Provider adapters translate FORGE's stable contracts into the format a model understands. Capability does not need to be reimplemented for every provider.

This creates an important distinction:

> **Model capability determines how well the agent reasons. FORGE determines what the agent can consistently understand and operate.**

## Authority is not orchestration

FORGE should protect the workspace without preventing legitimate work.

The human controls authority by choosing execution mode, filesystem scope, network capabilities, workspace, credentials, operating-system permissions, and when FORGE runs. The runtime uses persistent Disabled, Controlled, and Allow All modes rather than a per-action approval queue; Allow All remains bounded by the user's selected scopes and OS permissions.

The agent controls execution within those configured boundaries. A complex task should not fail simply because it required six reads, three edits, a test run, and another correction.

Workspace containment, validation, cancellation, backups, auditing, timeouts, and resource limits are useful. Arbitrary tool-count and reasoning-round ceilings are not a substitute for safety.

The design rule is simple:

> **Bound resources, not agency.**

## Why this matters for long-running projects

Software development leaves a trail of decisions that source code alone cannot explain. A useful workspace remembers not only what exists, but why it exists, what failed before, what was verified, and what remains unresolved.

That record should be understandable by a new model or a new human engineer without depending on the original conversation that produced it.

FORGE is therefore less interested in owning the smartest model than in building the durable environment where intelligence can accumulate across the entire life of a project.

## Architectural consequence

The architecture follows directly from that philosophy:

```text
workspace evidence
      ↓
FORGE intelligence layer
context · memory · chronology · relevance
      ↓
replaceable agent adapter
Codex · Ollama · hosted model · future runtime
      ↓
FORGE capability layer
filesystem · Git · shell · tasks · web
      ↓
verified project state feeds back into workspace intelligence
```

The built-in chat can remain useful, but it is one interface and one agent client—not the operating model of the product.

Read [Architecture](ARCHITECTURE.md) for the implementation boundary and [Integrated Terminal](TERMINAL.md) for the CLI-agent workflow.
