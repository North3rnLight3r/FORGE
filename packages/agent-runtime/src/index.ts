import { execFile as execFileCallback } from 'node:child_process';
import { access, readdir, readFile } from 'node:fs/promises';
import { homedir, platform as hostPlatform } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);

export type AgentRuntimeKind = 'native' | 'hermes';
export type SupportedPlatform = 'linux' | 'darwin' | 'win32' | 'other';
export type HermesIntegrationMode = 'acp' | 'headless-http' | 'unavailable';
export const DEFAULT_HERMES_ENDPOINT = 'http://127.0.0.1:11434/v1';

export interface PlatformCapabilities {
  platform: SupportedPlatform;
  nativeRuntimeAvailable: boolean;
  hermesAvailable: boolean;
  hermesIntegrationMode: HermesIntegrationMode;
  embeddingProviderAvailable: boolean;
  embeddingModelAvailable: boolean;
  semanticIndexHealthy: boolean;
  toolRouterAvailable: boolean;
  workspaceDatabaseHealthy: boolean;
  appDataPath: string;
  packagedResourcePath: string;
}

export function normalizePlatform(value: string): SupportedPlatform { return ['linux', 'darwin', 'win32'].includes(value) ? value as SupportedPlatform : 'other'; }

export function hermesIntegrationMode(platform: string, status: HermesRuntimeStatus | null): HermesIntegrationMode {
  if (status?.availability !== 'available') return 'unavailable';
  if (status.endpointReachable === true) return 'headless-http';
  return normalizePlatform(platform) === 'linux' ? 'acp' : 'unavailable';
}

export function platformCapabilities(input: { platform?: string; appDataPath: string; resourcePath: string; hermesStatus: HermesRuntimeStatus | null; embeddingProviderAvailable: boolean; embeddingModelAvailable: boolean; semanticIndexHealthy: boolean; workspaceDatabaseHealthy: boolean; toolRouterAvailable?: boolean }): PlatformCapabilities {
  const platform = normalizePlatform(input.platform ?? process.platform); const mode = hermesIntegrationMode(platform, input.hermesStatus);
  return { platform, nativeRuntimeAvailable: true, hermesAvailable: mode !== 'unavailable', hermesIntegrationMode: mode, embeddingProviderAvailable: input.embeddingProviderAvailable, embeddingModelAvailable: input.embeddingModelAvailable, semanticIndexHealthy: input.semanticIndexHealthy, toolRouterAvailable: input.toolRouterAvailable !== false, workspaceDatabaseHealthy: input.workspaceDatabaseHealthy, appDataPath: path.resolve(input.appDataPath), packagedResourcePath: path.resolve(input.resourcePath) };
}
export type RuntimeAvailability = 'available' | 'unavailable' | 'degraded';
export type SkillScope = 'workspace' | 'repository' | 'global' | 'forge-os';

export interface HermesRuntimeConfiguration { command?: string; endpoint?: string; }
export interface HermesRuntimeStatus {
  kind: 'hermes'; availability: RuntimeAvailability; command: string; version?: string; endpoint?: string;
  endpointReachable: boolean | null; installDirectory?: string; skillRoots: string[]; message: string;
}
export interface AgentRuntimeProfile { kind: AgentRuntimeKind; requested: AgentRuntimeKind; active: AgentRuntimeKind; status: HermesRuntimeStatus | null; }
export interface DiscoveredSkill { id: string; name: string; description: string; version?: string; platforms: string[]; path: string; scope: SkillScope; }
export interface RuntimeStatusOptions {
  command?: string; endpoint?: string; environment?: NodeJS.ProcessEnv; platform?: string; homeDirectory?: string;
  execute?: (command: string, args: string[], options: { timeout: number; windowsHide: boolean }) => Promise<{ stdout: string; stderr: string }>;
  fetcher?: typeof fetch;
}

const exists = async (value: string): Promise<boolean> => access(value).then(() => true).catch(() => false);

/** Detects Hermes without installing it, launching a GUI, or relying on a fixed platform path. */
export class HermesRuntimeDetector {
  async status(options: RuntimeStatusOptions = {}): Promise<HermesRuntimeStatus> {
    const command = normalizeCommand(options.command) ?? 'hermes';
    const environment = options.environment ?? process.env;
    const homeDirectory = options.homeDirectory ?? homedir();
    const configuredRoot = environment.HERMES_HOME?.trim();
    const endpoint = normalizeEndpoint(options.endpoint ?? environment.FORGE_HERMES_ENDPOINT ?? (environment.FORGE_AGENT_RUNTIME === 'hermes' ? DEFAULT_HERMES_ENDPOINT : undefined));
    const execute = options.execute ?? ((file, args, executionOptions) => execFile(file, args, executionOptions));
    const fetcher = options.fetcher ?? fetch;
    let version: string | undefined;
    let installDirectory: string | undefined;
    let executableError: string | undefined;
    const candidates: string[] = [];
    try {
      const result = await execute(command, ['--version'], { timeout: 4_000, windowsHide: true });
      version = firstUsefulLine(result.stdout) ?? firstUsefulLine(result.stderr);
      installDirectory = installedDirectory(result.stdout) ?? installedDirectory(result.stderr);
      if (installDirectory) candidates.push(path.dirname(installDirectory));
    } catch (error) { executableError = conciseError(error); }
    let endpointReachable: boolean | null = null;
    if (endpoint) {
      try {
        const modelsEndpoint = `${endpoint.replace(/\/$/, '')}/models`;
        const response = await fetcher(modelsEndpoint, { method: 'GET', signal: AbortSignal.timeout(4_000) });
        endpointReachable = response.ok || response.status === 401 || response.status === 403;
      } catch { endpointReachable = false; }
    }
    const roots = [...new Set([configuredRoot, ...candidates, path.join(homeDirectory, '.hermes')].filter((candidate): candidate is string => Boolean(candidate && candidate.trim())))];
    const skillRoots = roots.flatMap((root) => [path.join(root, 'skills'), path.join(root, 'optional-skills')]);
    const discoveredRoots = (await Promise.all(skillRoots.map(async (candidate) => (await exists(candidate)) ? candidate : null))).filter((candidate): candidate is string => Boolean(candidate));
    if (version) return {
      kind: 'hermes', availability: endpointReachable === false ? 'degraded' : 'available', command, version, endpoint, endpointReachable, installDirectory, skillRoots: discoveredRoots,
      message: endpointReachable === false ? 'Hermes CLI is available, but the configured endpoint did not respond.' : 'Hermes CLI is available. FORGE retains workspace state and tool execution.'
    };
    if (endpointReachable) return {
      kind: 'hermes', availability: 'available', command, endpoint, endpointReachable, skillRoots: discoveredRoots,
      message: 'The configured Hermes-compatible endpoint is reachable. FORGE will use the shared native ToolRouter through the Hermes bridge.'
    };
    return {
      kind: 'hermes', availability: 'unavailable', command, endpoint, endpointReachable, skillRoots: discoveredRoots,
      message: `Hermes is optional and was not detected${executableError ? ` (${executableError})` : ''}. FORGE will use its native runtime.`
    };
  }
}

