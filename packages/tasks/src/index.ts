import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { valid } from 'semver';
import type { GitStatus, Task, TaskDraft, TaskHandoff, TaskRealitySnapshot, TaskStep, TaskStepDraft, ToolResultView } from '@forge/ipc';
import type { StorageService } from '@forge/storage';
import type { BackgroundShellRunOutput, ShellRunInput } from '@forge/shell';

type TaskStore = Pick<StorageService,
  'workspaceId' | 'createPersistentTask' | 'updatePersistentTask' | 'listPersistentTasks' | 'getPersistentTask' | 'setPersistentTaskState' | 'setTaskStepState' |
  'appendTaskCheckpoint' | 'appendTaskArtifact' | 'upsertTaskExternalReference' | 'appendTaskEvent' | 'updateTaskReality' | 'linkTaskStepAudit'>;

export interface TaskRuntimeDependencies {
  storage: TaskStore;
  workspaceRoot: () => string | null;
  git?: { status(): Promise<GitStatus> };
  shell?: { startBackground(input: ShellRunInput, outputPath: string, requestId?: string, allowAuthorizedExternalCwd?: boolean): Promise<BackgroundShellRunOutput>; cancel?(requestId: string): boolean };
  processState?: (pid: number) => Promise<'running' | 'exited' | 'missing'>;
  now?: () => number;
}

const processState = async (pid: number): Promise<'running' | 'exited' | 'missing'> => {
  if (!Number.isSafeInteger(pid) || pid <= 0) return 'missing';
  try { process.kill(pid, 0); return 'running'; }
  catch (error) { return error instanceof Error && 'code' in error && error.code === 'EPERM' ? 'running' : 'missing'; }
};

const completed = (step: TaskStep): boolean => step.status === 'completed' || step.status === 'skipped';
const slug = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'task';

export class TaskRuntime {
  private readonly now: () => number;
  private readonly inspectProcess: NonNullable<TaskRuntimeDependencies['processState']>;

  constructor(private readonly dependencies: TaskRuntimeDependencies) {
    this.now = dependencies.now ?? Date.now;
    this.inspectProcess = dependencies.processState ?? processState;
  }

  create(draft: TaskDraft): Promise<Task> { return this.dependencies.storage.createPersistentTask(draft); }
  update(taskId: string, draft: TaskDraft): Promise<Task> { return this.dependencies.storage.updatePersistentTask(taskId, draft); }
  list(): Promise<Task[]> { return this.dependencies.storage.listPersistentTasks(); }
  get(taskId: string): Promise<Task> { return this.dependencies.storage.getPersistentTask(taskId); }

  async createRelease(version: string, originatingConversationId?: string): Promise<Task> {
    if (!valid(version)) throw new Error('Release version must be a valid semantic version without a leading v.');
    return this.create(releaseTaskTemplate(version, originatingConversationId));
  }

  async realitySnapshot(taskId: string): Promise<TaskRealitySnapshot> {
    const task = await this.get(taskId); const workspaceId = await this.dependencies.storage.workspaceId();
    const pids = [...new Set([...task.processIds, ...task.steps.flatMap((step) => step.externalProcessId ? [step.externalProcessId] : [])])];
    const processes = await Promise.all(pids.map(async (pid) => ({ pid, state: await this.inspectProcess(pid) })));
    let git: TaskRealitySnapshot['git'];
    if (this.dependencies.git) {
      try { const status = await this.dependencies.git.status(); git = { branch: status.branch, commitSha: status.head?.hash, workingTreeClean: status.files.length === 0 }; }
      catch { git = undefined; }
    }
    return { observedAt: this.now(), workspaceId, git, processes, stepObservations: [] };
  }

