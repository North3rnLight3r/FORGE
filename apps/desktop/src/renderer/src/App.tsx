import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type JSX, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';
import Editor, { loader, type OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { DEFAULT_WORKSPACE_LAYOUT, type AppUpdateStatus, type BrowserStateView, type DashboardData, type FileMetadata, type FileNode, type FilePreview, type GitDiff, type GitStatus, type RuntimeTelemetryView, type WorkspaceInfo, type WorkspaceLayout } from '@forge/ipc';
import { forgeInvoke, onRuntimeEvent } from './forge';
import ChatPanel from './components/ChatPanel';
import MemoryPanel from './components/MemoryPanel';
import SettingsModal from './components/SettingsModal';
import TerminalPanel from './components/TerminalPanel';
import ToolPanel from './components/ToolPanel';
import TaskPanel from './components/TaskPanel';
import BrowserPanel from './components/BrowserPanel';
import ForgeOsShell from './components/ForgeOsShell';
import TextInputDialog from './components/TextInputDialog';
import AuroraLayer from './components/AuroraLayer';
import ForgeBrand from './components/ForgeBrand';
import IntelligenceVisualizer from './components/IntelligenceVisualizer';
import { useInterfaceSounds } from './components/useInterfaceSounds';
import { childEditorPath, copiedEditorName, findFileNode, parentEditorPath } from './editor-files';
import { isEditableShortcutTarget, resolveEditorShortcut } from './editor-shortcuts';
import { openWorkspaceFrom } from './workspace-opening';

const languageFor = (extension?: string, name?: string): string => {
  if (/^dockerfile$/i.test(name ?? '')) return 'dockerfile';
  if (/^makefile$/i.test(name ?? '')) return 'makefile';
  return ({
    md: 'markdown', mdx: 'markdown', ts: 'typescript', mts: 'typescript', cts: 'typescript', tsx: 'typescript', js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript', json: 'json', jsonc: 'json',
    py: 'python', pyw: 'python', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', h: 'cpp', hpp: 'cpp', c: 'c', cs: 'csharp', java: 'java', kt: 'kotlin', kts: 'kotlin', rs: 'rust', go: 'go', swift: 'swift',
    css: 'css', scss: 'scss', less: 'less', html: 'html', htm: 'html', xml: 'xml', vue: 'html', svelte: 'html', php: 'php', rb: 'ruby', sh: 'shell', bash: 'shell', zsh: 'shell', fish: 'shell', ps1: 'powershell',
    yml: 'yaml', yaml: 'yaml', toml: 'ini', ini: 'ini', sql: 'sql', graphql: 'graphql', dart: 'dart', lua: 'lua', r: 'r', fs: 'fsharp', fsx: 'fsharp'
  }[extension?.toLowerCase() ?? ''] ?? 'plaintext');
};
const call = async <T,>(promise: Promise<{ success: boolean; data?: T; error?: { message: string } }>): Promise<T> => { const result = await promise; if (!result.success) throw new Error(result.error?.message ?? 'Request failed.'); return result.data as T; };
const clamp = (value: number, minimum: number, maximum: number): number => Math.min(maximum, Math.max(minimum, value));

function fitLayout(layout: WorkspaceLayout, width: number, height: number): WorkspaceLayout {
  const availableWidth = Math.max(440, width - 10 - 300);
  let explorerWidth = clamp(layout.explorerWidth, 180, Math.min(520, availableWidth - 260));
  let intelligenceWidth = clamp(layout.intelligenceWidth, 260, Math.min(620, availableWidth - explorerWidth));
  if (explorerWidth + intelligenceWidth > availableWidth) intelligenceWidth = Math.max(260, availableWidth - explorerWidth);
  if (explorerWidth + intelligenceWidth > availableWidth) explorerWidth = Math.max(180, availableWidth - intelligenceWidth);
  const availableHeight = Math.max(420, height - 52 - 5);
  const bottomHeight = clamp(layout.bottomHeight, 160, Math.max(160, availableHeight - 260));
  const contextHeight = clamp(layout.contextHeight, 140, Math.max(140, availableHeight - bottomHeight - 5 - 180));
  return { explorerWidth, intelligenceWidth, bottomHeight, contextHeight };
}

function ancestorPaths(value: string): string[] {
  const ancestors: string[] = [];
  let current = parentEditorPath(value);
  while (current) { ancestors.unshift(current); current = parentEditorPath(current); }
  return ancestors;
}

function replaceFileChildren(nodes: FileNode[], relativePath: string, children: FileNode[]): FileNode[] {
  return nodes.map((node) => node.relativePath === relativePath
    ? { ...node, children }
    : node.children ? { ...node, children: replaceFileChildren(node.children, relativePath, children) } : node);
}

loader.config({ monaco });

type AppTextPrompt =
  | { kind: 'create-entry'; entryType: 'file' | 'directory'; directory: string }
  | { kind: 'rename-entry'; node: FileNode }
  | { kind: 'create-goal' }
  | { kind: 'create-task' };
type ForgeLiveState = { status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error'; port?: number; url?: string; error?: { message: string } };

export default function App(): JSX.Element {
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [active, setActive] = useState<FileNode | null>(null);
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [diff, setDiff] = useState<GitDiff | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<FilePreview | null>(null);
  const [metadata, setMetadata] = useState<FileMetadata | null>(null);
  const [showHidden, setShowHidden] = useState(() => localStorage.getItem('forge.showHiddenFiles.v2') !== 'false');
  const [updateStatus, setUpdateStatus] = useState<AppUpdateStatus | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState<'api' | 'github' | null>(null);
  const [layout, setLayout] = useState<WorkspaceLayout>(DEFAULT_WORKSPACE_LAYOUT);
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const [bottomView, setBottomView] = useState<'source' | 'terminal' | 'actions' | 'tasks'>('source');
  const [browserOpen, setBrowserOpen] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | undefined>();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set());
  const [clipboardNode, setClipboardNode] = useState<Pick<FileNode, 'relativePath' | 'name' | 'type'> | null>(null);
  const [contextMenu, setContextMenu] = useState<{ node: FileNode; x: number; y: number } | null>(null);
  const [textPrompt, setTextPrompt] = useState<AppTextPrompt | null>(null);
  const [textPromptBusy, setTextPromptBusy] = useState(false);
  const [forgeLive, setForgeLive] = useState<ForgeLiveState>({ status: 'stopped' });
  const [telemetry, setTelemetry] = useState<RuntimeTelemetryView | null>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const interfaceSounds = useInterfaceSounds();

  const refresh = useCallback(async () => {
    if (!workspace) return;
    try {
      const [nextFiles, nextStatus, nextDashboard] = await Promise.all([
        call<FileNode[]>(forgeInvoke('file.list', { recursive: false, showHidden })),
        call<GitStatus>(forgeInvoke('git.status', undefined)).catch(() => null),
        call<DashboardData>(forgeInvoke('meta.dashboard', undefined))
      ]);
      setFiles(nextFiles); setStatus(nextStatus); setDashboard(nextDashboard);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not refresh workspace.'); }
  }, [showHidden, workspace]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { localStorage.setItem('forge.showHiddenFiles.v2', String(showHidden)); }, [showHidden]);
  useEffect(() => { void call<WorkspaceInfo | null>(forgeInvoke('workspace.info', undefined)).then((info) => { if (info) setWorkspace(info); }).catch(() => undefined); }, []);
  useEffect(() => {
    if (!workspace) { setForgeLive({ status: 'stopped' }); return undefined; }
    const refreshLive = (): void => { void call<ForgeLiveState>(forgeInvoke('forge-live.status', undefined)).then(setForgeLive).catch(() => undefined); };
    refreshLive(); const timer = window.setInterval(refreshLive, 800); return () => window.clearInterval(timer);
  }, [workspace?.rootPath]);
  useEffect(() => {
    if (!workspace) return undefined;
    return onRuntimeEvent((event) => {
      if (['context.updated', 'context.invalidated', 'agent.completed', 'agent.blocked', 'memory.changed', 'task.changed'].includes(event.type)) {
        void call<DashboardData>(forgeInvoke('meta.dashboard', undefined)).then(setDashboard).catch(() => undefined);
      }
      if (['tool.requested', 'tool.completed', 'agent.started', 'agent.completed', 'agent.blocked', 'task.changed'].includes(event.type)) {
        void call<RuntimeTelemetryView>(forgeInvoke('runtime.telemetry', undefined)).then(setTelemetry).catch(() => undefined);
      }
    });
  }, [workspace?.rootPath]);
  useEffect(() => { void call<AppUpdateStatus>(forgeInvoke('app.update.status', undefined)).then(setUpdateStatus).catch(() => undefined); }, []);
  useEffect(() => {
    if (!workspace) { setTelemetry(null); return undefined; }
    const sample = (): void => { if (!document.hidden) void call<RuntimeTelemetryView>(forgeInvoke('runtime.telemetry', undefined)).then(setTelemetry).catch(() => undefined); };
    sample(); const timer = window.setInterval(sample, 2_000); return () => window.clearInterval(timer);
  }, [workspace?.rootPath]);
  useEffect(() => {
    if (!updateStatus || !['checking', 'available', 'downloading'].includes(updateStatus.state)) return undefined;
    const timer = window.setInterval(() => { void call<AppUpdateStatus>(forgeInvoke('app.update.status', undefined)).then(setUpdateStatus).catch(() => undefined); }, 1500);
    return () => window.clearInterval(timer);
  }, [updateStatus]);
  useEffect(() => {
    if (!workspace) return;
    setLayoutLoaded(false);
    void call<WorkspaceLayout>(forgeInvoke('workspace.layout.get', undefined)).then((saved) => { setLayout(fitLayout(saved, window.innerWidth, window.innerHeight)); setLayoutLoaded(true); }).catch((cause) => { setError(cause instanceof Error ? cause.message : String(cause)); setLayout(DEFAULT_WORKSPACE_LAYOUT); setLayoutLoaded(true); });
  }, [workspace?.rootPath]);
  useEffect(() => {
    const resize = (): void => setLayout((current) => fitLayout(current, window.innerWidth, window.innerHeight));
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    const closeContextMenu = (): void => setContextMenu(null);
    window.addEventListener('click', closeContextMenu);
    return () => window.removeEventListener('click', closeContextMenu);
  }, []);
  useEffect(() => {
    if (!workspace || !layoutLoaded) return undefined;
    const timer = window.setTimeout(() => { void call<WorkspaceLayout>(forgeInvoke('workspace.layout.save', layout)).catch((cause) => setError(cause instanceof Error ? cause.message : String(cause))); }, 250);
    return () => window.clearTimeout(timer);
  }, [layout, layoutLoaded, workspace]);
  useEffect(() => { void forgeInvoke('editor.dirty.update', { paths: active && content !== savedContent ? [active.relativePath] : [] }); }, [active?.relativePath, content, savedContent]);

  const applyOpenedWorkspace = (opened: WorkspaceInfo): void => { setWorkspace(opened); setActive(null); setContent(''); setSavedContent(''); setSelectedPath(undefined); setExpandedFolders(new Set()); setError(null); };
  const openWorkspace = async (): Promise<void> => { try { applyOpenedWorkspace(await openWorkspaceFrom('workspace.open', forgeInvoke)); } catch (cause) { if ((cause as Error).message !== 'Workspace selection was cancelled.') setError((cause as Error).message); } };
  const openHomeWorkspace = async (): Promise<void> => { try { applyOpenedWorkspace(await openWorkspaceFrom('workspace.open.home', forgeInvoke)); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); } };
  const startLive = async (): Promise<void> => { try { setForgeLive(await call<ForgeLiveState>(forgeInvoke('forge-live.start', undefined))); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); } };
  const stopLive = async (): Promise<void> => { try { setForgeLive(await call<ForgeLiveState>(forgeInvoke('forge-live.stop', undefined))); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); } };
  const openLivePreview = async (): Promise<void> => { try { await call<BrowserStateView>(forgeInvoke('forge-live.open-preview', undefined)); setBrowserOpen(true); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); } };
  const openFile = async (node: FileNode): Promise<void> => { if (node.type === 'directory') return; setSelectedPath(node.relativePath); setMediaPreview(null); try { const info = await call<FileMetadata>(forgeInvoke('file.metadata', { path: node.relativePath })); setMetadata(info); if (['image', 'audio', 'video'].includes(info.kind)) { setMediaPreview(await call<FilePreview>(forgeInvoke('file.preview', { path: node.relativePath }))); setActive(node); setContent(''); setSavedContent(''); setPreview(false); return; } if (info.kind === 'binary' || (info.kind === 'executable' && !info.text)) { setActive(node); setContent(`Binary/executable file\n\n${JSON.stringify(info, null, 2)}`); setSavedContent(''); setPreview(false); return; } const file = await call<{ content: string }>(forgeInvoke('file.read', { path: node.relativePath })); setActive(node); setContent(file.content); setSavedContent(file.content); setPreview(node.extension === 'md'); setError(null); } catch (cause) { setError((cause as Error).message); } };
  const save = async (): Promise<void> => { if (!active) return; try { await call(forgeInvoke('file.write', { path: active.relativePath, content })); setSavedContent(content); await refresh(); } catch (cause) { setError((cause as Error).message); } };
  const selectedNode = (selectedPath ? findFileNode(files, selectedPath) : null) ?? active;
  const selectedDirectory = selectedNode?.type === 'directory' ? selectedNode.relativePath : parentEditorPath(selectedNode?.relativePath ?? '');
  const expandParents = (relativePath: string): void => setExpandedFolders((current) => new Set([...current, ...ancestorPaths(relativePath)]));
  const createEntry = (type: 'file' | 'directory'): void => {
    setContextMenu(null);
    setTextPrompt({ kind: 'create-entry', entryType: type, directory: selectedDirectory });
  };
  const createEntryFromPrompt = async (prompt: Extract<AppTextPrompt, { kind: 'create-entry' }>, answer: string): Promise<void> => {
    const relativePath = childEditorPath(prompt.directory, answer);
    if (!relativePath || relativePath.split('/').includes('..')) { setError('Choose a workspace-relative name.'); return; }
    try {
      const created = await call<FileNode>(forgeInvoke('file.create', { path: relativePath, type: prompt.entryType, content: '' }));
      expandParents(created.relativePath); setSelectedPath(created.relativePath); setContextMenu(null); setError(null);
      if (prompt.entryType === 'file') { setActive(created); setContent(''); setSavedContent(''); setPreview(false); window.requestAnimationFrame(() => editorRef.current?.focus()); }
      void refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  const renameNode = (node: FileNode | null = selectedNode): void => {
    if (!node) return;
    setContextMenu(null);
    setTextPrompt({ kind: 'rename-entry', node });
  };
  const renameNodeFromPrompt = async (node: FileNode, answer: string): Promise<void> => {
    const newPath = childEditorPath(parentEditorPath(node.relativePath), answer);
    if (!newPath || newPath === node.relativePath || newPath.split('/').includes('..')) return;
    try {
      const renamed = await call<FileNode>(forgeInvoke('file.rename', { oldPath: node.relativePath, newPath }));
      if (active?.relativePath === node.relativePath) setActive(renamed);
      else if (active?.relativePath.startsWith(`${node.relativePath}/`)) setActive({ ...active, relativePath: `${renamed.relativePath}${active.relativePath.slice(node.relativePath.length)}`, path: `${renamed.path}${active.path.slice(node.path.length)}` });
      setSelectedPath(renamed.relativePath); setContextMenu(null); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  const deleteNode = async (node: FileNode | null = selectedNode): Promise<void> => {
    if (!node || !window.confirm(`Delete ${node.relativePath}? This cannot be undone.`)) return;
    try {
      await call(forgeInvoke('file.delete', { path: node.relativePath }));
      if (active && (active.relativePath === node.relativePath || active.relativePath.startsWith(`${node.relativePath}/`))) { setActive(null); setContent(''); setSavedContent(''); }
      setSelectedPath(undefined); setContextMenu(null); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  const copyNode = (node: FileNode | null = selectedNode): void => { if (!node) return; setClipboardNode({ relativePath: node.relativePath, name: node.name, type: node.type }); setSelectedPath(node.relativePath); setContextMenu(null); };
  const pasteNode = async (target: FileNode | null = selectedNode): Promise<void> => {
    if (!clipboardNode) return;
    const directory = target?.type === 'directory' ? target.relativePath : parentEditorPath(target?.relativePath ?? '');
    if (clipboardNode.type === 'directory' && (directory === clipboardNode.relativePath || directory.startsWith(`${clipboardNode.relativePath}/`))) { setError('A folder cannot be pasted into itself or one of its children.'); return; }
    const siblingNames = (directory ? findFileNode(files, directory)?.children : files)?.map((node) => node.name) ?? [];
    const destinationPath = childEditorPath(directory, copiedEditorName(clipboardNode.name, siblingNames));
    try { const pasted = await call<FileNode>(forgeInvoke('file.copy', { sourcePath: clipboardNode.relativePath, destinationPath })); expandParents(pasted.relativePath); setSelectedPath(pasted.relativePath); setContextMenu(null); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  const toggleFolder = (node: FileNode): void => {
    if (node.type !== 'directory') return;
    setSelectedPath(node.relativePath);
    const opening = !expandedFolders.has(node.relativePath);
    setExpandedFolders((current) => { const next = new Set(current); if (opening) next.add(node.relativePath); else next.delete(node.relativePath); return next; });
    if (opening) void call<FileNode[]>(forgeInvoke('file.list', { path: node.relativePath, recursive: false, showHidden }))
      .then((children) => setFiles((current) => replaceFileChildren(current, node.relativePath, children)))
      .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
  };
  const deleteActive = async (): Promise<void> => { await deleteNode(active); };
  const submitTextPrompt = async (value: string): Promise<void> => {
    if (!textPrompt) return;
    setTextPromptBusy(true);
    try {
      if (textPrompt.kind === 'create-entry') await createEntryFromPrompt(textPrompt, value);
      else if (textPrompt.kind === 'rename-entry') await renameNodeFromPrompt(textPrompt.node, value);
      else if (textPrompt.kind === 'create-goal') { await call(forgeInvoke('meta.goal.create', { title: value })); await refresh(); }
      else { await call(forgeInvoke('meta.task.create', { title: value })); await refresh(); }
      setTextPrompt(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setTextPromptBusy(false); }
  };
  const commit = async (): Promise<void> => { try { await call(forgeInvoke('git.commit', { message: commitMessage })); setCommitMessage(''); await refresh(); } catch (cause) { setError((cause as Error).message); } };
  const stage = async (file: string): Promise<void> => { try { await call(forgeInvoke('git.stage', { files: [file] })); setDiff(await call(forgeInvoke('git.diff', { staged: false }))); await refresh(); } catch (cause) { setError((cause as Error).message); } };
  const openReleases = async (): Promise<void> => { try { await call(forgeInvoke('app.release.open', undefined)); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); } };
  const runGitAction = async (channel: 'git.pull' | 'git.push'): Promise<void> => { try { await call(forgeInvoke(channel, undefined)); await refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); } };
  const checkForUpdates = async (): Promise<void> => { try { setCheckingUpdate(true); const result = await call<AppUpdateStatus>(forgeInvoke('app.update.check', undefined)); setUpdateStatus(result); if (['error', 'development', 'not-available'].includes(result.state)) setError(result.message); } catch (cause) { setError((cause as Error).message); } finally { setCheckingUpdate(false); } };
  const installUpdate = async (): Promise<void> => { try { await call(forgeInvoke('app.update.install', undefined)); } catch (cause) { setError((cause as Error).message); } };
  const renderMarkdown = useMemo(() => ({ __html: DOMPurify.sanitize(marked.parse(content) as string) }), [content]);
  const gridStyle = { '--explorer-width': `${layout.explorerWidth}px`, '--intelligence-width': `${layout.intelligenceWidth}px`, '--bottom-height': `${layout.bottomHeight}px`, '--context-height': `${layout.contextHeight}px` } as CSSProperties;
  const mountEditor: OnMount = (editor) => { editorRef.current = editor; };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent): void => {
      if (settingsOpen) return;
      const editable = isEditableShortcutTarget(event.target);
      const command = event.metaKey || event.ctrlKey;
      if (!editable && command && event.code === 'KeyC' && selectedNode) { event.preventDefault(); copyNode(); return; }
      if (!editable && command && event.code === 'KeyV' && clipboardNode) { event.preventDefault(); void pasteNode(); return; }
      if (!editable && command && event.code === 'KeyN' && !event.shiftKey) { event.preventDefault(); createEntry('file'); return; }
      if (!editable && command && event.code === 'KeyN' && event.shiftKey) { event.preventDefault(); createEntry('directory'); return; }
      if (!editable && event.code === 'F2' && selectedNode) { event.preventDefault(); renameNode(); return; }
      if (!editable && (event.key === 'Delete' || event.key === 'Backspace') && selectedNode) { event.preventDefault(); void deleteNode(); return; }
      const shortcut = resolveEditorShortcut(event);
      if (!shortcut) return;
      if (shortcut === 'save') { event.preventDefault(); if (active) void save(); return; }
      if (shortcut === 'open') { event.preventDefault(); void openWorkspace(); return; }
      if (!active || preview || isEditableShortcutTarget(event.target)) return;
      event.preventDefault(); editorRef.current?.trigger('forge-shortcut', shortcut, null); editorRef.current?.focus();
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [active, clipboardNode, content, preview, savedContent, selectedNode, settingsOpen, workspace]);

  const handleContextMenu = (event: ReactMouseEvent<HTMLDivElement>, node: FileNode): void => { event.preventDefault(); event.stopPropagation(); setSelectedPath(node.relativePath); setContextMenu({ node, x: event.clientX, y: event.clientY }); };

  return <main className="app-shell">
    <AuroraLayer />
    <ForgeOsShell />
    <header className="app-header"><div className="brand"><ForgeBrand /><small>v{updateStatus?.currentVersion ?? '2.5.0-beta-dev'} · {workspace?.name ?? 'No workspace'}</small></div><div className="toolbar">{updateStatus?.state === 'downloaded' ? <button className="update-ready" onClick={installUpdate}>Restart to update</button> : <button onClick={checkForUpdates} disabled={checkingUpdate || ['checking', 'available', 'downloading'].includes(updateStatus?.state ?? '')}>{updateStatus?.state === 'available' ? `Preparing v${updateStatus.availableVersion}…` : updateStatus?.state === 'downloading' ? 'Downloading update…' : checkingUpdate || updateStatus?.state === 'checking' ? 'Checking…' : 'Check for updates'}</button>}<button disabled={!workspace || ['starting', 'stopping'].includes(forgeLive.status)} onClick={forgeLive.status === 'running' ? stopLive : startLive}>{forgeLive.status === 'running' ? `● FORGE Live :${forgeLive.port}` : forgeLive.status === 'starting' ? '◌ Starting Live…' : '○ Go Live'}</button>{forgeLive.status === 'running' && <button onClick={openLivePreview}>Open Preview</button>}<button className={browserOpen ? 'active-tab' : ''} onClick={() => setBrowserOpen((open) => !open)}>Browser</button><button onClick={openReleases}>Releases</button><button onClick={() => setSettingsOpen('github')}>GitHub</button><button onClick={() => setSettingsOpen('api')}>Settings</button><button className={interfaceSounds.enabled ? 'sound-toggle active-tab' : 'sound-toggle'} title={`${interfaceSounds.enabled ? 'Mute' : 'Enable'} FORGE system sounds`} onClick={interfaceSounds.toggle}>{interfaceSounds.enabled ? '◉ Sound' : '○ Sound'}</button><button title="Open home directory as workspace" onClick={openHomeWorkspace}>Home</button><button title="Open workspace (⌘/Ctrl+O)" onClick={openWorkspace}>Open workspace</button><button disabled={!workspace} onClick={() => createEntry('file')}>New file</button><button title="Save (⌘/Ctrl+S)" disabled={!active || content === savedContent} onClick={save}>Save</button><button disabled={!selectedNode} className="danger" onClick={deleteActive}>Delete</button></div></header>
    {settingsOpen && <SettingsModal initialSection={settingsOpen} onClose={() => setSettingsOpen(null)} />}
    {error && <div className="notice"><span>{error}</span><button onClick={() => setError(null)}>×</button></div>}
    {!workspace ? <section className="welcome"><div><ForgeBrand /><p className="eyebrow">LOCAL-FIRST INTELLIGENT WORKSPACE</p><h1>Think in files.<br />Build with context.</h1><p>FORGE keeps your notes, source code, Git history, conversations, and durable project memory in one private desktop workspace.</p><div className="welcome-actions"><button className="primary" onClick={openWorkspace}>Open a project folder</button><button onClick={openHomeWorkspace}>Open home directory</button></div></div></section> : <section className="workspace-grid" style={gridStyle}>
      <aside className="explorer"><div className="panel-title"><span>EXPLORER</span><div className="explorer-actions"><button title="Refresh file tree" onClick={() => void refresh()}>↻</button><button title="Show hidden files" className={showHidden ? 'active-tab' : ''} onClick={() => setShowHidden((value) => !value)}>Hidden</button><button title="New file (⌘/Ctrl+N)" onClick={() => createEntry('file')}>＋</button><button title="New folder (⌘/Ctrl+Shift+N)" onClick={() => createEntry('directory')}>▰</button><button title="Paste (⌘/Ctrl+V)" disabled={!clipboardNode} onClick={() => void pasteNode()}>Paste</button></div></div><FileTree nodes={files} active={selectedPath ?? active?.relativePath} expanded={expandedFolders} onToggle={toggleFolder} onOpen={openFile} onSelect={setSelectedPath} onContextMenu={handleContextMenu} /></aside>
      {contextMenu && <div className="explorer-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}><strong>{contextMenu.node.name}</strong><button onClick={() => contextMenu.node.type === 'directory' ? toggleFolder(contextMenu.node) : void openFile(contextMenu.node)}>Open</button><button onClick={() => createEntry('file')}>New file here</button><button onClick={() => createEntry('directory')}>New folder here</button><button onClick={() => copyNode(contextMenu.node)}>Copy</button><button disabled={!clipboardNode} onClick={() => void pasteNode(contextMenu.node)}>Paste into</button><button onClick={() => renameNode(contextMenu.node)}>Rename</button><button className="danger" onClick={() => void deleteNode(contextMenu.node)}>Delete</button></div>}
      <ResizeHandle axis="x" label="Resize Explorer" className="explorer-resizer" onDelta={(delta) => setLayout((current) => fitLayout({ ...current, explorerWidth: current.explorerWidth + delta }, window.innerWidth, window.innerHeight))} />
      <section className="editor-area">{browserOpen ? <BrowserPanel /> : <><div className="tabbar">{active ? <><span>{active.name}{content !== savedContent ? ' •' : ''}</span>{metadata && <small>{metadata.kind} · {metadata.mimeType} · {metadata.size.toLocaleString()} bytes</small>}<button onClick={() => setPreview(!preview)}>{preview ? 'Edit' : 'Preview'}</button></> : <span>Choose a file to start</span>}</div>{mediaPreview?.mimeType.startsWith('image/') && <img src={mediaPreview.dataUrl} alt={mediaPreview.path} style={{ maxWidth: '100%', maxHeight: 'calc(100% - 44px)', objectFit: 'contain' }} />}{mediaPreview?.mimeType.startsWith('audio/') && <audio controls src={mediaPreview.dataUrl} style={{ width: '90%', margin: '40px' }} />}{mediaPreview?.mimeType.startsWith('video/') && <video controls src={mediaPreview.dataUrl} style={{ maxWidth: '100%', maxHeight: 'calc(100% - 44px)' }} />}{active && !mediaPreview ? preview && active.extension === 'md' ? <article className="markdown-preview" dangerouslySetInnerHTML={renderMarkdown} /> : <Editor key={active.relativePath} height="100%" theme="vs-dark" language={languageFor(active.extension, active.name)} value={content} onMount={mountEditor} onChange={(value) => setContent(value ?? '')} options={{ minimap: { enabled: false }, fontSize: 14, padding: { top: 18 }, wordWrap: 'on', automaticLayout: true }} /> : !active ? <div className="empty-editor">Select a file to start.</div> : null}</>}</section>
      <ResizeHandle axis="x" label="Resize workspace intelligence" className="intelligence-resizer" onDelta={(delta) => setLayout((current) => fitLayout({ ...current, intelligenceWidth: current.intelligenceWidth - delta }, window.innerWidth, window.innerHeight))} />
      <aside className="intelligence-panel">
        <div className="workspace-context"><div className="panel-title">INTELLIGENCE LAYER <span className="telemetry-live">LIVE</span></div><div className="dashboard-scroll"><IntelligenceVisualizer dashboard={dashboard} telemetry={telemetry} /><Metric label="Active context" value={`${((dashboard?.contextHealth.tokensUsed ?? 0) / 1000).toFixed(1)}k / ${((dashboard?.contextHealth.tokenBudget ?? 32000) / 1000).toFixed(0)}k`} /><Metric label="Relevance" value={`${Math.round((dashboard?.contextHealth.relevance ?? 0) * 100)}%`} /><Metric label="Freshness" value={`${Math.round((dashboard?.contextHealth.freshness ?? 0) * 100)}%`} /><Metric label="Authority" value={`${Math.round((dashboard?.contextHealth.authority ?? 0) * 100)}%`} /><Metric label="Redundancy" value={`${Math.round((dashboard?.contextHealth.redundancy ?? 0) * 100)}%`} /><Metric label="Stale context" value={`${Math.round((dashboard?.contextHealth.staleRatio ?? 0) * 100)}%`} /><Metric label="Artifacts" value={`${dashboard?.contextHealth.recordsSelected ?? 0} / ${dashboard?.contextHealth.recordsConsidered ?? 0}`} />{dashboard?.contextHealth.fallbackReason && <p className="muted semantic-state">Semantic discovery: {dashboard.contextHealth.fallbackReason}</p>}<section className="list-section context-sources"><h3>Active artifact context</h3>{dashboard?.contextSources.length ? dashboard.contextSources.map((source) => <article key={source.id}><div><b>{source.title}</b><small>{source.kind}{typeof source.relevance === 'number' ? ` · ${Math.round(source.relevance > 1 ? source.relevance : source.relevance * 100)}% relevant` : ''}</small>{source.reason && <em>{source.reason}</em>}</div></article>) : <p className="muted">No context packet assembled yet.</p>}</section><section className="list-section"><div><h3>Goals</h3><button aria-label="Create goal" onClick={() => setTextPrompt({ kind: 'create-goal' })}>+</button></div>{dashboard?.project?.goals.length ? dashboard.project.goals.map((goal) => <p key={goal.id}>○ {goal.title}</p>) : <p className="muted">No goals yet.</p>}</section><section className="list-section"><div><h3>Tasks</h3><button aria-label="Create task" onClick={() => setTextPrompt({ kind: 'create-task' })}>+</button></div>{dashboard?.project?.tasks.length ? dashboard.project.tasks.map((task) => <p key={task.id}>□ {task.title}</p>) : <p className="muted">No tasks yet.</p>}</section><section className="list-section"><h3>Recent commits</h3>{dashboard?.recentCommits.length ? dashboard.recentCommits.slice(0, 4).map((entry) => <p key={entry.hash}><code>{entry.shortHash}</code> {entry.message}</p>) : <p className="muted">No commits available.</p>}</section><MemoryPanel workspaceKey={workspace.rootPath} /></div></div>
        <ResizeHandle axis="y" label="Resize context and chat" className="context-resizer" onDelta={(delta) => setLayout((current) => fitLayout({ ...current, contextHeight: current.contextHeight + delta }, window.innerWidth, window.innerHeight))} />
        <ChatPanel workspaceKey={workspace.rootPath} />
      </aside>
      <ResizeHandle axis="y" label="Resize source control" className="git-resizer" onDelta={(delta) => setLayout((current) => fitLayout({ ...current, bottomHeight: current.bottomHeight - delta }, window.innerWidth, window.innerHeight))} />
      <section className="git-panel"><div className="panel-title"><button className={bottomView === 'source' ? 'active-tab' : ''} onClick={() => setBottomView('source')}>SOURCE CONTROL</button><button className={bottomView === 'tasks' ? 'active-tab' : ''} onClick={() => setBottomView('tasks')}>TASKS</button><button className={bottomView === 'terminal' ? 'active-tab' : ''} onClick={() => setBottomView('terminal')}>TERMINAL</button><button className={bottomView === 'actions' ? 'active-tab' : ''} onClick={() => setBottomView('actions')}>AGENT ACTIONS</button><span>{bottomView === 'source' ? status?.branch ?? 'Not a Git repository' : bottomView === 'terminal' ? 'User-entered commands' : bottomView === 'tasks' ? 'Workspace-owned durable execution' : 'Autonomous execution activity'}</span>{bottomView === 'source' && <><button onClick={() => void runGitAction('git.pull')}>Pull</button><button onClick={() => void runGitAction('git.push')}>Push</button></>}</div>{bottomView === 'source' ? <div className="git-content"><div className="changes">{status?.files.length ? status.files.map((file) => <button key={file.path} onClick={() => stage(file.path)}><b>{file.indexStatus}{file.workingStatus}</b>{file.path}</button>) : <p className="muted">Working tree clean.</p>}</div><div className="commit"><input value={commitMessage} onChange={(event) => setCommitMessage(event.target.value)} placeholder="Commit message" /><button disabled={!commitMessage.trim()} onClick={commit}>Commit</button></div><pre className="diff">{diff?.files.flatMap((file) => file.lines.map((line) => `${line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : ' '} ${line.content}`)).join('\n') || 'Select a changed file to stage and inspect changes.'}</pre></div> : bottomView === 'tasks' ? <TaskPanel workspaceKey={workspace.rootPath} onOpenAudit={() => setBottomView('actions')} /> : bottomView === 'actions' ? <ToolPanel workspaceKey={workspace.rootPath} /> : null}<div className={bottomView === 'terminal' ? 'bottom-terminal-view active' : 'bottom-terminal-view'} aria-hidden={bottomView !== 'terminal'}><TerminalPanel workspaceKey={workspace.rootPath} /></div></section>
    </section>}
    {textPrompt && <TextInputDialog
      title={textPrompt.kind === 'create-entry' ? `New ${textPrompt.entryType}` : textPrompt.kind === 'rename-entry' ? `Rename ${textPrompt.node.name}` : textPrompt.kind === 'create-goal' ? 'New goal' : 'New task'}
      label={textPrompt.kind === 'create-entry' ? 'Name or workspace-relative path' : textPrompt.kind === 'rename-entry' ? 'New name' : 'Title'}
      confirmLabel={textPrompt.kind === 'rename-entry' ? 'Rename' : 'Create'}
      initialValue={textPrompt.kind === 'rename-entry' ? textPrompt.node.name : ''}
      busy={textPromptBusy}
      onCancel={() => setTextPrompt(null)}
      onSubmit={submitTextPrompt}
    />}
  </main>;
}

function ResizeHandle({ axis, className, label, onDelta }: { axis: 'x' | 'y'; className: string; label: string; onDelta: (delta: number) => void }): JSX.Element {
  const start = (event: ReactPointerEvent<HTMLDivElement>): void => {
    event.preventDefault();
    let previous = axis === 'x' ? event.clientX : event.clientY;
    const move = (pointer: PointerEvent): void => { const next = axis === 'x' ? pointer.clientX : pointer.clientY; onDelta(next - previous); previous = next; };
    const stop = (): void => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('blur', stop);
      document.body.classList.remove('resizing-x', 'resizing-y');
    };
    document.body.classList.add(axis === 'x' ? 'resizing-x' : 'resizing-y');
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('blur', stop);
  };
  return <div className={`resize-handle ${axis === 'x' ? 'vertical' : 'horizontal'} ${className}`} role="separator" aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'} aria-label={label} onPointerDown={start} />;
}

function Metric({ label, value }: { label: string; value: number | string }): JSX.Element { return <div className="metric"><span>{label}</span><strong>{value}</strong></div>; }
function FileTree({ nodes, active, expanded, onToggle, onOpen, onSelect, onContextMenu }: { nodes: FileNode[]; active?: string; expanded: ReadonlySet<string>; onToggle: (node: FileNode) => void; onOpen: (node: FileNode) => void; onSelect: (path: string) => void; onContextMenu: (event: ReactMouseEvent<HTMLDivElement>, node: FileNode) => void }): JSX.Element {
  return <ul className="file-tree">{nodes.map((node) => {
    const open = node.type === 'directory' && expanded.has(node.relativePath);
    return <li key={node.relativePath}>
      <div className={`file-tree-row ${active === node.relativePath ? 'selected' : ''}`} onContextMenu={(event) => onContextMenu(event, node)}>
        {node.type === 'directory' ? <button className="tree-toggle" aria-label={`${open ? 'Collapse' : 'Expand'} ${node.name}`} onClick={() => onToggle(node)}>{open ? '⌄' : '›'}</button> : <span className="tree-spacer" />}
        <button className="tree-label" onClick={() => { onSelect(node.relativePath); if (node.type === 'directory') onToggle(node); else void onOpen(node); }}>{node.name}</button>
      </div>
      {open && node.children ? <FileTree nodes={node.children} active={active} expanded={expanded} onToggle={onToggle} onOpen={onOpen} onSelect={onSelect} onContextMenu={onContextMenu} /> : null}
    </li>;
  })}</ul>;
}
