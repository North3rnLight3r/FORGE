import { app, BrowserView, BrowserWindow, clipboard, dialog, ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { is } from '@electron-toolkit/utils';
import { buildReleaseIdentity, formatAppBuildInfo, IPC_CHANNELS, type AppBuildInfo, type BrowserBookmark, type BrowserHistoryEntry, type BrowserStateView, type BrowserTabView, type IPCChannel, type IPCRequestMap, type IPCResponseMap, type IPCResult, type RuntimeEventType } from '@forge/ipc';
import { WorkspaceService } from '@forge/workspace';
import { GitHubService, GitService } from '@forge/git';
import { StorageService } from '@forge/storage';
import { Agent, HermesBridge, OpenAIProvider } from '@forge/ai';
import { OpenAICompatibleEmbeddingClient, SemanticContextService, SemanticIndexer, WorkspaceContextEngine, WorkspaceIntelligenceService } from '@forge/intelligence';
import { MemoryService, MemoryRetriever, MemoryIndexer } from '@forge/memory';
import { UpdaterService } from './updater';
import { SettingsService } from './settings';
import { ToolRouter } from '@forge/agent-tools';
import { ShellService, TerminalService } from '@forge/shell';
import { validateExternalUrl, WebService } from '@forge/web';
import { ForgeLiveService, isLoopbackUrl } from '@forge/forge-live';
import { TaskRuntime } from '@forge/tasks';
import { createNativeAgentRuntime } from './native-agent-runtime';
import { eventForChannel } from './runtime-events';
import { ForgeOsService } from '@forge/os-integration';
import { HermesRuntimeDetector, discoverSkills, platformCapabilities, resolveAgentRuntime, skillRootsForWorkspace } from '@forge/agent-runtime';

declare const __FORGE_BUILD_COMMIT__: string;
declare const __FORGE_BUILD_DATE__: string;

const workspace = new WorkspaceService();
const settings = new SettingsService();
const git = new GitService(() => settings.githubCredentials());
const github = new GitHubService(() => git.originUrl(), async () => {
  const credentials = await settings.githubCredentials();
  return credentials ? { token: credentials.token } : null;
});
const storage = new StorageService();
const updater = new UpdaterService();
const dirtyEditorPaths = new Set<string>();
const shellService = new ShellService(() => workspace.info()?.rootPath ?? null);
const webService = new WebService(() => settings.webResearchEnabled());
const terminalService = new TerminalService(() => workspace.info()?.rootPath ?? null, (event) => {
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send('terminal.event', event);
});
const taskRuntime = new TaskRuntime({ storage, workspaceRoot: () => workspace.info()?.rootPath ?? null, git, shell: shellService });
const forgeOs = new ForgeOsService();
let mainWindow: BrowserWindow | null = null;
type BrowserTab = { id: string; view: BrowserView; loading: boolean; error: string };
const browserTabs = new Map<string, BrowserTab>();
let activeBrowserTabId: string | null = null;
let attachedBrowserView: BrowserView | null = null;
let browserLayout: { visible: boolean; bounds?: { x: number; y: number; width: number; height: number } } = { visible: false };
let browserBookmarks: BrowserBookmark[] = [];
let browserHistory: BrowserHistoryEntry[] = [];
let rendererSource: AppBuildInfo['rendererSource'] = 'file:// development build';
let forgeLive: ForgeLiveService | null = null;
const activeToolOperations = new Set<string>();
const activeTaskOperations = new Set<string>();
let lastToolActivityAt = 0;
let lastTaskActivityAt = 0;

function liveMainWindow(): BrowserWindow | null {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
}

/** BrowserWindow owns BrowserView attachment. `closed` can fire after its
 * native host has gone away, so never detach through a stale window. */
function detachBrowserView(): void {
  const window = liveMainWindow();
  if (attachedBrowserView && window) {
    try { window.setBrowserView(null); }
    catch { /* The native host is already being torn down. */ }
  }
  attachedBrowserView = null;
}

function appBuildInfo(): AppBuildInfo {
  return {
    ...buildReleaseIdentity(app.getVersion(), app.isPackaged),
    commit: __FORGE_BUILD_COMMIT__, buildDate: __FORGE_BUILD_DATE__,
    runtime: app.isPackaged ? 'packaged' : 'development', rendererSource,
    platform: process.platform, architecture: process.arch
  };
}

const aiProvider = new OpenAIProvider();
const contextBuilder = new WorkspaceContextEngine(workspace, git, storage);
const intelligence = new WorkspaceIntelligenceService(contextBuilder, storage);
const embeddingClient = new OpenAICompatibleEmbeddingClient(() => settings.embeddingConfiguration(), (event) => emitRuntimeEvent(event.type, event.payload));
const semanticContext = new SemanticContextService(storage, embeddingClient, () => settings.embeddingConfiguration(), (event) => emitRuntimeEvent(event.type, event.payload), workspace);
const semanticIndexer = new SemanticIndexer(workspace, storage, embeddingClient, () => settings.embeddingConfiguration(), (event) => emitRuntimeEvent(event.type, event.payload));

async function runSemanticRefresh(operation: () => Promise<Awaited<ReturnType<SemanticIndexer['incremental']>>>, trigger: string): Promise<void> {
  try {
    let status = await operation();
    if (['degraded', 'rebuild-required'].includes(status.state) && settings.publicSettings().autoRepairIndex) {
      await emitRuntimeEvent('semantic.index.start', { trigger, repair: true, priorState: status.state });
      status = await semanticIndexer.rebuild();
    }
    if (status.state === 'degraded' || status.state === 'rebuild-required') await emitRuntimeEvent('semantic.index.error', { trigger, state: status.state, message: status.lastError ?? 'Semantic index requires repair.' });
    else if (status.state === 'ready') await emitRuntimeEvent('context.updated', { trigger, indexedRecords: status.indexedRecords });
  } catch (error) {
    await emitRuntimeEvent('semantic.index.error', { trigger, message: error instanceof Error ? error.message : String(error) });
  }
}
contextBuilder.useSemanticContext(semanticContext);
const memoryService = new MemoryService(storage as any);
const memoryRetriever = new MemoryRetriever(memoryService as any);
const memoryIndexer = new MemoryIndexer(memoryService as any, workspace as any);
const agent = new Agent(aiProvider as any, intelligence as any, memoryRetriever as any);
const hermesProvider = new HermesBridge();
const hermesAgent = new Agent(hermesProvider as any, intelligence as any, memoryRetriever as any);

async function applyAISettings(): Promise<void> {
  const inference = await settings.apiConfiguration(); aiProvider.configure(inference);
  contextBuilder.setTokenBudget(settings.publicSettings().contextTokenBudget);
  const endpoint = settings.hermesConfiguration().endpoint;
  const model = process.env.FORGE_HERMES_MODEL?.trim()
    || process.env.FORGE_OLLAMA_MODEL?.trim()
    || process.env.OPENAI_MODEL?.trim()
    || inference.model;
  hermesProvider.configure({ endpoint, model });
}

async function resolveReasoningRuntime(): Promise<{ agent: Agent; provider: OpenAIProvider | HermesBridge; kind: 'native' | 'hermes' }> {
  const publicSettings = settings.publicSettings();
  if (publicSettings.agentRuntime !== 'hermes' || !publicSettings.hermesEndpoint) return { agent, provider: aiProvider, kind: 'native' };
  const status = await new HermesRuntimeDetector().status(settings.hermesConfiguration());
  const profile = resolveAgentRuntime('hermes', status, status.endpointReachable === true);
  return profile.active === 'hermes' ? { agent: hermesAgent, provider: hermesProvider, kind: 'hermes' } : { agent, provider: aiProvider, kind: 'native' };
}

async function emitRuntimeEvent(type: RuntimeEventType, payload?: Record<string, unknown>): Promise<void> {
  const operationId = typeof payload?.operationId === 'string' ? payload.operationId : '';
  if (type === 'tool.requested') { if (operationId) activeToolOperations.add(operationId); lastToolActivityAt = Date.now(); }
  if (type === 'tool.completed') { if (operationId) activeToolOperations.delete(operationId); lastToolActivityAt = Date.now(); }
  if (type === 'agent.started' && typeof payload?.taskId === 'string') { activeTaskOperations.add(operationId || String(payload.taskId)); lastTaskActivityAt = Date.now(); }
  if (['agent.completed', 'agent.blocked'].includes(type) && typeof payload?.taskId === 'string') { activeTaskOperations.delete(operationId || String(payload.taskId)); lastTaskActivityAt = Date.now(); }
  if (type === 'task.changed') lastTaskActivityAt = Date.now();
  if (type === 'context.invalidated') await intelligence.invalidate(String(payload?.channel ?? 'runtime-event'), payload);
  const workspaceId = (await storage.dashboard().catch(() => null))?.id;
  if (!workspaceId) return;
  const event = { type, workspaceId, occurredAt: Date.now(), payload };
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send('runtime.event', event);
}

function register<C extends IPCChannel>(channel: C, action: (request: IPCRequestMap[C]) => Promise<IPCResponseMap[C]>): void {
  ipcMain.handle(channel, async (_event, request: IPCRequestMap[C]): Promise<IPCResult<IPCResponseMap[C]>> => {
    try {
      const data = await action(request);
      const event = eventForChannel(channel);
      if (event) {
        await emitRuntimeEvent(event, { channel }); await emitRuntimeEvent('context.invalidated', { channel });
        if (['task.changed', 'memory.changed'].includes(event) && settings.publicSettings().embeddingEnabled && settings.publicSettings().autoIndex) void runSemanticRefresh(() => semanticIndexer.refreshDurableState(), `durable-state:${channel}`);
      }
      return { success: true, data };
    }
    catch (error) {
      const code = error instanceof Error && 'code' in error ? String(error.code) : undefined;
      const message = code === 'EACCES' || code === 'EPERM'
        ? process.platform === 'darwin'
          ? 'macOS denied access. Grant the installed FORGE app Full Disk Access in System Settings → Privacy & Security, then relaunch. Administrator-owned paths may still require separate elevation.'
          : 'The operating system denied access to that location. Check the file owner and permissions, then try again.'
        : error instanceof Error ? error.message : 'An unexpected error occurred.';
      return { success: false, error: { message, code } };
    }
  });
}

async function openWorkspaceAt(rootPath: string): Promise<NonNullable<ReturnType<WorkspaceService['info']>>> {
  if (semanticRefreshTimer) clearTimeout(semanticRefreshTimer);
  semanticRefreshTimer = null; pendingSemanticPaths.clear();
  terminalService.dispose(); dirtyEditorPaths.clear(); activeToolOperations.clear(); activeTaskOperations.clear(); disposeBrowserTabs(); await forgeLive?.stop().catch(() => undefined); forgeLive = null;
  await semanticIndexer.stop(); await storage.close();
  const info = await workspace.open(rootPath);
  await git.init(info.rootPath);
  await storage.init(info.rootPath);
  await settings.rememberWorkspacePath(info.rootPath);
  workspace.watch();
  await refreshBrowserRecords();
  if (settings.publicSettings().embeddingEnabled && settings.publicSettings().autoIndex) void runSemanticRefresh(() => semanticIndexer.incremental(), 'workspace-open');
  return info;
}

const pendingSemanticPaths = new Set<string>();
let semanticRefreshTimer: NodeJS.Timeout | null = null;
workspace.on('changed', (relativePath: string) => {
  void emitRuntimeEvent('file.changed', { path: relativePath });
  if (!settings.publicSettings().embeddingEnabled || !settings.publicSettings().autoIndex) return;
  pendingSemanticPaths.add(relativePath);
  if (semanticRefreshTimer) clearTimeout(semanticRefreshTimer);
  semanticRefreshTimer = setTimeout(() => {
    semanticRefreshTimer = null;
    const paths = [...pendingSemanticPaths]; pendingSemanticPaths.clear();
    void runSemanticRefresh(() => semanticIndexer.refreshPaths(paths), `file-change:${paths.length}`);
  }, 300);
});

function liveService(): ForgeLiveService {
  const info = workspace.info(); if (!info) throw new Error('Open a workspace before using FORGE Live.');
  if (!forgeLive || forgeLive.status().workspaceId !== info.rootPath) forgeLive = new ForgeLiveService(info.rootPath, { onState: (state) => { for (const window of BrowserWindow.getAllWindows()) window.webContents.send('forge-live.state', state); } });
  return forgeLive;
}

function browserState(): BrowserStateView {
  const active = activeBrowserTabId ? browserTabs.get(activeBrowserTabId) : undefined;
  const contents = active?.view.webContents;
  const tabs: BrowserTabView[] = [...browserTabs.values()].filter((tab) => !tab.view.webContents.isDestroyed()).map((tab) => ({
    id: tab.id, url: tab.view.webContents.getURL(), title: tab.view.webContents.getTitle() || tab.view.webContents.getURL() || 'New tab',
    canGoBack: tab.view.webContents.canGoBack(), canGoForward: tab.view.webContents.canGoForward(), loading: tab.loading, error: tab.error || undefined
  }));
  return {
    url: contents?.getURL() ?? '', title: contents?.getTitle() ?? '', canGoBack: contents?.canGoBack() ?? false, canGoForward: contents?.canGoForward() ?? false,
    loading: active?.loading ?? false, error: active?.error || undefined, activeTabId: active?.id, showingHome: !active, tabs, bookmarks: browserBookmarks, history: browserHistory
  };
}

function sendBrowserState(): void {
  const window = liveMainWindow();
  if (window) window.webContents.send('browser.state', browserState());
}

async function refreshBrowserRecords(): Promise<void> {
  if (!workspace.info()) { browserBookmarks = []; browserHistory = []; return; }
  [browserBookmarks, browserHistory] = await Promise.all([storage.listBrowserBookmarks(), storage.listBrowserHistory()]);
}

function activeBrowserTab(): BrowserTab | null {
  const tab = activeBrowserTabId ? browserTabs.get(activeBrowserTabId) : undefined;
  return tab && !tab.view.webContents.isDestroyed() ? tab : null;
}

/** Keep page-initiated public redirects inside the native view. Re-loading them
 * through the async validator cancels the page currently being painted, which
 * leaves sites with client-side redirects on a blank surface. */
function blockedBrowserNavigation(value: string): string | null {
  let url: URL;
  try { url = new URL(value); } catch { return 'The browser rejected an invalid navigation URL.'; }
  if (!['https:', 'http:'].includes(url.protocol)) return 'Only HTTP and HTTPS browser navigation is allowed.';
  if (url.username || url.password) return 'Credential-bearing URLs are blocked.';
  const hostname = url.hostname.toLowerCase();
  if (isLoopbackUrl(value)) return null;
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) return 'Local-network URLs are blocked.';
  const ipv4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(hostname);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224) return 'Private and local network addresses are blocked.';
  }
  return null;
}