  async resume(taskId: string, suppliedSnapshot?: TaskRealitySnapshot): Promise<Task> {
    const before = await this.get(taskId);
    if (before.status === 'completed' || before.status === 'cancelled') return before;
    if (before.startedAt === undefined) {
      await this.dependencies.storage.setPersistentTaskState(taskId, 'running', { summary: 'Task started; persisted state will be reconciled before any work continues.', eventType: 'task.started', currentStepId: before.currentStepId ?? null, resumabilityState: 'reconcile-required' });
    } else {
      await this.dependencies.storage.appendTaskEvent(taskId, { type: 'task.resumed', summary: 'Resume requested; persisted state will be reconciled before any work continues.' });
    }
    return this.reconcile(taskId, suppliedSnapshot ?? await this.realitySnapshot(taskId));
  }

  async reconcile(taskId: string, snapshot: TaskRealitySnapshot): Promise<Task> {
    let task = await this.get(taskId);
    if (snapshot.workspaceId !== task.workspaceId) throw new Error('Reality snapshot belongs to another workspace.');
    await this.dependencies.storage.updateTaskReality(taskId, { associatedBranch: snapshot.git?.branch, associatedCommitSha: snapshot.git?.commitSha, processIds: snapshot.processes.filter((entry) => entry.state === 'running').map((entry) => entry.pid) });
    const observations = new Map(snapshot.stepObservations.map((observation) => [observation.stepId, observation]));
    for (const observation of snapshot.stepObservations) {
      const step = task.steps.find((candidate) => candidate.id === observation.stepId);
      if (!step || completed(step)) continue;
      if (observation.state === 'completed' && observation.verified) {
        await this.dependencies.storage.setTaskStepState(taskId, step.id, 'completed', { summary: observation.summary, auditReference: observation.auditReference, eventType: 'step.completed' });
        await this.dependencies.storage.appendTaskCheckpoint(taskId, { stepId: step.id, name: `${step.name} completed`, summary: observation.summary, verified: true, evidence: observation.evidence, auditReferences: observation.auditReference ? [observation.auditReference] : [] });
        if (observation.auditReference) await this.dependencies.storage.linkTaskStepAudit(taskId, step.id, observation.auditReference);
        const evidence = observation.evidence as { externalReference?: Parameters<StorageService['upsertTaskExternalReference']>[1]; artifact?: Parameters<StorageService['appendTaskArtifact']>[1] } | undefined;
        if (evidence?.externalReference) { const reference = await this.dependencies.storage.upsertTaskExternalReference(taskId, { ...evidence.externalReference, stepId: step.id }); await this.dependencies.storage.updateTaskReality(taskId, { externalResourceIds: [...new Set([...task.externalResourceIds, reference.id])] }); await this.dependencies.storage.appendTaskEvent(taskId, { stepId: step.id, type: 'external.asset.verified', summary: observation.summary, details: { externalReferenceId: reference.id }, auditReference: observation.auditReference }); }
        if (evidence?.artifact) await this.dependencies.storage.appendTaskArtifact(taskId, { ...evidence.artifact, stepId: step.id });
      } else if (observation.state === 'failed') {
        await this.dependencies.storage.setTaskStepState(taskId, step.id, 'failed', { summary: observation.summary, error: observation.error ?? { message: observation.summary, retryable: false }, auditReference: observation.auditReference, eventType: 'step.failed' });
      } else if (observation.state === 'running') {
        await this.dependencies.storage.setTaskStepState(taskId, step.id, 'running', { summary: observation.summary, externalProcessId: step.externalProcessId, auditReference: observation.auditReference, eventType: 'external.process.detected' });
      } else {
        await this.dependencies.storage.setTaskStepState(taskId, step.id, 'waiting', { summary: observation.summary, auditReference: observation.auditReference, eventType: 'step.waiting' });
      }
    }
    task = await this.get(taskId);
    for (const step of task.steps) {
      if (step.status !== 'running' || !step.externalProcessId || observations.has(step.id)) continue;
      const observed = snapshot.processes.find((entry) => entry.pid === step.externalProcessId);
      if (!observed || observed.state === 'missing' || observed.state === 'exited') {
        await this.dependencies.storage.setTaskStepState(taskId, step.id, 'blocked', { summary: `Tracked process ${step.externalProcessId} is no longer running and no verified completion evidence was found.`, error: { message: 'Tracked process disappeared before its result was verified.', exitCode: observed?.exitCode, retryable: true, suggestedNextAction: 'Inspect the bounded output and remote state before retrying.' }, eventType: 'task.blocked' });
      }
    }
    task = await this.get(taskId);
    const incompleteDependencies: string[] = [];
    for (const dependencyId of task.taskDependencies) { const dependency = await this.get(dependencyId); if (dependency.status !== 'completed') incompleteDependencies.push(dependencyId); }
    const allComplete = task.steps.length > 0 && task.steps.every(completed);
    if (allComplete) return this.dependencies.storage.setPersistentTaskState(taskId, 'completed', { summary: 'Every task step has verified completion or an explicit skip.', eventType: 'task.completed', currentStepId: null, resumabilityState: 'complete', details: { observedAt: snapshot.observedAt } });
    const failed = task.steps.find((step) => step.status === 'failed');
    if (failed) return this.dependencies.storage.setPersistentTaskState(taskId, 'failed', { summary: `Step failed: ${failed.name}`, eventType: 'state.reconciled', currentStepId: failed.id, interruptionReason: failed.lastError?.message, resumabilityState: failed.attempts < failed.retryPolicy.maxAttempts ? 'resumable' : 'not-resumable' });
    const blocked = task.steps.find((step) => step.status === 'blocked');
    if (blocked || incompleteDependencies.length) return this.dependencies.storage.setPersistentTaskState(taskId, 'blocked', { summary: blocked ? `Blocked at ${blocked.name}.` : 'Waiting for dependent tasks to complete.', eventType: 'state.reconciled', currentStepId: blocked?.id ?? null, interruptionReason: blocked?.lastError?.message ?? `Incomplete task dependencies: ${incompleteDependencies.join(', ')}`, resumabilityState: 'reconcile-required' });
    const running = task.steps.find((step) => step.status === 'running');
    if (running) return this.dependencies.storage.setPersistentTaskState(taskId, 'running', { summary: `${running.name} is still running.`, eventType: 'state.reconciled', currentStepId: running.id, resumabilityState: 'reconcile-required', details: { observedAt: snapshot.observedAt, processId: running.externalProcessId } });
    const next = task.steps.find((step) => !completed(step) && step.dependencies.every((dependencyId) => completed(task.steps.find((candidate) => candidate.id === dependencyId)!)));
    if (!next) return this.dependencies.storage.setPersistentTaskState(taskId, 'blocked', { summary: 'No dependency-ready step is available.', eventType: 'state.reconciled', currentStepId: null, interruptionReason: 'Step dependency graph cannot advance.', resumabilityState: 'reconcile-required' });
    if (next.status === 'waiting') return this.dependencies.storage.setPersistentTaskState(taskId, 'waiting', { summary: `Verification or an external condition is still required for ${next.name}.`, eventType: 'state.reconciled', currentStepId: next.id, resumabilityState: 'reconcile-required', details: { observedAt: snapshot.observedAt } });
    return this.dependencies.storage.setPersistentTaskState(taskId, 'ready', { summary: `Ready for ${next.name}.`, eventType: 'state.reconciled', currentStepId: next.id, resumabilityState: 'resumable', details: { observedAt: snapshot.observedAt, git: snapshot.git } });
  }

