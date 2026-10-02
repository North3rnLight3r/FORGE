import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import type { AppUpdateStatus, BrowserStateView } from '@forge/ipc';
import { forgeInvoke } from '../forge';
import ForgeBrand from './ForgeBrand';

const data = async <T,>(request: ReturnType<typeof forgeInvoke>): Promise<T> => {
  const result = await request;
  if (!result.success) throw new Error(result.error.message);
  return result.data as T;
};

const emptyState: BrowserStateView = { url: '', title: '', canGoBack: false, canGoForward: false, loading: false, showingHome: true, tabs: [], bookmarks: [], history: [] };
const normalizedUrl = (value: string): string => /^[a-z][a-z0-9+.-]*:/i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
const shortTitle = (value: string): string => value.length > 26 ? `${value.slice(0, 23)}…` : value;
const TabIcon = ({ type }: { type: 'add' | 'close' }): JSX.Element => type === 'add'
  ? <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
  : <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m4 4 8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;

export default function BrowserPanel(): JSX.Element {
  const surface = useRef<HTMLDivElement | null>(null);
  const [address, setAddress] = useState('');
  const [state, setState] = useState<BrowserStateView>(emptyState);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<'history' | 'bookmarks' | null>(null);
  const [update, setUpdate] = useState<AppUpdateStatus | null>(null);
  const applyState = useCallback((next: BrowserStateView): void => { setState(next); if (next.url) setAddress(next.url); }, []);
  const layout = useCallback(() => {
    const bounds = surface.current?.getBoundingClientRect();
    if (!bounds) return;
    void data<BrowserStateView>(forgeInvoke('browser.layout', { visible: true, bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } })).then(applyState).catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
  }, [applyState]);
  useEffect(() => {
    layout();
    const observer = new ResizeObserver(layout);
    if (surface.current) observer.observe(surface.current);
    window.addEventListener('resize', layout);
    return () => { observer.disconnect(); window.removeEventListener('resize', layout); void forgeInvoke('browser.layout', { visible: false }); };
  }, [layout]);
  useEffect(() => window.forge.onBrowserState(applyState), [applyState]);
  useEffect(() => { if (state.showingHome) void data<AppUpdateStatus>(forgeInvoke('app.update.status', undefined)).then(setUpdate).catch(() => undefined); }, [state.showingHome]);
  useEffect(() => {
    if (panel) { void forgeInvoke('browser.layout', { visible: false }); return; }
    layout();
  }, [panel, layout]);
  const invoke = async (channel: Parameters<typeof forgeInvoke>[0], request: any = undefined): Promise<void> => {
    try { applyState(await data<BrowserStateView>(forgeInvoke(channel as any, request))); setError(''); layout(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  const navigate = async (url = address): Promise<void> => invoke('browser.navigate', { url: normalizedUrl(url) });
  const checkForUpdates = async (): Promise<void> => {
    try { setUpdate(await data<AppUpdateStatus>(forgeInvoke('app.update.check', undefined))); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  const togglePanel = (next: 'history' | 'bookmarks'): void => setPanel((current) => current === next ? null : next);
  const newestVersion = update?.availableVersion ?? update?.currentVersion;
  const newestUpdateTitle = newestVersion ? `FORGE ${newestVersion}` : 'FORGE updates';
  const newestUpdateSummary = update?.message ?? 'Update status is ready to check.';
  return <div className="browser-panel">
    <div className="browser-tab-strip">
      <button className={state.showingHome ? 'active' : ''} onClick={() => void invoke('browser.home')} title="FORGE Browser home">⌂ Home</button>
      {state.tabs.map((tab) => <span key={tab.id} className={`browser-tab ${state.activeTabId === tab.id ? 'active' : ''}`}><button onClick={() => void invoke('browser.tab.select', { tabId: tab.id })} title={tab.title}>{tab.loading ? '◌ ' : ''}{shortTitle(tab.title)}</button><button className="browser-tab-close" onClick={() => void invoke('browser.tab.close', { tabId: tab.id })} aria-label={`Close ${tab.title}`}><TabIcon type="close" /></button></span>)}
      <button className="browser-tab-add" onClick={() => void invoke('browser.tab.new')} aria-label="Open a new browser tab"><TabIcon type="add" /></button>
    </div>
    <div className="browser-toolbar"><button disabled={!state.canGoBack} onClick={() => void invoke('browser.back')} aria-label="Back">←</button><button disabled={!state.canGoForward} onClick={() => void invoke('browser.forward')} aria-label="Forward">→</button><button disabled={state.showingHome} onClick={() => void invoke('browser.reload')} aria-label="Reload">↻</button><form onSubmit={(event) => { event.preventDefault(); void navigate(); }}><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Enter a public website" aria-label="Browser address" /><button className="accent" type="submit">Go</button></form><button className={panel === 'bookmarks' ? 'active' : ''} disabled={state.showingHome} onClick={() => void invoke('browser.bookmark.add')} title="Bookmark current page">★</button><button className={panel === 'bookmarks' ? 'active' : ''} onClick={() => togglePanel('bookmarks')}>Bookmarks</button><button className={panel === 'history' ? 'active' : ''} onClick={() => togglePanel('history')}>History</button></div>
    {(error || state.error) && <div className="terminal-error">{error || state.error}</div>}
    <div ref={surface} className="browser-surface">
      {state.showingHome && <section className="browser-home"><div className="browser-home-content"><ForgeBrand compact /><p className="eyebrow">PRIVATE WORKSPACE BROWSER</p><h2>Research in your own atmosphere.</h2><p>Open public research alongside your project without giving websites access to your files, shell, or credentials.</p><form onSubmit={(event) => { event.preventDefault(); void navigate(); }}><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Search or enter a public website" aria-label="Home browser address" /><button className="accent" type="submit">Open site</button></form><div className="browser-home-grid"><article><strong>Newest updates</strong><span>{newestUpdateTitle}</span><small>{newestUpdateSummary}</small><button onClick={() => void checkForUpdates()}>Check for updates</button></article><article><strong>Project</strong><span>Follow source, releases, issues, and release notes on GitHub.</span><button onClick={() => void navigate('https://github.com/North3rnLight3r/FORGE')}>Open FORGE on GitHub</button></article></div></div></section>}
      {panel && <aside className="browser-drawer"><header><strong>{panel === 'history' ? 'History' : 'Bookmarks'}</strong><button onClick={() => setPanel(null)}>×</button></header>{panel === 'history' ? state.history.length ? state.history.map((entry) => <button className="browser-record" key={entry.id} onClick={() => void navigate(entry.url)}><b>{entry.title || entry.url}</b><small>{entry.url} · {entry.visitCount} visit{entry.visitCount === 1 ? '' : 's'}</small></button>) : <p>No public pages visited in this workspace yet.</p> : state.bookmarks.length ? state.bookmarks.map((entry) => <div className="browser-record" key={entry.id}><button onClick={() => void navigate(entry.url)}><b>{entry.title || entry.url}</b><small>{entry.url}</small></button><button className="danger" onClick={() => void invoke('browser.bookmark.remove', { bookmarkId: entry.id })}>Remove</button></div>) : <p>Bookmark a public page to keep it with this workspace.</p>}</aside>}
    </div>
  </div>;
}
