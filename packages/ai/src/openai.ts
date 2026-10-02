export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string; }
import type { AgentProviderResponse, AgentToolDescriptor } from './agent';
export interface OpenAIModelInfo { id: string; ownedBy?: string; }
export interface OpenAIModelValidation { model: string; exists: boolean; availableCount: number; }

export const DEFAULT_OPENAI_MODEL = 'gpt-5.6-sol';
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

interface ProviderErrorBody { error?: { message?: string; code?: string; param?: string }; message?: string; }

interface ResponsesOutputItem {
  type?: unknown;
  call_id?: unknown;
  name?: unknown;
  arguments?: unknown;
  content?: Array<{ type?: unknown; text?: unknown }>;
}

/**
 * zod-to-json-schema's OpenAPI output uses the legacy boolean exclusive bounds
 * form. Responses validates against modern JSON Schema, where those keywords
 * contain the numeric boundary itself.
 */
function responsesCompatibleSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(responsesCompatibleSchema);
  if (!value || typeof value !== 'object') return value;
  const schema = Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, responsesCompatibleSchema(entry)]));
  if (schema.exclusiveMinimum === true && typeof schema.minimum === 'number') {
    schema.exclusiveMinimum = schema.minimum;
    delete schema.minimum;
  }
  if (schema.exclusiveMaximum === true && typeof schema.maximum === 'number') {
    schema.exclusiveMaximum = schema.maximum;
    delete schema.maximum;
  }
  return schema;
}

