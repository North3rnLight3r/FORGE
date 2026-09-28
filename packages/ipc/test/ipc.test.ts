import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { buildReleaseIdentity, buildUpdatePolicy, formatAppBuildInfo, IPC_CHANNELS, isUpdateVersionEligible, normalizeUpdateChannel } from '../src';

describe('IPC contract', () => {
  it('exposes agent channels', () => {
    expect(IPC_CHANNELS.agentAsk).toBe('agent.ask');
    expect(IPC_CHANNELS.agentExplainProject).toBe('agent.explainProject');
    expect(IPC_CHANNELS.agentReviewChanges).toBe('agent.reviewChanges');
  });

  it('keeps every canonical invoke channel unique, allowlisted in preload, and registered in the shared desktop main process', async () => {
    const channels = Object.entries(IPC_CHANNELS);
    expect(new Set(channels.map(([, value]) => value)).size).toBe(channels.length);

    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
    const [mainSource, preloadSource] = await Promise.all([
      readFile(path.join(repoRoot, 'apps/desktop/src/main/index.ts'), 'utf8'),
      readFile(path.join(repoRoot, 'apps/desktop/src/preload/index.ts'), 'utf8')
    ]);

    expect(preloadSource).toContain('Object.values(IPC_CHANNELS)');
    expect(preloadSource).toContain('ipcRenderer.invoke(channel, request)');
    for (const [key, channel] of channels) {
      expect(mainSource, `${channel} (${key}) is missing a main-process handler`).toMatch(new RegExp(`register\\(IPC_CHANNELS\\.${key}\\s*,`));
    }
  });

  it('gives every IPC capability a renderer surface or a documented intentional exception', async () => {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
    const rendererRoot = path.join(repoRoot, 'apps/desktop/src/renderer/src');
    const readRendererSources = async (directory: string): Promise<string[]> => {
      const entries = await readdir(directory, { withFileTypes: true });
      return (await Promise.all(entries.map(async (entry) => entry.isDirectory()
        ? readRendererSources(path.join(directory, entry.name))
        : /\.(ts|tsx)$/.test(entry.name) ? [await readFile(path.join(directory, entry.name), 'utf8')] : []))).flat();
    };
    const [rendererSource, audit] = await Promise.all([
      readRendererSources(rendererRoot).then((sources) => sources.join('\n')),
      readFile(path.join(repoRoot, 'docs/IPC_UI_CAPABILITY_AUDIT.md'), 'utf8')
    ]);
    const exceptions: Record<string, string> = {
      'markdown.parse': 'The editor renders Markdown locally',
      'git.branches': 'No branch-switching UI is intentionally exposed',
      'git.log': 'The dashboard supplies the bounded recent-commit view',
      'git.unstage': 'The current source-control view only stages files',
      'meta.goal.update': 'Goals are currently summary-only after creation',
      'meta.goal.delete': 'Goals are currently summary-only after creation',
      'settings.platform.capabilities': 'The settings UI presents runtime-specific availability',
      'context.health.get': 'The intelligence panel receives the same health fields through meta.dashboard',
      'agent.explainProject': 'The chat composer is the single user-directed entry point',
      'agent.reviewChanges': 'The chat composer is the single user-directed entry point',
      'agent.conversations.append': 'Conversation mutation is owned by agent.ask and the conversation controls',
      'terminal.remove': 'Terminal sessions remain available for their observable lifecycle',
      'tasks.get': 'The task panel uses the bounded workspace task list',
      'tasks.cancel': 'Stop All provides the currently exposed cancellation control',
      'tasks.redirect': 'The Agent Actions runner exposes task.redirect with task selection',
      'tasks.retry.step': 'Run / Resume Task owns retry progression',
      'forge-live.restart': 'Go Live exposes start and stop while running',
      'forge-live.copy-url': 'Open Preview is the exposed live-preview action',
      'forge-os.session.action': 'FORGE-OS routes session controls through reviewed desktop launchers'
    };
    for (const channel of Object.values(IPC_CHANNELS)) {
      const quoted = new RegExp(`['"]${channel.replace('.', '\\.')}['"]`);
      if (quoted.test(rendererSource)) continue;
      expect(exceptions, `${channel} has no renderer invocation or intentional exception`).toHaveProperty(channel);
      expect(audit, `${channel} exception is absent from the audit`).toContain(`\`${channel}\``);
      expect(audit, `${channel} exception reason drifted from the audit`).toContain(exceptions[channel]);
    }
  });

  it('exposes non-secret build diagnostics and copy channels', () => {
    expect(IPC_CHANNELS.appBuildInfo).toBe('app.build.info');
    expect(IPC_CHANNELS.appBuildInfoCopy).toBe('app.build.info.copy');
    expect(formatAppBuildInfo({
      version: '1.0.1',
      channel: 'stable',
      commit: 'abc123',
      buildDate: '2026-08-06T12:00:00.000Z',
      runtime: 'packaged',
      rendererSource: 'file:// packaged app.asar',
      platform: 'darwin',
      architecture: 'arm64'
    })).toContain('FORGE v1.0.1\nChannel: stable\nCommit: abc123');
  });

  it('selects development, beta, and stable release identities safely', () => {
    expect(buildReleaseIdentity('1.1.0-beta.1', false)).toEqual({ version: '1.1.0-beta.1-dev', channel: 'development' });
    expect(buildReleaseIdentity('1.1.0-beta.1', true)).toEqual({ version: '1.1.0-beta.1', channel: 'beta' });
    expect(buildReleaseIdentity('1.1.0', true)).toEqual({ version: '1.1.0', channel: 'stable' });
    expect(normalizeUpdateChannel('beta')).toBe('beta'); expect(normalizeUpdateChannel('preview')).toBe('beta'); expect(normalizeUpdateChannel('anything-else')).toBe('stable');
    expect(buildUpdatePolicy('stable')).toEqual({ allowPrerelease: false, allowDowngrade: false });
    expect(buildUpdatePolicy('beta')).toEqual({ allowPrerelease: true, allowDowngrade: false });
  });

  it('only permits forward updates that belong to the selected channel', () => {
    expect(isUpdateVersionEligible('1.0.1', '1.1.0-alpha.1', 'stable')).toBe(false);
    expect(isUpdateVersionEligible('1.0.1', '1.1.0-alpha.2', 'stable')).toBe(false);
    expect(isUpdateVersionEligible('1.0.1', '1.1.0-beta.1', 'stable')).toBe(false);
    expect(isUpdateVersionEligible('1.0.1', '1.1.0', 'stable')).toBe(true);
    expect(isUpdateVersionEligible('1.1.0-alpha.3', '1.1.0-beta.1', 'beta')).toBe(true);
    expect(isUpdateVersionEligible('1.1.0-beta.1', '1.1.0-beta.2', 'beta')).toBe(true);
    expect(isUpdateVersionEligible('1.1.0-beta.1', '1.2.0-alpha.1', 'beta')).toBe(false);
    expect(isUpdateVersionEligible('1.1.0-beta.1', '1.1.0-rc.1', 'beta')).toBe(true);
    expect(isUpdateVersionEligible('1.1.0-beta.1', '1.1.0', 'beta')).toBe(true);
    expect(isUpdateVersionEligible('1.1.0', '1.1.0-beta.2', 'beta')).toBe(false);
    expect(isUpdateVersionEligible('1.1.0-beta.1', '1.1.0-preview.3', 'beta')).toBe(false);
    expect(isUpdateVersionEligible('invalid', '1.1.0', 'beta')).toBe(false);
    expect(isUpdateVersionEligible('1.1.0', 'invalid', 'beta')).toBe(false);
  });
});