  async pause(taskId: string, reason: string): Promise<Task> {
    if (!reason.trim() || reason.length > 4_000) throw new Error('A bounded pause reason is required.');
    const task = await this.get(taskId); if (task.status === 'completed' || task.status === 'cancelled') return task;
    return this.dependencies.storage.setPersistentTaskState(taskId, 'paused', { summary: `Paused: ${reason}`, eventType: 'task.paused', interruptionReason: reason, currentStepId: task.currentStepId, resumabilityState: 'reconcile-required' });
  }

  async redirect(taskId: string, instruction: string): Promise<Task> {
    const normalized = instruction.trim();
    if (!normalized || normalized.length > 4_000) throw new Error('A redirect instruction between 1 and 4,000 characters is required.');
    const task = await this.get(taskId);
    if (['completed', 'cancelled'].includes(task.status)) throw new Error('Completed or cancelled tasks cannot receive redirect instructions.');
    await this.dependencies.storage.appendTaskEvent(taskId, { type: 'task.redirected', summary: `Redirect instruction queued: ${normalized.slice(0, 240)}`, details: { instruction: normalized } });
    return this.get(taskId);
  }

  async pendingRedirects(taskId: string): Promise<Array<{ eventId: string; instruction: string }>> {
    const task = await this.get(taskId);
    const consumed = new Set(task.events.filter((event) => event.type === 'task.redirect.consumed' && typeof (event.details as { eventId?: unknown } | undefined)?.eventId === 'string').map((event) => (event.details as { eventId: string }).eventId));
    return task.events.filter((event) => event.type === 'task.redirected' && !consumed.has(event.id) && typeof (event.details as { instruction?: unknown } | undefined)?.instruction === 'string').map((event) => ({ eventId: event.id, instruction: (event.details as { instruction: string }).instruction }));
  }