function createBrowserTab(): BrowserTab {
  const tab: BrowserTab = { id: randomUUID(), view: new BrowserView({ webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true } }), loading: false, error: '' };
  const contents = tab.view.webContents;
  contents.setWindowOpenHandler(({ url }) => { void navigateBrowser(url, true).catch((error) => reportBrowserError(tab, error)); return { action: 'deny' }; });
  contents.on('will-navigate', (event, url) => {
    const reason = blockedBrowserNavigation(url);
    if (!reason) return;
    event.preventDefault();
    reportBrowserError(tab, reason);
  });
  contents.on('did-start-loading', () => { tab.loading = true; tab.error = ''; sendBrowserState(); });
  contents.on('did-finish-load', () => {
    tab.loading = false; sendBrowserState();
    const url = contents.getURL();
    if (url) void storage.recordBrowserVisit(url, contents.getTitle()).then(refreshBrowserRecords).then(sendBrowserState).catch(() => undefined);
  });
  contents.on('did-fail-load', (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => { if (isMainFrame && errorCode !== -3) reportBrowserError(tab, `${errorDescription} (${validatedUrl})`); });
  contents.on('did-navigate', sendBrowserState);
  contents.on('did-navigate-in-page', sendBrowserState);
  browserTabs.set(tab.id, tab);
  setBrowserLayout(browserLayout);
  return tab;
}

