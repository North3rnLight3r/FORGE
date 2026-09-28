import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { StorageService } from '@forge/storage';
import { TaskRuntime, releaseTaskTemplate } from '../src';

const directories: string[] = [];
afterEach(async () => Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

async function runtime(): Promise<{ root: string; storage: StorageService; tasks: TaskRuntime }> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-tasks-')); directories.push(root); const storage = new StorageService(); await storage.init(root);
  return { root, storage, tasks: new TaskRuntime({ storage, workspaceRoot: () => root, processState: async () => 'missing' }) };
}

describe('workspace-owned persistent tasks', () => {
  it('creates an editable task from a title without requiring hidden parameters', async () => {
    const { storage, tasks } = await runtime();
    const task = await tasks.create({ title: 'Title-only task', taskType: '', resumeInstructions: '', steps: [] });
    expect(task.title).toBe('Title-only task'); expect(task.taskType).toBe('custom'); expect(task.steps[0]).toMatchObject({ name: 'Define and verify the objective', riskTier: 0 });
    await storage.close();
  });

  it('creates a dependency-aware release template without execution gates', async () => {
    const { storage, tasks } = await runtime(); const task = await tasks.createRelease('1.1.0-beta.2');
    expect(task.taskType).toBe('release'); expect(task.steps.length).toBeGreaterThan(20); expect(task.steps[0].status).toBe('pending');
    expect(task.steps.find((step) => step.name === 'Push')?.riskTier).toBe(2);
    expect(releaseTaskTemplate('1.1.0-beta.2').associatedReleaseTag).toBe('v1.1.0-beta.2'); await storage.close();
  });

  it('persists independently of conversations and application restarts', async () => {
    const { root, storage, tasks } = await runtime(); const conversation = await storage.conversationState();
    const task = await tasks.create({ title: 'Persistent Task Verification', taskType: 'verification', originatingConversationId: conversation.activeConversationId, resumeInstructions: 'Audit the workspace and continue at the first pending step.', steps: [{ id: 'inspect', name: 'Inspect workspace', purpose: 'Observe root state.', riskTier: 0, requiredTool: 'file.list', verificationCriteria: ['Root listing observed'] }, { id: 'handoff', name: 'Generate handoff', purpose: 'Write projection.', riskTier: 1, requiredTool: 'task.handoff', verificationCriteria: ['Markdown exists'], dependencies: ['inspect'] }] });
    await storage.deleteConversation(conversation.activeConversationId); expect((await tasks.get(task.id)).originatingConversationId).toBe(conversation.activeConversationId); await storage.close();
    const reopened = new StorageService(); await reopened.init(root); const replacement = new TaskRuntime({ storage: reopened, workspaceRoot: () => root }); expect((await replacement.get(task.id)).title).toBe('Persistent Task Verification'); await reopened.close();
  });

  it('persists redirected instructions until the active runner acknowledges delivery', async () => {
    const { root, storage, tasks } = await runtime();
    const task = await tasks.create({ title: 'Redirectable task', taskType: 'maintenance', resumeInstructions: 'Continue from verified state.', steps: [{ id: 'work', name: 'Work', purpose: 'Make the requested change.', riskTier: 1, requiredTool: 'file.write', verificationCriteria: ['Change verified'] }] });
    await tasks.redirect(task.id, 'Skip the generated bundle and inspect the tests first.');
    expect(await tasks.pendingRedirects(task.id)).toMatchObject([{ instruction: 'Skip the generated bundle and inspect the tests first.' }]);
    await storage.close();
    const reopened = new StorageService(); await reopened.init(root); const resumed = new TaskRuntime({ storage: reopened, workspaceRoot: () => root });
    const redirects = await resumed.pendingRedirects(task.id);
    expect(redirects).toHaveLength(1);
    await resumed.acknowledgeRedirects(task.id, redirects.map((entry) => entry.eventId));
    expect(await resumed.pendingRedirects(task.id)).toEqual([]);
    await reopened.close();
  });

  it('reconciles stale processes and accepts verified remote completion without repeating work', async () => {
    const { storage, tasks } = await runtime(); const task = await tasks.create({ title: 'Upload', taskType: 'release', resumeInstructions: 'Verify remote state before retry.', steps: [{ id: 'upload', name: 'Upload DMG', purpose: 'Upload one asset.', riskTier: 2, requiredTool: 'web.open', verificationCriteria: ['Remote SHA matches'] }, { id: 'zip', name: 'Upload ZIP', purpose: 'Upload next asset.', riskTier: 2, requiredTool: 'web.open', verificationCriteria: ['Remote SHA matches'], dependencies: ['upload'] }] });
    await storage.setTaskStepState(task.id, 'upload', 'running', { summary: 'Upload process started.', externalProcessId: 99123, incrementAttempts: true });
    const blocked = await tasks.resume(task.id, { observedAt: 1, workspaceId: task.workspaceId, processes: [{ pid: 99123, state: 'missing' }], stepObservations: [] }); expect(blocked.status).toBe('blocked');
    const reconciled = await tasks.resume(task.id, { observedAt: 2, workspaceId: task.workspaceId, processes: [{ pid: 99123, state: 'missing' }], stepObservations: [{ stepId: 'upload', state: 'completed', verified: true, summary: 'Remote DMG exists and SHA matches.', evidence: { sha256: 'abc' } }] });
    expect(reconciled.steps.find((step) => step.id === 'upload')?.status).toBe('completed'); expect(reconciled.currentStepId).toBe('zip'); expect(reconciled.status).toBe('ready'); await storage.close();
  });

  it('fails a verified hash mismatch and generates a durable Markdown handoff', async () => {
    const { root, storage, tasks } = await runtime(); const task = await tasks.create({ title: 'Asset verification', taskType: 'release', resumeInstructions: 'Do not publish until hashes match.', steps: [{ id: 'hash', name: 'Verify hash', purpose: 'Compare local and remote SHA.', riskTier: 0, requiredTool: 'web.fetch', verificationCriteria: ['Hashes equal'], retryPolicy: { maxAttempts: 2 } }] });
    const failed = await tasks.resume(task.id, { observedAt: 1, workspaceId: task.workspaceId, processes: [], stepObservations: [{ stepId: 'hash', state: 'failed', verified: true, summary: 'Remote hash mismatch.', error: { message: 'SHA-256 mismatch', retryable: false } }] }); expect(failed.status).toBe('failed');
    const handoff = await tasks.generateHandoff(task.id); expect(await readFile(path.join(root, handoff.relativePath), 'utf8')).toContain('Actions that must not be repeated'); await storage.close();
  });

  it('never silently kills an active process when task tracking is cancelled', async () => {
    const { storage, tasks } = await runtime(); const task = await tasks.create({ title: 'Background build', taskType: 'build', resumeInstructions: 'Inspect PID and output.', steps: [{ id: 'build', name: 'Build', purpose: 'Run build.', riskTier: 2, requiredTool: 'shell.run', verificationCriteria: ['Exit zero'] }] });
    await storage.setTaskStepState(task.id, 'build', 'running', { summary: 'Build running.', externalProcessId: 42 }); await storage.updateTaskReality(task.id, { processIds: [42] });
    await expect(tasks.cancel(task.id, 'Stop', false)).rejects.toThrow(/could not be cancelled through its tracked shell request/); expect((await tasks.cancel(task.id, 'Stop tracking', true)).status).toBe('cancelled'); await storage.close();
  });

  it('starts a Tier 2 background step through the injected shell runtime and persists its PID', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'forge-task-process-')); directories.push(root); const storage = new StorageService(); await storage.init(root); let outputPath = '';
    const tasks = new TaskRuntime({ storage, workspaceRoot: () => root, processState: async (pid) => pid === 777 ? 'running' : 'missing', shell: { startBackground: async (_input, pathValue, requestId) => { outputPath = pathValue; return { requestId: requestId ?? 'request', pid: 777, outputPath: pathValue, startedAt: 10 }; } } });
    const task = await tasks.create({ title: 'Persistent build', taskType: 'build', resumeInstructions: 'Inspect PID and output before advancing.', steps: [{ id: 'build', name: 'Build', purpose: 'Build in background.', riskTier: 2, requiredTool: 'task.process.start', verificationCriteria: ['Exit zero'] }] });
    const started = await tasks.startBackground(task.id, 'build', { command: 'npm', args: ['run', 'build'], workingDirectory: '.', timeoutMs: 1000, reason: 'build', expectedOutcome: 'bundle' }, 'audit-1');
    expect(started.process.pid).toBe(777); expect(outputPath).toContain(`.forge${path.sep}task-output`); expect(started.task.processIds).toContain(777); expect(started.task.steps[0]).toMatchObject({ status: 'running', externalProcessId: 777 }); expect(started.task.steps[0].auditReferences).toEqual([]);
    await storage.appendAction({ id: 'audit-1', timestamp: 10, workspaceId: task.workspaceId, conversationId: 'conversation', modelId: 'model', toolName: 'task.process.start', sanitizedInputs: {}, executionDurationMs: 1, executionState: 'succeeded', success: true, result: { pid: 777 }, resultSummary: 'Background process started.', affectedPaths: [outputPath], exitCode: null });
    const linked = await tasks.recordToolOutcome(task.id, 'build', 'audit-1', { requestId: 'audit-1', toolName: 'task.process.start', success: true, output: { pid: 777 }, affectedPaths: [outputPath], warnings: [], durationMs: 1 });
    expect(linked.status).toBe('running'); expect(linked.steps[0].auditReferences).toContain('audit-1'); expect(linked.checkpoints.at(-1)?.name).toContain('tool result observed'); await storage.close();
  });

  it('keeps a successful tool result waiting until an audit-backed checkpoint verifies completion', async () => {
    const { storage, tasks } = await runtime(); const task = await tasks.create({ title: 'Read verification', taskType: 'verification', resumeInstructions: 'Verify the read result before completing.', steps: [{ id: 'read', name: 'Read README', purpose: 'Observe the workspace README.', riskTier: 0, requiredTool: 'file.read', verificationCriteria: ['README content was observed'] }] });
    await storage.appendAction({ id: 'read-audit', timestamp: 10, workspaceId: task.workspaceId, conversationId: 'conversation', modelId: 'model', toolName: 'file.read', sanitizedInputs: { path: 'README.md' }, executionDurationMs: 1, executionState: 'succeeded', success: true, result: { content: '# FORGE' }, resultSummary: 'README read.', affectedPaths: [], exitCode: null });
    const observed = await tasks.recordToolOutcome(task.id, 'read', 'read-audit', { requestId: 'read-audit', toolName: 'file.read', success: true, output: { content: '# FORGE' }, affectedPaths: [], warnings: [], durationMs: 1 });
    expect(observed.status).toBe('waiting'); expect(observed.steps[0]).toMatchObject({ status: 'waiting', attempts: 1 }); expect(observed.steps[0].startedAt).toBeTypeOf('number'); expect(observed.checkpoints.at(-1)).toMatchObject({ verified: true, auditReferences: ['read-audit'] });
    const verified = await tasks.checkpoint(task.id, { stepId: 'read', name: 'README verified', summary: 'The audited result contains the expected README.', verified: true, auditReference: 'read-audit' });
    expect(verified.status).toBe('completed'); expect(verified.events.some((event) => event.type === 'task.completed')).toBe(true); await storage.close();
  });

  it('resumes an eligible step after restart without approval state', async () => {
    const { root, storage, tasks } = await runtime(); const task = await tasks.create({ title: 'Restart', taskType: 'build', resumeInstructions: 'Continue from the first unfinished step.', assignedProvider: 'provider-before', assignedModel: 'model-before', steps: [{ id: 'build', name: 'Build', purpose: 'Run the build.', riskTier: 2, requiredTool: 'task.process.start', verificationCriteria: ['Exit zero'] }] });
    await storage.close();
    const reopened = new StorageService(); await reopened.init(root); const replacement = new TaskRuntime({ storage: reopened, workspaceRoot: () => root });
    const resumed = await replacement.resume(task.id, { observedAt: 2, workspaceId: task.workspaceId, processes: [], stepObservations: [] });
    expect(resumed.status).toBe('ready'); expect(resumed.resumabilityState).toBe('resumable'); expect(resumed.assignedProvider).toBe('provider-before'); expect(resumed.assignedModel).toBe('model-before'); expect(resumed.events.some((event) => event.type === 'task.started')).toBe(true); await reopened.close();
  });

  it('persists provider-neutral external evidence and artifacts during reconciliation', async () => {
    const { storage, tasks } = await runtime(); const task = await tasks.create({ title: 'Remote asset', taskType: 'release', resumeInstructions: 'Compare local and remote hashes.', assignedProvider: 'provider-a', assignedModel: 'model-a', steps: [{ id: 'asset', name: 'Verify asset', purpose: 'Verify a release asset.', riskTier: 0, requiredTool: 'web.fetch', verificationCriteria: ['Remote SHA matches'] }] });
    const reconciled = await tasks.resume(task.id, { observedAt: 2, workspaceId: task.workspaceId, processes: [], stepObservations: [{ stepId: 'asset', state: 'completed', verified: true, summary: 'Remote asset SHA matches.', evidence: { externalReference: { type: 'asset', provider: 'github', externalId: 'FORGE.dmg', url: 'https://github.com/example/FORGE.dmg', state: 'verified', verifiedAt: 2, metadata: { authorization: 'secret' } }, artifact: { kind: 'dmg', uri: 'https://github.com/example/FORGE.dmg', sha256: 'abc', verifiedAt: 2, metadata: { token: 'secret' } } } }] });
    expect(reconciled.status).toBe('completed'); expect(reconciled.externalReferences[0]).toMatchObject({ externalId: 'FORGE.dmg', state: 'verified', metadata: { authorization: '[REDACTED]' } }); expect(reconciled.artifacts[0]).toMatchObject({ kind: 'dmg', sha256: 'abc', metadata: { token: '[REDACTED]' } }); expect(reconciled.assignedProvider).toBe('provider-a'); await storage.close();
  });

  it('counts executions rather than retry-queue transitions as attempts', async () => {
    const { storage, tasks } = await runtime(); const task = await tasks.create({ title: 'Retry accounting', taskType: 'test', resumeInstructions: 'Retry only after inspecting failure evidence.', steps: [{ id: 'check', name: 'Check', purpose: 'Run a retryable check.', riskTier: 0, requiredTool: 'file.read', verificationCriteria: ['Observed'], retryPolicy: { maxAttempts: 2 } }] });
    await storage.setTaskStepState(task.id, 'check', 'failed', { summary: 'First execution failed.', incrementAttempts: true, error: { message: 'Temporary failure', retryable: true }, eventType: 'step.failed' });
    const retried = await tasks.retryStep(task.id, 'check'); expect(retried.steps[0]).toMatchObject({ status: 'pending', attempts: 1 }); await storage.close();
  });
});