  async acknowledgeRedirects(taskId: string, eventIds: string[]): Promise<void> {
    const available = new Set((await this.pendingRedirects(taskId)).map((entry) => entry.eventId));
    for (const eventId of eventIds) if (available.has(eventId)) await this.dependencies.storage.appendTaskEvent(taskId, { type: 'task.redirect.consumed', summary: 'Queued redirect instruction was delivered to the active agent.', details: { eventId } });
  }

  async cancel(taskId: string, reason: string, trackingOnly: boolean): Promise<Task> {
    if (!reason.trim() || reason.length > 4_000) throw new Error('A bounded cancellation reason is required.');
    const task = await this.get(taskId); const activeSteps = task.steps.filter((step) => step.status === 'running' && step.externalProcessId); const activePids = [...new Set(activeSteps.map((step) => step.externalProcessId!))];
    if (activePids.length && !trackingOnly) {
      for (const step of activeSteps) {
        const requestId = step.auditReferences.at(-1);
        if (!requestId || !this.dependencies.shell?.cancel?.(requestId)) throw new Error(`Task process ${step.externalProcessId} could not be cancelled through its tracked shell request ${requestId ?? '(missing)'}. Task state was not changed.`);
      }
    }
    const summary = activePids.length && trackingOnly ? `FORGE tracking cancelled; external process IDs may still be active: ${activePids.join(', ')}.` : `Task cancelled: ${reason}`;
    return this.dependencies.storage.setPersistentTaskState(taskId, 'cancelled', { summary, eventType: 'task.cancelled', interruptionReason: reason, currentStepId: task.currentStepId, resumabilityState: 'not-resumable', details: { trackingOnly, activePids } });
  }

  async stopAll(): Promise<number> {
    const active = (await this.list()).filter((task) => !['completed', 'cancelled'].includes(task.status));
    let cancelled = 0;
    for (const task of active) { await this.cancel(task.id, 'Stop All was requested from FORGE.', false); cancelled += 1; }
    return cancelled;
  }

  async retryStep(taskId: string, stepId: string): Promise<Task> {
    const task = await this.get(taskId); const step = task.steps.find((candidate) => candidate.id === stepId);
    if (!step) throw new Error('Unknown task step.');
    if (!['failed', 'blocked'].includes(step.status)) throw new Error('Only failed or blocked steps can be retried.');
    if (step.attempts >= step.retryPolicy.maxAttempts) throw new Error('The task step retry limit has been reached.');
    if (!step.dependencies.every((dependencyId) => completed(task.steps.find((candidate) => candidate.id === dependencyId)!))) throw new Error('Task step dependencies are not complete.');
    await this.dependencies.storage.setTaskStepState(taskId, stepId, 'pending', { summary: `Retry queued for ${step.name}.`, eventType: 'step.retried' });
    return this.dependencies.storage.setPersistentTaskState(taskId, 'ready', { summary: `Ready to retry ${step.name}.`, eventType: 'state.reconciled', currentStepId: step.id, resumabilityState: 'resumable' });
  }

