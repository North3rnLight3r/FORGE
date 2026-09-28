import type { WorkspaceService } from '@forge/workspace';
import type { GitService } from '@forge/git';
import type { StorageService } from '@forge/storage';
import type { FileNode } from '@forge/ipc';
import type { MemoryEntry } from '@forge/memory';
import type { ContextAssemblyResult, ContextBudgetPolicy, WorkspaceArtifact } from './intelligence';

const DEFAULT_CONTEXT_BUDGET = 14_000;
const DOCUMENT_PATTERN = /(?:^|\/)(?:readme|architecture|project[_-]?status|roadmap|dev[_-]?log|release[_-]?notes|goals?|memory)\.md$/i;

export interface ProjectContext {
  projectName: string | null;
  rootPath: string | null;
  files: Array<{ path: string; type: 'file' | 'directory'; extension?: string }>;
  readme?: { path: string; content: string } | null;
  packageJson?: { path: string; content: string } | null;
  documents: Array<{ path: string; content: string }>;
  sourceFiles: Array<{ path: string; content: string; changed: boolean; relevance: number; reason: string }>;
  gitStatus?: unknown | null;
  recentCommits?: Array<{ hash: string; message: string; author?: string; timestamp?: number }> | null;
  metadata?: unknown | null;
  memories?: MemoryEntry[] | null;
}

export class PriorityContextBudgetPolicy implements ContextBudgetPolicy {
  select(artifacts: readonly WorkspaceArtifact[], characterBudget: number): { selected: readonly WorkspaceArtifact[]; omittedArtifactIds: readonly string[] } {
    const ordered = [...artifacts].sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
    const selected: WorkspaceArtifact[] = [];
    const omittedArtifactIds: string[] = [];
    let remaining = characterBudget;
    for (const artifact of ordered) {
      if (remaining <= 0) { omittedArtifactIds.push(artifact.id); continue; }
      const allowance = Math.min(artifact.content.length, 4_000, remaining);
      if (allowance <= 0) { omittedArtifactIds.push(artifact.id); continue; }
      const content = artifact.content.length > allowance ? `${artifact.content.slice(0, Math.max(0, allowance - 1))}…` : artifact.content;
      selected.push({ ...artifact, content });
      remaining -= content.length;
      if (content.length < artifact.content.length) omittedArtifactIds.push(`${artifact.id}:truncated`);
    }
    return { selected, omittedArtifactIds };
  }
}

export class ContextBuilderImpl {
  constructor(
    private workspace: WorkspaceService,
    private git: GitService,
    private storage: StorageService,
    private budgetPolicy: ContextBudgetPolicy = new PriorityContextBudgetPolicy()
  ) {}

  private flattenFiles(nodes: FileNode[]): Array<{ path: string; type: 'file' | 'directory'; extension?: string }> {
    const out: Array<{ path: string; type: 'file' | 'directory'; extension?: string }> = [];
    for (const node of nodes) {
      out.push({ path: node.relativePath || node.path, type: node.type, extension: node.extension });
      if (node.children?.length) out.push(...this.flattenFiles(node.children));
    }
    return out;
  }

