import { app, shell } from 'electron';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import type { AppUpdateStatus } from '@forge/ipc';
import { localUpdateCommand } from './update-command';

export { localUpdateCommand } from './update-command';

const releasesUrl = 'https://github.com/North3rnLight3r/FORGE/releases';

export class UpdaterService {
  private updateStatus: AppUpdateStatus = {
    currentVersion: app.getVersion(),
    state: 'idle',
    message: 'The local FORGE checkout is the update source.'
  };

  status(): AppUpdateStatus {
    return { ...this.updateStatus, currentVersion: app.getVersion() };
  }

  async check(): Promise<AppUpdateStatus> {
    const update = localUpdateCommand();
    if (!existsSync(update.cwd) || !(await this.sourceEntryExists(update))) {
      this.setStatus('error', `The current checkout was not found at ${update.cwd}. Pull or clone it, then run ${update.label}.`);
      return this.status();
    }
    this.setStatus('available', `Current checkout ready. ${update.label} will rebuild and install exactly that source.`);
    return this.status();
  }

  async install(): Promise<void> {
    if (this.updateStatus.state !== 'available') throw new Error('Check for a current checkout update first.');
    const update = localUpdateCommand();
    if (!existsSync(update.cwd) || !(await this.sourceEntryExists(update))) throw new Error(`The current checkout was not found at ${update.cwd}.`);
    const child = spawn(update.command, update.arguments, {
      cwd: update.cwd,
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, FORGE_UPDATE_PARENT_PID: String(process.pid) }
    });
    child.unref();
    child.once('error', (error) => this.setStatus('error', `Could not start ${update.label}: ${error.message}`));
    child.once('spawn', () => {
      this.setStatus('downloaded', `Installing the current checkout with ${update.label}. FORGE will close while the runtime is replaced.`);
      setTimeout(() => app.quit(), 100);
    });
  }

  async openLatestRelease(): Promise<void> {
    await shell.openExternal(releasesUrl);
  }

  private setStatus(state: AppUpdateStatus['state'], message: string, availableVersion?: string): void {
    this.updateStatus = { currentVersion: app.getVersion(), state, message, availableVersion };
  }

  private async sourceEntryExists(update: ReturnType<typeof localUpdateCommand>): Promise<boolean> {
    if (update.command === 'bash') return existsSync(join(update.cwd, update.arguments[0]));
    try {
      const manifest = JSON.parse(await readFile(join(update.cwd, 'package.json'), 'utf8')) as { scripts?: Record<string, string> };
      const script = update.arguments[1];
      return typeof script === 'string' && typeof manifest.scripts?.[script] === 'string';
    } catch {
      return false;
    }
  }
}