  async checkpoint(taskId: string, input: { stepId?: string; name: string; summary: string; verified: boolean; evidence?: unknown; auditReference?: string }): Promise<Task> {
    if (!input.name.trim() || input.name.length > 240 || !input.summary.trim() || input.summary.length > 10_000 || JSON.stringify(input.evidence ?? null).length > 250_000) throw new Error('Checkpoint name, summary, or evidence exceeds the storage limit.');
    if (input.verified && !input.auditReference) throw new Error('A verified checkpoint requires an observed audit reference.');
    await this.dependencies.storage.appendTaskCheckpoint(taskId, { stepId: input.stepId, name: input.name, summary: input.summary, verified: input.verified, evidence: input.evidence, auditReferences: input.auditReference ? [input.auditReference] : [] });
    await this.dependencies.storage.appendTaskEvent(taskId, { stepId: input.stepId, type: 'state.reconciled', summary: `Checkpoint recorded: ${input.name}.`, details: { verified: input.verified }, auditReference: input.auditReference });
    if (input.verified && input.stepId) {
      const task = await this.get(taskId); const step = task.steps.find((candidate) => candidate.id === input.stepId); if (!step) throw new Error('Unknown task step.');
      if (!completed(step)) await this.dependencies.storage.setTaskStepState(taskId, step.id, 'completed', { summary: input.summary, auditReference: input.auditReference, eventType: 'step.completed' });
      return this.reconcile(taskId, await this.realitySnapshot(taskId));
    }
    return this.get(taskId);
  }

  async recordToolOutcome(taskId: string, stepId: string, toolRequestId: string, result: ToolResultView): Promise<Task> {
    const task = await this.get(taskId); const step = task.steps.find((candidate) => candidate.id === stepId); if (!step) throw new Error('Unknown task step.');
    if (step.requiredTool && step.requiredTool !== result.toolName) throw new Error('Tool result does not match the task step contract.');
    await this.dependencies.storage.linkTaskStepAudit(taskId, stepId, toolRequestId);
    const succeeded = result.success && (result.exitCode === undefined || result.exitCode === null || result.exitCode === 0);
    if (succeeded) {
      const processStarted = result.toolName === 'task.process.start';
      await this.dependencies.storage.setTaskStepState(taskId, stepId, processStarted ? 'running' : 'waiting', { summary: processStarted ? `${step.name} started; completion still requires observed exit and verification evidence.` : `${step.name} returned a successful tool result; its verification criteria still require an explicit checkpoint.`, auditReference: toolRequestId, incrementAttempts: !processStarted, eventType: processStarted ? 'external.process.detected' : 'step.waiting' });
      await this.dependencies.storage.appendTaskCheckpoint(taskId, { stepId, name: `${step.name} tool result observed`, summary: processStarted ? 'FORGE observed a successful background-process start, not completion.' : 'FORGE recorded a successful structured tool result. Step completion remains separately verified.', verified: true, evidence: { toolName: result.toolName, exitCode: result.exitCode, affectedPaths: result.affectedPaths, warnings: result.warnings }, auditReferences: [toolRequestId] });
    } else {
      const output = result.output as { stdout?: unknown; stderr?: unknown } | undefined;
      await this.dependencies.storage.setTaskStepState(taskId, stepId, 'failed', { summary: `${step.name} failed.`, error: { message: result.error?.message ?? `Tool exited with code ${result.exitCode ?? 'unknown'}.`, code: result.error?.code, exitCode: result.exitCode, stdout: typeof output?.stdout === 'string' ? output.stdout.slice(0, 8_000) : undefined, stderr: typeof output?.stderr === 'string' ? output.stderr.slice(0, 8_000) : undefined, retryable: !result.cancelled, suggestedNextAction: result.rollback?.instructions }, auditReference: toolRequestId, incrementAttempts: step.status !== 'running', eventType: 'step.failed' });
    }
    return this.reconcile(taskId, await this.realitySnapshot(taskId));
  }

