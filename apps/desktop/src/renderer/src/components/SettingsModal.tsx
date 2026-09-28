import { useEffect, useRef, useState, type JSX } from 'react';
import { formatAppBuildInfo, type AgentRuntimeStatusView, type AppBuildInfo, type EmbeddingModelValidationResult, type ModelValidationResult, type ProviderModel, type SemanticIndexStatusView, type SkillDescriptor, type UserSettings } from '@forge/ipc';
import { forgeInvoke } from '../forge';
import WorkspaceDataPanel from './WorkspaceDataPanel';
import './settings.css';

const getData = async <T,>(channel: Parameters<typeof forgeInvoke>[0], request?: unknown): Promise<T> => {
  const result = await forgeInvoke(channel as any, request);
  if (!result.success) throw new Error(result.error.message);
  return result.data as T;
};

const isLoopbackProvider = (value: string): boolean => {
  try { return ['localhost', '127.0.0.1', '::1'].includes(new URL(value).hostname.toLowerCase()); }
  catch { return false; }
};

export default function SettingsModal({ onClose, initialSection = 'api' }: { onClose: () => void; initialSection?: 'api' | 'github' }): JSX.Element {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [buildInfo, setBuildInfo] = useState<AppBuildInfo | null>(null);
  const [apiBaseUrl, setApiBaseUrl] = useState('https://api.openai.com/v1');
  const [apiModel, setApiModel] = useState('gpt-5.6-sol');
  const [apiKey, setApiKey] = useState('');
  const [githubUsername, setGithubUsername] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [clearApiKey, setClearApiKey] = useState(false);
  const [clearGithubToken, setClearGithubToken] = useState(false);
  const [webResearchEnabled, setWebResearchEnabled] = useState(false);
  const [updateChannel, setUpdateChannel] = useState<'stable' | 'beta'>('stable');
  const [agentRuntime, setAgentRuntime] = useState<'native' | 'hermes'>('native');
  const [hermesCommand, setHermesCommand] = useState('');
  const [hermesEndpoint, setHermesEndpoint] = useState('');
  const [embeddingEnabled, setEmbeddingEnabled] = useState(true);
  const [embeddingBaseUrl, setEmbeddingBaseUrl] = useState('http://127.0.0.1:11434/v1');
  const [embeddingModel, setEmbeddingModel] = useState('qwen3-embedding:0.6b');
  const [embeddingApiKey, setEmbeddingApiKey] = useState('');
  const [clearEmbeddingApiKey, setClearEmbeddingApiKey] = useState(false);
  const [contextTokenBudget, setContextTokenBudget] = useState(32_000);
  const [agentExecutionMode, setAgentExecutionMode] = useState<UserSettings['agentExecutionMode']>('controlled');
  const [filesystemScope, setFilesystemScope] = useState<UserSettings['filesystemScope']>('workspace');
  const [projectTreeRoot, setProjectTreeRoot] = useState('');
  const [networkAccess, setNetworkAccess] = useState<UserSettings['networkAccess']>({ web: false, git: false, packageManager: false, general: false });
  const [processMode, setProcessMode] = useState<UserSettings['processMode']>('standard');
  const [processTimeoutMs, setProcessTimeoutMs] = useState(120_000);
  const [backgroundTaskTimeoutMs, setBackgroundTaskTimeoutMs] = useState(600_000);
  const [autonomousTaskContinuation, setAutonomousTaskContinuation] = useState(true);
  const [autoRepairToolArguments, setAutoRepairToolArguments] = useState(true);
  const [backgroundTasksEnabled, setBackgroundTasksEnabled] = useState(true);
  const [autoIndex, setAutoIndex] = useState(true);
  const [autoRepairIndex, setAutoRepairIndex] = useState(true);
  const [embeddingModels, setEmbeddingModels] = useState<ProviderModel[]>([]);
  const [embeddingStatus, setEmbeddingStatus] = useState<EmbeddingModelValidationResult | null>(null);
  const [indexStatus, setIndexStatus] = useState<SemanticIndexStatusView | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<AgentRuntimeStatusView | null>(null);
  const [skills, setSkills] = useState<SkillDescriptor[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelStatus, setModelStatus] = useState<ModelValidationResult | null>(null);
  const apiSection = useRef<HTMLElement>(null);
  const githubSection = useRef<HTMLElement>(null);
  const keylessLocalProvider = isLoopbackProvider(apiBaseUrl);

  useEffect(() => {
    getData<UserSettings>('settings.get').then((value) => {
      setSettings(value); setApiBaseUrl(value.apiBaseUrl); setApiModel(value.apiModel); setGithubUsername(value.githubUsername); setWebResearchEnabled(value.webResearchEnabled); setUpdateChannel(value.updateChannel); setAgentRuntime(value.agentRuntime); setHermesCommand(value.hermesCommand); setHermesEndpoint(value.hermesEndpoint); setEmbeddingEnabled(value.embeddingEnabled); setEmbeddingBaseUrl(value.embeddingBaseUrl); setEmbeddingModel(value.embeddingModel); setContextTokenBudget(value.contextTokenBudget); setAgentExecutionMode(value.agentExecutionMode); setFilesystemScope(value.filesystemScope); setProjectTreeRoot(value.projectTreeRoot); setNetworkAccess(value.networkAccess); setProcessMode(value.processMode); setProcessTimeoutMs(value.processTimeoutMs); setBackgroundTaskTimeoutMs(value.backgroundTaskTimeoutMs); setAutonomousTaskContinuation(value.autonomousTaskContinuation); setAutoRepairToolArguments(value.autoRepairToolArguments); setBackgroundTasksEnabled(value.backgroundTasksEnabled); setAutoIndex(value.autoIndex); setAutoRepairIndex(value.autoRepairIndex);
    }).catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
    getData<AppBuildInfo>('app.build.info').then(setBuildInfo).catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
    getData<AgentRuntimeStatusView>('settings.runtime.status').then(setRuntimeStatus).catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
    getData<SkillDescriptor[]>('agent.skills.list').then(setSkills).catch(() => setSkills([]));
    getData<SemanticIndexStatusView>('semantic.index.status').then(setIndexStatus).catch(() => setIndexStatus(null));
  }, []);

  useEffect(() => {
    if (!settings) return;
    window.requestAnimationFrame(() => (initialSection === 'github' ? githubSection.current : apiSection.current)?.scrollIntoView({ block: 'start' }));
  }, [initialSection, settings]);

  const loadModels = async (manual = false): Promise<void> => {
    if (manual) { setBusy(true); setError(null); setMessage(null); }
    setModelsLoading(true);
    try {
      const available = await getData<ProviderModel[]>('settings.models.list', { apiBaseUrl, apiKey: apiKey || undefined });
      setModels(available);
      if (manual) setMessage(`${available.length} provider models loaded.`);
    } catch (cause) {
      if (manual) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setModelsLoading(false);
      if (manual) setBusy(false);
    }
  };

  useEffect(() => {
    if (!settings || (!settings.apiKeyConfigured && !keylessLocalProvider)) return;
    void loadModels();
    // Loading is intentionally triggered when the saved provider becomes known or the URL changes.
    // Manual refresh remains available for providers whose model catalog changes during a session.
  }, [settings?.apiBaseUrl, settings?.apiKeyConfigured, keylessLocalProvider]);

  const save = async (): Promise<void> => {
    setBusy(true); setError(null); setMessage(null);
    try {
      const saved = await getData<UserSettings>('settings.save', { apiBaseUrl, apiModel, apiKey, clearApiKey, githubUsername, githubToken, clearGithubToken, webResearchEnabled, updateChannel, agentRuntime, hermesCommand, hermesEndpoint, embeddingEnabled, embeddingProvider: 'openai-compatible', embeddingBaseUrl, embeddingModel, embeddingApiKey, clearEmbeddingApiKey, contextTokenBudget, agentExecutionMode, filesystemScope, projectTreeRoot, networkAccess, processMode, processTimeoutMs, backgroundTaskTimeoutMs, autonomousTaskContinuation, autoRepairToolArguments, backgroundTasksEnabled, autoIndex, autoRepairIndex });
      setSettings(saved); setApiKey(''); setGithubToken(''); setEmbeddingApiKey(''); setClearApiKey(false); setClearGithubToken(false); setClearEmbeddingApiKey(false); setMessage('Settings saved securely.');
      setRuntimeStatus(await getData<AgentRuntimeStatusView>('settings.runtime.status'));
      setSkills(await getData<SkillDescriptor[]>('agent.skills.list').catch(() => []));
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const testApi = async (): Promise<void> => {
    setBusy(true); setError(null); setMessage(null);
    try { await getData('settings.test.api'); setMessage('AI provider connection succeeded.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const refreshModels = async (): Promise<void> => {
    setModelStatus(null);
    await loadModels(true);
  };

  const validateModel = async (): Promise<void> => {
    setBusy(true); setError(null); setMessage(null); setModelStatus(null);
    try {
      const result = await getData<ModelValidationResult>('settings.model.validate', { apiBaseUrl, apiModel, apiKey: apiKey || undefined });
      setModelStatus(result);
      setMessage(result.exists ? `Model ${result.model} is available from this provider.` : `Model ${result.model} was not found. You may save it for a compatible provider, but requests will fail until it becomes available.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const testGithub = async (): Promise<void> => {
    setBusy(true); setError(null); setMessage(null);
    try { const result = await getData<{ login: string }>('settings.test.github'); setMessage(`GitHub connected as ${result.login}.`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const refreshEmbeddingModels = async (): Promise<void> => {
    setBusy(true); setError(null); setMessage(null); setEmbeddingStatus(null);
    try { const available = await getData<ProviderModel[]>('settings.embedding.models.list', { embeddingBaseUrl, embeddingApiKey: embeddingApiKey || undefined }); setEmbeddingModels(available); setMessage(`${available.length} embedding models loaded.`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const validateEmbeddingModel = async (): Promise<void> => {
    setBusy(true); setError(null); setMessage(null); setEmbeddingStatus(null);
    try { const result = await getData<EmbeddingModelValidationResult>('settings.embedding.model.validate', { embeddingBaseUrl, embeddingModel, embeddingApiKey: embeddingApiKey || undefined }); setEmbeddingStatus(result); setMessage(result.exists ? `Embedding model ${result.model} is available${result.dimensions ? ` with ${result.dimensions} dimensions` : ''}.` : `Embedding model ${result.model} was not found.`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const rebuildSemanticIndex = async (): Promise<void> => {
    setBusy(true); setError(null); setMessage(null);
    try { const status = await getData<SemanticIndexStatusView>('semantic.index.rebuild'); setIndexStatus(status); setMessage(`Semantic index rebuilt with ${status.indexedRecords} records.`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const copyBuildInfo = async (): Promise<void> => {
    setError(null);
    try {
      const copied = await getData<AppBuildInfo>('app.build.info.copy');
      setBuildInfo(copied);
      setMessage('Build diagnostic copied.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };

  return <div className="settings-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <header className="settings-heading"><div><p>FORGE CONFIGURATION</p><h2 id="settings-title">Settings</h2></div><button onClick={onClose} aria-label="Close settings">×</button></header>
      {!settings ? <div className="settings-loading">Loading secure settings…</div> : <div className="settings-body">
        {buildInfo && <section className="settings-section build-diagnostic">
          <div className="settings-section-title"><div><span>ABOUT THIS BUILD</span><h3>FORGE v{buildInfo.version}</h3></div><em className={buildInfo.runtime === 'packaged' ? 'configured' : ''}>{buildInfo.runtime}</em></div>
          <pre>{formatAppBuildInfo(buildInfo)}</pre>
          <button onClick={copyBuildInfo}>Copy build diagnostic</button>
        </section>}
        {!settings.secureStorageAvailable && <div className="settings-warning">OS secure storage is unavailable. FORGE will not save new secrets.</div>}
        <section className="settings-section" ref={apiSection}>
          <div className="settings-section-title"><div><span>INTELLIGENCE · INFERENCE</span><h3>Reasoning model</h3></div><em className={settings.apiKeyConfigured || keylessLocalProvider ? 'configured' : ''}>{settings.apiKeyConfigured ? 'Key saved' : keylessLocalProvider ? 'Local provider' : 'Not configured'}</em></div>
          <label>Inference API base URL<input value={apiBaseUrl} onChange={(event) => setApiBaseUrl(event.target.value)} placeholder="https://api.openai.com/v1" /></label>
          <p className="settings-help">The default tracks FORGE's current recommended GPT-5.x model. For a local Ollama server, use http://127.0.0.1:11434/v1 and leave the API key blank. Compatible local models receive the same FORGE file tools and execution activity log.</p>
          <label>Inference model ID<input list="forge-provider-models" value={apiModel} onChange={(event) => { setApiModel(event.target.value); setModelStatus(null); }} placeholder="gpt-5.6-sol" /></label>
          <datalist id="forge-provider-models">{models.map((model) => <option key={model.id} value={model.id}>{model.ownedBy}</option>)}</datalist>
          <div className="model-actions"><button onClick={refreshModels} disabled={busy || modelsLoading || (!settings.apiKeyConfigured && !apiKey && !keylessLocalProvider)}>{modelsLoading ? 'Loading models…' : 'Refresh provider models'}</button><button onClick={validateModel} disabled={busy || !apiModel.trim() || (!settings.apiKeyConfigured && !apiKey && !keylessLocalProvider)}>Validate model</button>{modelStatus && <em className={modelStatus.exists ? 'model-valid' : 'model-invalid'}>{modelStatus.exists ? 'Available' : 'Not found'}</em>}</div>
          <label>API key (optional for loopback providers)<input type="password" autoComplete="off" value={apiKey} onChange={(event) => { setApiKey(event.target.value); setClearApiKey(false); }} placeholder={settings.apiKeyConfigured ? 'Saved — enter a new key to replace it' : keylessLocalProvider ? 'Not required for this local provider' : 'Enter API key'} /></label>
          {settings.apiKeyConfigured && <button className="settings-link danger" onClick={() => { setClearApiKey(true); setApiKey(''); }}>Remove saved API key</button>}
          <button onClick={testApi} disabled={busy || (!settings.apiKeyConfigured && !keylessLocalProvider)}>Test saved model and API connection</button>
        </section>

        <section className="settings-section">
          <div className="settings-section-title"><div><span>AGENT EXECUTION POLICY</span><h3>Tooling and autonomy</h3></div><em className={agentExecutionMode === 'allow-all' ? 'configured' : ''}>{agentExecutionMode === 'allow-all' ? 'Allow All' : agentExecutionMode === 'disabled' ? 'Disabled' : 'Controlled'}</em></div>
          <label>Agent execution<select value={agentExecutionMode} onChange={(event) => setAgentExecutionMode(event.target.value as UserSettings['agentExecutionMode'])}><option value="disabled">Disabled</option><option value="controlled">Controlled</option><option value="allow-all">Allow All</option></select></label>
          <label>Filesystem scope<select value={filesystemScope} onChange={(event) => setFilesystemScope(event.target.value as UserSettings['filesystemScope'])}><option value="workspace">Current workspace only</option><option value="repository">Current Git repository</option><option value="project-tree">Selected project tree</option><option value="home">User home</option><option value="full">Full user-accessible filesystem</option></select></label>
          {filesystemScope === 'project-tree' && <label>Selected project tree root<input value={projectTreeRoot} onChange={(event) => setProjectTreeRoot(event.target.value)} placeholder="/Users/name/Projects" /></label>}
          <fieldset><legend>Network access</legend>
            {([['web', 'Web read-only'], ['git', 'Git'], ['packageManager', 'Package manager'], ['general', 'General network']] as const).map(([key, label]) => <label className="settings-check" key={key}><input type="checkbox" checked={networkAccess[key]} onChange={(event) => setNetworkAccess((current) => ({ ...current, [key]: event.target.checked }))} /> {label}</label>)}
          </fieldset>
          <label>Process mode<select value={processMode} onChange={(event) => setProcessMode(event.target.value as UserSettings['processMode'])}><option value="standard">Standard</option><option value="full-local-compute">Full local compute</option></select></label>
          <label>Process timeout (seconds)<input type="number" min={1} max={600} value={Math.round(processTimeoutMs / 1000)} onChange={(event) => setProcessTimeoutMs(Number(event.target.value) * 1000)} /></label>
          <label>Background task timeout (minutes)<input type="number" min={1} max={1440} value={Math.round(backgroundTaskTimeoutMs / 60_000)} onChange={(event) => setBackgroundTaskTimeoutMs(Number(event.target.value) * 60_000)} /></label>
          <p className="settings-help">Tool calls currently execute serially to preserve task-step ordering.</p>
          <label className="settings-check"><input type="checkbox" checked={autonomousTaskContinuation} onChange={(event) => setAutonomousTaskContinuation(event.target.checked)} /> Autonomous task continuation</label>
          <label className="settings-check"><input type="checkbox" checked={autoRepairToolArguments} onChange={(event) => setAutoRepairToolArguments(event.target.checked)} /> Automatically repair deterministic tool arguments</label>
          <label className="settings-check"><input type="checkbox" checked={backgroundTasksEnabled} onChange={(event) => setBackgroundTasksEnabled(event.target.checked)} /> Background task processes</label>
          <label className="settings-check"><input type="checkbox" checked={autoIndex} onChange={(event) => setAutoIndex(event.target.checked)} /> Automatically index workspace knowledge</label>
          <label className="settings-check"><input type="checkbox" checked={autoRepairIndex} onChange={(event) => setAutoRepairIndex(event.target.checked)} /> Automatically repair a degraded semantic index</label>
          <p className="settings-help">Allow All removes repeated per-tool authorization inside the selected filesystem and network scopes. OS permissions, audit logging, cancellation, rollback, and secret redaction remain in force.</p>
        </section>

        <section className="settings-section">
          <div className="settings-section-title"><div><span>INTELLIGENCE · SEMANTIC CONTEXT</span><h3>Embedding and semantic memory</h3></div><em className={indexStatus?.state === 'ready' ? 'configured' : ''}>{indexStatus?.state ?? 'Not initialized'}</em></div>
          <label className="settings-check"><input type="checkbox" checked={embeddingEnabled} onChange={(event) => setEmbeddingEnabled(event.target.checked)} /> Enable semantic context</label>
          <p className="settings-help">Semantic context and automatic indexing are enabled by default. A configured embedding provider is required; failures remain visible in index status. Semantic discovery supplements broad questions while direct file/Git evidence stays authoritative.</p>
          <label>Embedding API base URL<input value={embeddingBaseUrl} onChange={(event) => setEmbeddingBaseUrl(event.target.value)} placeholder="http://127.0.0.1:11434/v1" /></label>
          <label>Embedding model<input list="forge-embedding-models" value={embeddingModel} onChange={(event) => { setEmbeddingModel(event.target.value); setEmbeddingStatus(null); }} placeholder="qwen3-embedding:0.6b" /></label>
          <datalist id="forge-embedding-models">{embeddingModels.map((model) => <option key={model.id} value={model.id}>{model.ownedBy}</option>)}</datalist>
          <div className="model-actions"><button onClick={refreshEmbeddingModels} disabled={busy || !embeddingEnabled}>Refresh provider models</button><button onClick={validateEmbeddingModel} disabled={busy || !embeddingEnabled || !embeddingModel.trim()}>Validate embedding model</button>{embeddingStatus && <em className={embeddingStatus.exists ? 'model-valid' : 'model-invalid'}>{embeddingStatus.exists ? `${embeddingStatus.dimensions ?? '?'} dimensions` : 'Not found'}</em>}</div>
          <label>Embedding API key (remote providers only)<input type="password" autoComplete="off" value={embeddingApiKey} onChange={(event) => { setEmbeddingApiKey(event.target.value); setClearEmbeddingApiKey(false); }} placeholder={settings.embeddingApiKeyConfigured ? 'Saved — enter a new key to replace it' : isLoopbackProvider(embeddingBaseUrl) ? 'Not required for local Ollama' : 'Enter embedding API key'} /></label>
          {settings.embeddingApiKeyConfigured && <button className="settings-link danger" onClick={() => { setClearEmbeddingApiKey(true); setEmbeddingApiKey(''); }}>Remove saved embedding key</button>}
          <label>Context token budget<input type="number" min={4000} max={128000} step={1000} value={contextTokenBudget} onChange={(event) => setContextTokenBudget(Number(event.target.value))} /></label>
          <div className="model-actions"><button onClick={rebuildSemanticIndex} disabled={busy || !embeddingEnabled}>Rebuild semantic index</button><span className="settings-help">{indexStatus ? `${indexStatus.indexedRecords} records · ${indexStatus.embeddingModel ?? 'no model'}${indexStatus.embeddingDimensions ? ` · ${indexStatus.embeddingDimensions}d` : ''}${indexStatus.lastIndexedAt ? ` · ${new Date(indexStatus.lastIndexedAt).toLocaleString()}` : ''}` : 'Index status unavailable.'}</span></div>
          {indexStatus?.lastError && <p className="settings-warning">{indexStatus.lastError}</p>}
        </section>

        <section className="settings-section">
          <div className="settings-section-title"><div><span>AGENT RUNTIME</span><h3>Native FORGE or Hermes</h3></div><em className={runtimeStatus?.availability === 'available' ? 'configured' : ''}>{runtimeStatus?.active === 'hermes' ? 'Hermes active' : 'Native active'}</em></div>
          <label>Runtime<select value={agentRuntime} onChange={(event) => setAgentRuntime(event.target.value as 'native' | 'hermes')}><option value="native">Native FORGE runtime</option><option value="hermes">Hermes when its headless bridge is available</option></select></label>
          <p className="settings-help">FORGE remains the owner of workspace memory, tasks, tools, execution context, and audit history. Hermes discovery is optional and never prevents native FORGE operation.</p>
          <label>Hermes command (optional)<input value={hermesCommand} onChange={(event) => setHermesCommand(event.target.value)} placeholder="hermes" /></label>
          <label>Hermes endpoint (optional)<input value={hermesEndpoint} onChange={(event) => setHermesEndpoint(event.target.value)} placeholder="https://…" /></label>
          {runtimeStatus && <p className={`settings-help ${runtimeStatus.availability === 'unavailable' ? '' : 'configured'}`}>{runtimeStatus.message}{runtimeStatus.version ? ` (${runtimeStatus.version})` : ''}</p>}
          <p className="settings-help">Discovered skill packages: {skills.length ? skills.map((skill) => skill.name).join(', ') : 'none in the active workspace or configured Hermes roots'}.</p>
        </section>

        <section className="settings-section" ref={githubSection}>
          <div className="settings-section-title"><div><span>GITHUB</span><h3>Repository integration</h3></div><em className={settings.githubTokenConfigured ? 'configured' : ''}>{settings.githubTokenConfigured ? 'Token saved' : 'Not configured'}</em></div>
          <p className="settings-help">Use a fine-grained personal access token with Contents read/write access for the repositories you want FORGE to pull and push. The token is never written into a Git remote URL.</p>
          <label>GitHub username<input value={githubUsername} onChange={(event) => setGithubUsername(event.target.value)} placeholder="GitHub username" /></label>
          <label>Personal access token<input type="password" autoComplete="off" value={githubToken} onChange={(event) => { setGithubToken(event.target.value); setClearGithubToken(false); }} placeholder={settings.githubTokenConfigured ? 'Saved — enter a new token to replace it' : 'github_pat_…'} /></label>
          {settings.githubTokenConfigured && <button className="settings-link danger" onClick={() => { setClearGithubToken(true); setGithubToken(''); }}>Remove saved GitHub token</button>}
          <button onClick={testGithub} disabled={busy || !settings.githubTokenConfigured}>Test saved GitHub connection</button>
        </section>

        <section className="settings-section">
          <div className="settings-section-title"><div><span>TOOLS & UPDATES</span><h3>External research and release channel</h3></div><em className={webResearchEnabled ? 'configured' : ''}>{webResearchEnabled ? 'Web enabled' : 'Web disabled'}</em></div>
          <label className="settings-check"><input type="checkbox" checked={webResearchEnabled} onChange={(event) => setWebResearchEnabled(event.target.checked)} /> Enable structured external web research</label>
          <p className="settings-help">Web tools run through the agentic tool runtime, retain exact query or URL audit records, block local networks, and never upload workspace files automatically.</p>
          <label>Update channel<select value={updateChannel} onChange={(event) => setUpdateChannel(event.target.value as 'stable' | 'beta')}><option value="stable">Stable (default)</option><option value="beta">Beta (beta, release candidate)</option></select></label>
          <p className="settings-help">Stable installations never receive beta builds unless Beta is selected explicitly. Existing Preview preferences migrate to Beta.</p>
        </section>

        <WorkspaceDataPanel />

        {message && <div className="settings-message success">{message}</div>}
        {error && <div className="settings-message error">{error}</div>}
      </div>}
      <footer className="settings-footer"><span>Secrets use Electron secure OS credential storage.</span><div><button onClick={onClose}>Cancel</button><button className="primary" disabled={busy || !settings} onClick={save}>{busy ? 'Working…' : 'Save settings'}</button></div></footer>
    </section>
  </div>;
}
