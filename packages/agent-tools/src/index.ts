import { createHash, randomUUID } from 'node:crypto';
import { promises as fs, type Dirent } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { GitHubService, GitService } from '@forge/git';
import type { ShellService, ShellRunInput } from '@forge/shell';
import type { WebService } from '@forge/web';
import { ToolRegistry, ToolValidationError, z, type ProviderToolCall, type ToolDefinition, type ToolRequest, type ToolResult } from '@forge/tool-runtime';
import { zodToJsonSchema } from 'zod-to-json-schema';

export type { ProviderToolCall, ToolRequest, ToolResult } from '@forge/tool-runtime';

const MAX_TEXT_BYTES = 2_000_000;
const MAX_RANGED_TEXT_BYTES = 64_000_000;
const MAX_SEARCH_RESULTS = 20000;
const MAX_LIST_ENTRIES = 10_000;
const textOutput = z.object({ success: z.boolean() }).passthrough();
const filePath = z.string().min(1).max(4_096).refine((value) => !value.includes('\0'), 'Path must not contain a null byte.');
const relativePath = filePath.refine((value) => !path.isAbsolute(value) && !value.split(/[\\/]/).includes('..'), 'Repository path must be relative.');
const reason = z.string().min(3).max(2_000);

export type FilesystemScope = 'workspace' | 'repository' | 'project-tree' | 'home' | 'full';

interface FilesystemPathPolicy {
  workspaceRoot: string;
  scope: FilesystemScope;
  repositoryRoot?: string;
  projectTreeRoot?: string;
}

export interface AuditRecord {
  id: string;
  timestamp: number;
  workspaceId: string;
  conversationId: string;
  modelId: string;
  toolName: string;
  taskId?: string;
  stepId?: string;
  sanitizedInputs: unknown;
  executionState: 'requested' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'validation-failed';
  executionDurationMs: number;
  success: boolean;
  result: unknown;
  resultSummary: string;
  affectedPaths: string[];
  exitCode?: number | null;
  rollback?: ToolResult['rollback'];
}

export interface AuditStore {
  appendAction(record: AuditRecord): Promise<void>;
  listActions(filters?: { conversationId?: string; toolName?: string; success?: boolean; from?: number; to?: number }): Promise<AuditRecord[]>;
}

/**
 * A deliberately small bridge to the user-visible FORGE browser.  The agent
 * never receives Electron or webContents access directly; it can only request
 * these bounded, audited operations through ToolRouter.
 */
export interface BrowserToolService {
  enabled(): boolean;
  open(url: string): Promise<{ url: string; title: string; canGoBack: boolean; canGoForward: boolean }>;
  read(): Promise<{ url: string; title: string; text: string; truncated: boolean }>;
}

export interface ToolRouterContext {
  workspaceId: string;
  conversationId: string;
  modelId: string;
  workspaceRoot: string;
  filesystemScope?: FilesystemScope;
  repositoryRoot?: string;
  projectTreeRoot?: string;
  executionMode?: 'disabled' | 'controlled' | 'allow-all';
  networkAccess?: { web: boolean; git: boolean; packageManager: boolean; general: boolean };
  backgroundTasksEnabled?: boolean;
  autoRepairToolArguments?: boolean;
  processTimeoutMs?: number;
  backgroundTaskTimeoutMs?: number;
  processMode?: 'standard' | 'full-local-compute';
  /** Current natural-language request, used only to produce an audit reason. */
  userRequest?: string;
  /** Runtime-owned persistent task linkage, never exposed as tool arguments. */
  task?: { taskId: string; stepId: string };
}

export interface ToolRequestOutcome { request: ToolRequest; result?: ToolResult; }
type ToolExecutor = (input: any, request: ToolRequest, signal: AbortSignal) => Promise<Omit<ToolResult, 'requestId' | 'toolName' | 'durationMs'>>;

const inside = (root: string, candidate: string): boolean => candidate === root || candidate.startsWith(`${root}${path.sep}`);
const skippableFileSystemError = (error: unknown): boolean => error instanceof Error && 'code' in error && ['EACCES', 'EPERM', 'ENOENT'].includes(String(error.code));
const displayPath = (root: string, candidate: string): string => inside(root, candidate) ? path.relative(root, candidate) || '.' : candidate;

export async function resolveContainedPath(rootValue: string, relative: string, allowMissing = false): Promise<string> {
  if (!relative || relative.includes('\0')) throw new Error('A non-empty path without null bytes is required.');
  const root = await fs.realpath(rootValue);
  const selected = relative === '~' ? os.homedir() : relative.startsWith(`~${path.sep}`) ? path.join(os.homedir(), relative.slice(2)) : relative;
  const candidate = path.resolve(root, selected);
  let inspected = candidate;
  if (allowMissing) {
    while (true) {
      try { await fs.lstat(inspected); break; } catch (error) {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
        const parent = path.dirname(inspected);
        if (parent === inspected) throw error;
        inspected = parent;
      }
    }
  }
  await fs.realpath(inspected);
  return candidate;
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

async function resolveExistingParent(candidate: string, allowMissing: boolean): Promise<string> {
  if (!allowMissing) return fs.realpath(candidate);
  const suffix: string[] = [];
  let existing = candidate;
  while (true) {
    try {
      await fs.lstat(existing);
      return path.resolve(await fs.realpath(existing), ...suffix.reverse());
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
      const parent = path.dirname(existing);
      if (parent === existing) throw error;
      suffix.push(path.basename(existing));
      existing = parent;
    }
  }
}

export async function resolveScopedPath(policy: FilesystemPathPolicy, requestedPath: string, allowMissing = false): Promise<string> {
  if (!requestedPath || requestedPath.includes('\0')) throw new Error('A non-empty path without null bytes is required.');
  const requested = requestedPath === '~' ? os.homedir() : requestedPath.startsWith('~/') || requestedPath.startsWith(`~${path.sep}`)
    ? path.join(os.homedir(), requestedPath.slice(2))
    : requestedPath;
  const candidate = await resolveExistingParent(path.resolve(policy.workspaceRoot, requested), allowMissing);
  let allowedRoot: string | undefined;
  if (policy.scope === 'workspace') allowedRoot = await fs.realpath(policy.workspaceRoot);
  else if (policy.scope === 'repository') {
    if (!policy.repositoryRoot) throw new Error('Repository scope is unavailable because the active Git repository root could not be identified.');
    allowedRoot = await fs.realpath(policy.repositoryRoot);
  } else if (policy.scope === 'project-tree') {
    if (!policy.projectTreeRoot) throw new Error('Project-tree scope requires a selected project root in Settings.');
    allowedRoot = await fs.realpath(policy.projectTreeRoot);
  } else if (policy.scope === 'home') allowedRoot = await fs.realpath(os.homedir());
  if (allowedRoot && !isWithin(allowedRoot, candidate)) {
    throw new Error(`SCOPE_FAILURE: Resolved path ${candidate} is outside the configured ${policy.scope} scope (${allowedRoot}).`);
  }
  return candidate;
}

export function unifiedDiff(filePath: string, before: string, after: string): string {
  if (before === after) return '';
  const oldLines = before.split('\n');
  const newLines = after.split('\n');
  const lines = [`--- a/${filePath}`, `+++ b/${filePath}`, `@@ -1,${oldLines.length} +1,${newLines.length} @@`];
  let prefix = 0;
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) { lines.push(` ${oldLines[prefix]}`); prefix += 1; }
  for (let index = prefix; index < oldLines.length; index += 1) lines.push(`-${oldLines[index]}`);
  for (let index = prefix; index < newLines.length; index += 1) lines.push(`+${newLines[index]}`);
  return lines.join('\n').slice(0, 250_000);
}

async function readText(absolute: string, maxBytes = MAX_TEXT_BYTES): Promise<{ content: string; encoding: 'utf8' | 'utf8-bom'; mode: number }> {
  const [buffer, stat] = await Promise.all([fs.readFile(absolute), fs.stat(absolute)]);
  if (buffer.byteLength > maxBytes) throw new Error(`File exceeds the supported ${maxBytes.toLocaleString()} byte text size limit.`);
  if (buffer.includes(0)) throw new Error('Binary content must be requested with file.readBinary.');
  const bom = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
  return { content: buffer.subarray(bom ? 3 : 0).toString('utf8'), encoding: bom ? 'utf8-bom' : 'utf8', mode: stat.mode };
}

async function atomicWrite(absolute: string, content: string, encoding: 'utf8' | 'utf8-bom' = 'utf8', mode?: number): Promise<void> {
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  const temporary = path.join(path.dirname(absolute), `.${path.basename(absolute)}.${randomUUID()}.tmp`);
  const data = Buffer.from(`${encoding === 'utf8-bom' ? '\ufeff' : ''}${content}`, 'utf8');
  try { await fs.writeFile(temporary, data, { flag: 'wx', mode }); await fs.rename(temporary, absolute); }
  catch (error) { await fs.rm(temporary, { force: true }).catch(() => undefined); throw error; }
}

async function backupPath(root: string, relative: string): Promise<string> {
  const hash = createHash('sha256').update(`${Date.now()}\0${relative}`).digest('hex').slice(0, 12);
  const absolute = path.resolve(root, relative);
  const backupName = inside(root, absolute) ? path.relative(root, absolute) : path.join('external', path.basename(absolute));
  const destination = path.join(root, '.forge', 'backups', `${Date.now()}-${hash}`, backupName);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  return destination;
}

const definition = <I, O>(value: ToolDefinition<I, O>): ToolDefinition<I, O> => value;

