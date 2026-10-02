import { afterEach, describe, expect, it, vi } from 'vitest';
import { Agent } from '../src/agent';
import { HermesBridge } from '../src/hermes';

afterEach(() => vi.unstubAllGlobals());

describe('Hermes Ollama bridge', () => {
  it('uses Ollama OpenAI-compatible chat completions and preserves FORGE tool identity', async () => {
    let requestUrl = '';
    let requestBody: any;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      requestUrl = url;
      requestBody = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ choices: [{ message: { content: '', tool_calls: [{ id: 'hermes-call', function: { name: 'forge_0_file_read', arguments: '{"path":"README.md"}' } }] } }] }), { status: 200 });
    }));
    const bridge = new HermesBridge({ endpoint: 'http://127.0.0.1:11434/v1', model: 'llama3.2:3b' });
    const result = await bridge.chatWithTools([{ role: 'user', content: 'read the README' }], [{ name: 'file.read', description: 'Read a file', parameters: { type: 'object' } }]);
    expect(requestUrl).toBe('http://127.0.0.1:11434/v1/chat/completions');
    expect(requestBody.model).toBe('llama3.2:3b');
    expect(result.toolCalls).toEqual([{ id: 'hermes-call', name: 'file.read', arguments: { path: 'README.md' }, provider: 'hermes' }]);
  });

  it('adds the same intelligence layer to Hermes and keeps workspace context ahead of the model', async () => {
    let requestBody: any;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      requestBody = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ choices: [{ message: { content: 'verified' } }] }), { status: 200 });
    }));
    const bridge = new HermesBridge({ endpoint: 'http://127.0.0.1:11434/v1', model: 'llama3.2:3b' });
    const agent = new Agent(bridge, { assemble: async () => ({ systemPrompt: 'Workspace evidence: current source.', artifacts: [], omittedArtifactIds: [], characterBudget: 1000, characterCount: 32 }) });
    await agent.askWithContext('inspect the current implementation');
    expect(requestBody.messages[0].content).toContain('FORGE intelligence layer');
    expect(requestBody.messages[0].content).toContain('Hermes through the configured OpenAI-compatible endpoint');
    expect(requestBody.messages[0].content).toContain('current files, and current Git state as authoritative');
  });
});