async function navigateBrowser(value: string, openInNewTab = false): Promise<BrowserStateView> {
  const url = (isLoopbackUrl(value) ? new URL(value) : await validateExternalUrl(value)).toString();
  const tab = openInNewTab ? createBrowserTab() : activeBrowserTab() ?? createBrowserTab();
  activeBrowserTabId = tab.id; tab.loading = true; tab.error = ''; setBrowserLayout(browserLayout); sendBrowserState();
  try { await tab.view.webContents.loadURL(url); }
  catch (error) {
    // A page-initiated public redirect supersedes the in-flight navigation and
    // Electron rejects the older load with ERR_ABORTED (-3).  The replacement
    // navigation remains observable through browser state, so it is not a
    // user-facing load failure.
    if (!/ERR_ABORTED|\(-3\)/i.test(error instanceof Error ? error.message : String(error))) { reportBrowserError(tab, error); throw error; }
  }
  return browserState();
}

function reportBrowserError(tab: BrowserTab, error: unknown): void {
  tab.loading = false;
  tab.error = error instanceof Error ? error.message : String(error);
  sendBrowserState();
}

async function readBrowserPage(): Promise<{ url: string; title: string; text: string; truncated: boolean }> {
  const tab = activeBrowserTab();
  if (!tab) throw new Error('Open a public page in the FORGE Browser before asking the agent to read it.');
  const url = (await validateExternalUrl(tab.view.webContents.getURL())).toString();
  const document = await tab.view.webContents.executeJavaScript(`(() => ({ title: document.title || '', text: (document.body?.innerText || '').replace(/\\s+/g, ' ').trim() }))()`, true) as { title?: unknown; text?: unknown };
  const text = typeof document.text === 'string' ? document.text : '';
  const limit = 160_000;
  return { url, title: typeof document.title === 'string' ? document.title : tab.view.webContents.getTitle(), text: text.slice(0, limit), truncated: text.length > limit };
}

