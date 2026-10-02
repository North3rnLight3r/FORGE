import { app, safeStorage } from 'electron';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { normalizeUpdateChannel, type SettingsSaveRequest, type UserSettings } from '@forge/ipc';
import { DEFAULT_HERMES_ENDPOINT, DEFAULT_HERMES_MODEL, DEFAULT_OPENAI_MODEL } from '@forge/ai';
import { DEFAULT_CONTEXT_TOKEN_BUDGET, DEFAULT_EMBEDDING_BASE_URL, DEFAULT_EMBEDDING_MODEL, type EmbeddingConfiguration } from '@forge/intelligence';

interface StoredSettings {
  lastWorkspacePath?: string;
  apiBaseUrl?: string;
  apiModel?: string;
  apiKey?: string;
  githubUsername?: string;
  githubToken?: string;
  webResearchEnabled?: boolean;
  updateChannel?: 'stable' | 'beta' | 'preview';
  agentRuntime?: 'native' | 'hermes';
  hermesCommand?: string;
  hermesEndpoint?: string;
  embeddingEnabled?: boolean;
  embeddingProvider?: 'openai-compatible';
  embeddingBaseUrl?: string;
  embeddingModel?: string;
  embeddingApiKey?: string;
  contextTokenBudget?: number;
  agentExecutionMode?: 'disabled' | 'controlled' | 'allow-all';
  filesystemScope?: 'workspace' | 'repository' | 'project-tree' | 'home' | 'full';
  projectTreeRoot?: string;
  networkAccess?: { web?: boolean; git?: boolean; packageManager?: boolean; general?: boolean };
  processMode?: 'standard' | 'full-local-compute';
  processTimeoutMs?: number;
  backgroundTaskTimeoutMs?: number;
  autonomousTaskContinuation?: boolean;
  autoRepairToolArguments?: boolean;
  backgroundTasksEnabled?: boolean;
  autoIndex?: boolean;
  autoRepairIndex?: boolean;
}

export interface GitHubCredentials {
  username: string;
  token: string;
  askPassPath: string;
}

const defaultBaseUrl = 'https://api.openai.com/v1';

function environmentRuntime(): 'native' | 'hermes' { return process.env.FORGE_AGENT_RUNTIME === 'hermes' ? 'hermes' : 'native'; }
function environmentHermesEndpoint(): string { return process.env.FORGE_HERMES_ENDPOINT?.trim() || (environmentRuntime() === 'hermes' ? DEFAULT_HERMES_ENDPOINT : ''); }
function environmentModel(): string { return process.env.OPENAI_MODEL?.trim() || process.env.FORGE_HERMES_MODEL?.trim() || (environmentRuntime() === 'hermes' ? DEFAULT_HERMES_MODEL : DEFAULT_OPENAI_MODEL); }

export class SettingsService {
  private data: StoredSettings = {};
  private settingsPath = '';
  private askPassPath = '';
  private encryptionAvailable = false;

  async init(): Promise<void> {
    const userDataPath = app.getPath('userData');
    this.settingsPath = join(userDataPath, 'settings.json');
    this.askPassPath = join(userDataPath, 'forge-git-askpass.sh');
    await fs.mkdir(userDataPath, { recursive: true });
    this.data = await fs.readFile(this.settingsPath, 'utf8').then((text) => JSON.parse(text) as StoredSettings).catch(() => ({}));
    this.encryptionAvailable = await safeStorage.isAsyncEncryptionAvailable();
    await fs.writeFile(this.askPassPath, '#!/bin/sh\ncase "$1" in\n  *Username*) printf "%s" "$FORGE_GITHUB_USERNAME" ;;\n  *Password*) printf "%s" "$FORGE_GITHUB_TOKEN" ;;\n  *) printf "%s" "" ;;\nesac\n', { mode: 0o700 });
    await fs.chmod(this.askPassPath, 0o700);
  }

