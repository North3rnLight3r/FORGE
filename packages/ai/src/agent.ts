import type { MemoryEntry, MemoryRetriever } from '@forge/memory';
import type { ContextAssemblyResult } from './intelligence';
import { intelligenceMessages } from './intelligence-layer';

export interface AgentMessage { role: 'system' | 'user' | 'assistant'; content: string; }

export interface SimpleAIProvider {
  id: string;
  isConfigured(): Promise<boolean>;
  chat(messages: AgentMessage[], model?: string): Promise<string>;
  chatWithTools?(messages: AgentMessage[], tools: AgentToolDescriptor[], model?: string): Promise<AgentProviderResponse>;
}

export interface AgentToolDescriptor {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  sideEffects?: string;
  networkAccess?: boolean;
  cancellation?: boolean;
  resultSemantics?: string;
}
export interface AgentProviderResponse { content: string; toolCalls: Array<{ id: string; name: string; arguments: unknown; provider: string }>; modelId?: string; }

export interface AgentTurnResult {
  content: string;
  memories: MemoryEntry[];
  context: ContextAssemblyResult;
}
export interface AgentToolTurnResult extends AgentTurnResult { toolCalls: AgentProviderResponse['toolCalls']; modelId?: string; }

export class Agent {
  constructor(
    private provider: SimpleAIProvider,
    private contextBuilder: { assemble(query: string, memories?: MemoryEntry[] | null): Promise<ContextAssemblyResult>; packet?(query: string, memories?: MemoryEntry[] | null): Promise<ContextAssemblyResult> },
    private memoryRetriever?: MemoryRetriever
  ) {}

  async askWithContext(question: string, history: readonly AgentMessage[] = []): Promise<AgentTurnResult> {
    const prepared = await this.prepare(question, history);
    return { content: await this.provider.chat(prepared.messages), memories: prepared.memories, context: prepared.context };
  }

  async askWithTools(question: string, history: readonly AgentMessage[] = [], tools: AgentToolDescriptor[] = []): Promise<AgentToolTurnResult> {
    const prepared = await this.prepare(question, history);
    const response = this.provider.chatWithTools ? await this.provider.chatWithTools(prepared.messages, tools) : { content: await this.provider.chat(prepared.messages), toolCalls: [] };
    return { content: response.content, toolCalls: response.toolCalls, modelId: response.modelId, memories: prepared.memories, context: prepared.context };
  }

  private async prepare(question: string, history: readonly AgentMessage[]): Promise<{ messages: AgentMessage[]; memories: MemoryEntry[]; context: ContextAssemblyResult }> {
    let memories: MemoryEntry[] = [];
    if (this.memoryRetriever) {
      try { memories = await this.memoryRetriever.search(question, 6); }
      catch { memories = []; }
    }
    const context = this.contextBuilder.packet ? await this.contextBuilder.packet(question, memories) : await this.contextBuilder.assemble(question, memories);
    const boundedHistory = history
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .slice(-48)
      .reduceRight<AgentMessage[]>((selected, message) => {
        const used = selected.reduce((total, entry) => total + entry.content.length, 0);
        return used >= 40_000 ? selected : [{ role: message.role, content: message.content.slice(0, 6_000) }, ...selected];
      }, []);
    const messages: AgentMessage[] = [
      { role: 'system', content: context.systemPrompt },
      ...boundedHistory,
      { role: 'user', content: question }
    ];
    return {
      messages: intelligenceMessages(messages, { runtime: this.provider.id === 'hermes' ? 'hermes' : 'native' }),
      memories,
      context
    };
  }

  async ask(question: string, history: readonly AgentMessage[] = []): Promise<string> {
    return (await this.askWithContext(question, history)).content;
  }

  async explainProject(history: readonly AgentMessage[] = []): Promise<string> {
    return this.ask('Explain this repository as an evidence-grounded architecture summary.', history);
  }

  async reviewChanges(history: readonly AgentMessage[] = []): Promise<string> {
    return this.ask('Review the current repository changes against its documented architecture and project goals.', history);
  }
}

export default Agent;