function setBrowserLayout(request: { visible: boolean; bounds?: { x: number; y: number; width: number; height: number } }): void {
  browserLayout = request;
  const tab = activeBrowserTab();
  if (!request.visible || !tab) {
    detachBrowserView();
    return;
  }
  if (request.bounds) {
    const { x, y, width, height } = request.bounds;
    tab.view.setBounds({ x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)), width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) });
  }
  // BrowserView is attached directly to BrowserWindow. On macOS this avoids
  // intermittent WebContentsView compositor frames that render as a blank
  // surface even though the page itself has loaded successfully.
  // setBrowserView registers native lifecycle listeners. Re-attaching the
  // same view on every ResizeObserver tick leaks those listeners and can
  // destabilize long-running browser sessions.
  if (attachedBrowserView !== tab.view) {
    const window = liveMainWindow();
    if (!window) return;
    try {
      window.setBrowserView(tab.view);
      attachedBrowserView = tab.view;
    } catch {
      // The renderer can send a final ResizeObserver event while its window
      // is closing. The next live layout update will attach the view again.
      attachedBrowserView = null;
    }
  }
}

function showBrowserHome(): BrowserStateView { activeBrowserTabId = null; setBrowserLayout(browserLayout); sendBrowserState(); return browserState(); }

function openBlankBrowserTab(): BrowserStateView {
  const tab = createBrowserTab();
  activeBrowserTabId = tab.id;
  tab.view.webContents.loadURL('about:blank').catch((error) => reportBrowserError(tab, error));
  setBrowserLayout(browserLayout); sendBrowserState();
  return browserState();
}

function selectBrowserTab(tabId: string): BrowserStateView {
  if (!browserTabs.has(tabId)) throw new Error('The browser tab is no longer available.');
  activeBrowserTabId = tabId; setBrowserLayout(browserLayout); sendBrowserState(); return browserState();
}

function closeBrowserTab(tabId: string): BrowserStateView {
  const tab = browserTabs.get(tabId); if (!tab) return browserState();
  const ordered = [...browserTabs.keys()]; const index = ordered.indexOf(tabId);
  browserTabs.delete(tabId); if (!tab.view.webContents.isDestroyed()) tab.view.webContents.close();
  if (activeBrowserTabId === tabId) activeBrowserTabId = ordered[index + 1] ?? ordered[index - 1] ?? null;
  setBrowserLayout(browserLayout); sendBrowserState(); return browserState();
}

async function addActiveBrowserBookmark(): Promise<BrowserStateView> {
  const tab = activeBrowserTab(); if (!tab) throw new Error('Open a public page before creating a bookmark.');
  const url = (await validateExternalUrl(tab.view.webContents.getURL())).toString();
  await storage.addBrowserBookmark(url, tab.view.webContents.getTitle()); await refreshBrowserRecords(); sendBrowserState(); return browserState();
}

async function removeBrowserBookmark(bookmarkId: string): Promise<BrowserStateView> {
  await storage.deleteBrowserBookmark(bookmarkId); await refreshBrowserRecords(); sendBrowserState(); return browserState();
}

function disposeBrowserTabs(): void {
  detachBrowserView();
  for (const tab of browserTabs.values()) if (!tab.view.webContents.isDestroyed()) tab.view.webContents.close();
  browserTabs.clear(); activeBrowserTabId = null; browserBookmarks = []; browserHistory = [];
}

const browserToolService = {
  enabled: (): boolean => settings.webResearchEnabled(),
  open: navigateBrowser,
  read: readBrowserPage
};
const toolRouter = new ToolRouter({ git, github, shell: shellService, terminal: terminalService, tasks: taskRuntime, browser: browserToolService, memories: memoryService, web: webService, audit: storage, dirtyPaths: () => dirtyEditorPaths });