  publicSettings(): UserSettings {
    return {
      apiBaseUrl: this.data.apiBaseUrl ?? process.env.OPENAI_BASE_URL ?? defaultBaseUrl,
      apiModel: this.data.apiModel ?? environmentModel(),
      apiKeyConfigured: Boolean(this.data.apiKey || process.env.OPENAI_API_KEY),
      githubUsername: this.data.githubUsername ?? '',
      githubTokenConfigured: Boolean(this.data.githubToken),
      secureStorageAvailable: this.encryptionAvailable
      , webResearchEnabled: this.data.webResearchEnabled === true
      , updateChannel: normalizeUpdateChannel(this.data.updateChannel)
      , agentRuntime: this.data.agentRuntime ?? environmentRuntime()
      , hermesCommand: this.data.hermesCommand ?? process.env.FORGE_HERMES_COMMAND ?? ''
      , hermesEndpoint: this.data.hermesEndpoint ?? environmentHermesEndpoint()
      , embeddingEnabled: this.data.embeddingEnabled !== false
      , embeddingProvider: 'openai-compatible'
      , embeddingBaseUrl: this.data.embeddingBaseUrl ?? process.env.FORGE_EMBEDDING_BASE_URL ?? DEFAULT_EMBEDDING_BASE_URL
      , embeddingModel: this.data.embeddingModel ?? process.env.FORGE_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL
      , embeddingApiKeyConfigured: Boolean(this.data.embeddingApiKey || process.env.FORGE_EMBEDDING_API_KEY)
      , contextTokenBudget: Math.min(128_000, Math.max(4_000, this.data.contextTokenBudget ?? DEFAULT_CONTEXT_TOKEN_BUDGET))
      , agentExecutionMode: this.data.agentExecutionMode === 'disabled' || this.data.agentExecutionMode === 'allow-all' ? this.data.agentExecutionMode : 'controlled'
      , filesystemScope: ['repository', 'project-tree', 'home', 'full'].includes(this.data.filesystemScope ?? '') ? this.data.filesystemScope! : 'workspace'
      , projectTreeRoot: this.data.projectTreeRoot ?? ''
      , networkAccess: { web: this.data.networkAccess?.web === true, git: this.data.networkAccess?.git === true, packageManager: this.data.networkAccess?.packageManager === true, general: this.data.networkAccess?.general === true }
      , processMode: this.data.processMode === 'full-local-compute' ? 'full-local-compute' : 'standard'
      , processTimeoutMs: Math.min(600_000, Math.max(1_000, this.data.processTimeoutMs ?? 120_000))
      , backgroundTaskTimeoutMs: Math.min(86_400_000, Math.max(1_000, this.data.backgroundTaskTimeoutMs ?? 600_000))
      , autonomousTaskContinuation: this.data.autonomousTaskContinuation !== false
      , autoRepairToolArguments: this.data.autoRepairToolArguments !== false
      , backgroundTasksEnabled: this.data.backgroundTasksEnabled !== false
      , autoIndex: this.data.autoIndex !== false
      , autoRepairIndex: this.data.autoRepairIndex !== false
    };
  }