function legacyToolAlias(name: string): string {
  return `forge_${name.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function providerToolNames(tools: AgentToolDescriptor[]): Map<string, string> {
  const names = new Map<string, string>();
  const legacyCandidates = new Map<string, string[]>();
  tools.forEach((tool, index) => {
    names.set(`forge_${index}_${tool.name.replace(/[^a-zA-Z0-9_-]/g, '_')}`, tool.name);
    names.set(tool.name, tool.name);
    const legacy = legacyToolAlias(tool.name);
    legacyCandidates.set(legacy, [...(legacyCandidates.get(legacy) ?? []), tool.name]);
  });
  for (const [alias, candidates] of legacyCandidates) {
    if (candidates.length === 1) names.set(alias, candidates[0]);
  }
  return names;
}

export class OpenAIProvider {
  public id: string;
  private apiKey: string | undefined;
  private baseUrl: string;
  private model: string;

  constructor(opts?: { apiKey?: string; baseUrl?: string; model?: string; id?: string }) {
    this.id = opts?.id ?? 'openai';
    this.apiKey = opts?.apiKey ?? process.env.OPENAI_API_KEY;
    this.baseUrl = this.normalizeBaseUrl(opts?.baseUrl ?? process.env.OPENAI_BASE_URL ?? DEFAULT_BASE_URL);
    this.model = this.normalizeModel(opts?.model ?? process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL);
  }

  configure(opts: { apiKey?: string; baseUrl: string; model: string }): void {
    this.apiKey = opts.apiKey;
    this.baseUrl = this.normalizeBaseUrl(opts.baseUrl);
    this.model = this.normalizeModel(opts.model);
  }

  async isConfigured(): Promise<boolean> { return Boolean(this.apiKey) || this.isLoopbackProvider(); }

  async listModels(): Promise<OpenAIModelInfo[]> {
    const response = await this.authorizedFetch(`${this.baseUrl}/models`);
    if (!response.ok) throw await this.providerError(response, 'Could not list models');
    const payload = await response.json() as { data?: Array<{ id?: unknown; owned_by?: unknown }>; models?: Array<{ name?: unknown; id?: unknown; owned_by?: unknown }> };
    const rawModels = Array.isArray(payload.data) ? payload.data : Array.isArray(payload.models) ? payload.models.map((model) => ({ id: model.id ?? model.name, owned_by: model.owned_by })) : null;
    if (!rawModels) throw new Error('The AI provider returned an invalid model list. You can still enter a model ID manually.');
    return rawModels
      .filter((model): model is { id: string; owned_by?: unknown } => typeof model.id === 'string' && Boolean(model.id.trim()))
      .map((model) => ({ id: model.id, ownedBy: typeof model.owned_by === 'string' ? model.owned_by : undefined }))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  async validateModel(model = this.model): Promise<OpenAIModelValidation> {
    const normalized = this.normalizeModel(model);
    const models = await this.listModels();
    return { model: normalized, exists: models.some((entry) => entry.id === normalized), availableCount: models.length };
  }

  async testConnection(): Promise<OpenAIModelValidation> {
    const validation = await this.validateModel();
    if (!validation.exists) {
      throw new Error(`The saved model "${validation.model}" is not available to this API key. Choose another model or refresh the provider model list.`);
    }
    return validation;
  }

  async chat(messages: ChatMessage[], model = this.model): Promise<string> {
    const selectedModel = this.normalizeModel(model);
    const request = {
      model: selectedModel,
      messages: messages.map((message) => ({ role: message.role, content: message.content })),
      max_completion_tokens: 1_600
    };
    let response = await this.authorizedFetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorText = await response.clone().text();
      if (response.status === 400 && /max_completion_tokens|unknown parameter|unsupported parameter/i.test(errorText)) {
        const { max_completion_tokens: _ignored, ...compatibleRequest } = request;
        response = await this.authorizedFetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...compatibleRequest, max_tokens: 1_600 })
        });
      }
    }

    if (!response.ok) throw await this.providerError(response, `AI request failed for model "${selectedModel}"`);
    const data = await response.json() as { choices?: Array<{ message?: { content?: unknown }; text?: unknown }> };
    const choice = data.choices?.[0];
    if (!choice) return '';
    return typeof choice.message?.content === 'string' ? choice.message.content : String(choice.text ?? '');
  }

  async chatWithTools(messages: ChatMessage[], tools: AgentToolDescriptor[], model = this.model): Promise<AgentProviderResponse> {
    const selectedModel = this.normalizeModel(model);
    const availableTools = tools;
    const providerNames = providerToolNames(availableTools);
    const aliasedTools = availableTools.map((tool, index) => {
      const alias = `forge_${index}_${tool.name.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      return { alias, tool };
    });
    if (this.usesResponsesForTools(selectedModel)) {
      return this.responsesWithTools(messages, aliasedTools, providerNames, selectedModel);
    }
    const providerTools = aliasedTools.map(({ alias, tool }) => ({
      type: 'function',
      function: { name: alias, description: `${tool.description} (FORGE tool: ${tool.name})`, parameters: responsesCompatibleSchema(tool.parameters) }
    }));
    const request = {
      model: selectedModel,
      messages: messages.map((message) => ({ role: message.role, content: message.content })),
      tools: providerTools,
      tool_choice: 'auto',
      // FORGE continues from observed results until progress stops. Request one
      // call at a time so an audit is never rejected for a burst of parallel
      // calls in a single provider response.
      parallel_tool_calls: false,
      max_completion_tokens: 10000,
    };
    let compatibleRequest: Record<string, unknown> = request;
    let response = await this.authorizedFetch(`${this.baseUrl}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(compatibleRequest) });
    for (let attempt = 0; !response.ok && response.status === 400 && attempt < 2; attempt += 1) {
      const errorText = await response.clone().text();
      const next = { ...compatibleRequest };
      if (/parallel_tool_calls/i.test(errorText) && 'parallel_tool_calls' in next) {
        delete next.parallel_tool_calls;
      } else if (/max_completion_tokens|unknown parameter|unsupported parameter/i.test(errorText) && 'max_completion_tokens' in next) {
        const limit = next.max_completion_tokens;
        delete next.max_completion_tokens;
        next.max_tokens = limit;
      } else {
        break;
      }
      compatibleRequest = next;
      response = await this.authorizedFetch(`${this.baseUrl}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(compatibleRequest) });
    }
    if (!response.ok) throw await this.providerError(response, `AI request failed for model "${selectedModel}"`);
    const data = await response.json() as { choices?: Array<{ message?: { content?: unknown; tool_calls?: unknown[] } }> };
    const message = data.choices?.[0]?.message;
    const toolCalls = (message?.tool_calls ?? []).map((raw) => {
      const call = raw as { id?: unknown; function?: { name?: unknown; arguments?: unknown } };
      if (typeof call.function?.name !== 'string' || typeof call.function.arguments !== 'string') throw new Error('The provider returned a malformed tool call.');
      let args: unknown; try { args = JSON.parse(call.function.arguments); } catch { throw new Error('The provider returned malformed tool arguments.'); }
      return { id: typeof call.id === 'string' ? call.id : crypto.randomUUID(), name: providerNames.get(call.function.name) ?? call.function.name, arguments: args, provider: this.id };
    });
    const content = typeof message?.content === 'string' ? message.content : '';
    if (toolCalls.length === 0) {
      const textCall = this.textToolCall(content, availableTools, providerNames);
      if (textCall) return { content: '', toolCalls: [textCall], modelId: selectedModel };
    }
    return { content, toolCalls, modelId: selectedModel };
  }

  private async responsesWithTools(
    messages: ChatMessage[],
    tools: Array<{ alias: string; tool: AgentToolDescriptor }>,
    providerNames: ReadonlyMap<string, string>,
    selectedModel: string
  ): Promise<AgentProviderResponse> {
    const request = {
      model: selectedModel,
      input: messages.map((message) => ({ role: message.role, content: message.content })),
      tools: tools.map(({ alias, tool }) => ({
        type: 'function',
        name: alias,
        description: `${tool.description} (FORGE tool: ${tool.name})`,
        parameters: responsesCompatibleSchema(tool.parameters)
      })),
      tool_choice: 'auto',
      // This is deliberately not a total tool budget. The native runtime
      // observes one result, then asks for the next dependency-ready call.
      parallel_tool_calls: false,
      max_output_tokens: 10_000
    };
    const response = await this.authorizedFetch(`${this.baseUrl}/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
    if (!response.ok) throw await this.providerError(response, `AI request failed for model "${selectedModel}"`);
    const data = await response.json() as { model?: unknown; output?: ResponsesOutputItem[]; output_text?: unknown };
    if (!Array.isArray(data.output)) throw new Error('The provider returned a malformed Responses API result.');
    const toolCalls = data.output.filter((item) => item.type === 'function_call').map((call) => {
      if (typeof call.name !== 'string' || typeof call.arguments !== 'string') throw new Error('The provider returned a malformed tool call.');
      let args: unknown;
      try { args = JSON.parse(call.arguments); } catch { throw new Error('The provider returned malformed tool arguments.'); }
      return {
        id: typeof call.call_id === 'string' ? call.call_id : crypto.randomUUID(),
        name: providerNames.get(call.name) ?? call.name,
        arguments: args,
        provider: this.id
      };
    });
    const content = typeof data.output_text === 'string'
      ? data.output_text
      : data.output
        .filter((item) => item.type === 'message')
        .flatMap((item) => item.content ?? [])
        .filter((part) => part.type === 'output_text' && typeof part.text === 'string')
        .map((part) => part.text as string)
        .join('');
    return { content, toolCalls, modelId: typeof data.model === 'string' ? data.model : selectedModel };
  }

  private async authorizedFetch(url: string, init: RequestInit = {}): Promise<Response> {
    if (!this.apiKey && !this.isLoopbackProvider()) throw new Error('An API key is required for remote AI providers. Loopback providers such as Ollama may run without one.');
    return fetch(url, {
      ...init,
      headers: this.apiKey ? { ...init.headers, Authorization: `Bearer ${this.apiKey}` } : init.headers
    });
  }

  private isLoopbackProvider(): boolean {
    const hostname = new URL(this.baseUrl).hostname.toLowerCase();
    return ['localhost', '127.0.0.1', '::1'].includes(hostname);
  }

  private textToolCall(content: string, tools: AgentToolDescriptor[], providerNames: ReadonlyMap<string, string>): AgentProviderResponse['toolCalls'][number] | null {
    const trimmed = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    if (!trimmed.startsWith('{')) return null;
    try {
      const value = JSON.parse(trimmed) as { name?: unknown; tool?: unknown; parameters?: unknown; arguments?: unknown };
      const requestedName = value.name ?? value.tool;
      const requestedArguments = value.parameters ?? value.arguments;
      if (typeof requestedName !== 'string' || !requestedArguments || typeof requestedArguments !== 'object' || Array.isArray(requestedArguments)) return null;
      const stableName = providerNames.get(requestedName) ?? requestedName;
      if (!tools.some((tool) => tool.name === stableName)) return null;
      return { id: crypto.randomUUID(), name: stableName, arguments: requestedArguments, provider: this.id };
    } catch { return null; }
  }

  private async providerError(response: Response, prefix: string): Promise<Error> {
    const text = await response.text();
    let detail = text;
    let code: string | undefined;
    try {
      const parsed = JSON.parse(text) as ProviderErrorBody;
      detail = parsed.error?.message ?? parsed.message ?? text;
      code = parsed.error?.code;
    } catch { /* non-JSON compatible providers are allowed */ }
    if (response.status === 404 || code === 'model_not_found' || /model.+(?:not found|does not exist|not available)/i.test(detail)) {
      return new Error(`${prefix}: the model is unsupported or unavailable for this provider. Refresh models in Settings or enter a different model ID.`);
    }
    return new Error(`${prefix} (${response.status}): ${detail || response.statusText}`);
  }

  private normalizeBaseUrl(value: string): string {
    const normalized = value.trim().replace(/\/$/, '');
    if (!normalized) throw new Error('API base URL is required.');
    const parsed = new URL(normalized);
    if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('API base URL must use HTTPS or HTTP.');
    if (parsed.username || parsed.password) throw new Error('API base URL must not contain credentials.');
    const loopback = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname.toLowerCase());
    if (parsed.protocol === 'http:' && !loopback) throw new Error('Remote API base URLs must use HTTPS. HTTP is allowed only for loopback providers.');
    return parsed.toString().replace(/\/$/, '');
  }

  private normalizeModel(value: string): string {
    const normalized = value.trim();
    if (!normalized) throw new Error('AI model ID is required.');
    return normalized;
  }

  private usesResponsesForTools(model: string): boolean {
    return /^gpt-5\.6(?:-|$)/i.test(model);
  }
}

export default OpenAIProvider;
