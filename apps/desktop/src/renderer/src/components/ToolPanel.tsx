import { useCallback, useEffect, useState, type JSX } from 'react';
import type { ActionLogView, Task, ToolCapabilityView, ToolRequestView, ToolResultView } from '@forge/ipc';
import { forgeInvoke, onRuntimeEvent } from '../forge';

const data = async <T,>(promise: ReturnType<typeof forgeInvoke>): Promise<T> => {
  const result = await promise;
  if (!result.success) throw new Error(result.error.message);
  return result.data as T;
};

export default function ToolPanel({ workspaceKey }: { workspaceKey: string }): JSX.Element {
  const [requests, setRequests] = useState<ToolRequestView[]>([]);
  const [actions, setActions] = useState<ActionLogView[]>([]);
  const [capabilities, setCapabilities] = useState<ToolCapabilityView[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [redirectInstruction, setRedirectInstruction] = useState('');
  const [selectedCapability, setSelectedCapability] = useState('');
  const [toolArguments, setToolArguments] = useState('{}');
  const [toolResult, setToolResult] = useState<ToolResultView | null>(null);
  const [runningRequestId, setRunningRequestId] = useState('');
  const [error, setError] = useState('');
  const [outcome, setOutcome] = useState('');
  const [tool, setTool] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const refresh = useCallback(async () => {
    try {
      const filters: { conversationId?: string; toolName?: string; success?: boolean; from?: number; to?: number } = {};
      if (outcome) filters.success = outcome === 'success';
      if (tool) filters.toolName = tool;
      if (conversationId) filters.conversationId = conversationId;
      if (fromDate) filters.from = new Date(`${fromDate}T00:00:00`).getTime();
      if (toDate) filters.to = new Date(`${toDate}T23:59:59.999`).getTime();
      const [nextRequests, nextActions, nextCapabilities, nextTasks] = await Promise.all([
        data<ToolRequestView[]>(forgeInvoke('tool.requests.list', undefined)),
        data<ActionLogView[]>(forgeInvoke('tool.actions.list', filters)),
        data<ToolCapabilityView[]>(forgeInvoke('tool.catalog', undefined)),
        data<Task[]>(forgeInvoke('tasks.list', undefined))
      ]);
      setRequests(nextRequests);
      setActions(nextActions);
      setCapabilities(nextCapabilities);
      setTasks(nextTasks);
      setSelectedTaskId((current) => current && nextTasks.some((task) => task.id === current) ? current : nextTasks.find((task) => !['completed', 'cancelled'].includes(task.status))?.id ?? nextTasks[0]?.id ?? '');
      setSelectedCapability((current) => current && nextCapabilities.some((entry) => entry.name === current) ? current : nextCapabilities.find((entry) => entry.available && entry.executorPresent)?.name ?? '');
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  }, [outcome, tool, conversationId, fromDate, toDate]);
  useEffect(() => {
    void refresh();
    return onRuntimeEvent((event) => {
      if (['tool.requested', 'tool.completed', 'agent.completed', 'context.invalidated'].includes(event.type)) void refresh();
    });
  }, [workspaceKey, refresh]);
  const cancel = async (requestId: string): Promise<void> => {
    try { await data<boolean>(forgeInvoke('tool.request.cancel', { requestId })); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  const stopAll = async (): Promise<void> => {
    try {
      setError('');
      const stopped = await data<{ toolsCancelled: number; tasksCancelled: number }>(forgeInvoke('agent.stop.all', undefined));
      setError(`Stop All completed: ${stopped.toolsCancelled} tool requests and ${stopped.tasksCancelled} tasks cancelled.`);
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  const runCapability = async (): Promise<void> => {
    const capability = capabilities.find((entry) => entry.name === selectedCapability);
    if (!capability?.available || !capability.executorPresent || !capability.providerVisible) return;
    const requestId = crypto.randomUUID();
    try {
      const parsedArguments = capability.name === 'task.redirect' ? { taskId: selectedTaskId, instruction: redirectInstruction } : JSON.parse(toolArguments) as unknown;
      if (capability.name === 'task.redirect' && (!selectedTaskId || !redirectInstruction.trim())) throw new Error('Select an active task and enter a redirect instruction.');
      setRunningRequestId(requestId); setToolResult(null); setError('');
      const result = await data<ToolResultView>(forgeInvoke('tool.execute', { requestId, toolName: capability.name, arguments: parsedArguments }));
      setToolResult(result);
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setRunningRequestId(''); }
  };
  const copy = async (value: unknown): Promise<void> => {
    try { await navigator.clipboard.writeText(JSON.stringify(value, null, 2)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  return <div className="tool-panel">
    <div className="tool-filters"><strong>AGENT ACTIONS</strong><button onClick={() => void stopAll()}>Stop All</button><input value={conversationId} onChange={(event) => setConversationId(event.target.value)} placeholder="Conversation ID" /><input value={tool} onChange={(event) => setTool(event.target.value)} placeholder="Tool" /><select value={outcome} onChange={(event) => setOutcome(event.target.value)}><option value="">All outcomes</option><option value="success">Success</option><option value="failure">Failure</option></select><input type="date" aria-label="From date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /><input type="date" aria-label="To date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></div>
    {error && <div className="terminal-error">{error}</div>}
    <section className="tool-capabilities"><h3>Registered capabilities</h3>{capabilities.length ? capabilities.map((capability) => <article key={capability.name}><header><b>{capability.name}</b><em>{capability.available ? 'available' : 'unavailable'}</em></header><p>{capability.purpose}</p><small>{capability.category} · {capability.sideEffect} · executor {capability.executorPresent ? 'ready' : 'missing'} · provider {capability.providerVisible ? 'visible' : 'hidden'} · {capability.cancellable ? 'cancellable' : 'not cancellable'}{capability.networkAccess ? ' · network-capable' : ''}</small>{capability.unavailableReason && <p className="terminal-error">{capability.unavailableReason}</p>}</article>) : <p className="muted">Capability catalog unavailable.</p>}</section>
    <section className="tool-runner"><h3>Run / Test Capability</h3><label>Capability<select value={selectedCapability} onChange={(event) => { setSelectedCapability(event.target.value); setToolResult(null); }}><option value="">Select an available capability</option>{capabilities.map((capability) => <option key={capability.name} value={capability.name} disabled={!capability.available || !capability.executorPresent || !capability.providerVisible}>{capability.name}{capability.available ? '' : ` · unavailable: ${capability.unavailableReason ?? 'not configured'}`}</option>)}</select></label>{capabilities.find((entry) => entry.name === selectedCapability) && <><p>{capabilities.find((entry) => entry.name === selectedCapability)?.purpose}</p><pre>{JSON.stringify(capabilities.find((entry) => entry.name === selectedCapability)?.inputSchema, null, 2)}</pre>{selectedCapability === 'task.redirect' ? <><label>Task<select value={selectedTaskId} onChange={(event) => setSelectedTaskId(event.target.value)}>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title} · {task.status}</option>)}</select></label><label>Redirect instruction<textarea value={redirectInstruction} onChange={(event) => setRedirectInstruction(event.target.value)} /></label></> : <label>Arguments (JSON)<textarea value={toolArguments} onChange={(event) => setToolArguments(event.target.value)} spellCheck={false} /></label>}<button disabled={Boolean(runningRequestId) || !capabilities.find((entry) => entry.name === selectedCapability)?.available} onClick={() => void runCapability()}>{runningRequestId ? 'Running…' : 'Run / Test'}</button>{runningRequestId && <button onClick={() => void cancel(runningRequestId)}>Cancel</button>}</>}{toolResult && <pre>{JSON.stringify(toolResult, null, 2)}</pre>}</section>
    <div className="tool-columns">
      <section><h3>Live execution</h3>{requests.length ? requests.map((request) => <article className="tool-request" key={request.id}><header><b>{request.toolName}</b><em>{request.state}</em></header><dl><dt>Reason</dt><dd>{request.reason}</dd><dt>Target</dt><dd>{request.target}</dd><dt>Working directory</dt><dd>{request.workingDirectory ?? 'Active workspace'}</dd><dt>Network</dt><dd>{request.networkAccess ? `Yes · ${request.externalDataDescription ?? 'request metadata only'}` : 'No'}</dd><dt>Expected effect</dt><dd>{request.expectedEffect}</dd></dl>{request.diff && <pre>{request.diff}</pre>}{request.state === 'running' && <button onClick={() => void cancel(request.id)}>Cancel running</button>}<button onClick={() => void copy(request)}>Copy request</button></article>) : <p className="muted">No agent tool activity in this runtime.</p>}</section>
      <section><h3>Persistent action log</h3>{actions.length ? actions.map((action) => <article className="action-row" key={action.id}><header><b>{action.toolName}</b><em>{action.success ? 'success' : 'failure'}</em></header><p>{action.resultSummary}</p><small>{new Date(action.timestamp).toLocaleString()} · {action.executionState} · {action.executionDurationMs} ms</small><button onClick={() => void copy(action)}>Copy</button></article>) : <p className="muted">No matching audited actions.</p>}</section>
    </div>
  </div>;
}