  async startBackground(taskId: string, stepId: string, input: ShellRunInput, toolRequestId: string): Promise<{ task: Task; process: BackgroundShellRunOutput }> {
    if (!this.dependencies.shell) throw new Error('Background shell runtime is unavailable.');
    const task = await this.get(taskId); const step = task.steps.find((candidate) => candidate.id === stepId); if (!step) throw new Error('Unknown task step.');
    if (!['shell.run', 'task.process.start'].includes(step.requiredTool ?? '')) throw new Error('Task step is not configured for a background shell process.');
    if (!step.dependencies.every((dependencyId) => completed(task.steps.find((candidate) => candidate.id === dependencyId)!))) throw new Error('Task step dependencies are not complete.');
    const outputPath = path.join('.forge', 'task-output', taskId, `${slug(step.name)}.log`);
    await this.dependencies.storage.setTaskStepState(taskId, stepId, 'running', { summary: `${step.name} is starting as a workspace-owned background process.`, incrementAttempts: true, auditReference: toolRequestId, eventType: 'step.started' });
    try {
      const process = await this.dependencies.shell.startBackground(input, outputPath, toolRequestId, true);
      await this.dependencies.storage.setTaskStepState(taskId, stepId, 'running', { summary: `${step.name} is running as process ${process.pid}.`, externalProcessId: process.pid, outputPath, auditReference: toolRequestId, eventType: 'external.process.detected' });
      await this.dependencies.storage.updateTaskReality(taskId, { processIds: [...new Set([...task.processIds, process.pid])] });
      return { task: await this.get(taskId), process };
    } catch (error) {
      await this.dependencies.storage.setTaskStepState(taskId, stepId, 'failed', { summary: `${step.name} could not start.`, error: { message: error instanceof Error ? error.message : String(error), retryable: true, suggestedNextAction: 'Inspect the exact command, working directory, and output path before retrying.' }, auditReference: toolRequestId, eventType: 'step.failed' });
      throw error;
    }
  }

  async generateHandoff(taskId: string): Promise<TaskHandoff> {
    const task = await this.get(taskId); const root = this.dependencies.workspaceRoot(); if (!root) throw new Error('Open a workspace before generating a task handoff.');
    const markdown = taskHandoffMarkdown(task); const directory = path.join(root, '.forge', 'handoffs'); const relativePath = path.join('.forge', 'handoffs', `${slug(task.title)}-${task.id.slice(0, 8)}.md`); const destination = path.join(root, relativePath); const temporary = `${destination}.${randomUUID()}.tmp`;
    await fs.mkdir(directory, { recursive: true });
    try { await fs.writeFile(temporary, markdown, { flag: 'wx' }); await fs.rename(temporary, destination); } catch (error) { await fs.rm(temporary, { force: true }); throw error; }
    const generatedAt = this.now(); await this.dependencies.storage.appendTaskEvent(taskId, { type: 'handoff.generated', summary: `Human-readable handoff generated at ${relativePath}.`, details: { relativePath } });
    return { taskId, relativePath, markdown, generatedAt };
  }
}

