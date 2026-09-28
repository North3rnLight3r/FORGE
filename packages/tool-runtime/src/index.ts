import { z } from 'zod';

export type ToolExecutionState = 'requested' | 'running' | 'succeeded' | 'failed' | 'cancelled';
/**
 * Concrete execution effects.  Network reads are intentionally distinct from
 * network writes so callers can describe the operation accurately in audit
 * events and user-visible execution history.
 */
export type ToolSideEffect = 'read' | 'workspace-write' | 'repository-write' | 'destructive' | 'process' | 'read-network' | 'write-network';

export interface ToolAuditMetadata {
  category: 'filesystem' | 'git' | 'shell' | 'web' | 'memory';
  recordsAffectedPaths: boolean;
  recordsExitCode: boolean;
  externalDataTransfer: boolean;
}

export interface ToolDefinition<I = unknown, O = unknown> {
  name: string;
  purpose: string;
  inputSchema: z.ZodType<I>;
  outputSchema: z.ZodType<O>;
  /** Observable effect, independent from a numeric risk label. */
  sideEffect: ToolSideEffect;
  workspaceBoundary: 'required' | 'not-applicable';
  timeoutMs: number;
  audit: ToolAuditMetadata;
  cancellable: boolean;
  networkAccess: boolean;
  describeTarget(input: I): string;
  describeEffect(input: I): string;
}

export interface ProviderToolCall {
  id: string;
  name: string;
  arguments: unknown;
  provider: string;
}

/**
 * Runtime-owned identity and audit context for one tool execution. These
 * values are never provider arguments and must not be requested from a model
 * or user.
 */
export interface ToolExecutionContext {
  requestId: string;
  workspaceId: string;
  conversationId: string;
  modelId: string;
  reason: string;
  taskId?: string;
  stepId?: string;
}

export interface ToolRequest<I = unknown> {
  id: string;
  workspaceId: string;
  conversationId: string;
  modelId: string;
  toolName: string;
  input: I;
  executionContext: ToolExecutionContext;
  reason: string;
  target: string;
  workingDirectory?: string;
  expectedEffect: string;
  predictedAffectedPaths: string[];
  networkAccess: boolean;
  externalDataDescription?: string;
  diff?: string;
  state: ToolExecutionState;
  requestedAt: number;
  updatedAt: number;
}

export interface ToolResult<T = unknown> {
  requestId: string;
  toolName: string;
  success: boolean;
  output?: T;
  affectedPaths: string[];
  diff?: string;
  warnings: string[];
  error?: { code: string; message: string; details?: string };
  rollback?: { available: boolean; instructions?: string; backupPath?: string };
  exitCode?: number | null;
  durationMs: number;
  truncated?: boolean;
  cancelled?: boolean;
}

export class ToolRegistry {
  private readonly definitions = new Map<string, ToolDefinition<any, any>>();

  register<I, O>(definition: ToolDefinition<I, O>): void {
    if (!/^[a-z]+(?:\.[a-z]+)+$/.test(definition.name)) throw new Error(`Invalid tool name: ${definition.name}`);
    if (this.definitions.has(definition.name)) throw new Error(`Duplicate tool name: ${definition.name}`);
    this.definitions.set(definition.name, definition);
  }

  get(name: string): ToolDefinition<any, any> | undefined { return this.definitions.get(name); }
  list(): ToolDefinition<any, any>[] { return [...this.definitions.values()]; }

  parse(call: ProviderToolCall): { definition: ToolDefinition<any, any>; input: any } {
    const definition = this.definitions.get(call.name);
    if (!definition) throw new ToolValidationError('UNKNOWN_TOOL', `Unknown tool name: ${call.name}`);
    const parsed = definition.inputSchema.safeParse(call.arguments);
    if (!parsed.success) throw new ToolValidationError('MALFORMED_ARGUMENTS', `Invalid arguments for ${call.name}: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`);
    return { definition, input: parsed.data };
  }
}

export class ToolValidationError extends Error {
  constructor(public readonly code: 'UNKNOWN_TOOL' | 'MALFORMED_ARGUMENTS' | 'MALFORMED_OUTPUT' | 'POLICY_FAILURE', message: string) { super(message); }
}

export { z };