  async save(request: SettingsSaveRequest): Promise<UserSettings> {
    this.data.apiBaseUrl = this.validateUrl(request.apiBaseUrl || defaultBaseUrl);
    this.data.apiModel = request.apiModel.trim() || DEFAULT_OPENAI_MODEL;
    this.data.githubUsername = request.githubUsername.trim();
    this.data.webResearchEnabled = request.webResearchEnabled === true;
    this.data.updateChannel = normalizeUpdateChannel(request.updateChannel);
    this.data.agentRuntime = request.agentRuntime === 'hermes' ? 'hermes' : 'native';
    const hermesCommand = request.hermesCommand?.trim();
    if (hermesCommand) this.data.hermesCommand = this.validateCommand(hermesCommand); else delete this.data.hermesCommand;
    const hermesEndpoint = request.hermesEndpoint?.trim();
    if (hermesEndpoint) this.data.hermesEndpoint = this.validateUrl(hermesEndpoint); else delete this.data.hermesEndpoint;
    this.data.embeddingEnabled = request.embeddingEnabled ?? this.data.embeddingEnabled ?? true;
    this.data.embeddingProvider = 'openai-compatible';
    this.data.embeddingBaseUrl = this.validateUrl(request.embeddingBaseUrl || DEFAULT_EMBEDDING_BASE_URL);
    this.data.embeddingModel = request.embeddingModel?.trim() || DEFAULT_EMBEDDING_MODEL;
    this.data.contextTokenBudget = Math.min(128_000, Math.max(4_000, Math.round(request.contextTokenBudget ?? DEFAULT_CONTEXT_TOKEN_BUDGET)));
    this.data.agentExecutionMode = request.agentExecutionMode === 'disabled' || request.agentExecutionMode === 'allow-all' ? request.agentExecutionMode : 'controlled';
    this.data.filesystemScope = ['repository', 'project-tree', 'home', 'full'].includes(request.filesystemScope ?? '') ? request.filesystemScope! : 'workspace';
    this.data.projectTreeRoot = request.projectTreeRoot?.trim().slice(0, 4_096) ?? '';
    this.data.networkAccess = { web: request.networkAccess?.web === true, git: request.networkAccess?.git === true, packageManager: request.networkAccess?.packageManager === true, general: request.networkAccess?.general === true };
    this.data.processMode = request.processMode === 'full-local-compute' ? request.processMode : 'standard';
    this.data.processTimeoutMs = Math.min(600_000, Math.max(1_000, Math.round(request.processTimeoutMs ?? 120_000)));
    this.data.backgroundTaskTimeoutMs = Math.min(86_400_000, Math.max(1_000, Math.round(request.backgroundTaskTimeoutMs ?? 600_000)));
    this.data.autonomousTaskContinuation = request.autonomousTaskContinuation !== false;
    this.data.autoRepairToolArguments = request.autoRepairToolArguments !== false;
    this.data.backgroundTasksEnabled = request.backgroundTasksEnabled !== false;
    this.data.autoIndex = request.autoIndex !== false;
    this.data.autoRepairIndex = request.autoRepairIndex !== false;

    if (request.clearApiKey) delete this.data.apiKey;
    else if (request.apiKey?.trim()) this.data.apiKey = await this.encrypt(request.apiKey.trim());

    if (request.clearGithubToken) delete this.data.githubToken;
    else if (request.githubToken?.trim()) this.data.githubToken = await this.encrypt(request.githubToken.trim());

    if (request.clearEmbeddingApiKey) delete this.data.embeddingApiKey;
    else if (request.embeddingApiKey?.trim()) this.data.embeddingApiKey = await this.encrypt(request.embeddingApiKey.trim());

    const temporaryPath = `${this.settingsPath}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(this.data, null, 2)}\n`, { mode: 0o600 });
    await fs.rename(temporaryPath, this.settingsPath);
    await fs.chmod(this.settingsPath, 0o600);
    return this.publicSettings();
  }

  lastWorkspacePath(): string | undefined { return this.data.lastWorkspacePath; }

  async rememberWorkspacePath(rootPath: string): Promise<void> {
    this.data.lastWorkspacePath = rootPath;
    const temporaryPath = `${this.settingsPath}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(this.data, null, 2)}\n`, { mode: 0o600 });
    await fs.rename(temporaryPath, this.settingsPath);
    await fs.chmod(this.settingsPath, 0o600);
  }

  async apiConfiguration(overrides: { apiKey?: string; baseUrl?: string; model?: string } = {}): Promise<{ apiKey?: string; baseUrl: string; model: string }> {
    return {
      apiKey: overrides.apiKey?.trim() || (this.data.apiKey ? await this.decrypt(this.data.apiKey) : process.env.OPENAI_API_KEY),
      baseUrl: this.validateUrl(overrides.baseUrl || this.data.apiBaseUrl || process.env.OPENAI_BASE_URL || defaultBaseUrl),
      model: overrides.model?.trim() || this.data.apiModel || environmentModel()
    };
  }

  async embeddingConfiguration(overrides: { apiKey?: string; baseUrl?: string; model?: string; enabled?: boolean } = {}): Promise<EmbeddingConfiguration> {
    return {
      enabled: overrides.enabled ?? this.data.embeddingEnabled !== false,
      provider: 'openai-compatible',
      apiKey: overrides.apiKey?.trim() || (this.data.embeddingApiKey ? await this.decrypt(this.data.embeddingApiKey) : process.env.FORGE_EMBEDDING_API_KEY),
      baseUrl: this.validateUrl(overrides.baseUrl || this.data.embeddingBaseUrl || process.env.FORGE_EMBEDDING_BASE_URL || DEFAULT_EMBEDDING_BASE_URL),
      model: overrides.model?.trim() || this.data.embeddingModel || process.env.FORGE_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL
    };
  }

  async githubCredentials(): Promise<GitHubCredentials | null> {
    if (!this.data.githubToken) return null;
    return {
      username: this.data.githubUsername?.trim() || 'x-access-token',
      token: await this.decrypt(this.data.githubToken),
      askPassPath: this.askPassPath
    };
  }

  async testGitHub(): Promise<{ login: string }> {
    const credentials = await this.githubCredentials();
    if (!credentials) throw new Error('Save a GitHub token before testing the connection.');
    const response = await fetch('https://api.github.com/user', {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${credentials.token}`, 'User-Agent': 'FORGE-desktop' }
    });
    if (!response.ok) throw new Error(`GitHub authentication failed (${response.status}).`);
    const profile = await response.json() as { login?: string };
    if (!profile.login) throw new Error('GitHub did not return an account login.');
    return { login: profile.login };
  }

 webResearchEnabled(): boolean { return this.data.webResearchEnabled === true; }
  updateChannel(): 'stable' | 'beta' { return normalizeUpdateChannel(this.data.updateChannel); }
  hermesConfiguration(): { command?: string; endpoint?: string } { return { command: this.data.hermesCommand ?? process.env.FORGE_HERMES_COMMAND, endpoint: this.data.hermesEndpoint ?? environmentHermesEndpoint() }; }

  private validateUrl(value: string): string {
    const parsed = new URL(value.trim());
    if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('API base URL must use HTTPS or HTTP.');
    if (parsed.username || parsed.password) throw new Error('API base URL must not contain credentials.');
    const loopback = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname.toLowerCase());
    if (parsed.protocol === 'http:' && !loopback) throw new Error('Remote API base URLs must use HTTPS. HTTP is allowed only for loopback providers.');
    return parsed.toString().replace(/\/$/, '');
  }

  private validateCommand(value: string): string {
    if (value.length > 1_024 || /[\0\r\n]/.test(value)) throw new Error('Hermes command must be a bounded executable path or command name.');
    return value;
  }

  private async encrypt(value: string): Promise<string> {
    if (!this.encryptionAvailable) throw new Error('Secure OS credential storage is not available. Secrets were not saved.');
    return (await safeStorage.encryptStringAsync(value)).toString('base64');
  }

  private async decrypt(value: string): Promise<string> {
    if (!this.encryptionAvailable) throw new Error('Secure OS credential storage is not available.');
    return (await safeStorage.decryptStringAsync(Buffer.from(value, 'base64'))).result;
  }
}