export function releaseTaskTemplate(version: string, originatingConversationId?: string): TaskDraft {
  if (!valid(version)) throw new Error('Release version must be valid semantic versioning.');
  const specifications: Array<[string, string, 0 | 1 | 2, string | undefined, string[]]> = [
    ['Version validation', 'Confirm package and requested semantic versions agree.', 0, 'file.read', ['package.json contains the requested version']],
    ['Branch validation', 'Confirm the release starts from the intended branch.', 0, 'git.status', ['Observed branch is recorded']],
    ['Working-tree validation', 'Prove the exact source tree is deliberate.', 0, 'git.status', ['Working tree state is recorded']],
    ['Tests', 'Run the complete automated test suite.', 2, 'task.process.start', ['Exit code is zero', 'Test totals are recorded']],
    ['Lint', 'Run static lint validation.', 2, 'task.process.start', ['Exit code is zero']],
    ['Typecheck', 'Run the TypeScript compiler without emitting.', 2, 'task.process.start', ['Exit code is zero']],
    ['Production build', 'Build production Electron bundles.', 2, 'task.process.start', ['Exit code is zero', 'Bundles exist']],
    ['ARM64 package', 'Create the ARM64 macOS package.', 2, 'task.process.start', ['DMG and ZIP artifacts exist']],
    ['Universal package', 'Create the universal macOS package.', 2, 'task.process.start', ['Universal DMG and ZIP artifacts exist']],
    ['Commit', 'Commit the exact validated staged source set.', 2, 'git.commit', ['Commit SHA is recorded']],
    ['Push', 'Push the validated feature branch.', 2, 'git.push', ['Remote branch contains commit']],
    ['Pull request', 'Create or identify the release pull request.', 2, 'web.open', ['Pull request ID and URL are recorded']],
    ['Merge', 'Merge only after required checks pass.', 2, 'web.open', ['Merge commit is recorded']],
    ['Main synchronization', 'Verify local main equals origin/main.', 2, 'git.pull', ['Local and remote main SHAs match']],
    ['Tag creation', 'Create the annotated release tag at the authoritative commit.', 2, 'shell.run', ['Annotated tag resolves to source commit']],
    ['GitHub Actions', 'Observe the release workflow without wasteful polling.', 0, 'web.fetch', ['Workflow run ID and conclusion are recorded']],
    ['DMG upload', 'Upload the validated DMG serially.', 2, 'web.open', ['Remote DMG exists']],
    ['ZIP upload', 'Upload the validated ZIP after the DMG.', 2, 'web.open', ['Remote ZIP exists']],
    ['Blockmap verification', 'Verify expected blockmap assets.', 0, 'web.fetch', ['Required blockmaps exist']],
    ['Updater metadata verification', 'Validate beta or latest updater YAML.', 0, 'web.fetch', ['Updater metadata references correct assets']],
    ['Remote SHA verification', 'Compare remote assets with validated local hashes.', 0, 'web.fetch', ['Every remote SHA matches']],
    ['Release publication', 'Publish the release only after provenance checks.', 2, 'web.open', ['Release is published and not draft']],
    ['Local installation', 'Install the exact validated application package.', 2, 'shell.run', ['Installed bundle identity is recorded']],
    ['Runtime diagnostics', 'Verify packaged runtime identity and security diagnostics.', 0, 'terminal.read', ['Runtime diagnostics match the release']],
    ['Updater verification', 'Verify the selected logical update channel behavior.', 2, 'shell.run', ['Updater result is recorded']],
    ['Final handoff', 'Generate the authoritative incomplete-or-complete release handoff.', 1, 'task.handoff', ['Handoff Markdown exists']]
  ];
  const steps: TaskStepDraft[] = specifications.map(
    ([name, purpose, riskTier, requiredTool, verificationCriteria], index) => ({ 
      id: `release-${String(index + 1).padStart(2, '0')}-${slug(name)}`, 
      name, 
      purpose, 
      riskTier, 
      requiredTool, 
      
      expectedInput: 
      requiredTool === 'task.process.start' 
      ? { 
          command: 'defined when the task step is executed',
          args: [] 
      } 
  :   undefined, 
  expectedOutput: { 
    verified: true, 
  }, 
  
  retryPolicy: { 
    maxAttempts: riskTier === 0 ? 2 : 1, 
    backoffMs: 5000, 
    retryableErrorCodes: ['ETIMEDOUT', 'ECONNRESET', 'HTTP_502'] 
  }, 
  
  timeoutMs: 
    requiredTool === 'task.process.start' 
    ? 600_000 
    : 120_000, 
    artifactPaths: [], 
    verificationCriteria, 
    dependencies: 
      index 
        ? [
            `release-${String(index).padStart(2, '0')}-${slug(
              specifications[index - 1][0],
            )}`,
          ] 
        : [], 
        
        rollbackInstructions: 
          riskTier === 2 
            ? 'Inspect the exact tool result and remote/local state before attempting any rollback.' 
            : undefined,
           })
          );


  return { 
    title: 
      `Release FORGE ${version}`, 
    
      description: 
      'Workspace-owned release workflow. The template defines structure and verification; it grants no execution authority.', 
      
      taskType: 
        'release', 
      
      priority: 
        'high', 
      
      originatingConversationId, 
      
      progressSummary: 
        'Release workflow drafted; no executable step has started.', 
        
        resumeInstructions: 
          'Reconcile Git, local processes, workflow/release metadata, asset presence, and hashes. Continue only from the first genuinely unfinished step. Do not rebuild, retag, reupload, recreate a pull request, or republish verified work.', 
          
          associatedReleaseTag: 
            `v${version}`, steps 
        };
}