function registerHandlers(): void {
  register(IPC_CHANNELS.workspaceOpen, async () => {
    const selection = await dialog.showOpenDialog({ title: 'Open Forge workspace', properties: ['openDirectory', 'createDirectory'] });
    if (selection.canceled || !selection.filePaths[0]) throw new Error('Workspace selection was cancelled.');
    return openWorkspaceAt(selection.filePaths[0]);
  });
  register(IPC_CHANNELS.workspaceOpenHome, async () => openWorkspaceAt(homedir()));
  register(IPC_CHANNELS.workspaceInfo, async () => workspace.info());
  register(IPC_CHANNELS.workspaceLayoutGet, async () => storage.getWorkspaceLayout());
  register(IPC_CHANNELS.workspaceLayoutSave, async (request) => storage.saveWorkspaceLayout(request));
  register(IPC_CHANNELS.fileList, async (request) => workspace.list(request?.path, { recursive: request?.recursive, showHidden: request?.showHidden }));
  register(IPC_CHANNELS.fileRead, async (request) => workspace.readFile(request.path));
  register(IPC_CHANNELS.fileMetadata, async (request) => workspace.metadata(request.path));
  register(IPC_CHANNELS.filePreview, async (request) => workspace.preview(request.path));
  register(IPC_CHANNELS.fileWrite, async (request) => workspace.writeFile(request.path, request.content));
  register(IPC_CHANNELS.fileCreate, async (request) => workspace.create(request.path, request.type, request.content));
  register(IPC_CHANNELS.fileDelete, async (request) => workspace.delete(request.path));
  register(IPC_CHANNELS.fileRename, async (request) => workspace.rename(request.oldPath, request.newPath));
  register(IPC_CHANNELS.fileCopy, async (request) => workspace.copy(request.sourcePath, request.destinationPath));
  register(IPC_CHANNELS.markdownParse, async (request) => workspace.parse(request.path));
  register(IPC_CHANNELS.gitStatus, async () => git.status());
  register(IPC_CHANNELS.gitBranches, async () => git.branches());
  register(IPC_CHANNELS.gitLog, async (request) => git.log(request?.limit));
  register(IPC_CHANNELS.gitDiff, async (request) => git.diff(request.staged));
  register(IPC_CHANNELS.gitStage, async (request) => git.stage(request.files));
  register(IPC_CHANNELS.gitUnstage, async (request) => git.unstage(request.files));
  register(IPC_CHANNELS.gitCommit, async (request) => git.commit(request.message, request.files));
  register(IPC_CHANNELS.gitPull, async () => git.pull());
  register(IPC_CHANNELS.gitPush, async () => git.push());
  register(IPC_CHANNELS.metaDashboard, async () => {
    const project = await storage.dashboard();
    const packet = await intelligence.snapshot(await memoryRetriever.search('workspace architecture decisions documentation source', 6));
    const all = (nodes: any[]): any[] => nodes.flatMap((node) => [node, ...(node.children ? all(node.children) : [])]);
    const files = all(await workspace.list());
    return {
      project,
      recentCommits: await git.log(8).catch(() => []),
      contextHealth: { ...packet.metrics, hasReadme: files.some((file) => /^readme\.md$/i.test(file.name)), noteCount: files.filter((file) => file.extension === 'md').length, codeFileCount: files.filter((file) => ['ts', 'tsx', 'js', 'jsx', 'py', 'cpp', 'c'].includes(file.extension ?? '')).length },
      contextSources: packet.artifacts.map((artifact) => ({ id: artifact.id, kind: artifact.kind, title: artifact.title, path: artifact.path, relevance: typeof artifact.metadata?.relevance === 'number' ? artifact.metadata.relevance : undefined, reason: typeof artifact.metadata?.reason === 'string' ? artifact.metadata.reason : undefined })),
      contextGeneratedAt: packet.generatedAt
    };
  });
  register(IPC_CHANNELS.metaGoalCreate, async (request) => storage.createGoal(request.title, request.description));
  register(IPC_CHANNELS.metaGoalUpdate, async (request) => storage.updateGoal(request.goalId, request.title, request.description, request.status));
  register(IPC_CHANNELS.metaGoalDelete, async (request) => storage.deleteGoal(request.goalId));
  register(IPC_CHANNELS.metaTaskCreate, async (request) => storage.createTask(request.title, request.description, request.priority));
  register(IPC_CHANNELS.appUpdateStatus, async () => updater.status());
  register(IPC_CHANNELS.appUpdateCheck, async () => updater.check());
  register(IPC_CHANNELS.appUpdateInstall, async () => updater.install());
  register(IPC_CHANNELS.appReleaseOpen, async () => updater.openLatestRelease());
  register(IPC_CHANNELS.appBuildInfo, async () => appBuildInfo());
  register(IPC_CHANNELS.appBuildInfoCopy, async () => { const info = appBuildInfo(); clipboard.writeText(formatAppBuildInfo(info)); return info; });
  register(IPC_CHANNELS.settingsGet, async () => settings.publicSettings());
  register(IPC_CHANNELS.settingsSave, async (request) => { const result = await settings.save(request); await applyAISettings(); if (result.embeddingEnabled && result.autoIndex) void runSemanticRefresh(() => semanticIndexer.incremental(), 'settings-save'); return result; });
  register(IPC_CHANNELS.settingsTestApi, async () => aiProvider.testConnection());
  register(IPC_CHANNELS.settingsModelsList, async (request) => new OpenAIProvider(await settings.apiConfiguration({ apiKey: request.apiKey, baseUrl: request.apiBaseUrl })).listModels());
  register(IPC_CHANNELS.settingsModelValidate, async (request) => new OpenAIProvider(await settings.apiConfiguration({ apiKey: request.apiKey, baseUrl: request.apiBaseUrl, model: request.apiModel })).validateModel(request.apiModel));
  register(IPC_CHANNELS.settingsEmbeddingModelsList, async (request) => embeddingClient.listModels({ baseUrl: request.embeddingBaseUrl, apiKey: request.embeddingApiKey }));
  register(IPC_CHANNELS.settingsEmbeddingModelValidate, async (request) => embeddingClient.validateModel(request.embeddingModel, { baseUrl: request.embeddingBaseUrl, model: request.embeddingModel, apiKey: request.embeddingApiKey, enabled: true }));
  register(IPC_CHANNELS.settingsTestGithub, async () => settings.testGitHub());
  register(IPC_CHANNELS.settingsRuntimeStatus, async () => {
    const status = await new HermesRuntimeDetector().status(settings.hermesConfiguration());
    const profile = resolveAgentRuntime(settings.publicSettings().agentRuntime, status, status.endpointReachable === true);
    return { ...status, requested: profile.requested, active: profile.active };
  });
  register(IPC_CHANNELS.settingsPlatformCapabilities, async () => {
    const status = await new HermesRuntimeDetector().status(settings.hermesConfiguration());
    const semantic = await storage.semanticIndexStatus().catch(() => null);
    const config = await settings.embeddingConfiguration();
    return platformCapabilities({ platform: process.platform, appDataPath: app.getPath('userData'), resourcePath: process.resourcesPath, hermesStatus: status, embeddingProviderAvailable: config.enabled && (!semantic?.lastError || semantic.state === 'ready'), embeddingModelAvailable: semantic?.state === 'ready' && semantic.embeddingModel === config.model, semanticIndexHealthy: semantic?.state === 'ready', workspaceDatabaseHealthy: Boolean(await storage.dashboard().catch(() => null)), toolRouterAvailable: true });
  });
  register(IPC_CHANNELS.semanticIndexStatus, async () => storage.semanticIndexStatus());
  register(IPC_CHANNELS.semanticIndexRebuild, async () => semanticIndexer.rebuild());
  register(IPC_CHANNELS.contextHealthGet, async () => semanticContext.health());
  register(IPC_CHANNELS.runtimeTelemetry, async () => {
    const [semantic, project] = await Promise.all([storage.semanticIndexStatus(), storage.dashboard()]);
    const requests = project ? await toolRouter.listRequests(project.id) : [];
    const memory = process.memoryUsage();
    const now = Date.now();
    const persistedRunningTasks = project?.tasks.filter((task) => task.status === 'running').length ?? 0;
    return {
      sampledAt: Date.now(),
      process: { pid: process.pid, uptimeSeconds: process.uptime(), rssBytes: memory.rss, heapUsedBytes: memory.heapUsed, heapTotalBytes: memory.heapTotal, externalBytes: memory.external, arrayBuffersBytes: memory.arrayBuffers },
      semantic,
      activity: {
        runningTools: Math.max(activeToolOperations.size, requests.filter((request) => request.state === 'running').length),
        queuedTools: requests.filter((request) => request.state === 'requested').length,
        runningTasks: Math.max(activeTaskOperations.size, persistedRunningTasks),
        activeTerminals: terminalService.list().filter((session) => session.state === 'running').length,
        toolsActive: activeToolOperations.size > 0 || now - lastToolActivityAt < 1_500,
        tasksActive: activeTaskOperations.size > 0 || now - lastTaskActivityAt < 1_500
      }
    };
  });
  register(IPC_CHANNELS.agentSkillsList, async () => {
    const info = workspace.info();
    if (!info) throw new Error('Open a workspace before listing skills.');
    const status = await new HermesRuntimeDetector().status(settings.hermesConfiguration());
    return discoverSkills(skillRootsForWorkspace(info.rootPath, { hermesRoots: status.skillRoots }));
  });

  const nativeAgent = createNativeAgentRuntime({ storage, workspace, agent, toolRouter, taskRuntime, settings, aiProvider, git, emitRuntimeEvent, resolveReasoningRuntime });
  register(IPC_CHANNELS.agentAsk, async (request) => { if (!request.prompt.trim()) throw new Error('A prompt is required.'); return nativeAgent.runAgentTurn(request.conversationId, request.prompt.trim()); });
  register(IPC_CHANNELS.agentExplainProject, async (request) => nativeAgent.runAgentTurn(request?.conversationId, 'Explain this repository as an evidence-grounded architecture summary.'));
  register(IPC_CHANNELS.agentReviewChanges, async (request) => nativeAgent.runAgentTurn(request?.conversationId, 'Review the current repository changes against its documented architecture and project goals.'));
  register(IPC_CHANNELS.agentConversationsState, async (request) => storage.conversationState(request?.conversationId));
  register(IPC_CHANNELS.agentConversationsList, async (request) => (await storage.conversationState(request?.conversationId)).messages);
  register(IPC_CHANNELS.agentConversationsAppend, async (request) => { const state = await storage.conversationState(request.conversationId); for (const entry of request.entries) await storage.appendConversation(state.activeConversationId, entry.role, entry.content); return undefined; });
  register(IPC_CHANNELS.agentConversationCreate, async (request) => storage.createConversation(request.title));
  register(IPC_CHANNELS.agentConversationSelect, async (request) => storage.selectConversation(request.conversationId));
  register(IPC_CHANNELS.agentConversationRename, async (request) => storage.renameConversation(request.conversationId, request.title));
  register(IPC_CHANNELS.agentConversationClear, async (request) => storage.clearConversation(request.conversationId));
  register(IPC_CHANNELS.agentConversationDelete, async (request) => storage.deleteConversation(request.conversationId));
  register(IPC_CHANNELS.agentConversationsClearAll, async () => storage.clearAllConversations());
  register(IPC_CHANNELS.agentMemoriesList, async () => storage.listMemories(250, 1_200));
  register(IPC_CHANNELS.agentMemoriesStats, async () => storage.memoryStats());
  register(IPC_CHANNELS.agentMemoriesDelete, async (request) => { await storage.deleteMemory(request.id); return undefined; });
  register(IPC_CHANNELS.agentMemoriesClear, async () => storage.clearMemories());
  register(IPC_CHANNELS.agentMemoriesReindex, async () => { await memoryIndexer.indexWorkspaceFiles(); return undefined; });
  const toolContext = async () => {
    const project = await storage.dashboard(); const info = workspace.info(); const conversation = await storage.conversationState();
    if (!project || !info) throw new Error('Open a workspace first.');
    return { workspaceId: project.id, workspaceRoot: info.rootPath, conversationId: conversation.activeConversationId, modelId: settings.publicSettings().apiModel };
  };
  register(IPC_CHANNELS.toolRequestsList, async () => { const project = await storage.dashboard(); return project ? toolRouter.listRequests(project.id) : []; });
  register(IPC_CHANNELS.toolRequestCancel, async (request) => toolRouter.cancel(request.requestId, await toolContext()));
  register(IPC_CHANNELS.toolActionsList, async (request) => storage.listActions(request));
  register(IPC_CHANNELS.toolCatalog, async () => toolRouter.capabilityCatalog(settings.publicSettings().agentExecutionMode));
  register(IPC_CHANNELS.toolExecute, async (request) => {
    const current = settings.publicSettings();
    const context = await toolContext();
    const outcome = await toolRouter.request({ id: request.requestId, name: request.toolName, provider: 'forge-tool-panel', arguments: request.arguments }, { ...context, repositoryRoot: workspace.info()?.gitRoot ?? undefined, filesystemScope: current.filesystemScope, projectTreeRoot: current.projectTreeRoot || undefined, executionMode: current.agentExecutionMode, networkAccess: current.networkAccess, backgroundTasksEnabled: current.backgroundTasksEnabled, autoRepairToolArguments: current.autoRepairToolArguments, processMode: current.processMode, processTimeoutMs: current.processTimeoutMs, backgroundTaskTimeoutMs: current.backgroundTaskTimeoutMs, userRequest: 'The user explicitly ran this capability from the FORGE Tooling panel.' });
    if (!outcome.result) throw new Error(`Tool ${request.toolName} did not return an execution result.`);
    return outcome.result;
  });
  register(IPC_CHANNELS.agentStopAll, async () => {
    const project = await storage.dashboard();
    if (!project) return { toolsCancelled: 0, tasksCancelled: 0 };
    const toolsCancelled = await toolRouter.cancelAll(project.id);
    const tasksCancelled = await taskRuntime.stopAll();
    return { toolsCancelled, tasksCancelled };
  });
  register(IPC_CHANNELS.editorDirtyUpdate, async (request) => { dirtyEditorPaths.clear(); for (const value of request.paths) if (value && !value.split(/[\\/]/).includes('..')) dirtyEditorPaths.add(value); return undefined; });
  register(IPC_CHANNELS.terminalCreate, async (request) => terminalService.create(request?.workingDirectory, request?.columns, request?.rows));
  register(IPC_CHANNELS.terminalList, async () => terminalService.list());
  register(IPC_CHANNELS.terminalInput, async (request) => { terminalService.input(request.sessionId, request.data); return undefined; });
  register(IPC_CHANNELS.terminalResize, async (request) => { terminalService.resize(request.sessionId, request.columns, request.rows); return undefined; });
  register(IPC_CHANNELS.terminalTerminate, async (request) => { terminalService.terminate(request.sessionId); return undefined; });
  register(IPC_CHANNELS.terminalRestart, async (request) => terminalService.restart(request.sessionId));
  register(IPC_CHANNELS.terminalRemove, async (request) => { terminalService.remove(request.sessionId); return undefined; });
  register(IPC_CHANNELS.tasksList, async () => taskRuntime.list());
  register(IPC_CHANNELS.tasksGet, async (request) => taskRuntime.get(request.taskId));
  register(IPC_CHANNELS.tasksCreate, async (request) => taskRuntime.create(request));
  register(IPC_CHANNELS.tasksUpdate, async (request) => taskRuntime.update(request.taskId, request.draft));
  register(IPC_CHANNELS.tasksCreateRelease, async (request) => taskRuntime.createRelease(request.version, request.originatingConversationId));
  register(IPC_CHANNELS.tasksResume, async (request) => nativeAgent.runTaskStep(request.taskId));
  register(IPC_CHANNELS.tasksPause, async (request) => taskRuntime.pause(request.taskId, request.reason));
  register(IPC_CHANNELS.tasksCancel, async (request) => taskRuntime.cancel(request.taskId, request.reason, request.trackingOnly));
  register(IPC_CHANNELS.tasksRedirect, async (request) => taskRuntime.redirect(request.taskId, request.instruction));
  register(IPC_CHANNELS.tasksDelete, async (request) => { await storage.deletePersistentTask(request.taskId); return undefined; });
  register(IPC_CHANNELS.tasksRetryStep, async (request) => { await taskRuntime.retryStep(request.taskId, request.stepId); return nativeAgent.runTaskStep(request.taskId); });
  register(IPC_CHANNELS.tasksHandoff, async (request) => taskRuntime.generateHandoff(request.taskId));
  register(IPC_CHANNELS.browserNavigate, async (request) => navigateBrowser(request.url));
  register(IPC_CHANNELS.browserLayout, async (request) => { setBrowserLayout(request); return browserState(); });
  register(IPC_CHANNELS.browserBack, async () => { const tab = activeBrowserTab(); if (tab?.view.webContents.canGoBack()) tab.view.webContents.goBack(); return browserState(); });
  register(IPC_CHANNELS.browserForward, async () => { const tab = activeBrowserTab(); if (tab?.view.webContents.canGoForward()) tab.view.webContents.goForward(); return browserState(); });
  register(IPC_CHANNELS.browserReload, async () => { const tab = activeBrowserTab(); if (tab) tab.view.webContents.reload(); return browserState(); });
  register(IPC_CHANNELS.browserHome, async () => showBrowserHome());
  register(IPC_CHANNELS.browserTabNew, async () => openBlankBrowserTab());
  register(IPC_CHANNELS.browserTabClose, async (request) => closeBrowserTab(request.tabId));
  register(IPC_CHANNELS.browserTabSelect, async (request) => selectBrowserTab(request.tabId));
  register(IPC_CHANNELS.browserBookmarkAdd, async () => addActiveBrowserBookmark());
  register(IPC_CHANNELS.browserBookmarkRemove, async (request) => removeBrowserBookmark(request.bookmarkId));
  register(IPC_CHANNELS.forgeLiveStart, async () => liveService().start());
  register(IPC_CHANNELS.forgeLiveStop, async () => forgeLive ? forgeLive.stop() : { workspaceId: workspace.info()?.rootPath ?? '', status: 'stopped', mode: 'static' });
  register(IPC_CHANNELS.forgeLiveRestart, async () => liveService().restart());
  register(IPC_CHANNELS.forgeLiveStatus, async () => forgeLive?.status() ?? { workspaceId: workspace.info()?.rootPath ?? '', status: 'stopped', mode: 'static' });
  register(IPC_CHANNELS.forgeLiveOpenPreview, async () => { const live = await liveService().start(); if (!live.url) throw new Error('FORGE Live did not produce a preview URL.'); return navigateBrowser(live.url); });
  register(IPC_CHANNELS.forgeLiveCopyUrl, async () => { const url = forgeLive?.status().url; if (!url) throw new Error('Start FORGE Live before copying its URL.'); clipboard.writeText(url); return { url }; });
  register(IPC_CHANNELS.forgeOsContext, async () => forgeOs.context());
  register(IPC_CHANNELS.forgeOsApplications, async () => forgeOs.discoverApplications());
  register(IPC_CHANNELS.forgeOsApplicationLaunch, async (request) => { await forgeOs.launchApplication(request.id); return undefined; });
  register(IPC_CHANNELS.forgeOsOverview, async () => forgeOs.overview(app.getVersion()));
  register(IPC_CHANNELS.forgeOsSessionAction, async (request) => { await forgeOs.sessionAction(request.action); if (request.action === 'logout') app.quit(); return undefined; });
}