export function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  const base = { outputSchema: textOutput, cancellable: true };
  registry.register(definition({ ...base, name: 'file.list', purpose: 'List files and hidden entries at a relative, parent, home, or absolute directory path. Omit path for the active workspace root. Continue with the returned offset when truncated.', inputSchema: z.object({ path: filePath.default('.'), recursive: z.boolean().default(false), maxDepth: z.number().int().min(0).max(20).default(2), maxEntries: z.number().int().min(1).max(MAX_LIST_ENTRIES).default(500), offset: z.number().int().min(0).max(1_000_000).default(0) }), sideEffect: 'read', workspaceBoundary: 'required', timeoutMs: 10_000, audit: { category: 'filesystem', recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: (input) => input.path ?? '.', describeEffect: () => 'Read a bounded directory listing, beginning at the workspace root by default.' }));
  registry.register(definition({ ...base, name: 'file.read', purpose: 'Read a bounded range of any accessible text file, including hidden and absolute paths. Use file.readBinary for binary content.', inputSchema: z.object({ path: filePath, startLine: z.number().int().min(1).optional(), endLine: z.number().int().min(1).optional(), offset: z.number().int().min(0).max(MAX_RANGED_TEXT_BYTES).optional(), maxCharacters: z.number().int().min(1).max(200_000).default(12_000) }).refine((input) => input.endLine === undefined || input.startLine === undefined || input.endLine >= input.startLine, 'endLine must not precede startLine.').refine((input) => input.offset === undefined || (input.startLine === undefined && input.endLine === undefined), 'offset cannot be combined with line ranges.'), sideEffect: 'read', workspaceBoundary: 'required', timeoutMs: 10_000, audit: { category: 'filesystem', recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: (input) => input.path, describeEffect: () => 'Read bounded text without changing the workspace.' }));
  registry.register(definition({ ...base, name: 'file.read.binary', purpose: 'Read bounded binary content at any accessible path as base64 together with file metadata.', inputSchema: z.object({ path: filePath, maxBytes: z.number().int().min(1).max(25_000_000).default(2_000_000) }), sideEffect: 'read', workspaceBoundary: 'required', timeoutMs: 20_000, audit: { category: 'filesystem', recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: (input) => input.path, describeEffect: () => 'Read binary bytes as bounded base64 without changing the workspace.' }));
  registry.register(definition({ ...base, name: 'file.search', purpose: 'Search accessible text files, including hidden files and paths outside the active workspace. When truncated, continue using the returned offset.', inputSchema: z.object({ query: z.string().min(1).max(500), path: filePath.default('.'), caseSensitive: z.boolean().default(false), maxResults: z.number().int().min(1).max(MAX_SEARCH_RESULTS).default(50), offset: z.number().int().min(0).max(100_000).default(0) }), sideEffect: 'read', workspaceBoundary: 'required', timeoutMs: 20_000, audit: { category: 'filesystem', recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: (input) => input.path ?? '.', describeEffect: (input) => `Search workspace text for ${JSON.stringify(input.query)}.` }));
  registry.register(definition({ ...base, name: 'file.create', purpose: 'Create a file at any accessible path.', inputSchema: z.object({ path: filePath, content: z.string().max(MAX_TEXT_BYTES), reason }), sideEffect: 'workspace-write', workspaceBoundary: 'required', timeoutMs: 10_000, audit: { category: 'filesystem', recordsAffectedPaths: true, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: (input) => input.path, describeEffect: () => 'Create a new file atomically.' }));
  registry.register(definition({ ...base, name: 'file.write', purpose: 'Replace an accessible text file after showing a diff.', inputSchema: z.object({ path: filePath, content: z.string().max(MAX_TEXT_BYTES), reason }), sideEffect: 'workspace-write', workspaceBoundary: 'required', timeoutMs: 10_000, audit: { category: 'filesystem', recordsAffectedPaths: true, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: (input) => input.path, describeEffect: () => 'Atomically write the diff with a rollback backup.' }));
  registry.register(definition({ ...base, name: 'file.patch', purpose: 'Apply a targeted text replacement to an accessible file.', inputSchema: z.object({ path: filePath, expected: z.string().min(1).max(MAX_TEXT_BYTES), replacement: z.string().max(MAX_TEXT_BYTES), replaceAll: z.boolean().default(false), reason }), sideEffect: 'workspace-write', workspaceBoundary: 'required', timeoutMs: 10_000, audit: { category: 'filesystem', recordsAffectedPaths: true, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: (input) => input.path, describeEffect: () => 'Apply the displayed targeted patch atomically.' }));
  for (const name of ['file.rename', 'file.move'] as const) registry.register(definition({ ...base, name, purpose: 'Move an accessible path without overwriting.', inputSchema: z.object({ from: filePath, to: filePath, reason }), sideEffect: 'workspace-write', workspaceBoundary: 'required', timeoutMs: 10_000, audit: { category: 'filesystem', recordsAffectedPaths: true, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: (input) => `${input.from} → ${input.to}`, describeEffect: () => 'Move the path without overwriting the destination.' }));
  registry.register(definition({ ...base, name: 'directory.create', purpose: 'Create a directory at any accessible path.', inputSchema: z.object({ path: filePath, reason }), sideEffect: 'workspace-write', workspaceBoundary: 'required', timeoutMs: 10_000, audit: { category: 'filesystem', recordsAffectedPaths: true, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: (input) => input.path, describeEffect: () => 'Create a directory at the requested path.' }));
  registry.register(definition({ ...base, name: 'file.delete', purpose: 'Delete an accessible path after creating a rollback backup.', inputSchema: z.object({ path: filePath, reason }), sideEffect: 'destructive', workspaceBoundary: 'required', timeoutMs: 20_000, audit: { category: 'filesystem', recordsAffectedPaths: true, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: (input) => input.path, describeEffect: () => 'Back up then delete the selected source path.' }));
  registry.register(definition({ ...base, name: 'terminal.read', purpose: 'Read bounded recent output from an existing user terminal session.', inputSchema: z.object({ sessionId: z.string().uuid().optional(), maxCharacters: z.number().int().min(100).max(20_000).default(4_000) }), sideEffect: 'read', workspaceBoundary: 'required', timeoutMs: 5_000, audit: { category: 'shell', recordsAffectedPaths: false, recordsExitCode: true, externalDataTransfer: false }, networkAccess: false, describeTarget: (input) => input.sessionId ?? 'all terminal sessions', describeEffect: () => 'Read bounded, redacted recent terminal evidence without changing the session.' }));

  const gitRead = (name: 'git.status' | 'git.diff' | 'git.log' | 'git.branches', schema: any, effect: string): void => registry.register(definition({ ...base, name, purpose: effect, inputSchema: schema, sideEffect: 'read', workspaceBoundary: 'required', timeoutMs: 20_000, audit: { category: 'git', recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: () => 'active Git workspace', describeEffect: () => effect }));
  gitRead('git.status', z.object({}), 'Inspect current branch and working tree status.'); gitRead('git.diff', z.object({ staged: z.boolean().default(false) }), 'Inspect the Git diff.'); gitRead('git.log', z.object({ limit: z.number().int().min(1).max(100).default(30) }), 'Inspect recent Git history.'); gitRead('git.branches', z.object({}), 'Inspect Git branches.');
  for (const name of ['git.stage', 'git.unstage'] as const) registry.register(definition({ ...base, name, purpose: `${name === 'git.stage' ? 'Stage' : 'Unstage'} selected Git paths.`, inputSchema: z.object({ files: z.array(relativePath).min(1).max(200), reason }), sideEffect: 'workspace-write', workspaceBoundary: 'required', timeoutMs: 20_000, audit: { category: 'git', recordsAffectedPaths: true, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: (input) => input.files.join(', '), describeEffect: () => `${name === 'git.stage' ? 'Stage' : 'Unstage'} only the listed paths.` }));
  registry.register(definition({ ...base, name: 'git.commit', purpose: 'Commit the exact staged Git paths.', inputSchema: z.object({ message: z.string().min(1).max(5_000), reason }), sideEffect: 'repository-write', workspaceBoundary: 'required', timeoutMs: 60_000, audit: { category: 'git', recordsAffectedPaths: true, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: () => 'current branch and staged files', describeEffect: (input) => `Create a commit with message ${JSON.stringify(input.message)}.` }));
  for (const name of ['git.pull', 'git.push'] as const) registry.register(definition({ ...base, name, purpose: `${name === 'git.pull' ? 'Pull from' : 'Push to'} the configured remote.`, inputSchema: z.object({ reason }), sideEffect: 'write-network', workspaceBoundary: 'required', timeoutMs: 120_000, audit: { category: 'git', recordsAffectedPaths: true, recordsExitCode: false, externalDataTransfer: true }, networkAccess: true, describeTarget: () => 'origin and current branch', describeEffect: () => `${name === 'git.pull' ? 'Receive remote changes' : 'Send local commits'} using protected Git credentials.` }));
  registry.register(definition({ ...base, name: 'shell.run', purpose: 'Run one executable with a separate argument array. Use bash -lc for shell operators, pipes, redirects, globbing, or substitutions.', inputSchema: z.object({ command: z.string().min(1).max(4_096).describe('Executable name only, such as hermes, sha256sum, or bash. Do not include arguments in this field.'), args: z.array(z.string().max(32_000)).max(500).default([]).describe('Arguments as separate array entries. For shell syntax use ["-lc", "<script>"] with command "bash".'), workingDirectory: filePath.optional().describe('Absolute or relative cwd. Relative paths start at the active workspace root.'), timeoutMs: z.number().int().min(100).max(600_000).default(120_000), environment: z.record(z.string()).optional(), environmentAllowlist: z.array(z.string()).max(100).default([]), networkProfile: z.enum(['offline', 'network', 'package-manager', 'git']).default('offline'), reason, expectedOutcome: z.string().min(1).max(2_000) }), sideEffect: 'process', workspaceBoundary: 'required', timeoutMs: 600_000, audit: { category: 'shell', recordsAffectedPaths: true, recordsExitCode: true, externalDataTransfer: false }, networkAccess: true, describeTarget: (input) => [input.command, ...(input.args ?? [])].map(quoteArgument).join(' '), describeEffect: (input) => `${input.expectedOutcome} Network profile: ${input.networkProfile}.` }));
  registry.register(definition({ ...base, name: 'web.search', purpose: 'Search the public web when external research is enabled. Workspace content is never sent automatically.', inputSchema: z.object({ query: z.string().min(1).max(1_000), reason, projectDataSent: z.literal('None').default('None') }), sideEffect: 'read-network', workspaceBoundary: 'not-applicable', timeoutMs: 30_000, audit: { category: 'web', recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: true }, networkAccess: true, describeTarget: (input) => input.query, describeEffect: () => 'Send the exact public query to an external search service and return cited results.' }));
  registry.register(definition({ ...base, name: 'web.fetch', purpose: 'Retrieve a public HTTP(S) resource when external research is enabled. Workspace content is never sent automatically.', inputSchema: z.object({ url: z.string().url().max(8_000), reason, projectDataSent: z.literal('None').default('None') }), sideEffect: 'read-network', workspaceBoundary: 'not-applicable', timeoutMs: 30_000, audit: { category: 'web', recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: true }, networkAccess: true, describeTarget: (input) => input.url, describeEffect: () => 'Retrieve bounded public web evidence without browser automation.' }));
  registry.register(definition({ ...base, name: 'browser.open', purpose: 'Open a validated public HTTP(S) URL in the user-visible FORGE Browser.', inputSchema: z.object({ url: z.string().url().max(8_000), reason, projectDataSent: z.literal('None').default('None') }), sideEffect: 'read-network', workspaceBoundary: 'not-applicable', timeoutMs: 45_000, audit: { category: 'web', recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: true }, networkAccess: true, describeTarget: (input) => input.url, describeEffect: () => 'Navigate the visible FORGE Browser to this public URL. The destination and any rendered content remain external data.' }));
  registry.register(definition({ ...base, name: 'browser.read', purpose: 'Read bounded rendered text from the current visible FORGE Browser page.', inputSchema: z.object({ reason }), sideEffect: 'read-network', workspaceBoundary: 'not-applicable', timeoutMs: 20_000, audit: { category: 'web', recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: true }, networkAccess: false, describeTarget: () => 'the current FORGE Browser page', describeEffect: () => 'Send bounded rendered page text from the current public page to the configured model for analysis.' }));
  registry.register(definition({ ...base, name: 'browser.find', purpose: 'Find bounded text excerpts on the current visible FORGE Browser page.', inputSchema: z.object({ query: z.string().min(1).max(1_000), maxResults: z.number().int().min(1).max(50).default(10), reason }), sideEffect: 'read-network', workspaceBoundary: 'not-applicable', timeoutMs: 20_000, audit: { category: 'web', recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: true }, networkAccess: false, describeTarget: () => 'the current FORGE Browser page', describeEffect: (input) => `Send excerpts matching ${JSON.stringify(input.query)} from the current public page to the configured model.` }));
  registry.register(definition({ ...base, name: 'browser.savecontext', purpose: 'Save an agent-authored summary of the current browser page as durable workspace context.', inputSchema: z.object({ title: z.string().min(1).max(500), content: z.string().min(1).max(200_000), reason }), workspaceBoundary: 'required', timeoutMs: 15_000, audit: { category: 'memory', recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, sideEffect: 'workspace-write', describeTarget: (input) => `durable workspace context: ${input.title}`, describeEffect: () => 'Persist the supplied browser-page summary in workspace-owned durable memory. It can be removed from Durable Memory later.' }));
  registry.register(definition({ ...base, name: 'github.read', purpose: 'Inspect metadata, branches, commits, issues, pull requests, comments, workflow state, releases, or assets for the active GitHub repository.', inputSchema: z.object({ resource: z.enum(['metadata', 'branches', 'commits', 'issues', 'pulls', 'issue-comments', 'pull-comments', 'workflow-runs', 'workflow-jobs', 'releases', 'release-assets']), number: z.number().int().positive().optional(), runId: z.number().int().positive().optional(), releaseId: z.number().int().positive().optional(), page: z.number().int().min(1).max(100).default(1), reason }), sideEffect: 'read-network', workspaceBoundary: 'required', timeoutMs: 30_000, audit: { category: 'git', recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: true }, networkAccess: true, describeTarget: (input) => `GitHub ${input.resource}`, describeEffect: () => 'Read bounded GitHub repository evidence using the active origin.' }));
  const githubMutationContext = { reason };
  const githubMutation = z.discriminatedUnion('action', [
    z.object({ action: z.literal('create-issue'), title: z.string().min(1).max(500), body: z.string().max(65_000).optional(), labels: z.array(z.string().max(100)).max(100).optional(), assignees: z.array(z.string().max(100)).max(100).optional(), ...githubMutationContext }),
    z.object({ action: z.literal('update-issue'), number: z.number().int().positive(), title: z.string().min(1).max(500).optional(), body: z.string().max(65_000).optional(), state: z.enum(['open', 'closed']).optional(), labels: z.array(z.string().max(100)).max(100).optional(), assignees: z.array(z.string().max(100)).max(100).optional(), ...githubMutationContext }),
    z.object({ action: z.literal('comment-issue'), number: z.number().int().positive(), body: z.string().min(1).max(65_000), ...githubMutationContext }),
    z.object({ action: z.literal('create-branch'), branch: z.string().min(1).max(255).regex(/^[A-Za-z0-9._/-]+$/), sha: z.string().min(7).max(100), ...githubMutationContext }),
    z.object({ action: z.literal('create-file'), path: relativePath, message: z.string().min(1).max(500), content: z.string().min(1).max(2_000_000), branch: z.string().min(1).max(255).optional(), sha: z.string().min(7).max(100).optional(), ...githubMutationContext }),
    z.object({ action: z.literal('create-pull-request'), title: z.string().min(1).max(500), head: z.string().min(1).max(500), base: z.string().min(1).max(500), body: z.string().max(65_000).optional(), draft: z.boolean().optional(), ...githubMutationContext }),
    z.object({ action: z.literal('comment-pull-request'), number: z.number().int().positive(), body: z.string().min(1).max(65_000), ...githubMutationContext }),
    z.object({ action: z.literal('retry-workflow'), runId: z.number().int().positive(), ...githubMutationContext }),
    z.object({ action: z.literal('create-release'), tag_name: z.string().min(1).max(255), target_commitish: z.string().min(1).max(255).optional(), name: z.string().max(500).optional(), body: z.string().max(65_000).optional(), draft: z.boolean().optional(), prerelease: z.boolean().optional(), ...githubMutationContext }),
    z.object({ action: z.literal('update-release'), releaseId: z.number().int().positive(), tag_name: z.string().min(1).max(255).optional(), target_commitish: z.string().min(1).max(255).optional(), name: z.string().max(500).optional(), body: z.string().max(65_000).optional(), draft: z.boolean().optional(), prerelease: z.boolean().optional(), ...githubMutationContext })
  ]).superRefine((input, context) => {
    if (input.action === 'update-issue' && input.title === undefined && input.body === undefined && input.state === undefined && input.labels === undefined && input.assignees === undefined) context.addIssue({ code: z.ZodIssueCode.custom, message: 'An issue update requires at least one changed field.' });
    if (input.action === 'update-release' && input.tag_name === undefined && input.target_commitish === undefined && input.name === undefined && input.body === undefined && input.draft === undefined && input.prerelease === undefined) context.addIssue({ code: z.ZodIssueCode.custom, message: 'A release update requires at least one changed field.' });
  });
  registry.register(definition({ ...base, name: 'github.mutate', purpose: 'Perform one typed GitHub repository mutation through the official REST API.', inputSchema: githubMutation, sideEffect: 'write-network', workspaceBoundary: 'required', timeoutMs: 60_000, audit: { category: 'git', recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: true }, networkAccess: true, describeTarget: (input) => `GitHub ${input.action}`, describeEffect: () => 'Send one authenticated, audited GitHub API mutation for the active repository.' }));
  const taskStepDraft = z.object({ id: z.string().min(1).max(200).optional(), name: z.string().min(1).max(300), purpose: z.string().min(1).max(2_000), riskTier: z.union([z.literal(0), z.literal(1), z.literal(2)]), requiredTool: z.string().max(200).optional(), expectedInput: z.unknown().optional(), expectedOutput: z.unknown().optional(), retryPolicy: z.object({ maxAttempts: z.number().int().min(1).max(20).optional(), backoffMs: z.number().int().min(0).max(86_400_000).optional(), retryableErrorCodes: z.array(z.string().max(100)).max(50).optional() }).optional(), timeoutMs: z.number().int().min(100).max(86_400_000).optional(), artifactPaths: z.array(relativePath).max(200).optional(), verificationCriteria: z.array(z.string().min(1).max(1_000)).min(1).max(100), rollbackInstructions: z.string().max(4_000).optional(), dependencies: z.array(z.string().min(1).max(200)).max(100).optional() });
  const taskDraft = z.object({ title: z.string().min(1).max(300), description: z.string().max(10_000).optional(), taskType: z.string().min(1).max(100), priority: z.enum(['low', 'medium', 'high']).optional(), originatingConversationId: z.string().uuid().optional(), assignedProvider: z.string().max(200).optional(), assignedModel: z.string().max(200).optional(), progressSummary: z.string().max(4_000).optional(), resumeInstructions: z.string().min(1).max(10_000), associatedBranch: z.string().max(500).optional(), associatedCommitSha: z.string().max(100).optional(), associatedPullRequest: z.string().max(2_000).optional(), associatedReleaseTag: z.string().max(500).optional(), associatedWorkflowRun: z.string().max(500).optional(), taskDependencies: z.array(z.string().uuid()).max(100).optional(), steps: z.array(taskStepDraft).max(500) });
  registry.register(definition({ ...base, name: 'task.inspect', purpose: 'Inspect one workspace-owned persistent task and its verified checkpoints.', inputSchema: z.object({ taskId: z.string().uuid() }), sideEffect: 'read', workspaceBoundary: 'required', timeoutMs: 5_000, audit: { category: 'memory', recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: (input) => input.taskId, describeEffect: () => 'Read persistent task state without changing it.' }));
  registry.register(definition({ ...base, name: 'task.create', purpose: 'Create a draft workspace-owned task without executing any step.', inputSchema: taskDraft.extend({ reason }), sideEffect: 'workspace-write', workspaceBoundary: 'required', timeoutMs: 10_000, audit: { category: 'memory', recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: (input) => input.title, describeEffect: () => 'Persist a draft task and its structured steps; no executable work will start.' }));
  for (const name of ['task.resume', 'task.pause', 'task.cancel'] as const) registry.register(definition({ ...base, name, purpose: `${name.slice(5)} a workspace-owned task .`, inputSchema: z.object({ taskId: z.string().uuid(), reason, trackingOnly: z.boolean().default(true) }), sideEffect: 'workspace-write', workspaceBoundary: 'required', timeoutMs: 20_000, audit: { category: 'memory', recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: (input) => input.taskId, describeEffect: () => `${name.slice(5)} task tracking without changing execution policy.` }));
  registry.register(definition({ ...base, name: 'task.checkpoint', purpose: 'Record a checkpoint for the active task step; FORGE supplies task and audit identities internally.', inputSchema: z.object({ name: z.string().min(1).max(300), summary: z.string().min(1).max(4_000), verified: z.boolean().default(false), evidence: z.unknown().optional(), reason }), sideEffect: 'workspace-write', workspaceBoundary: 'required', timeoutMs: 10_000, audit: { category: 'memory', recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: () => 'the active workspace task step', describeEffect: () => 'Persist a structured checkpoint without executing another tool.' }));
  registry.register(definition({ ...base, name: 'task.handoff', purpose: 'Generate a Markdown projection of the active workspace task.', inputSchema: z.object({ reason }), sideEffect: 'workspace-write', workspaceBoundary: 'required', timeoutMs: 10_000, audit: { category: 'memory', recordsAffectedPaths: true, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: () => '.forge/handoffs for the active task', describeEffect: () => 'Atomically write or update a human-readable task handoff.' }));
  registry.register(definition({ ...base, name: 'task.process.start', purpose: 'Start one task step as a detached workspace-owned process with file-backed output.', inputSchema: z.object({ command: z.string().min(1).max(4_096).describe('Executable name only; put every argument in args.'), args: z.array(z.string().max(32_000)).max(500).default([]).describe('Arguments as separate array entries; use bash with ["-lc", "<script>"] for shell syntax.'), workingDirectory: filePath.optional().describe('Absolute or relative cwd. Relative paths start at the active workspace root.'), timeoutMs: z.number().int().min(100).max(86_400_000).default(600_000), environment: z.record(z.string()).optional(), environmentAllowlist: z.array(z.string()).max(100).default([]), networkProfile: z.enum(['offline', 'network', 'package-manager', 'git']).default('offline'), reason, expectedOutcome: z.string().min(1).max(2_000) }), sideEffect: 'process', workspaceBoundary: 'required', timeoutMs: 30_000, audit: { category: 'shell', recordsAffectedPaths: true, recordsExitCode: true, externalDataTransfer: false }, networkAccess: true, describeTarget: (input) => [input.command, ...(input.args ?? [])].map(quoteArgument).join(' '), describeEffect: (input) => `${input.expectedOutcome} Output will be stored under .forge/task-output and execution may outlive the current conversation. Network profile: ${input.networkProfile}.` }));
  registry.register(definition({ ...base, name: 'task.redirect', purpose: 'Queue a natural-language instruction for the active task at its next safe continuation boundary.', inputSchema: z.object({ taskId: z.string().uuid(), instruction: z.string().min(1).max(4_000), reason }), sideEffect: 'workspace-write', workspaceBoundary: 'required', timeoutMs: 10_000, audit: { category: 'memory', recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: (input) => `task ${input.taskId}`, describeEffect: () => 'Persist a redirect instruction in task history until the running agent acknowledges delivery.' }));
  return registry;
}

export function quoteArgument(value: string): string { return /^[A-Za-z0-9_./:=+-]+$/.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`; }

const SHELL_TOOL_NAMES = new Set(['shell.run', 'task.process.start']);

interface NormalizedCommandLine { command: string; args: string[]; }

/**
 * Parse a direct command line without asking spawn() or a shell to guess its
 * argument boundaries. Shell language is preserved verbatim behind bash -lc.
 */
export function normalizeCommandLine(commandLine: string): NormalizedCommandLine {
  const script = commandLine.trim();
  if (!script) throw new ToolValidationError('MALFORMED_ARGUMENTS', 'A non-empty executable or command line is required.');
  const args: string[] = [];
  let token = '';
  let tokenStarted = false;
  let quote: 'single' | 'double' | null = null;
  let requiresShell = false;
  const finishToken = (): void => {
    if (!tokenStarted) return;
    args.push(token);
    token = '';
    tokenStarted = false;
  };
  for (let index = 0; index < script.length; index += 1) {
    const character = script[index];
    if (quote === 'single') {
      if (character === "'") quote = null;
      else token += character;
      continue;
    }
    if (quote === 'double') {
      if (character === '"') { quote = null; continue; }
      if (character === '$' || character === '`') { requiresShell = true; break; }
      if (character === '\\' && index + 1 < script.length) {
        const next = script[++index];
        token += ['$', '`', '"', '\\'].includes(next) ? next : `\\${next}`;
      } else token += character;
      continue;
    }
    if (character === '\n' || character === '\r') { requiresShell = true; break; }
    if (/\s/.test(character)) { finishToken(); continue; }
    if (character === "'") { quote = 'single'; tokenStarted = true; continue; }
    if (character === '"') { quote = 'double'; tokenStarted = true; continue; }
    if (character === '\\') {
      if (index + 1 >= script.length) throw new ToolValidationError('MALFORMED_ARGUMENTS', 'Command line ends with an incomplete escape.');
      token += script[++index]; tokenStarted = true; continue;
    }
    if (';&|<>`$(){}'.includes(character) || character === '*' || character === '?' || character === '[' || (character === '#' && !tokenStarted) || (character === '~' && !tokenStarted)) {
      requiresShell = true; break;
    }
    token += character;
    tokenStarted = true;
  }
  if (requiresShell) return { command: 'bash', args: ['-lc', script] };
  if (quote) throw new ToolValidationError('MALFORMED_ARGUMENTS', `Command line contains an unterminated ${quote}-quoted argument.`);
  finishToken();
  if (!args.length) throw new ToolValidationError('MALFORMED_ARGUMENTS', 'A non-empty executable is required.');
  if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(args[0])) return { command: 'bash', args: ['-lc', script] };
  if (['cd', 'source', 'export', 'alias', 'unalias', 'set', 'unset', 'ulimit'].includes(args[0])) return { command: 'bash', args: ['-lc', script] };
  return { command: args[0], args: args.slice(1) };
}

/** Normalize only provider-facing shell calls; the executor receives canonical command + argv. */
export function normalizeShellToolCall(call: ProviderToolCall): ProviderToolCall {
  if (!SHELL_TOOL_NAMES.has(call.name)) return call;
  if (typeof call.arguments === 'string') return normalizeShellToolCall({ ...call, arguments: { command: call.arguments } });
  if (Array.isArray(call.arguments)) {
    if (!call.arguments.length || !call.arguments.every((argument) => typeof argument === 'string')) throw new ToolValidationError('MALFORMED_ARGUMENTS', 'Shell command arrays must contain non-empty string arguments.');
    return normalizeShellToolCall({ ...call, arguments: { command: call.arguments[0], args: call.arguments.slice(1) } });
  }
  if (!call.arguments || typeof call.arguments !== 'object') return call;
  const argumentsValue = call.arguments as Record<string, unknown>;
  if (Array.isArray(argumentsValue.command)) {
    if (!argumentsValue.command.length || !argumentsValue.command.every((argument) => typeof argument === 'string')) throw new ToolValidationError('MALFORMED_ARGUMENTS', 'Shell command arrays must contain non-empty string arguments.');
    return normalizeShellToolCall({ ...call, arguments: { ...argumentsValue, command: argumentsValue.command[0], args: [...argumentsValue.command.slice(1), ...(Array.isArray(argumentsValue.args) ? argumentsValue.args : [])] } });
  }
  if (typeof argumentsValue.command !== 'string') return call;
  const suppliedArgs = argumentsValue.args;
  if (typeof suppliedArgs === 'string') return normalizeShellToolCall({ ...call, arguments: { ...argumentsValue, command: `${argumentsValue.command} ${suppliedArgs}`, args: [] } });
  if (suppliedArgs !== undefined && !Array.isArray(suppliedArgs)) return call;
  if (Array.isArray(suppliedArgs) && suppliedArgs.length > 0) {
    if (/\s/.test(argumentsValue.command)) {
      const normalized = normalizeCommandLine(argumentsValue.command);
      return { ...call, arguments: { ...argumentsValue, command: normalized.command, args: [...normalized.args, ...suppliedArgs] } };
    }
    return call;
  }
  const normalized = normalizeCommandLine(argumentsValue.command);
  return { ...call, arguments: { ...argumentsValue, ...normalized } };
}

export function normalizeProviderToolCall(call: ProviderToolCall, userRequest = ''): ProviderToolCall {
  const shellNormalized = normalizeShellToolCall(call);
  if (!shellNormalized.arguments || typeof shellNormalized.arguments !== 'object' || Array.isArray(shellNormalized.arguments)) return shellNormalized;
  const input = { ...(shellNormalized.arguments as Record<string, unknown>) };
  if (['file.list', 'file.search'].includes(shellNormalized.name) && input.path === '') input.path = '.';
  if (shellNormalized.name === 'file.read' && input.offset !== undefined && (input.startLine !== undefined || input.endLine !== undefined)) {
    if (/\b(lines?|line numbers?|from line|through line)\b/i.test(userRequest)) delete input.offset;
    else { delete input.startLine; delete input.endLine; }
  }
  return { ...shellNormalized, arguments: input };
}

function inferredNetworkProfile(command: string, args: readonly string[]): ShellRunInput['networkProfile'] {
  const executable = path.basename(command).toLowerCase();
  const action = args.find((argument) => !argument.startsWith('-'))?.toLowerCase();
  if (['curl', 'wget', 'ssh', 'scp'].includes(executable)) return 'network';
  if (['npm', 'npx', 'pnpm', 'yarn', 'bun'].includes(executable) && ['install', 'ci', 'add', 'update', 'publish', 'dlx', 'create'].includes(action ?? '')) return 'package-manager';
  if (executable === 'git' && ['clone', 'fetch', 'pull', 'push', 'ls-remote'].includes(action ?? '')) return 'git';
  return 'offline';
}

export function sanitizeToolData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeToolData);
  if (!value || typeof value !== 'object') return typeof value === 'string' && /(?:sk-|github_pat_|gh[oprsu]_)[A-Za-z0-9_-]{10,}/.test(value) ? '[REDACTED]' : value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, /token|secret|password|authorization|credential|api.?key/i.test(key) ? '[REDACTED]' : sanitizeToolData(entry)]));
}

export function boundedToolEvidence(result: ToolResult, limit = 12_000): string {
  const text = JSON.stringify(sanitizeToolData({ toolName: result.toolName, success: result.success, output: result.output, error: result.error, affectedPaths: result.affectedPaths, exitCode: result.exitCode, warnings: result.warnings, truncated: result.truncated }), null, 2);
  return text.length > limit ? `${text.slice(0, limit)}\n[FORGE bounded the remaining tool output]` : text;
}

function boundedShellAuditOutput(output: unknown, limit = 64_000): unknown {
  if (!output || typeof output !== 'object') return undefined;
  const value = output as Record<string, unknown>;
  const bound = (entry: unknown): unknown => typeof entry === 'string' && entry.length > limit ? `${entry.slice(0, limit)}\n[FORGE bounded the remaining audited output]` : entry;
  return sanitizeToolData({
    executable: value.executable,
    argv: value.argv,
    cwd: value.cwd,
    stdout: bound(value.stdout),
    stderr: bound(value.stderr),
    exitCode: value.exitCode,
    signal: value.signal,
    timedOut: value.timedOut,
    cancelled: value.cancelled,
    truncated: value.truncated
  });
}

const INTERNAL_PROVIDER_ARGUMENTS = new Set(['reason', 'taskContext', 'originatingConversationId', 'auditId', 'stepId']);

/** Remove runtime-owned bookkeeping from every nested provider schema branch. */
export function modelVisibleToolSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== 'object') return value;
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'properties' && entry && typeof entry === 'object' && !Array.isArray(entry)) {
        output[key] = Object.fromEntries(Object.entries(entry as Record<string, unknown>)
          .filter(([property]) => !INTERNAL_PROVIDER_ARGUMENTS.has(property))
          .map(([property, propertySchema]) => [property, visit(propertySchema)]));
      } else if (key === 'required' && Array.isArray(entry)) {
        output[key] = entry.filter((property) => typeof property !== 'string' || !INTERNAL_PROVIDER_ARGUMENTS.has(property));
      } else {
        output[key] = visit(entry);
      }
    }
    return output;
  };
  return visit(schema) as Record<string, unknown>;
}

function inferExecutionReason(definition: ToolDefinition<any, any>, context: ToolRouterContext): string {
  const request = context.userRequest?.trim().replace(/\s+/g, ' ');
  return request
    ? `${definition.purpose} Current user request: ${request}`.slice(0, 2_000)
    : definition.purpose.slice(0, 2_000);
}

function enrichRuntimeArguments(argumentsValue: unknown, reasonValue: string, context: ToolRouterContext, toolName: string): unknown {
  if (!argumentsValue || typeof argumentsValue !== 'object' || Array.isArray(argumentsValue)) return argumentsValue;
  const { reason: _providerReason, taskContext: _providerTaskContext, originatingConversationId: _providerConversationId, auditId: _providerAuditId, stepId: _providerStepId, ...semanticArguments } = argumentsValue as Record<string, unknown>;
  const inferredProfile = SHELL_TOOL_NAMES.has(toolName) && typeof semanticArguments.command === 'string' ? inferredNetworkProfile(semanticArguments.command, Array.isArray(semanticArguments.args) ? semanticArguments.args : []) : 'offline';
  const networkProfile = inferredProfile === 'offline' ? semanticArguments.networkProfile : inferredProfile;
  const configuredTimeout = toolName === 'task.process.start' ? context.backgroundTaskTimeoutMs : context.processTimeoutMs;
  const standardTimeout = toolName === 'task.process.start' ? 600_000 : 120_000;
  const timeoutLimit = context.processMode === 'full-local-compute' ? configuredTimeout : Math.min(configuredTimeout ?? standardTimeout, standardTimeout);
  const suppliedTimeout = typeof semanticArguments.timeoutMs === 'number' ? semanticArguments.timeoutMs : timeoutLimit;
  const cappedTimeout = typeof timeoutLimit === 'number' && typeof suppliedTimeout === 'number' ? Math.min(suppliedTimeout, timeoutLimit) : undefined;
  return { ...semanticArguments, ...(SHELL_TOOL_NAMES.has(toolName) && cappedTimeout !== undefined ? { timeoutMs: cappedTimeout } : {}), reason: reasonValue, ...(SHELL_TOOL_NAMES.has(toolName) && !semanticArguments.expectedOutcome ? { expectedOutcome: reasonValue } : {}), ...(SHELL_TOOL_NAMES.has(toolName) && networkProfile ? { networkProfile } : {}), ...(toolName === 'task.create' ? { originatingConversationId: context.conversationId } : {}) };
}

export class ToolRouter {
  readonly registry: ToolRegistry;
  private readonly requests = new Map<string, ToolRequest>();
  private readonly controllers = new Map<string, AbortController>();
  private readonly executors = new Map<string, ToolExecutor>();
  private readonly workspaceRoots = new Map<string, string>();
  private readonly requestPathPolicies = new Map<string, FilesystemPathPolicy>();

  constructor(private readonly dependencies: { git: GitService; github?: GitHubService; shell: ShellService; terminal?: { list(): Array<{ id: string; cwd: string; state: string; exitCode: number | null; recentOutput: string }> }; tasks?: { get(taskId: string): Promise<unknown>; create(draft: any): Promise<unknown>; resume(taskId: string): Promise<unknown>; pause(taskId: string, reason: string): Promise<unknown>; cancel(taskId: string, reason: string, trackingOnly: boolean): Promise<unknown>; checkpoint(taskId: string, input: any): Promise<unknown>; generateHandoff(taskId: string): Promise<unknown>; startBackground(taskId: string, stepId: string, input: ShellRunInput, toolRequestId: string): Promise<unknown> }; browser?: BrowserToolService; memories?: { create(entry: { type: 'document'; title?: string | null; content: string; metadata?: unknown }): Promise<{ id: string; createdAt: number; updatedAt: number }> }; web: WebService; audit: AuditStore; dirtyPaths: () => ReadonlySet<string> }) {
    this.registry = createToolRegistry(); this.installExecutors();
  }

  definitions(): ToolDefinition<any, any>[] { return this.registry.list(); }
  capabilityCatalog(executionMode: ToolRouterContext['executionMode'] = 'controlled'): Array<{ name: string; purpose: string; category: string; sideEffect: string; available: boolean; unavailableReason?: string; registered: boolean; executorPresent: boolean; providerVisible: boolean; cancellable: boolean; networkAccess: boolean; inputSchema: Record<string, unknown> }> {
    return this.registry.list().map((entry) => {
      const availability = this.availability(entry.name);
      const modeAllows = executionMode !== 'disabled' && (executionMode !== 'controlled' || ['read', 'read-network'].includes(entry.sideEffect));
      return { name: entry.name, purpose: entry.purpose, category: entry.audit.category, sideEffect: entry.sideEffect, available: availability.available, unavailableReason: availability.reason, registered: true, executorPresent: this.executors.has(entry.name), providerVisible: modeAllows && availability.available, cancellable: entry.cancellable, networkAccess: entry.networkAccess, inputSchema: modelVisibleToolSchema(zodToJsonSchema(entry.inputSchema, { target: 'openApi3' }) as Record<string, unknown>) };
    });
  }
    providerDefinitions(executionMode: ToolRouterContext['executionMode'] = 'controlled'): Array<{ name: string; description: string; parameters: Record<string, unknown>; sideEffects: string; networkAccess: boolean; cancellation: boolean; resultSemantics: string }> { if (executionMode === 'disabled') return []; return this.registry.list().filter((entry) => this.availability(entry.name).available && (executionMode !== 'controlled' || ['read', 'read-network'].includes(entry.sideEffect))).map((entry) => ({ name: entry.name, description: entry.purpose, parameters: modelVisibleToolSchema(zodToJsonSchema(entry.inputSchema, { target: 'openApi3' }) as Record<string, unknown>), sideEffects: entry.sideEffect, networkAccess: entry.networkAccess, cancellation: entry.cancellable, resultSemantics: 'Returns a structured, bounded result with success, affected paths, warnings, and recovery metadata when applicable.' })); }
  listRequests(workspaceId?: string): ToolRequest[] { return [...this.requests.values()].filter((request) => !workspaceId || request.workspaceId === workspaceId).sort((a, b) => b.requestedAt - a.requestedAt).map((request) => ({ ...request, input: sanitizeToolData(request.input) })); }
  requestById(id: string): ToolRequest | undefined { const request = this.requests.get(id); return request ? { ...request } : undefined; }

  async request(call: ProviderToolCall, context: ToolRouterContext): Promise<ToolRequestOutcome> {
    const definitionForContext = this.registry.get(call.name);
    const executionReason = definitionForContext ? inferExecutionReason(definitionForContext, context) : `Request ${call.name}`;
    let parsed: ReturnType<ToolRegistry['parse']>;
    try {
      const normalizedCall = context.autoRepairToolArguments === false ? call : normalizeProviderToolCall(call, context.userRequest);
      const runtimeCall = { ...normalizedCall, arguments: enrichRuntimeArguments(normalizedCall.arguments, executionReason, context, normalizedCall.name) };
      parsed = this.registry.parse(runtimeCall);
    }
    catch (error) {
      await this.auditValidationFailure(call, context, error);
      throw error;
    }
    const { definition, input } = parsed;
        const policyFailure = this.policyFailure(definition, input, context);
        if (policyFailure) {
          const error = new ToolValidationError('POLICY_FAILURE', policyFailure);
          await this.auditValidationFailure(call, context, error);
          throw error;
        }
    const availability = this.availability(definition.name);
    if (!availability.available) {
      const error = new ToolValidationError('UNKNOWN_TOOL', `${definition.name} is not available: ${availability.reason ?? 'a required FORGE capability is unavailable.'}`);
      await this.auditValidationFailure(call, context, error);
      throw error;
    }
    this.workspaceRoots.set(context.workspaceId, context.workspaceRoot);
    const now = Date.now();
    const requestId = call.id || randomUUID();
    const pathPolicy: FilesystemPathPolicy = { workspaceRoot: context.workspaceRoot, scope: context.filesystemScope ?? 'workspace', repositoryRoot: context.repositoryRoot, projectTreeRoot: context.projectTreeRoot };
    // Prediction is advisory. A stale path or changed file must still produce an audited tool result.
    const prediction = await this.predict(definition.name, input, pathPolicy).catch((): { paths: string[]; diff?: string; target?: string } => ({ paths: [] }));
    const request: ToolRequest = {
      id: requestId, workspaceId: context.workspaceId, conversationId: context.conversationId, modelId: context.modelId,
      toolName: definition.name, input,
      executionContext: { requestId, workspaceId: context.workspaceId, conversationId: context.conversationId, modelId: context.modelId, reason: executionReason, ...context.task },
      reason: executionReason,
      target: prediction.target ?? definition.describeTarget(input), workingDirectory: typeof input.workingDirectory === 'string' ? input.workingDirectory : undefined,
      expectedEffect: definition.describeEffect(input), predictedAffectedPaths: prediction.paths, networkAccess: definition.networkAccess && (input.networkProfile ?? 'network') !== 'offline',
      externalDataDescription: typeof input.projectDataSent === 'string' ? input.projectDataSent : undefined, diff: prediction.diff,
      state: 'requested', requestedAt: now, updatedAt: now
    };
    this.requests.set(request.id, request);
    this.requestPathPolicies.set(request.id, pathPolicy);
    const result = await this.execute(request.id, context);
    return { request: { ...request }, result };
  }

  async cancel(requestId: string, context: ToolRouterContext): Promise<boolean> {
    const request = this.required(requestId); if (request.workspaceId !== context.workspaceId) throw new Error('Tool request belongs to another workspace.');
    if (request.state === 'requested') { request.state = 'cancelled'; request.updatedAt = Date.now(); await this.dependencies.audit.appendAction(this.record(request, 'cancelled', false, 0, 'Tool request cancelled before execution.', [])); return true; }
    if (request.state !== 'running') return false;
    this.controllers.get(requestId)?.abort();
    if (SHELL_TOOL_NAMES.has(request.toolName)) this.dependencies.shell.cancel(requestId);
    return true;
  }

  async cancelAll(workspaceId: string): Promise<number> {
    const active = [...this.requests.values()].filter((request) => request.workspaceId === workspaceId && ['requested', 'running'].includes(request.state));
    let cancelled = 0;
    for (const request of active) if (await this.cancel(request.id, { workspaceId } as ToolRouterContext)) cancelled += 1;
    return cancelled;
  }

  async cancelTask(taskId: string): Promise<number> {
    const active = [...this.requests.values()].filter((request) => request.executionContext.taskId === taskId && ['requested', 'running'].includes(request.state));
    let cancelled = 0;
    for (const request of active) if (await this.cancel(request.id, { workspaceId: request.workspaceId } as ToolRouterContext)) cancelled += 1;
    return cancelled;
  }

  private async execute(requestId: string, _context: ToolRouterContext): Promise<ToolResult> {
    const request = this.required(requestId); const definition = this.registry.get(request.toolName)!; const executor = this.executors.get(request.toolName);
    if (!executor) throw new Error(`No executor is registered for ${request.toolName}.`);
    request.state = 'running'; request.updatedAt = Date.now(); const started = Date.now(); const controller = new AbortController(); this.controllers.set(request.id, controller);
    try {
      const partial = await executor(request.input, request, controller.signal);
      const output = partial.output === undefined ? undefined : definition.outputSchema.parse(partial.output);
      const result: ToolResult = { ...partial, output, requestId: request.id, toolName: request.toolName, durationMs: Date.now() - started };
      request.state = result.success ? 'succeeded' : result.cancelled ? 'cancelled' : 'failed'; request.updatedAt = Date.now();
      await this.dependencies.audit.appendAction(this.record(request, result.success ? 'succeeded' : result.cancelled ? 'cancelled' : 'failed', result.success, result.durationMs, result.success ? 'Tool completed successfully.' : result.error?.message ?? 'Tool failed.', result.affectedPaths, result.exitCode, result.rollback, result.output));
      return result;
    } catch (error) {
      const durationMs = Date.now() - started; const cancelled = controller.signal.aborted;
      const message = error instanceof Error ? error.message : String(error);
      const errorCode = cancelled ? 'CANCELLED' : message.startsWith('SCOPE_FAILURE:') ? 'SCOPE_FAILURE' : 'EXECUTION_FAILED';
      const result: ToolResult = { requestId: request.id, toolName: request.toolName, success: false, affectedPaths: [], warnings: [], error: { code: errorCode, message }, durationMs, cancelled };
      request.state = cancelled ? 'cancelled' : 'failed'; request.updatedAt = Date.now();
      await this.dependencies.audit.appendAction(this.record(request, cancelled ? 'cancelled' : 'failed', false, durationMs, result.error!.message, []));
      return result;
    } finally { this.controllers.delete(request.id); this.requestPathPolicies.delete(request.id); }
  }

  private record(request: ToolRequest, executionState: AuditRecord['executionState'], success: boolean, executionDurationMs: number, resultSummary: string, affectedPaths: string[], exitCode?: number | null, rollback?: ToolResult['rollback'], output?: unknown): AuditRecord {
    const auditedOutput = request.toolName === 'shell.run' ? boundedShellAuditOutput(output) : undefined;
    return { id: request.id, timestamp: Date.now(), workspaceId: request.workspaceId, conversationId: request.conversationId, modelId: request.modelId, toolName: request.toolName, taskId: request.executionContext.taskId, stepId: request.executionContext.stepId, sanitizedInputs: sanitizeToolData(request.input), executionState, executionDurationMs, success, result: { success, summary: resultSummary, exitCode: exitCode ?? null, affectedPathCount: affectedPaths.length, rollbackAvailable: rollback?.available ?? false, ...(auditedOutput === undefined ? {} : { output: auditedOutput }) }, resultSummary, affectedPaths, exitCode, rollback };
  }

  private async auditValidationFailure(call: ProviderToolCall, context: ToolRouterContext, error: unknown): Promise<void> {
    const summary = error instanceof Error ? error.message : String(error);
    await this.dependencies.audit.appendAction({ id: randomUUID(), timestamp: Date.now(), workspaceId: context.workspaceId, conversationId: context.conversationId, modelId: context.modelId, toolName: call.name, taskId: context.task?.taskId, stepId: context.task?.stepId, sanitizedInputs: sanitizeToolData(call.arguments), executionState: 'validation-failed', executionDurationMs: 0, success: false, result: { success: false, summary }, resultSummary: summary, affectedPaths: [] });
  }

  private required(id: string): ToolRequest { const request = this.requests.get(id); if (!request) throw new Error('Unknown tool request.'); return request; }

  private availability(name: string): { available: boolean; reason?: string } {
    if (name === 'terminal.read' && !this.dependencies.terminal) return { available: false, reason: 'the user terminal service is unavailable' };
    if (name.startsWith('github.') && !this.dependencies.github) return { available: false, reason: 'GitHub integration is unavailable' };
    if (name.startsWith('task.') && !this.dependencies.tasks) return { available: false, reason: 'the persistent task runtime is unavailable' };
    if (name.startsWith('browser.') && !this.dependencies.browser) return { available: false, reason: 'the FORGE Browser is unavailable' };
    if (name.startsWith('browser.') && !this.dependencies.browser?.enabled()) return { available: false, reason: 'external web research is disabled in Settings' };
    if (name === 'browser.savecontext' && !this.dependencies.memories) return { available: false, reason: 'durable workspace memory is unavailable' };
    if (name.startsWith('web.') && !this.dependencies.web.isEnabled()) return { available: false, reason: 'external web research is disabled in Settings' };
    return { available: true };
  }

  private policyFailure(definition: ToolDefinition<any, any>, input: any, context: ToolRouterContext): string | undefined {
    if (context.executionMode === 'disabled') return 'POLICY_FAILURE: Tool execution is disabled in Settings.';
    if (context.executionMode === 'controlled' && !['read', 'read-network'].includes(definition.sideEffect)) return 'POLICY_FAILURE: Controlled mode permits read-only capabilities. Select Allow All in Settings to authorize mutations, processes, or network writes.';
    const network = context.networkAccess;
    if (definition.sideEffect === 'read-network' || definition.sideEffect === 'write-network') {
      if (definition.name.startsWith('github.') || ['git.pull', 'git.push'].includes(definition.name)) {
        if (network && !network.git) return 'POLICY_FAILURE: Git network access is disabled in Settings.';
      } else if (network && !network.web) return 'POLICY_FAILURE: Web network access is disabled in Settings.';
    }
    if (['shell.run', 'task.process.start'].includes(definition.name)) {
      if (definition.name === 'task.process.start' && context.backgroundTasksEnabled === false) return 'POLICY_FAILURE: Background task processes are disabled in Settings.';
      const inferred = typeof input.command === 'string' ? inferredNetworkProfile(input.command, Array.isArray(input.args) ? input.args : []) : 'offline';
      const profile = inferred === 'offline' ? input.networkProfile ?? 'offline' : inferred;
      if (network && profile === 'git' && !network.git) return 'POLICY_FAILURE: Git network access is disabled in Settings.';
      if (network && profile === 'package-manager' && !network.packageManager) return 'POLICY_FAILURE: Package-manager network access is disabled in Settings.';
      if (network && profile === 'network' && !network.general) return 'POLICY_FAILURE: General network access is disabled in Settings.';
    }
    return undefined;
  }

  private async predict(name: string, input: any, policy: FilesystemPathPolicy): Promise<{ paths: string[]; diff?: string; target?: string }> {
    if (name === 'file.create') return { paths: [input.path], diff: unifiedDiff(input.path, '', input.content) };
    if (name === 'file.write') { const absolute = await resolveScopedPath(policy, input.path); const existing = await readText(absolute); return { paths: [absolute], diff: unifiedDiff(absolute, existing.content, input.content), target: absolute }; }
    if (name === 'file.patch') { const absolute = await resolveScopedPath(policy, input.path); const existing = await readText(absolute); const after = applyReplacement(existing.content, input.expected, input.replacement, input.replaceAll); return { paths: [absolute], diff: unifiedDiff(absolute, existing.content, after), target: absolute }; }
    if (['file.rename', 'file.move'].includes(name)) return { paths: [input.from, input.to] };
    if (name === 'directory.create' || name === 'file.delete') return { paths: [input.path] };
    if (name === 'git.stage' || name === 'git.unstage') { const status = await this.dependencies.git.status(); return { paths: input.files, target: `branch ${status.branch}: ${input.files.join(', ')}` }; }
    if (name === 'git.commit') { const status = await this.dependencies.git.status(); const paths = status.files.filter((file) => file.indexStatus !== ' ' && file.indexStatus !== '?').map((file) => file.path); return { paths, target: `branch ${status.branch}: ${paths.join(', ') || 'no staged files'}` }; }
    if (name === 'git.pull' || name === 'git.push') { const status = await this.dependencies.git.status(); return { paths: status.files.map((file) => file.path), target: `origin / branch ${status.branch}` }; }
    return { paths: [] };
  }

  private installExecutors(): void {
    const ok = (output: unknown, affectedPaths: string[] = [], extra: Partial<ToolResult> = {}): any => ({ success: true, output: { success: true, ...output as object }, affectedPaths, warnings: [], ...extra });
    this.executors.set('task.redirect', async (input) => {
      if (!this.dependencies.tasks) throw new Error('Persistent task runtime is unavailable.');
      const taskService = this.dependencies.tasks as typeof this.dependencies.tasks & { redirect(taskId: string, instruction: string): Promise<unknown> };
      return ok({ task: await taskService.redirect(input.taskId, input.instruction) });
    });
    const missing = (requestedPath: string): Record<string, unknown> => ({ missing: true, requestedPath, recovery: { action: 'restart-at-workspace-root', path: '.', nearestRequestedParent: path.dirname(requestedPath) || '.', instruction: 'List the workspace root, discover the real layout, and retry only with an observed path.' } });
    this.executors.set('file.list', async (input, request) => {
      const requestedPath = input.path === '.' ? '.' : input.path; const root = await fs.realpath(this.root(request)); const absolute = await this.resolvePath(request, requestedPath, true);
      if (!await pathExists(absolute)) return ok({ ...missing(requestedPath), entries: [], truncated: false });
      const entries: Array<{ path: string; type: string; size: number }> = [];
      const skipped: Array<{ path: string; error: string }> = [];
      const scanLimit = input.offset + input.maxEntries + 1;
      const visit = async (current: string, depth: number): Promise<void> => {
        if (entries.length >= scanLimit) return;
        let directory: Dirent[];
        try { directory = await fs.readdir(current, { withFileTypes: true }); }
        catch (error) { if (skippableFileSystemError(error)) { if (skipped.length < 100) skipped.push({ path: displayPath(root, current), error: String((error as NodeJS.ErrnoException).code) }); return; } throw error; }
        directory.sort((left, right) => left.name.localeCompare(right.name));
        for (const entry of directory) {
          if (entries.length >= scanLimit) return;
          const child = path.join(current, entry.name);
          try {
            const stat = await fs.lstat(child);
            entries.push({ path: displayPath(root, child), type: entry.isDirectory() ? 'directory' : entry.isSymbolicLink() ? 'symlink' : 'file', size: stat.size });
            if (input.recursive && entry.isDirectory() && depth < input.maxDepth) await visit(child, depth + 1);
          } catch (error) { if (!skippableFileSystemError(error)) throw error; if (skipped.length < 100) skipped.push({ path: displayPath(root, child), error: String((error as NodeJS.ErrnoException).code) }); }
        }
      };
      await visit(absolute, 0); const page = entries.slice(input.offset, input.offset + input.maxEntries); const nextOffset = input.offset + page.length; const truncated = nextOffset < entries.length;
      return ok({ entries: page, totalEntries: truncated ? undefined : entries.length, totalEntriesAtLeast: entries.length, skipped, truncated, continuation: truncated ? { offset: nextOffset, instruction: 'Call file.list again with the same path, recursion, and depth plus this offset.' } : undefined });
    });
    this.executors.set('file.read', async (input, request) => {
      const absolute = await this.resolvePath(request, input.path, true); if (!await pathExists(absolute)) return ok(missing(input.path));
      const stat = await fs.stat(absolute);
      if (!stat.isFile()) return ok({ path: input.path, unreadable: true, reason: 'not-a-file', recovery: { action: 'list-path', path: input.path, instruction: 'Use file.list for directories, then call file.read with an observed file path.' } });
      const data = await readText(absolute, MAX_RANGED_TEXT_BYTES);
      const content = data.content; const lineStarts = [0]; for (let index = 0; index < content.length; index += 1) if (content[index] === '\n') lineStarts.push(index + 1);
      const totalLines = lineStarts.length; const startOffset = input.offset ?? lineStarts[(input.startLine ?? 1) - 1] ?? content.length;
      const requestedEnd = input.endLine === undefined ? content.length : (lineStarts[input.endLine] ?? content.length);
      const endOffset = Math.max(startOffset, Math.min(content.length, requestedEnd)); const maxEnd = Math.min(endOffset, startOffset + input.maxCharacters);
      const returned = content.slice(startOffset, maxEnd); const lineAt = (offset: number): number => { let line = 0; for (let index = 1; index < lineStarts.length; index += 1) { if (lineStarts[index] > offset) break; line = index; } return line + 1; };
      const truncated = maxEnd < endOffset;
      return ok({ path: input.path, content: returned, encoding: data.encoding, totalCharacters: content.length, totalLines, returnedRange: { offset: startOffset, length: returned.length, startLine: lineAt(startOffset), endLine: lineAt(Math.max(startOffset, maxEnd - 1)) }, truncated, continuation: truncated ? { offset: maxEnd, instruction: 'Call file.read again with this offset and the same maxCharacters.' } : undefined });
    });
    this.executors.set('file.read.binary', async (input, request) => {
      const absolute = await this.resolvePath(request, input.path);
      const [buffer, stat] = await Promise.all([fs.readFile(absolute), fs.stat(absolute)]);
      if (!stat.isFile()) return ok({ path: input.path, unreadable: true, reason: 'not-a-file' });
      if (buffer.byteLength > input.maxBytes) throw new Error(`Binary file exceeds the requested ${input.maxBytes.toLocaleString()} byte limit.`);
      return ok({ path: input.path, encoding: 'base64', content: buffer.toString('base64'), byteLength: buffer.byteLength, mode: stat.mode });
    });
    this.executors.set('file.search', async (input, request, signal) => {
      const requestedPath = input.path === '.' ? '.' : input.path; const root = await fs.realpath(this.root(request)); const absolute = await this.resolvePath(request, requestedPath, true);
      if (!await pathExists(absolute)) return ok({ ...missing(requestedPath), matches: [], truncated: false });
      const matches: Array<{ path: string; line: number; text: string }> = []; let matchOffset = 0; const query = input.caseSensitive ? input.query : input.query.toLowerCase();
      const skipped: Array<{ path: string; error: string }> = [];
      const visit = async (current: string): Promise<void> => {
        if (signal.aborted || matches.length >= input.maxResults) return;
        let directory: Dirent[];
        try { directory = await fs.readdir(current, { withFileTypes: true }); }
        catch (error) { if (skippableFileSystemError(error)) { if (skipped.length < 100) skipped.push({ path: displayPath(root, current), error: String((error as NodeJS.ErrnoException).code) }); return; } throw error; }
        for (const entry of directory) {
          if (signal.aborted || matches.length >= input.maxResults) return;
          const child = path.join(current, entry.name);
          if (entry.isDirectory()) await visit(child);
          else if (entry.isFile()) {
            try {
              const data = await readText(child);
              for (const [index, line] of data.content.split(/\r?\n/).entries()) {
                const haystack = input.caseSensitive ? line : line.toLowerCase();
                if (haystack.includes(query)) { if (matchOffset >= input.offset) matches.push({ path: displayPath(root, child), line: index + 1, text: line.slice(0, 2_000) }); matchOffset += 1; }
                if (matches.length >= input.maxResults) break;
              }
            } catch (error) { if (skippableFileSystemError(error) && skipped.length < 100) skipped.push({ path: displayPath(root, child), error: String((error as NodeJS.ErrnoException).code) }); }
          }
        }
      };
      await visit(absolute); const truncated = matches.length >= input.maxResults;
      return ok({ matches, skipped, truncated, totalOrMore: input.offset + matches.length + (truncated ? 1 : 0), continuation: truncated ? { offset: input.offset + matches.length, instruction: 'Call file.search again with the same query/path and this offset.' } : undefined });
    });
    this.executors.set('file.create', async (input, request) => { this.assertNotDirty(input.path); const absolute = await this.resolvePath(request, input.path, true); await fs.mkdir(path.dirname(absolute), { recursive: true }); await fs.writeFile(absolute, input.content, { flag: 'wx' }); return ok({ path: absolute }, [absolute], { diff: request.diff, rollback: { available: true, instructions: `Delete ${absolute} to undo this creation.` } }); });
    for (const name of ['file.write', 'file.patch']) this.executors.set(name, async (input, request) => { this.assertNotDirty(input.path); const absolute = await this.resolvePath(request, input.path); const original = await readText(absolute); const after = name === 'file.write' ? input.content : applyReplacement(original.content, input.expected, input.replacement, input.replaceAll); const backup = await backupPath(this.root(request), absolute); await fs.copyFile(absolute, backup); await atomicWrite(absolute, after, original.encoding, original.mode); return ok({ path: absolute }, [absolute], { diff: unifiedDiff(absolute, original.content, after), rollback: { available: true, backupPath: path.relative(this.root(request), backup).replaceAll('\\', '/'), instructions: `Restore the backup over ${absolute}.` } }); });
    for (const name of ['file.rename', 'file.move']) this.executors.set(name, async (input, request) => { this.assertNotDirty(input.from); this.assertNotDirty(input.to); const source = await this.resolvePath(request, input.from); const destination = await this.resolvePath(request, input.to, true); await fs.access(destination).then(() => { throw new Error('Destination already exists.'); }).catch((error) => { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return; throw error; }); await fs.mkdir(path.dirname(destination), { recursive: true }); await fs.rename(source, destination); return ok({}, [source, destination], { rollback: { available: true, instructions: `Move ${destination} back to ${source}.` } }); });
    this.executors.set('directory.create', async (input, request) => { const absolute = await this.resolvePath(request, input.path, true); await fs.mkdir(absolute, { recursive: false }); return ok({}, [absolute], { rollback: { available: true, instructions: `Remove the empty directory ${absolute}.` } }); });
    this.executors.set('file.delete', async (input, request) => { this.assertNotDirty(input.path); const absolute = await this.resolvePath(request, input.path); if (inside(absolute, await fs.realpath(this.root(request)))) throw new Error('Deleting the active workspace or one of its parent directories would make the rollback backup recursive. Delete a narrower path.'); const backup = await backupPath(this.root(request), absolute); await fs.cp(absolute, backup, { recursive: true, errorOnExist: true }); await fs.rm(absolute, { recursive: true, force: false }); return ok({}, [absolute], { rollback: { available: true, backupPath: path.relative(this.root(request), backup).replaceAll('\\', '/'), instructions: `Restore the backup to ${absolute}.` } }); });
    this.executors.set('terminal.read', async (input) => { if (!this.dependencies.terminal) throw new Error('Terminal evidence is unavailable.'); const sessions = this.dependencies.terminal.list().filter((session) => !input.sessionId || session.id === input.sessionId).map((session) => ({ id: session.id, cwd: session.cwd, state: session.state, exitCode: session.exitCode, recentOutput: session.recentOutput.slice(-(input.maxCharacters ?? 4_000)) })); return ok({ sessions }); });
    this.executors.set('git.status', async () => ok({ status: await this.dependencies.git.status() })); this.executors.set('git.diff', async (input) => ok({ diff: await this.dependencies.git.diff(input.staged) })); this.executors.set('git.log', async (input) => ok({ commits: await this.dependencies.git.log(input.limit) })); this.executors.set('git.branches', async () => ok({ branches: await this.dependencies.git.branches() }));
    this.executors.set('git.stage', async (input) => { await this.dependencies.git.stage(input.files); return ok({}, input.files); }); this.executors.set('git.unstage', async (input) => { await this.dependencies.git.unstage(input.files); return ok({}, input.files); });
    this.executors.set('git.commit', async (input) => { const status = await this.dependencies.git.status(); const staged = status.files.filter((file) => file.indexStatus !== ' ' && file.indexStatus !== '?').map((file) => file.path); if (!staged.length) throw new Error('No staged files are available to commit.'); const commit = await this.dependencies.git.commit(input.message); return ok({ commit, branch: status.branch, stagedFiles: staged }, staged); });
    this.executors.set('git.pull', async () => { const status = await this.dependencies.git.status(); if (status.files.length) throw new Error('Pull is blocked while the working tree is dirty.'); await this.dependencies.git.pull(); return ok({ branch: status.branch }); }); this.executors.set('git.push', async () => { const status = await this.dependencies.git.status(); await this.dependencies.git.push(); return ok({ branch: status.branch }); });
    this.executors.set('shell.run', async (input: ShellRunInput, request) => { const workingDirectory = await this.resolvePath(request, input.workingDirectory ?? '.', false); const output = await this.dependencies.shell.run({ ...input, workingDirectory }, request.id, true); return { success: output.exitCode === 0 && !output.timedOut && !output.cancelled, output: { success: output.exitCode === 0 && !output.timedOut && !output.cancelled, ...output }, affectedPaths: [], warnings: [], exitCode: output.exitCode, truncated: output.truncated, cancelled: output.cancelled, ...(output.exitCode === 0 && !output.timedOut && !output.cancelled ? {} : { error: { code: output.timedOut ? 'TIMEOUT' : output.cancelled ? 'CANCELLED' : 'NONZERO_EXIT', message: `Command exited with code ${output.exitCode ?? 'unknown'}.` } }) }; });
    this.executors.set('web.search', async (input) => ok(await this.dependencies.web.search(input.query))); this.executors.set('web.fetch', async (input) => ok(await this.dependencies.web.fetch(input.url)));
    this.executors.set('browser.open', async (input) => {
      if (!this.dependencies.browser) throw new Error('The FORGE Browser is unavailable.');
      if (!this.dependencies.browser.enabled()) throw new Error('Agent web research is disabled in Settings. Enable it before asking the agent to use the FORGE Browser.');
      return ok(await this.dependencies.browser.open(input.url));
    });
    this.executors.set('browser.read', async () => {
      if (!this.dependencies.browser) throw new Error('The FORGE Browser is unavailable.');
      if (!this.dependencies.browser.enabled()) throw new Error('Agent web research is disabled in Settings. Enable it before sending browser content to the model.');
      return ok(await this.dependencies.browser.read());
    });
    this.executors.set('browser.find', async (input) => {
      if (!this.dependencies.browser) throw new Error('The FORGE Browser is unavailable.');
      if (!this.dependencies.browser.enabled()) throw new Error('Agent web research is disabled in Settings. Enable it before sending browser content to the model.');
      const page = await this.dependencies.browser.read();
      const needle = input.query.toLocaleLowerCase();
      const matches: Array<{ index: number; excerpt: string }> = [];
      let offset = 0;
      while (matches.length < input.maxResults) {
        const index = page.text.toLocaleLowerCase().indexOf(needle, offset);
        if (index < 0) break;
        matches.push({ index, excerpt: page.text.slice(Math.max(0, index - 180), Math.min(page.text.length, index + needle.length + 420)).replace(/\s+/g, ' ').trim() });
        offset = index + Math.max(1, needle.length);
      }
      return ok({ url: page.url, title: page.title, query: input.query, matches, truncated: page.truncated || matches.length >= input.maxResults });
    });
    this.executors.set('browser.savecontext', async (input) => {
      if (!this.dependencies.browser || !this.dependencies.memories) throw new Error('Browser context storage is unavailable.');
      const page = await this.dependencies.browser.read();
      const memory = await this.dependencies.memories.create({ type: 'document', title: input.title, content: input.content, metadata: { source: 'forge-browser', url: page.url, pageTitle: page.title, savedAt: Date.now() } });
      return ok({ memory: { id: memory.id, title: input.title, url: page.url, pageTitle: page.title, createdAt: memory.createdAt } }, [], { rollback: { available: true, instructions: `Delete durable memory ${memory.id} from Workspace Intelligence to remove this saved browser context.` } });
    });
    this.executors.set('github.read', async (input) => { if (!this.dependencies.github) throw new Error('GitHub integration is unavailable.'); return ok(await this.dependencies.github.read(input.resource, input)); });
    this.executors.set('github.mutate', async (input) => { if (!this.dependencies.github) throw new Error('GitHub integration is unavailable.'); return ok(await this.dependencies.github.mutate(input.action, input)); });
    this.executors.set('task.inspect', async (input) => { if (!this.dependencies.tasks) throw new Error('Persistent task runtime is unavailable.'); return ok({ task: await this.dependencies.tasks.get(input.taskId) }); });
    this.executors.set('task.create', async (input) => { if (!this.dependencies.tasks) throw new Error('Persistent task runtime is unavailable.'); const { reason: _reason, ...draft } = input; return ok({ task: await this.dependencies.tasks.create(draft) }); });
    this.executors.set('task.resume', async (input) => { if (!this.dependencies.tasks) throw new Error('Persistent task runtime is unavailable.'); return ok({ task: await this.dependencies.tasks.resume(input.taskId) }); });
    this.executors.set('task.pause', async (input) => { if (!this.dependencies.tasks) throw new Error('Persistent task runtime is unavailable.'); return ok({ task: await this.dependencies.tasks.pause(input.taskId, input.reason) }); });
    this.executors.set('task.cancel', async (input) => { if (!this.dependencies.tasks) throw new Error('Persistent task runtime is unavailable.'); return ok({ task: await this.dependencies.tasks.cancel(input.taskId, input.reason, input.trackingOnly) }); });
    this.executors.set('task.checkpoint', async (input, request) => { if (!this.dependencies.tasks) throw new Error('Persistent task runtime is unavailable.'); const { taskId, stepId } = request.executionContext; if (!taskId || !stepId) throw new Error('task.checkpoint requires an active persistent task step; FORGE supplies its IDs internally.'); return ok({ task: await this.dependencies.tasks.checkpoint(taskId, { ...input, stepId, auditReference: request.id }) }); });
    this.executors.set('task.handoff', async (_input, request) => { if (!this.dependencies.tasks) throw new Error('Persistent task runtime is unavailable.'); const taskId = request.executionContext.taskId; if (!taskId) throw new Error('task.handoff requires an active persistent task; FORGE supplies its ID internally.'); const handoff = await this.dependencies.tasks.generateHandoff(taskId) as { relativePath?: string }; return ok({ handoff }, handoff.relativePath ? [handoff.relativePath] : []); });
    this.executors.set('task.process.start', async (input, request) => { if (!this.dependencies.tasks) throw new Error('Persistent task runtime is unavailable.'); const { taskId, stepId } = request.executionContext; if (!taskId || !stepId) throw new Error('task.process.start requires an active persistent task step; FORGE supplies its IDs internally.'); const workingDirectory = await this.resolvePath(request, input.workingDirectory ?? '.', false); const processInput: ShellRunInput = { command: input.command, args: input.args, workingDirectory, timeoutMs: input.timeoutMs, environment: input.environment, environmentAllowlist: input.environmentAllowlist, networkProfile: input.networkProfile, reason: input.reason, expectedOutcome: input.expectedOutcome }; const started = await this.dependencies.tasks.startBackground(taskId, stepId, processInput, request.id) as { process?: { outputPath?: string } }; return ok({ started }, started.process?.outputPath ? [started.process.outputPath] : []); });
  }

  private root(request: ToolRequest): string { const root = this.workspaceRoots.get(request.workspaceId); if (!root) throw new Error('Workspace root is unavailable for this request.'); return root; }
  private resolvePath(request: ToolRequest, requestedPath: string, allowMissing = false): Promise<string> {
    const policy = this.requestPathPolicies.get(request.id) ?? { workspaceRoot: this.root(request), scope: 'workspace' as const };
    return resolveScopedPath(policy, requestedPath, allowMissing);
  }
  private assertNotDirty(relative: string): void { if (this.dependencies.dirtyPaths().has(relative)) throw new Error(`The editor has unsaved content for ${relative}; save or discard it before tool execution.`); }
}

async function pathExists(absolute: string): Promise<boolean> {
  try { await fs.access(absolute); return true; }
  catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false; throw error; }
}

function applyReplacement(content: string, expected: string, replacement: string, replaceAll: boolean): string {
  if (!content.includes(expected)) throw new Error('Patch precondition failed: expected text was not found.');
  if (!replaceAll && content.indexOf(expected) !== content.lastIndexOf(expected)) throw new Error('Patch is ambiguous; expected text occurs more than once.');
  return replaceAll ? content.split(expected).join(replacement) : content.replace(expected, replacement);
}

export function normalizeNativeToolCall(provider: string, raw: unknown): ProviderToolCall {
  const candidate = raw as { id?: unknown; function?: { name?: unknown; arguments?: unknown }; name?: unknown; arguments?: unknown };
  const name = candidate?.function?.name ?? candidate?.name;
  const args = candidate?.function?.arguments ?? candidate?.arguments;
  if (typeof name !== 'string') throw new ToolValidationError('MALFORMED_ARGUMENTS', 'Provider tool call is missing a name.');
  let parsed = args;
  if (typeof args === 'string') { try { parsed = JSON.parse(args); } catch { throw new ToolValidationError('MALFORMED_ARGUMENTS', 'Provider tool arguments are not valid JSON.'); } }
  return { id: typeof candidate.id === 'string' ? candidate.id : randomUUID(), name, arguments: parsed, provider };
}

export function parseStructuredToolFallback(provider: string, text: string): ProviderToolCall | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  let value: unknown; try { value = JSON.parse(trimmed); } catch { return null; }
  const parsed = z.object({ type: z.literal('forge_tool_request'), id: z.string().optional(), tool: z.string(), arguments: z.unknown() }).strict().safeParse(value);
  if (!parsed.success) return null;
  return { id: parsed.data.id ?? randomUUID(), name: parsed.data.tool, arguments: parsed.data.arguments, provider };
}
