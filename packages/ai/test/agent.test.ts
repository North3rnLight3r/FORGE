import { describe, it, expect } from 'vitest';
import { Agent } from '../src/agent';

class MockProvider {
  id = 'mock';
  async isConfigured() { return true; }
  async chat(messages: any[]) { return `response to: ${messages[messages.length - 1].content.slice(0, 32)}`; }
}

class MockBuilder {
  async assemble() {
    return { systemPrompt: 'FORGE workspace context', artifacts: [], omittedArtifactIds: [], characterBudget: 100, characterCount: 23 };
  }
}

describe('Agent', () => {
  it('ask calls provider and returns response', async () => {
    const provider = new MockProvider();
    const builder = new MockBuilder();
    const agent = new Agent(provider as any, builder as any);
    const r = await agent.ask('What is this repo?');
    expect(r).toContain('response to:');
  });

  it('explainProject delegates to ask', async () => {
    const provider = new MockProvider();
    const builder = new MockBuilder();
    const agent = new Agent(provider as any, builder as any);
    const r = await agent.explainProject();
    expect(r).toContain('response to:');
  });

  it('injects workspace context and bounded conversation history', async () => {
    let sent: any[] = [];
    const provider = new MockProvider();
    provider.chat = async (messages: any[]) => { sent = messages; return 'grounded'; };
    const agent = new Agent(provider as any, new MockBuilder() as any);
    const result = await agent.askWithContext('What should I build next?', [{ role: 'user', content: 'Architecture first' }]);
    expect(result.content).toBe('grounded');
    expect(sent[0].role).toBe('system');
    expect(sent[0].content).toContain('FORGE workspace context');
    expect(sent[0].content).toContain('FORGE intelligence layer');
    expect(sent[1]).toEqual({ role: 'user', content: 'Architecture first' });
    expect(sent.at(-1)?.content).toBe('What should I build next?');
  });
});