  async buildContext(_query?: string, memories?: MemoryEntry[] | null): Promise<ProjectContext> {
    const context: ProjectContext = {
      projectName: null,
      rootPath: null,
      files: [],
      readme: null,
      packageJson: null,
      documents: [],
      sourceFiles: [],
      gitStatus: null,
      recentCommits: null,
      metadata: null,
      memories: memories ?? null
    };

    try {
      const info = this.workspace.info();
      if (info) { context.projectName = info.name ?? null; context.rootPath = info.rootPath ?? null; }
    } catch { /* an unopened workspace has no identity */ }

    try { context.files = this.flattenFiles(await this.workspace.list('')); }
    catch { context.files = []; }

    const candidatePaths = [...new Set(context.files
      .filter((file) => file.type === 'file' && DOCUMENT_PATTERN.test(file.path))
      .map((file) => file.path))].slice(0, 10);
    for (const documentPath of candidatePaths) {
      try {
        const file = await this.workspace.readFile(documentPath);
        context.documents.push({ path: documentPath, content: file.content });
        if (/^readme\.md$/i.test(documentPath)) context.readme = { path: documentPath, content: file.content };
      } catch { /* skip unreadable context candidates */ }
    }

    if (!context.readme) {
      try {
        const readme = await this.workspace.readFile('README.md');
        context.readme = { path: readme.path, content: readme.content };
        context.documents.unshift({ path: readme.path, content: readme.content });
      } catch { context.readme = null; }
    }

    try {
      const packageJson = await this.workspace.readFile('package.json');
      context.packageJson = { path: packageJson.path, content: packageJson.content };
    } catch { context.packageJson = null; }

    try { context.gitStatus = await this.git.status(); }
    catch { context.gitStatus = null; }
    try {
      const commits = await this.git.log(12);
      context.recentCommits = commits.map((commit) => ({ hash: commit.hash, message: commit.message, author: commit.author, timestamp: commit.timestamp }));
    } catch { context.recentCommits = null; }
    try { context.metadata = await this.storage.dashboard(); }
    catch { context.metadata = null; }

    const queryTokens = new Set((_query ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2));
    const changedPaths = new Set(
      context.gitStatus && typeof context.gitStatus === 'object' && 'files' in context.gitStatus && Array.isArray((context.gitStatus as { files?: unknown }).files)
        ? ((context.gitStatus as { files: Array<{ path?: unknown }> }).files).map((file) => String(file.path ?? ''))
        : []
    );
    const sourceExtensions = new Set(['ts', 'tsx', 'js', 'jsx', 'py', 'c', 'cpp', 'rs', 'go', 'java']);
    const sourceCandidates = context.files
      .filter((file) => file.type === 'file' && sourceExtensions.has(file.extension?.toLowerCase() ?? ''))
      .map((file) => ({
        path: file.path,
        changed: changedPaths.has(file.path),
        score: (changedPaths.has(file.path) ? 100 : 0) + [...queryTokens].reduce((score, token) => score + (file.path.toLowerCase().includes(token) ? 10 : 0), 0)
      }))
      .filter((candidate) => candidate.changed || candidate.score > 0)
      .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
      .slice(0, 6);
    for (const candidate of sourceCandidates) {
      try {
        const file = await this.workspace.readFile(candidate.path);
        context.sourceFiles.push({
          path: candidate.path,
          content: file.content,
          changed: candidate.changed,
          relevance: candidate.changed ? 96 : 84,
          reason: candidate.changed ? 'Changed implementation file.' : 'Source path matches the current question.'
        });
      } catch { /* skip unreadable source evidence */ }
    }

    return context;
  }

