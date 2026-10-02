import type { AgentMessage, AgentProviderResponse, AgentToolDescriptor, SimpleAIProvider } from './agent';
import { OpenAIProvider } from './openai';

export const DEFAULT_HERMES_ENDPOINT = 'http://127.0.0.1:11434/v1';
export const DEFAULT_HERMES_MODEL = 'llama3.2:3b';

export interface HermesBridgeConfiguration {
  endpoint?: string;
  model?: string;
  apiKey?: string;
}

/**
 * Hermes transport bridge.
 *
 * Hermes is intentionally an interchangeable model runtime, not a second
 * workspace authority. Its model traffic uses the Ollama OpenAI-compatible
 * endpoint while Agent and the desktop runtime continue to route every tool
 * request through FORGE's ToolRouter.
 */
export class HermesBridge implements SimpleAIProvider {
  public readonly id = 'hermes';
  private readonly provider: OpenAIProvider;
  private configuration: { endpoint: string; model: string; apiKey?: string };

  constructor(configuration: HermesBridgeConfiguration = {}) {
    this.configuration = this.defaults(configuration);
    this.provider = new OpenAIProvider({
      id: 'hermes',
      apiKey: this.configuration.apiKey,
      baseUrl: this.configuration.endpoint!,
      model: this.configuration.model!
    });
  }

  configure(configuration: HermesBridgeConfiguration): void {
    this.configuration = this.defaults(configuration);
    this.provider.configure({
      apiKey: this.configuration.apiKey,
      baseUrl: this.configuration.endpoint!,
      model: this.configuration.model!
    });
  }

  endpoint(): string { return this.configuration.endpoint!; }
  model(): string { return this.configuration.model!; }

  async isConfigured(): Promise<boolean> { return this.provider.isConfigured(); }
  async chat(messages: AgentMessage[], model?: string): Promise<string> { return this.provider.chat(messages, model ?? this.model()); }
  async chatWithTools(messages: AgentMessage[], tools: AgentToolDescriptor[], model?: string): Promise<AgentProviderResponse> {
    return this.provider.chatWithTools(messages, tools, model ?? this.model());
  }

  async probe(): Promise<{ reachable: boolean; modelAvailable: boolean; model: string }> {
    try {
      const validation = await this.provider.validateModel(this.model());
      return { reachable: true, modelAvailable: validation.exists, model: validation.model };
    } catch {
      return { reachable: false, modelAvailable: false, model: this.model() };
    }
  }

  private defaults(configuration: HermesBridgeConfiguration): { endpoint: string; model: string; apiKey?: string } {
    return {
      endpoint: configuration.endpoint?.trim() || process.env.FORGE_HERMES_ENDPOINT || DEFAULT_HERMES_ENDPOINT,
      model: configuration.model?.trim() || process.env.FORGE_HERMES_MODEL || process.env.FORGE_OLLAMA_MODEL || process.env.OPENAI_MODEL || DEFAULT_HERMES_MODEL,
      apiKey: configuration.apiKey?.trim() || process.env.FORGE_HERMES_API_KEY || undefined
    };
  }
}

export default HermesBridge;
