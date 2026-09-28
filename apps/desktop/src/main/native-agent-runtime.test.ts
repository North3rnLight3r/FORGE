import { describe, expect, it } from 'vitest';
import { assertToolIdentity, createNativeAgentRuntime, requiredDirectEvidence, runtimeToolRecoveryGuidance } from './native-agent-runtime';

describe('native agent direct-evidence requirements', () => {
  it('honors explicit file and Git tool requests', () => {
    expect(requiredDirectEvidence('Use file.search + file.read, then git.log and git.diff.', [])).toEqual(['file.search', 'file.read', 'git.log', 'git.diff']);
    expect(requiredDirectEvidence('Use file.search + file.read, then git.log and git.diff.', ['file.search', 'file.read', 'git.log', 'git.diff'])).toEqual([]);
    expect(requiredDirectEvidence('Read packages/intelligence/src/semantic.ts before answering.', [])).toEqual(['file.read']);
  });

  it('does not allow a bug investigation to stop after file.search', () => {
    expect(requiredDirectEvidence('Investigate the runtime regression.', [])).toEqual(['file.search', 'git.log']);
    expect(requiredDirectEvidence('Investigate the runtime regression.', ['file.search'])).toContain('file.read');
    expect(requiredDirectEvidence('Investigate the runtime regression.', ['file.search', 'file.read', 'git.log'])).toEqual([]);
  });

  it('requires workspace inspection through direct tools when explicitly requested', () => {
    expect(requiredDirectEvidence('Use agent tools to inspect the workspace.', [])).toEqual(['file.search']);
  });
});

describe('native agent evidence-chain recovery', () => {
  it('continues from search through source read before accepting a diagnosis', async () => {
    const turns = [
      { content: 'A plausible guess.', toolCalls: [] },
      { content: '', toolCalls: [{ id: 'search', name: 'file.search', arguments: { query: 'failure', path: '.' }, provider: 'test' }] },
      { content: 'The search is enough.', toolCalls: [] },
      { content: '', toolCalls: [{ id: 'read', name: 'file.read', arguments: { path: 'src/runtime.ts' }, provider: 'test' }] },
      { content: 'Verified diagnosis from current source.', toolCalls: [] }
    ].map((turn) => ({ ...turn, modelId: 'test-model', memories: [], context: { artifacts: [], metrics: {} } }));
    const agent = { askWithTools: async () => turns.shift()!, askWithContext: async () => { throw new Error('unexpected'); } };
    const requested: string[] = [];
    const storage = {
      conversationState: async () => ({ activeConversationId: 'conversation' }), listConversationMessages: async () => [], appendConversation: async () => undefined,
      dashboard: async () => ({ id: 'workspace' }), markSemanticRecordsUsed: async () => undefined
    };
    const toolRouter = {
      providerDefinitions: () => [], request: async (call: any) => {
        requested.push(call.name);
        return { request: { id: call.id, toolName: call.name, conversationId: 'conversation' }, result: { requestId: call.id, toolName: call.name, success: true, output: { evidence: call.name }, affectedPaths: [], warnings: [], durationMs: 1 } };
      }
    };
    const runtime = createNativeAgentRuntime({ storage, workspace: { info: () => ({ rootPath: '/workspace' }) }, agent, toolRouter, taskRuntime: {}, settings: { publicSettings: () => ({ apiModel: 'test-model' }) }, aiProvider: { id: 'test' }, git: { status: async () => ({ branch: 'main', files: [] }) } });
    const result = await runtime.runAgentTurn(undefined, 'Investigate the failure using agent tools to inspect the workspace.');
    expect(requested).toEqual(['file.search', 'file.read']);
    expect(result.content).toContain('Verified diagnosis from current source.');
  });
});

describe('native agent tool routing', () => {
  const conversationId = '0d4df9fc-a584-4dbe-8cce-7f9b783581f3';
  const requestId = '2d5e799a-7d73-48b8-a4e9-d314944b5b95';

  it('preserves request and conversation identities across tool results', () => {
    const request = { id: requestId, toolName: 'file.list', conversationId };
    const result = { requestId, toolName: 'file.list' };
    expect(() => assertToolIdentity(request, result, conversationId)).not.toThrow();
  });

  it('rejects mismatched request, tool, or conversation identities before continuation', () => {
    const request = { id: requestId, toolName: 'file.list', conversationId };
    expect(() => assertToolIdentity(request, { requestId: '72b59bd4-42b1-4288-9513-dba43b9103a0', toolName: 'file.list' }, conversationId)).toThrow(/request mismatch/i);
    expect(() => assertToolIdentity(request, { requestId, toolName: 'shell.run' }, conversationId)).toThrow(/name mismatch/i);
    expect(() => assertToolIdentity({ ...request, conversationId: 'c2cff4f7-f41f-445e-b6f5-8b9ef5d55051' }, undefined, conversationId)).toThrow(/conversation mismatch/i);
  });

  it('explains configured filesystem scope without hiding available tools', () => {
    const tools = new Set(['file.list', 'file.read', 'shell.run', 'terminal.read', 'browser.read']);
    const guidance = runtimeToolRecoveryGuidance('file.list', 'Path must be workspace-relative and may not traverse upward.', tools);
    expect(guidance).toContain('Runtime tool catalog:');
    expect(guidance).toContain('shell.run');
    expect(guidance).toContain('when permitted by the configured filesystem scope');
    expect(runtimeToolRecoveryGuidance('file.read', 'SCOPE_FAILURE: target is outside the configured workspace scope', tools)).toContain('broader scope to select in Settings');
  });

  it('treats permission-denied scans as skippable rather than a reason to mutate ownership', () => {
    const guidance = runtimeToolRecoveryGuidance('file.list', "EACCES: permission denied, scandir '/home/user/.local/share/containers/storage/overlay/layer'", new Set(['file.list', 'shell.run']));
    expect(guidance).toMatch(/report unreadable paths/i);
    expect(guidance).toMatch(/Do not chmod\/chown/i);
  });
});