  async assemble(query: string, memories?: MemoryEntry[] | null, characterBudget = DEFAULT_CONTEXT_BUDGET): Promise<ContextAssemblyResult> {
    const context = await this.buildContext(query, memories);
    const artifacts: WorkspaceArtifact[] = [];
    const add = (artifact: WorkspaceArtifact): void => { if (artifact.content.trim()) artifacts.push(artifact); };

    add({
      id: 'workspace-inventory', kind: 'source', title: 'Workspace inventory', priority: 60,
      content: `${context.files.length} indexed entries\n${context.files.slice(0, 180).map((file) => `${file.type === 'directory' ? 'dir' : 'file'}: ${file.path}`).join('\n')}`,
      metadata: { relevance: 70, reason: 'Workspace identity and file inventory.' }
    });
    for (const document of context.documents) {
      const architectureDocument = /(?:architecture|project[_-]?status|roadmap|dev[_-]?log|release[_-]?notes)/i.test(document.path);
      add({
        id: `document:${document.path}`, kind: architectureDocument ? 'architecture' : 'documentation',
        title: document.path, path: document.path, content: document.content, priority: architectureDocument ? 100 : /^readme/i.test(document.path) ? 90 : 80,
        metadata: architectureDocument
          ? { relevance: 100, reason: 'Primary architecture evidence.' }
          : /^readme/i.test(document.path)
            ? { relevance: 96, reason: 'Primary project overview.' }
            : { relevance: 86, reason: 'Project documentation selected by architecture-first policy.' }
      });
    }
    for (const sourceFile of context.sourceFiles) add({
      id: `source:${sourceFile.path}`, kind: 'source', title: sourceFile.path, path: sourceFile.path,
      content: sourceFile.content, priority: sourceFile.changed ? 92 : 70,
      metadata: { relevance: sourceFile.relevance, reason: sourceFile.reason }
    });
    if (context.packageJson) add({ id: 'package-json', kind: 'configuration', title: 'package.json', path: context.packageJson.path, content: context.packageJson.content, priority: 72, metadata: { relevance: 78, reason: 'Authoritative project configuration.' } });
    if (context.gitStatus) add({ id: 'git-status', kind: 'git', title: 'Current Git state', content: JSON.stringify(context.gitStatus, null, 2), priority: 88, metadata: { relevance: 94, reason: 'Current repository state.' } });
    if (context.recentCommits?.length) add({
      id: 'git-history', kind: 'git', title: 'Recent Git history', priority: 86,
      content: context.recentCommits.map((commit) => `${commit.hash.slice(0, 8)} ${commit.message}${commit.author ? ` — ${commit.author}` : ''}`).join('\n'),
      metadata: { relevance: 90, reason: 'Recent project chronology.' }
    });
    if (context.metadata) add({ id: 'project-metadata', kind: 'metadata', title: 'Project goals and metadata', content: JSON.stringify(context.metadata, null, 2), priority: 94, metadata: { relevance: 96, reason: 'Active goals, tasks, and workspace identity.' } });
    for (const memory of context.memories ?? []) add({
      id: `memory:${memory.id}`, kind: 'memory', title: memory.title || memory.type, content: memory.content,
      priority: memory.type === 'decision' ? 98 : Math.max(70, Math.min(92, memory.relevance ?? 84)),
      updatedAt: memory.updatedAt,
      metadata: {
        ...(typeof memory.metadata === 'object' && memory.metadata ? memory.metadata as Record<string, unknown> : {}),
        relevance: memory.relevance ?? 80,
        reason: memory.reasons?.join(' · ') ?? 'Relevant durable workspace knowledge.'
      }
    });

    const budgeted = this.budgetPolicy.select(artifacts, characterBudget);
    const evidence = budgeted.selected.map((artifact) => `## ${artifact.title}${artifact.path ? ` (${artifact.path})` : ''}\n${artifact.content}`).join('\n\n');
    const projectName = context.projectName ?? 'the active workspace';
    const systemPrompt = `You are FORGE workspace intelligence operating alongside the repository "${projectName}".

Core philosophy:
- Local-first.
- The project folder is the source of truth.
- AI augments the workspace instead of replacing it.
- The AI is one replaceable subsystem inside FORGE, not the owner of the workspace or the primary application interface.
- Project memory must remain durable.
- Persistent tasks belong to the workspace, not to the current conversation, provider, model, renderer, or process.
- Markdown, Git, conversations, architecture, documentation, source code, and project metadata form one connected knowledge graph.

Decision policy:
- Ground answers in the supplied workspace evidence and distinguish evidence from inference.
- When asked what to build next, reason from architecture, project memory, Git history, documentation, current implementation, and goals.
- Prefer architectural evolution that strengthens workspace intelligence over generic IDE features.
- Do not default to plugins, collaboration, onboarding, dark mode, or templates unless repository evidence shows they directly advance this architecture.
- Never imply that clearing or starting a conversation erases workspace memory, indexes, project metadata, or Git state.
- Before resuming a persistent task, reconcile its checkpoint with current workspace, Git, local-process, and configured external-service evidence.
- Do not repeat completed or externally verified work, and never mark a step complete based only on another model's claim.
- When the user asks for an action, use the advertised tools directly from their ordinary language request. Do not require a persistent task, a tool name, or special prompt wording. File tools accept absolute paths, upward traversal, and hidden files; relative paths start at the active workspace root.
- You may request advertised tools, but you never execute tools directly.
- FORGE validates, authorizes, executes, audits, and returns every tool result. Never claim success until a successful FORGE result is present.
- Use the available tools for destructive, executable, and remote actions when the user's ordinary request authorizes them. Explain the reason and expected effect accurately, and report the observed result. Never invent credentials or claim access the operating system denied.

Workspace evidence for this turn:
${evidence || 'No workspace evidence was available.'}`;

    return {
      systemPrompt,
      artifacts: budgeted.selected,
      omittedArtifactIds: budgeted.omittedArtifactIds,
      characterBudget,
      characterCount: systemPrompt.length
    };
  }
}

export default ContextBuilderImpl;