export function taskHandoffMarkdown(task: Task): string {
  const complete = task.steps.filter(completed); const current = task.steps.find((step) => step.id === task.currentStepId); const waiting = task.steps.filter((step) => step.status === 'waiting'); const blocked = task.steps.filter((step) => ['blocked', 'failed'].includes(step.status));
  const lines = [`# ${task.title}`, '', `Task ID: \`${task.id}\``, `Status: **${task.status}**`, `Updated: ${new Date(task.updatedAt).toISOString()}`, '', '## Objective', '', task.description ?? task.title, '', '## Completed steps', '', ...(complete.length ? complete.map((step) => `- [x] ${step.name}`) : ['- None verified yet.']), '', '## Current state', '', `- Current step: ${current?.name ?? 'None'}`, `- Progress: ${task.progressSummary}`, `- Waiting: ${waiting.map((step) => step.name).join(', ') || 'None'}`, `- Blockers: ${blocked.map((step) => `${step.name}: ${step.lastError?.message ?? step.status}`).join('; ') || 'None'}`, `- Active process IDs: ${task.processIds.join(', ') || 'None'}`, '', '## Provenance and external state', '', `- Branch: ${task.associatedBranch ?? 'Unrecorded'}`, `- Commit: ${task.associatedCommitSha ?? 'Unrecorded'}`, `- Pull request: ${task.associatedPullRequest ?? 'Unrecorded'}`, `- Tag: ${task.associatedReleaseTag ?? 'Unrecorded'}`, `- Workflow run: ${task.associatedWorkflowRun ?? 'Unrecorded'}`, ...task.externalReferences.map((reference) => `- ${reference.type}: ${reference.url ?? reference.externalId} (${reference.state ?? 'state unrecorded'})`), '', '## Artifacts and verification', '', ...(task.artifacts.length ? task.artifacts.map((artifact) => `- ${artifact.kind}: ${artifact.path ?? artifact.uri ?? artifact.id}${artifact.sha256 ? ` — SHA-256 ${artifact.sha256}` : ''}${artifact.verifiedAt ? ' (verified)' : ''}`) : ['- No artifacts recorded.']), ...task.checkpoints.map((checkpoint) => `- ${checkpoint.verified ? 'Verified' : 'Unverified'} checkpoint: ${checkpoint.name} — ${checkpoint.summary}`), '', '## Resume instructions', '', task.resumeInstructions, '', '## Next action', '', current ? `Reconcile and advance **${current.name}** only after its dependencies and verification criteria are satisfied.` : 'Reconcile the task and identify the first genuinely unfinished step.', '', '## Actions that must not be repeated', '', ...(complete.length ? complete.map((step) => `- Do not repeat ${step.name} unless current evidence invalidates its verified checkpoint.`) : ['- No completed action is yet protected from repetition.']), '', '> SQLite task state in `.forge/metadata.sqlite` is authoritative. This Markdown file is a human-readable projection.', ''];
  return lines.join('\n');
}