/** Resolves the requested runtime without allowing an optional integration to become a single point of failure. */
export function resolveAgentRuntime(requested: AgentRuntimeKind, status: HermesRuntimeStatus | null, bridgeAvailable = false): AgentRuntimeProfile {
  const endpointBridgeAvailable = status?.endpointReachable === true;
  const active: AgentRuntimeKind = requested === 'hermes' && status?.availability === 'available' && (bridgeAvailable || endpointBridgeAvailable) ? 'hermes' : 'native';
  return { kind: active, requested, active, status };
}

/** Discover only lightweight metadata; SKILL.md bodies stay on disk until intentionally requested. */
export async function discoverSkills(roots: Array<{ path: string; scope: SkillScope }>): Promise<DiscoveredSkill[]> {
  const discovered: DiscoveredSkill[] = [];
  for (const root of roots) await visit(root.path, root.scope, 0, discovered);
  return discovered.sort((left, right) => left.name.localeCompare(right.name) || left.path.localeCompare(right.path));
}

async function visit(directory: string, scope: SkillScope, depth: number, discovered: DiscoveredSkill[]): Promise<void> {
  if (depth > 4) return;
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const child = path.join(directory, entry.name);
    const skillFile = path.join(child, 'SKILL.md');
    if (await exists(skillFile)) {
      const skill = parseSkillMetadata(await readFile(skillFile, 'utf8').catch(() => ''), skillFile, scope);
      if (skill) discovered.push(skill);
      continue;
    }
    await visit(child, scope, depth + 1, discovered);
  }
}

export function parseSkillMetadata(contents: string, skillPath: string, scope: SkillScope): DiscoveredSkill | null {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(contents)?.[1] ?? '';
  const field = (name: string): string | undefined => new RegExp(`^${name}:\\s*(.+?)\\s*$`, 'mi').exec(frontmatter)?.[1]?.trim().replace(/^['"]|['"]$/g, '');
  const title = /^#\s+(.+?)\s*$/m.exec(contents)?.[1]?.trim();
  const name = field('name') || title;
  if (!name) return null;
  const platforms = (field('platforms') ?? '').replace(/^\[|\]$/g, '').split(',').map((item) => item.trim()).filter(Boolean);
  return { id: `${scope}:${skillPath.replaceAll('\\', '/')}`, name, description: field('description') ?? '', version: field('version'), platforms, path: skillPath, scope };
}

export function skillRootsForWorkspace(workspaceRoot: string, options: { hermesRoots?: string[]; platform?: string } = {}): Array<{ path: string; scope: SkillScope }> {
  const platform = options.platform ?? hostPlatform();
  return [
    { path: path.join(workspaceRoot, '.forge', 'skills'), scope: 'workspace' },
    { path: path.join(workspaceRoot, 'skills'), scope: 'repository' },
    ...(options.hermesRoots ?? []).map((skillRoot) => ({ path: skillRoot, scope: 'global' as const })),
    ...(platform === 'linux' ? [{ path: '/usr/share/forge/skills', scope: 'forge-os' as const }] : [])
  ];
}

function normalizeCommand(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  if (normalized.length > 1_024 || /[\0\r\n]/.test(normalized)) throw new Error('Hermes command must be a bounded executable path or command name.');
  return normalized;
}
function normalizeEndpoint(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  const parsed = new URL(normalized);
  if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('Hermes endpoint must be an HTTP(S) URL without embedded credentials.');
  const loopback = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname.toLowerCase());
  if (parsed.protocol === 'http:' && !loopback) throw new Error('Remote Hermes endpoints must use HTTPS.');
  return parsed.toString();
}
function firstUsefulLine(value: string): string | undefined { return value.split(/\r?\n/).map((line) => line.trim()).find(Boolean)?.slice(0, 300); }
function installedDirectory(value: string): string | undefined { return /^Install directory:\s*(.+?)\s*$/mi.exec(value)?.[1]?.trim(); }
function conciseError(error: unknown): string { return (error instanceof Error ? error.message : String(error)).replace(/[\r\n]+/g, ' ').slice(0, 180); }
