import { chmod, mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { boundedToolEvidence, ToolRouter, createToolRegistry, normalizeCommandLine, normalizeProviderToolCall, parseStructuredToolFallback, resolveContainedPath, resolveScopedPath, unifiedDiff, type AuditRecord, type ProviderToolCall } from '../src';

const fakeGit = { status: async () => ({ branch: 'main', ahead: 0, behind: 0, files: [], head: null }), branches: async () => [], log: async () => [], diff: async () => ({ files: [] }), stage: async () => undefined, unstage: async () => undefined, commit: async () => ({ hash: '1' }), pull: async () => undefined, push: async () => undefined } as any;
const fakeShell = { run: async () => ({ stdout: '', stderr: '', exitCode: 0, signal: null, timedOut: false, cancelled: false, truncated: false }), cancel: () => true } as any;
const fakeWeb = { isEnabled: () => true, search: async () => ({ query: '', results: [] }), fetch: async () => ({}) } as any;
const fakeBrowser = { enabled: () => true, open: async (url: string) => ({ url, title: 'Example', canGoBack: false, canGoForward: false }), read: async () => ({ url: 'https://example.com/', title: 'Example Domain', text: 'Example Domain This domain is for use in illustrative examples in documents.', truncated: false }) };
const fakeTasks = { get: async () => ({}), create: async () => ({}), resume: async () => ({}), pause: async () => ({}), cancel: async () => ({}), redirect: async (_taskId: string, instruction: string) => ({ instruction }), checkpoint: async () => ({}), generateHandoff: async () => ({}), startBackground: async () => ({}) } as any;

describe('agent tool runtime', () => {
  describe('shell command normalization', () => {
    it('normalizes a single executable with no arguments', () => {
      expect(normalizeCommandLine('hermes')).toEqual({ command: 'hermes', args: [] });
    });

    it('normalizes an executable with multiple arguments', () => {
      expect(normalizeCommandLine('hermes acp --help')).toEqual({ command: 'hermes', args: ['acp', '--help'] });
      expect(normalizeCommandLine('cd ..')).toEqual({ command: 'bash', args: ['-lc', 'cd ..'] });
    });

    it('passes normalized executable and argv separately through ToolRouter and the audit record', async () => {
      const root = await mkdtemp(path.join(os.tmpdir(), 'forge-normalized-shell-'));
      const records: AuditRecord[] = [];
      let received: unknown;
      const shell = { ...fakeShell, run: async (input: unknown) => { received = input; return { executable: 'hermes', argv: ['acp', '--help'], cwd: root, stdout: 'usage: hermes acp', stderr: '', exitCode: 0, signal: null, timedOut: false, cancelled: false, truncated: false }; } };
      const router = new ToolRouter({ git: fakeGit, shell, web: fakeWeb, audit: { appendAction: async (record) => { records.push(record); }, listActions: async () => records }, dirtyPaths: () => new Set() });
      const context = { workspaceId: 'workspace-1', workspaceRoot: root, conversationId: 'conversation-1', modelId: 'test-model' };
      const outcome = await router.request({ id: 'normalized-shell', name: 'shell.run', provider: 'test', arguments: { command: 'hermes acp --help', expectedOutcome: 'help output' } }, context);
      expect(received).toMatchObject({ command: 'hermes', args: ['acp', '--help'] });
      expect(outcome.request.input).toMatchObject({ command: 'hermes', args: ['acp', '--help'] });
      expect(records.at(-1)).toMatchObject({ sanitizedInputs: { command: 'hermes', args: ['acp', '--help'] }, exitCode: 0, result: { output: { executable: 'hermes', argv: ['acp', '--help'], cwd: root, stdout: 'usage: hermes acp', exitCode: 0 } } });
    });

    it('preserves a quoted argument containing spaces as one argv entry', () => {
      expect(normalizeCommandLine('printf "%s\\n" "hello world"')).toEqual({ command: 'printf', args: ['%s\\n', 'hello world'] });
    });

    it.each([
      ['an && chain', 'which hermes && hermes --version'],
      ['a pipe', 'printf shell-ok | cat'],
      ['a redirect', 'printf shell-ok > result.txt'],
      ['an unquoted glob', 'sha256sum *.iso']
    ])('routes %s through bash -lc', (_name, script) => {
      expect(normalizeCommandLine(script)).toEqual({ command: 'bash', args: ['-lc', script] });
    });

    it('normalizes a command array before the shell executor runs', async () => {
      const root = await mkdtemp(path.join(os.tmpdir(), 'forge-malformed-shell-'));
      let executed = false;
      const router = new ToolRouter({ git: fakeGit, shell: { ...fakeShell, run: async () => { executed = true; return fakeShell.run(); } }, web: fakeWeb, audit: { appendAction: async () => undefined, listActions: async () => [] }, dirtyPaths: () => new Set() });
      const context = { workspaceId: 'workspace-1', workspaceRoot: root, conversationId: 'conversation-1', modelId: 'test-model' };
      const result = await router.request({ id: 'array-shell', name: 'shell.run', provider: 'test', arguments: ['hermes', 'acp', '--help'] }, context);
      expect(result.result?.success).toBe(true);
      expect(result.request.input).toMatchObject({ command: 'hermes', args: ['acp', '--help'] });
      expect(executed).toBe(true);
    });

    it('accepts a plain command string and infers a network profile', async () => {
      const root = await mkdtemp(path.join(os.tmpdir(), 'forge-shell-text-'));
      const router = new ToolRouter({ git: fakeGit, shell: fakeShell, web: fakeWeb, audit: { appendAction: async () => undefined, listActions: async () => [] }, dirtyPaths: () => new Set() });
      const context = { workspaceId: 'workspace-1', workspaceRoot: root, conversationId: 'conversation-1', modelId: 'test-model', userRequest: 'Install dependencies.' };
      const result = await router.request({ id: 'text-shell', name: 'shell.run', provider: 'test', arguments: 'npm install' }, context);
      expect(result.request.input).toMatchObject({ command: 'npm', args: ['install'], networkProfile: 'package-manager' });
    });
  });

  it('defines every tool with schemas, timeout, audit, cancellation, and boundary metadata', () => {
    const registry = createToolRegistry(); const definitions = registry.list();
    expect(definitions.map((entry) => entry.name)).toContain('shell.run');
    expect(definitions.map((entry) => entry.name)).toContain('web.search');
    expect(definitions.map((entry) => entry.name)).toEqual(expect.arrayContaining(['browser.open', 'browser.read', 'browser.find', 'browser.savecontext']));
    expect(definitions.every((entry) => entry.inputSchema && entry.outputSchema && entry.timeoutMs > 0 && entry.audit && typeof entry.cancellable === 'boolean')).toBe(true);
    expect(registry.parse({ id: 'linked-write', name: 'file.create', provider: 'test', arguments: { path: 'note.md', content: '', reason: 'Create task output.', taskContext: { taskId: '00000000-0000-4000-8000-000000000000', stepId: 'write' } } }).input).toEqual({ path: 'note.md', content: '', reason: 'Create task output.' });
  });

  it('reads the visible browser immediately with runtime-owned execution metadata and saves page context durably', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'forge-browser-tools-'));
    const saved: Array<{ type: string; title?: string | null; content: string; metadata?: unknown }> = [];
    const records: AuditRecord[] = [];
    const router = new ToolRouter({ git: fakeGit, shell: fakeShell, web: fakeWeb, browser: fakeBrowser, memories: { create: async (entry) => { saved.push(entry); return { id: 'memory-1', createdAt: 1, updatedAt: 1 }; } }, audit: { appendAction: async (record) => { records.push(record); }, listActions: async () => records }, dirtyPaths: () => new Set() });
    const context = { workspaceId: 'workspace-1', workspaceRoot: root, conversationId: 'conversation-1', modelId: 'test-model', userRequest: 'browser.read and tell me what you see', task: { taskId: '00000000-0000-4000-8000-000000000000', stepId: 'inspect-browser' } };
    const read = await router.request({ id: 'browser-read', name: 'browser.read', provider: 'test', arguments: {} }, context);
    expect(read.request.state).toBe('succeeded');
    const readResult = read.result!;
    expect(readResult.output).toMatchObject({ url: 'https://example.com/', text: expect.stringContaining('Example Domain') });
    expect(read.request.executionContext).toMatchObject({ requestId: 'browser-read', workspaceId: 'workspace-1', conversationId: 'conversation-1', modelId: 'test-model', taskId: context.task.taskId, stepId: context.task.stepId, reason: expect.stringContaining('browser.read and tell me what you see') });
    expect(records.at(-1)).toMatchObject({ id: 'browser-read', executionState: 'succeeded', taskId: context.task.taskId, stepId: context.task.stepId });
    const find = await router.request({ id: 'browser-find', name: 'browser.find', provider: 'test', arguments: { query: 'illustrative' } }, context);
    const findResult = find.result!;
    expect(findResult.output).toMatchObject({ matches: [{ excerpt: expect.stringContaining('illustrative') }] });
    const open = await router.request({ id: 'browser-open', name: 'browser.open', provider: 'test', arguments: { url: 'https://example.com/next' } }, context);
    expect(open.result?.success).toBe(true);
    expect(open.request.state).toBe('succeeded');
    const save = await router.request({ id: 'browser-save', name: 'browser.savecontext', provider: 'test', arguments: { title: 'Example reference', content: 'The page is a reserved example domain.', reason: 'Save this reference.' } }, context);
    expect(save.request.state).toBe('succeeded');
    expect(save.result?.rollback?.available).toBe(true);
    expect(saved).toEqual([expect.objectContaining({ type: 'document', title: 'Example reference', metadata: expect.objectContaining({ url: 'https://example.com/' }) })]);
  });

  it('continues from file.list to file.read with autonomous execution records and no approval state', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'forge-autonomous-follow-up-')); await writeFile(path.join(root, 'README.md'), 'autonomous workflow');
    const records: AuditRecord[] = [];
    const router = new ToolRouter({ git: fakeGit, shell: fakeShell, web: fakeWeb, audit: { appendAction: async (record) => { records.push(record); }, listActions: async () => records }, dirtyPaths: () => new Set() });
    const context = { workspaceId: 'workspace-1', workspaceRoot: root, conversationId: 'conversation-1', modelId: 'test-model', userRequest: 'Inspect the workspace and read its README.' };
    const listed = await router.request({ id: 'list-workspace', name: 'file.list', provider: 'test', arguments: {} }, context);
    expect(listed.request.state).toBe('succeeded'); expect(listed.result?.success).toBe(true);
    const read = await router.request({ id: 'read-readme', name: 'file.read', provider: 'test', arguments: { path: 'README.md' } }, context);
    expect(read.request.state).toBe('succeeded'); expect(read.result?.output).toMatchObject({ content: 'autonomous workflow' });
    expect(records).toMatchObject([{ id: 'list-workspace', executionState: 'succeeded' }, { id: 'read-readme', executionState: 'succeeded' }]);
    expect(JSON.stringify(records)).not.toContain('approval');
  });

  it('reads and patches a hidden file outside the active workspace with a workspace rollback backup', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'forge-tool-root-'));
    const outside = await mkdtemp(path.join(os.tmpdir(), 'forge-tool-external-'));
    const target = path.join(outside, '.settings');
    await writeFile(target, 'before\n');
    const router = new ToolRouter({ git: fakeGit, shell: fakeShell, web: fakeWeb, audit: { appendAction: async () => undefined, listActions: async () => [] }, dirtyPaths: () => new Set() });
    const context = { workspaceId: 'workspace-1', workspaceRoot: root, conversationId: 'conversation-1', modelId: 'test-model', filesystemScope: 'full' as const, userRequest: 'Read and update the hidden settings file.' };
    const listing = await router.request({ id: 'outside-list', name: 'file.list', provider: 'test', arguments: { path: outside } }, context);
    expect(listing.result?.output).toMatchObject({ entries: [{ path: await (await import('node:fs/promises')).realpath(target) }] });
    const read = await router.request({ id: 'outside-read', name: 'file.read', provider: 'test', arguments: { path: target } }, context);
    expect(read.result?.output).toMatchObject({ content: 'before\n' });
    const patch = await router.request({ id: 'outside-patch', name: 'file.patch', provider: 'test', arguments: { path: target, expected: 'before', replacement: 'after' } }, context);
    expect(patch.result?.success).toBe(true);
    expect(await readFile(target, 'utf8')).toBe('after\n');
    expect(patch.result?.rollback?.backupPath).toContain('.forge/backups/');
    expect(await readFile(path.join(root, patch.result!.rollback!.backupPath!), 'utf8')).toBe('before\n');
  });

  it('keeps runtime bookkeeping out of every provider-visible tool schema', () => {
    const router = new ToolRouter({ git: fakeGit, shell: fakeShell, web: { ...fakeWeb, isEnabled: () => true }, browser: fakeBrowser, terminal: { list: () => [] }, tasks: fakeTasks, audit: { appendAction: async () => undefined, listActions: async () => [] }, dirtyPaths: () => new Set() });
    const schemas = router.providerDefinitions('allow-all');
    const browserRead = schemas.find((entry) => entry.name === 'browser.read');
    expect(browserRead?.parameters).toMatchObject({ type: 'object', properties: {}, additionalProperties: false });
    for (const entry of schemas) {
      const schema = JSON.stringify(entry.parameters);
      expect(schema).not.toContain('taskContext');
      expect(schema).not.toContain('"reason"');
      expect(schema).not.toContain('originatingConversationId');
    }
    expect(JSON.stringify(schemas.find((entry) => entry.name === 'task.process.start')?.parameters)).not.toMatch(/taskId|stepId/);
  });

  it('accepts absolute paths, upward traversal, and symlinks outside the workspace', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'forge-containment-')); const outside = await mkdtemp(path.join(os.tmpdir(), 'forge-outside-'));
    await mkdir(path.join(root, 'inside')); await symlink(outside, path.join(root, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
    expect(await resolveContainedPath(root, outside)).toBe(outside);
    expect(await resolveContainedPath(root, '..')).toBe(path.dirname(await (await import('node:fs/promises')).realpath(root)));
    expect(await resolveContainedPath(root, 'escape')).toBe(path.join(await (await import('node:fs/promises')).realpath(root), 'escape'));
  });

  it('enforces configured filesystem scopes after resolving symlinks', async () => {
    const repository = await mkdtemp(path.join(os.tmpdir(), 'forge-scope-repo-'));
    const workspace = path.join(repository, 'apps', 'website');
    const sibling = path.join(repository, 'shared', 'config.ts');
    const external = await mkdtemp(path.join(os.tmpdir(), 'forge-scope-external-'));
    await mkdir(workspace, { recursive: true }); await mkdir(path.dirname(sibling), { recursive: true });
    await writeFile(sibling, 'export const value = 1;'); await writeFile(path.join(external, 'secret.txt'), 'outside');
    await symlink(external, path.join(workspace, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(resolveScopedPath({ workspaceRoot: workspace, scope: 'workspace' }, '../../shared/config.ts')).rejects.toThrow('SCOPE_FAILURE');
    expect(await resolveScopedPath({ workspaceRoot: workspace, scope: 'repository', repositoryRoot: repository }, '../../shared/config.ts')).toBe(await (await import('node:fs/promises')).realpath(sibling));
    expect(await resolveScopedPath({ workspaceRoot: workspace, scope: 'full' }, path.join(external, 'secret.txt'))).toBe(await (await import('node:fs/promises')).realpath(path.join(external, 'secret.txt')));
    await expect(resolveScopedPath({ workspaceRoot: workspace, scope: 'repository', repositoryRoot: repository }, 'linked/secret.txt')).rejects.toThrow('SCOPE_FAILURE');
    await expect(resolveScopedPath({ workspaceRoot: workspace, scope: 'project-tree' }, 'file.txt', true)).rejects.toThrow('selected project root');
  });

  it('normalizes redundant read locations and empty list roots before schema validation', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'forge-normalize-files-')); await writeFile(path.join(root, 'notes.txt'), 'first\nsecond\nthird\n');
    const normalizedLines = normalizeProviderToolCall({ id: 'line-read', name: 'file.read', provider: 'test', arguments: { path: 'notes.txt', offset: 7, startLine: 2, endLine: 2 } }, 'Read line 2 from notes.txt.');
    expect(normalizedLines.arguments).toEqual({ path: 'notes.txt', startLine: 2, endLine: 2 });
    const normalizedRange = normalizeProviderToolCall({ id: 'range-read', name: 'file.read', provider: 'test', arguments: { path: 'notes.txt', offset: 7, startLine: 2, endLine: 2 } });
    expect(normalizedRange.arguments).toEqual({ path: 'notes.txt', offset: 7 });
    expect(normalizeProviderToolCall({ id: 'root-list', name: 'file.list', provider: 'test', arguments: { path: '' } }).arguments).toMatchObject({ path: '.' });
    const router = new ToolRouter({ git: fakeGit, shell: fakeShell, web: fakeWeb, audit: { appendAction: async () => undefined, listActions: async () => [] }, dirtyPaths: () => new Set() });
    const outcome = await router.request({ id: 'normalized-read', name: 'file.read', provider: 'test', arguments: { path: 'notes.txt', offset: 7, startLine: 2, endLine: 2 } }, { workspaceId: 'workspace-1', workspaceRoot: root, conversationId: 'conversation-1', modelId: 'test-model' });
    expect(outcome.result?.success).toBe(true);
    expect(outcome.request.input).toMatchObject({ path: 'notes.txt', offset: 7 });
  });

  it('allows repository traversal only when the request carries repository scope', async () => {
    const repository = await mkdtemp(path.join(os.tmpdir(), 'forge-router-repo-'));
    const workspace = path.join(repository, 'apps', 'website'); const target = path.join(repository, 'shared', 'config.ts');
    await mkdir(workspace, { recursive: true }); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, 'shared config');
    const router = new ToolRouter({ git: fakeGit, shell: fakeShell, web: fakeWeb, audit: { appendAction: async () => undefined, listActions: async () => [] }, dirtyPaths: () => new Set() });
    const context = { workspaceId: 'workspace-1', workspaceRoot: workspace, repositoryRoot: repository, conversationId: 'conversation-1', modelId: 'test-model' };
    const denied = await router.request({ id: 'sandbox-denied', name: 'file.read', provider: 'test', arguments: { path: '../../shared/config.ts' } }, context);
    expect(denied.result?.success).toBe(false); expect(denied.result?.error?.message).toContain('SCOPE_FAILURE');
    const allowed = await router.request({ id: 'repository-allowed', name: 'file.read', provider: 'test', arguments: { path: '../../shared/config.ts' } }, { ...context, filesystemScope: 'repository' });
    expect(allowed.result?.output).toMatchObject({ content: 'shared config' });
  });

  it('enforces Disabled and configured network policy and caps process timeouts', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'forge-policy-tools-'));
    let receivedTimeout = 0;
    const router = new ToolRouter({ git: fakeGit, shell: { ...fakeShell, run: async (input: { timeoutMs: number }) => { receivedTimeout = input.timeoutMs; return fakeShell.run(); } }, web: fakeWeb, audit: { appendAction: async () => undefined, listActions: async () => [] }, dirtyPaths: () => new Set() });
    expect(router.providerDefinitions('disabled')).toEqual([]);
    expect(router.providerDefinitions('controlled').map((entry) => entry.name)).toContain('file.read');
    expect(router.providerDefinitions('controlled').map((entry) => entry.name)).not.toContain('file.write');
    const base = { workspaceId: 'workspace-1', workspaceRoot: root, conversationId: 'conversation-1', modelId: 'test-model' };
    await expect(router.request({ id: 'disabled-call', name: 'file.list', provider: 'test', arguments: {} }, { ...base, executionMode: 'disabled' })).rejects.toThrow('POLICY_FAILURE');
    await expect(router.request({ id: 'controlled-write', name: 'file.create', provider: 'test', arguments: { path: 'blocked.txt', content: 'no', reason: 'Write should be denied.' } }, { ...base, executionMode: 'controlled' })).rejects.toThrow('Select Allow All');
    await expect(router.request({ id: 'blocked-network', name: 'shell.run', provider: 'test', arguments: { command: 'curl', args: ['https://example.com'], networkProfile: 'offline', reason: 'Inspect public headers.' } }, { ...base, networkAccess: { web: false, git: false, packageManager: false, general: false } })).rejects.toThrow('General network access is disabled');
    const process = await router.request({ id: 'capped-process', name: 'shell.run', provider: 'test', arguments: { command: 'printf', args: ['ok'], timeoutMs: 20_000, reason: 'Print a short value.' } }, { ...base, processTimeoutMs: 5_000 });
    expect(process.result?.success).toBe(true); expect(process.request.input).toMatchObject({ timeoutMs: 5_000 }); expect(receivedTimeout).toBe(5_000);
    const standard = await router.request({ id: 'standard-process', name: 'shell.run', provider: 'test', arguments: { command: 'printf', args: ['ok'], timeoutMs: 600_000, reason: 'Use standard limits.' } }, { ...base, processTimeoutMs: 600_000, processMode: 'standard' });
    const full = await router.request({ id: 'full-process', name: 'shell.run', provider: 'test', arguments: { command: 'printf', args: ['ok'], timeoutMs: 600_000, reason: 'Use full local compute.' } }, { ...base, processTimeoutMs: 600_000, processMode: 'full-local-compute' });
    expect(standard.request.input).toMatchObject({ timeoutMs: 120_000 }); expect(full.request.input).toMatchObject({ timeoutMs: 600_000 });
  });

  it('validates shell working directories against the selected filesystem scope', async () => {
    const repository = await mkdtemp(path.join(os.tmpdir(), 'forge-shell-scope-repo-'));
    const workspace = path.join(repository, 'apps', 'site'); const sibling = path.join(repository, 'tools');
    await mkdir(workspace, { recursive: true }); await mkdir(sibling);
    let observedCwd = '';
    const router = new ToolRouter({ git: fakeGit, shell: { ...fakeShell, run: async (input: { workingDirectory: string }) => { observedCwd = input.workingDirectory; return { ...await fakeShell.run(), cwd: input.workingDirectory, exitCode: 0 }; } }, web: fakeWeb, audit: { appendAction: async () => undefined, listActions: async () => [] }, dirtyPaths: () => new Set() });
    const context = { workspaceId: 'workspace-1', workspaceRoot: workspace, repositoryRoot: repository, conversationId: 'conversation-1', modelId: 'test-model' };
    await expect(router.request({ id: 'shell-sandbox', name: 'shell.run', provider: 'test', arguments: { command: 'pwd', workingDirectory: '../../tools', timeoutMs: 1_000, reason: 'Check the sibling directory.' } }, context)).resolves.toMatchObject({ result: { success: false, error: { code: 'SCOPE_FAILURE' } } });
    const allowed = await router.request({ id: 'shell-repository', name: 'shell.run', provider: 'test', arguments: { command: 'pwd', workingDirectory: '../../tools', timeoutMs: 1_000, reason: 'Check the sibling directory.' } }, { ...context, filesystemScope: 'repository' });
    expect(allowed.result?.success).toBe(true); expect(observedCwd).toBe(await (await import('node:fs/promises')).realpath(sibling));
  });

  it('returns structured recovery metadata for missing filesystem paths', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'forge-missing-')); const router = new ToolRouter({ git: fakeGit, shell: fakeShell, web: fakeWeb, audit: { appendAction: async () => undefined, listActions: async () => [] }, dirtyPaths: () => new Set() });
    const context = { workspaceId: 'workspace-1', workspaceRoot: root, conversationId: 'conversation-1', modelId: 'test-model' };
    const listResult = await router.request({ id: 'list-1', name: 'file.list', provider: 'test', arguments: { path: 'missing/dir', recursive: false } }, context);
    expect(listResult.result?.success).toBe(true);
    expect(listResult.result?.output).toMatchObject({ success: true, missing: true, requestedPath: 'missing/dir', recovery: { action: 'restart-at-workspace-root', path: '.' } });
    const readResult = await router.request({ id: 'read-1', name: 'file.read', provider: 'test', arguments: { path: 'missing.txt' } }, context);
    expect(readResult.result?.success).toBe(true);
    expect(readResult.result?.output).toMatchObject({ success: true, missing: true, requestedPath: 'missing.txt' });
    const searchResult = await router.request({ id: 'search-1', name: 'file.search', provider: 'test', arguments: { path: 'missing/search', query: 'needle' } }, context);
    expect(searchResult.result?.success).toBe(true);
    expect(searchResult.result?.output).toMatchObject({ success: true, missing: true, requestedPath: 'missing/search', matches: [] });
  });

  it('returns a continuation offset instead of abandoning a truncated search', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'forge-search-page-')); await writeFile(path.join(root, 'matches.txt'), 'needle one\nneedle two\nneedle three\n');
    const router = new ToolRouter({ git: fakeGit, shell: fakeShell, web: fakeWeb, audit: { appendAction: async () => undefined, listActions: async () => [] }, dirtyPaths: () => new Set() });
    const context = { workspaceId: 'workspace-1', workspaceRoot: root, conversationId: 'conversation-1', modelId: 'test-model' };
    const first = await router.request({ id: 'search-page-1', name: 'file.search', provider: 'test', arguments: { query: 'needle', maxResults: 2 } }, context);
    expect(first.result?.output).toMatchObject({ truncated: true, continuation: { offset: 2 } });
    const second = await router.request({ id: 'search-page-2', name: 'file.search', provider: 'test', arguments: { query: 'needle', maxResults: 2, offset: 2 } }, context);
    expect(second.result?.output).toMatchObject({ truncated: false, matches: [{ line: 3, text: 'needle three' }] });
  });

  it('shows hidden paths during recursive model listing and search', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'forge-home-tools-'));
    const protectedDirectory = path.join(root, 'protected');
    await writeFile(path.join(root, 'visible.txt'), 'needle');
    await mkdir(path.join(root, '.local', 'share', 'containers', 'storage', 'overlay'), { recursive: true });
    await writeFile(path.join(root, '.local', 'share', 'containers', 'storage', 'overlay', 'private.txt'), 'needle');
    await mkdir(protectedDirectory);
    if (process.platform !== 'win32') await chmod(protectedDirectory, 0o000);
    try {
      const router = new ToolRouter({ git: fakeGit, shell: fakeShell, web: fakeWeb, audit: { appendAction: async () => undefined, listActions: async () => [] }, dirtyPaths: () => new Set() });
      const context = { workspaceId: 'workspace-1', workspaceRoot: root, conversationId: 'conversation-1', modelId: 'test-model' };
      const listing = await router.request({ id: 'home-list', name: 'file.list', provider: 'test', arguments: { recursive: true, maxDepth: 8 } }, context);
      expect(listing.result?.success).toBe(true);
      expect(listing.result?.output).toMatchObject({ entries: expect.arrayContaining([expect.objectContaining({ path: 'visible.txt' })]) });
      expect(JSON.stringify(listing.result?.output)).toContain('private.txt');
      const search = await router.request({ id: 'home-search', name: 'file.search', provider: 'test', arguments: { query: 'needle' } }, context);
      expect(search.result?.success).toBe(true);
      expect(search.result?.output).toMatchObject({ matches: expect.arrayContaining([{ path: 'visible.txt', line: 1, text: 'needle' }, { path: path.join('.local', 'share', 'containers', 'storage', 'overlay', 'private.txt'), line: 1, text: 'needle' }]) });
    } finally {
      if (process.platform !== 'win32') await chmod(protectedDirectory, 0o700).catch(() => undefined);
    }
  });

  it('keeps file.list independent from malformed optional task context', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'forge-list-context-')); await writeFile(path.join(root, 'note.txt'), 'content');
    const router = new ToolRouter({ git: fakeGit, shell: fakeShell, web: fakeWeb, audit: { appendAction: async () => undefined, listActions: async () => [] }, dirtyPaths: () => new Set() });
    const context = { workspaceId: 'workspace-1', workspaceRoot: root, conversationId: 'conversation-1', modelId: 'test-model' };
    const listing = await router.request({ id: 'list-invalid-context', name: 'file.list', provider: 'test', arguments: { taskContext: { taskId: 'not-a-uuid', stepId: 'inspect' } } }, context);
    expect(listing.result?.output).toMatchObject({ success: true, entries: [{ path: 'note.txt' }] });
  });

  it('paginates file listings and reads bounded file ranges with continuations', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'forge-read-range-'));
    await writeFile(path.join(root, 'alpha.txt'), 'one\ntwo\nthree\nfour\n'); await writeFile(path.join(root, 'beta.txt'), 'other');
    const router = new ToolRouter({ git: fakeGit, shell: fakeShell, web: fakeWeb, audit: { appendAction: async () => undefined, listActions: async () => [] }, dirtyPaths: () => new Set() });
    const context = { workspaceId: 'workspace-1', workspaceRoot: root, conversationId: 'conversation-1', modelId: 'test-model' };
    const listing = await router.request({ id: 'list-page', name: 'file.list', provider: 'test', arguments: { maxEntries: 1 } }, context);
    expect(listing.result?.output).toMatchObject({ entries: [{ path: 'alpha.txt' }], truncated: true, continuation: { offset: 1 } });
    const read = await router.request({ id: 'read-range', name: 'file.read', provider: 'test', arguments: { path: 'alpha.txt', startLine: 2, endLine: 3, maxCharacters: 100 } }, context);
    expect(read.result?.output).toMatchObject({ content: 'two\nthree\n', totalLines: 5, returnedRange: { startLine: 2, endLine: 3 } });
    const first = await router.request({ id: 'read-page', name: 'file.read', provider: 'test', arguments: { path: 'alpha.txt', maxCharacters: 5 } }, context);
    expect(first.result?.output).toMatchObject({ content: 'one\nt', truncated: true, continuation: { offset: 5 } });
  });

  it('keeps file.read recoverable for directories and bounded reads above the legacy 2 MB limit', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'forge-read-resilience-'));
    await mkdir(path.join(root, 'folder'));
    await writeFile(path.join(root, 'large.txt'), 'x'.repeat(2_100_000));
    const router = new ToolRouter({ git: fakeGit, shell: fakeShell, web: fakeWeb, audit: { appendAction: async () => undefined, listActions: async () => [] }, dirtyPaths: () => new Set() });
    const context = { workspaceId: 'workspace-1', workspaceRoot: root, conversationId: 'conversation-1', modelId: 'test-model' };
    const directory = await router.request({ id: 'read-directory', name: 'file.read', provider: 'test', arguments: { path: 'folder' } }, context);
    expect(directory.result?.success).toBe(true);
    expect(directory.result?.output).toMatchObject({ success: true, unreadable: true, reason: 'not-a-file', recovery: { action: 'list-path', path: 'folder' } });
    const large = await router.request({ id: 'read-large', name: 'file.read', provider: 'test', arguments: { path: 'large.txt', maxCharacters: 64 } }, context);
    expect(large.result?.success).toBe(true);
    expect(large.result?.output).toMatchObject({ content: 'x'.repeat(64), truncated: true, continuation: { offset: 64 } });
  });

  it('advertises only tools available to the current FORGE configuration', () => {
    const router = new ToolRouter({ git: fakeGit, shell: fakeShell, web: { ...fakeWeb, isEnabled: () => false }, audit: { appendAction: async () => undefined, listActions: async () => [] }, dirtyPaths: () => new Set() });
    const names = router.providerDefinitions().map((definition) => definition.name);
    expect(names).toContain('file.read'); expect(names).not.toContain('terminal.read'); expect(names).not.toContain('github.read'); expect(names).not.toContain('web.search'); expect(names).not.toContain('browser.open');
  });

  it('derives capability visibility from the registry and executes task redirects through the audited router', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'forge-capability-catalog-'));
    let redirected = '';
    const router = new ToolRouter({ git: fakeGit, shell: fakeShell, web: fakeWeb, tasks: { ...fakeTasks, redirect: async (_taskId: string, instruction: string) => { redirected = instruction; return { status: 'running' }; } }, audit: { appendAction: async () => undefined, listActions: async () => [] }, dirtyPaths: () => new Set() });
    const catalog = router.capabilityCatalog('allow-all');
    expect(catalog).toHaveLength(router.definitions().length);
    expect(catalog.every((entry) => entry.registered && entry.executorPresent && entry.inputSchema)).toBe(true);
    expect(catalog.find((entry) => entry.name === 'task.redirect')?.providerVisible).toBe(true);
    const result = await router.request({ id: 'ui-task-redirect', name: 'task.redirect', provider: 'test', arguments: { taskId: '00000000-0000-4000-8000-000000000000', instruction: 'Skip the build.', reason: 'Redirect the task.' } }, { workspaceId: 'workspace-1', workspaceRoot: root, conversationId: 'conversation-1', modelId: 'test-model' });
    expect(result.result?.success).toBe(true); expect(redirected).toBe('Skip the build.');
    const unavailable = new ToolRouter({ git: fakeGit, shell: fakeShell, web: fakeWeb, audit: { appendAction: async () => undefined, listActions: async () => [] }, dirtyPaths: () => new Set() }).capabilityCatalog();
    expect(unavailable.find((entry) => entry.name === 'task.redirect')).toMatchObject({ available: false, executorPresent: true, providerVisible: false, unavailableReason: 'the persistent task runtime is unavailable' });
  });

  it('creates visible diffs and applies atomic patches with rollback backups', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'forge-tools-')); await writeFile(path.join(root, 'note.txt'), 'before\n');
    const records: AuditRecord[] = []; const router = new ToolRouter({ git: fakeGit, shell: fakeShell, web: fakeWeb, audit: { appendAction: async (record) => { records.push(record); }, listActions: async () => records }, dirtyPaths: () => new Set() });
    const context = { workspaceId: 'workspace-1', workspaceRoot: root, conversationId: 'conversation-1', modelId: 'test-model' };
    const pending = await router.request({ id: 'patch-1', name: 'file.patch', provider: 'test', arguments: { path: 'note.txt', expected: 'before', replacement: 'after', reason: 'Update the fixture.' } }, context);
    expect(pending.result?.success).toBe(true); expect(pending.request.state).toBe('succeeded'); expect(pending.request.diff).toContain('-before');
    const result = pending.result!;
    expect(result.success).toBe(true); expect(result.rollback?.backupPath).toContain('.forge/backups/');
    expect(await readFile(path.join(root, 'note.txt'), 'utf8')).toBe('after\n'); expect(records.at(-1)?.executionState).toBe('succeeded');
    expect(records.at(-1)?.id).toBe('patch-1');
    const destructive = await router.request({ id: 'delete-1', name: 'file.delete', provider: 'test', arguments: { path: 'note.txt' } }, context);
    expect(destructive.result?.success).toBe(true);
    expect(destructive.request.state).toBe('succeeded');
  });

  it('executes workspace writes directly through the shared runtime', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'forge-session-scope-')); await writeFile(path.join(root, 'one.txt'), 'one'); await writeFile(path.join(root, 'two.txt'), 'two');
    const router = new ToolRouter({ git: fakeGit, shell: fakeShell, web: fakeWeb, audit: { appendAction: async () => undefined, listActions: async () => [] }, dirtyPaths: () => new Set() });
    const context = { workspaceId: 'workspace-1', workspaceRoot: root, conversationId: 'conversation-1', modelId: 'test-model' };
    const first = await router.request({ id: 'session-1', name: 'file.write', provider: 'test', arguments: { path: 'one.txt', content: 'updated', reason: 'Update one.' } }, context);
    const sameScope = await router.request({ id: 'session-2', name: 'file.write', provider: 'test', arguments: { path: 'one.txt', content: 'updated again', reason: 'Update one again.' } }, context);
    const differentScope = await router.request({ id: 'session-3', name: 'file.write', provider: 'test', arguments: { path: 'two.txt', content: 'blocked', reason: 'Update two.' } }, context);
    expect(first.result?.success).toBe(true);
    expect(sameScope.result?.success).toBe(true);
    expect(differentScope.result?.success).toBe(true);
  });

  it('executes file, shell, Git, browser, and task-process tools directly after validation', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'forge-direct-tools-'));
    let committed = false;
    const directGit = { ...fakeGit, status: async () => ({ branch: 'main', ahead: 0, behind: 0, head: null, files: committed ? [] : [{ path: 'direct.txt', indexStatus: 'M', workingStatus: ' ', untracked: false }] }), commit: async () => { committed = true; return { hash: 'direct-commit' }; } };
    const router = new ToolRouter({ git: directGit, shell: fakeShell, web: fakeWeb, browser: fakeBrowser, tasks: fakeTasks, audit: { appendAction: async () => undefined, listActions: async () => [] }, dirtyPaths: () => new Set() });
    const context = { workspaceId: 'workspace-1', workspaceRoot: root, conversationId: 'conversation-1', modelId: 'test-model', task: { taskId: '00000000-0000-4000-8000-000000000000', stepId: 'run' } };
    const calls: ProviderToolCall[] = [
      { id: 'create', name: 'file.create', provider: 'test', arguments: { path: 'direct.txt', content: 'direct', reason: 'Create fixture.' } },
      { id: 'read', name: 'file.read', provider: 'test', arguments: { path: 'direct.txt' } },
      { id: 'stage', name: 'git.stage', provider: 'test', arguments: { files: ['direct.txt'], reason: 'Stage fixture.' } },
      { id: 'commit', name: 'git.commit', provider: 'test', arguments: { message: 'test: direct runtime', reason: 'Commit fixture.' } },
      { id: 'pull', name: 'git.pull', provider: 'test', arguments: { reason: 'Synchronize fixture.' } },
      { id: 'push', name: 'git.push', provider: 'test', arguments: { reason: 'Publish fixture.' } },
      { id: 'shell', name: 'shell.run', provider: 'test', arguments: { command: 'echo', args: ['direct'], timeoutMs: 1_000, reason: 'Run fixture.', expectedOutcome: 'Command exits successfully.' } },
      { id: 'browser', name: 'browser.open', provider: 'test', arguments: { url: 'https://example.com/direct', reason: 'Open fixture.' } },
      { id: 'process', name: 'task.process.start', provider: 'test', arguments: { command: 'echo', args: ['task'], timeoutMs: 1_000, reason: 'Start fixture task.', expectedOutcome: 'Process is started.' } },
      { id: 'delete', name: 'file.delete', provider: 'test', arguments: { path: 'direct.txt', reason: 'Delete fixture.' } }
    ];
    for (const call of calls) {
      const outcome = await router.request(call, context);
      expect(outcome.request.state, call.name).toBe('succeeded');
      expect(outcome.result?.success, call.name).toBe(true);
    }
  });

  it('blocks writes to unsaved editor paths and redacts secrets in validation audit records', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'forge-dirty-')); await writeFile(path.join(root, 'note.txt'), 'before');
    const records: AuditRecord[] = []; const router = new ToolRouter({ git: fakeGit, shell: fakeShell, web: fakeWeb, audit: { appendAction: async (record) => { records.push(record); }, listActions: async () => records }, dirtyPaths: () => new Set(['note.txt']) });
    const context = { workspaceId: 'workspace-1', workspaceRoot: root, conversationId: 'conversation-1', modelId: 'test-model' };
    const write = await router.request({ id: 'write-1', name: 'file.write', provider: 'test', arguments: { path: 'note.txt', content: 'after', reason: 'test dirty protection' } }, context);
    expect(write.result?.error?.message).toContain('unsaved');
    await expect(router.request({ id: 'bad', name: 'unknown.tool', provider: 'test', arguments: { authorization: 'Bearer secret', note: 'sk-abcdefghijklmnopqrstuvwxyz' } }, context)).rejects.toThrow(/Unknown tool/);
    expect(records.at(-1)?.sanitizedInputs).toEqual({ authorization: '[REDACTED]', note: '[REDACTED]' });
  });

  it('accepts only strict provider-neutral fallback envelopes', () => {
    expect(parseStructuredToolFallback('test', '{"type":"forge_tool_request","tool":"git.status","arguments":{}}')?.name).toBe('git.status');
    expect(parseStructuredToolFallback('test', '```json\n{"tool":"git.status"}\n```')).toBeNull();
    expect(unifiedDiff('x.txt', 'a', 'b')).toContain('+++ b/x.txt');
    const bounded = boundedToolEvidence({ requestId: 'x', toolName: 'shell.run', success: true, output: { stdout: 'OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz', stderr: 'x'.repeat(1_000) }, affectedPaths: [], warnings: [], durationMs: 1 }, 120);
    expect(bounded.length).toBeLessThan(200); expect(bounded).toContain('[REDACTED]'); expect(bounded).toContain('bounded');
  });
});
