import { IPC_CHANNELS, type IPCChannel, type RuntimeEventType } from '@forge/ipc';

const TASK_MUTATIONS: IPCChannel[] = [
  IPC_CHANNELS.tasksCreate, IPC_CHANNELS.tasksUpdate, IPC_CHANNELS.tasksCreateRelease,
  IPC_CHANNELS.tasksDelete, IPC_CHANNELS.tasksPause, IPC_CHANNELS.tasksResume,
  IPC_CHANNELS.tasksCancel, IPC_CHANNELS.tasksRedirect, IPC_CHANNELS.tasksRetryStep, IPC_CHANNELS.tasksHandoff
];
const MEMORY_MUTATIONS: IPCChannel[] = [
  IPC_CHANNELS.agentMemoriesDelete, IPC_CHANNELS.agentMemoriesClear,
  IPC_CHANNELS.agentMemoriesReindex
];
const TERMINAL_LIFECYCLE_MUTATIONS: IPCChannel[] = [
  IPC_CHANNELS.terminalCreate, IPC_CHANNELS.terminalTerminate,
  IPC_CHANNELS.terminalRestart, IPC_CHANNELS.terminalRemove
];

export function eventForChannel(channel: IPCChannel): RuntimeEventType | null {
  if (['file.write', 'file.create', 'file.delete', 'file.rename', 'file.copy'].includes(channel)) return 'file.changed';
  if (['git.stage', 'git.unstage', 'git.commit', 'git.pull', 'git.push'].includes(channel)) return 'git.changed';
  if (TASK_MUTATIONS.includes(channel)) return 'task.changed';
  if (MEMORY_MUTATIONS.includes(channel)) return 'memory.changed';
  if (TERMINAL_LIFECYCLE_MUTATIONS.includes(channel)) return 'terminal.changed';
  if (channel === IPC_CHANNELS.workspaceOpen || channel === IPC_CHANNELS.workspaceOpenHome) return 'workspace.changed';
  return null;
}