function createWindow(): void {
  const rendererFile = join(__dirname, '../renderer/index.html');
  const packagedRendererUrl = pathToFileURL(rendererFile).toString();
  const forgeOsShell = process.platform === 'linux' && (process.env.FORGE_OS_SESSION === '1' || process.env.XDG_CURRENT_DESKTOP?.toUpperCase() === 'FORGE') && process.env.FORGE_SHELL_MODE !== '0';
  mainWindow = new BrowserWindow({ width: 1500, height: 950, minWidth: 1100, minHeight: 700, show: false, title: 'FORGE', webPreferences: { preload: join(__dirname, '../preload/index.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true } });
  if (forgeOsShell) mainWindow.maximize();
  mainWindow.on('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => { mainWindow = null; disposeBrowserTabs(); });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => { const developmentUrl = process.env.ELECTRON_RENDERER_URL; const allowed = is.dev && developmentUrl ? new URL(url).origin === new URL(developmentUrl).origin : url === packagedRendererUrl; if (!allowed) event.preventDefault(); });
  if (is.dev && process.env.ELECTRON_RENDERER_URL) { rendererSource = 'development URL'; void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL); }
  else { rendererSource = app.isPackaged ? 'file:// packaged app.asar' : 'file:// development build'; void mainWindow.loadFile(rendererFile); }
}

app.setName('FORGE');
const ownsSingleInstanceLock = app.requestSingleInstanceLock();

if (!ownsSingleInstanceLock) {
  app.quit();
} else {
app.on('second-instance', (_event, commandLine) => {
  const startupWorkspace = commandLine.find((argument) => argument.startsWith('--workspace='))?.slice('--workspace='.length);
  if (startupWorkspace) void openWorkspaceAt(startupWorkspace).catch(() => undefined);
  if (mainWindow?.isMinimized()) mainWindow.restore();
  mainWindow?.show();
  mainWindow?.focus();
});

app.whenReady().then(async () => {
  const developmentIcon = join(process.cwd(), 'apps/desktop/resources/ForgeIcon-v2.5-1024.png');
  if (process.platform === 'darwin' && is.dev && app.dock && existsSync(developmentIcon)) app.dock.setIcon(developmentIcon);
  try { await settings.init(); await applyAISettings(); registerHandlers(); const startupWorkspace = process.argv.find((argument) => argument.startsWith('--workspace='))?.slice('--workspace='.length) ?? settings.lastWorkspacePath(); if (startupWorkspace) await openWorkspaceAt(startupWorkspace).catch(() => undefined); createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); }
  catch (error) { dialog.showErrorBox('FORGE could not start', error instanceof Error ? error.message : String(error)); app.quit(); }
});
app.on('window-all-closed', async () => { terminalService.dispose(); await forgeLive?.stop().catch(() => undefined); forgeLive = null; await semanticIndexer.stop(); await storage.close(); if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { void forgeLive?.stop().catch(() => undefined); });
}
