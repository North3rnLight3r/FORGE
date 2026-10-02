import { app, shell } from 'electron';
import electronUpdater from 'electron-updater';
import { buildUpdatePolicy, isUpdateVersionEligible, type AppUpdateStatus } from '@forge/ipc';
import { GitHubReleaseDiscovery } from '@forge/updater';

const { autoUpdater } = electronUpdater;
const releasesUrl = 'https://github.com/North3rnLight3r/FORGE/releases';
const releaseDiscovery = new GitHubReleaseDiscovery({ owner: 'North3rnLight3r', repo: 'FORGE', platform: process.platform === 'win32' ? 'win32' : process.platform === 'linux' ? 'linux' : 'darwin' });
type ReleaseDiscovery = Pick<GitHubReleaseDiscovery, 'discover'>;

export class UpdaterService {
  private channel: 'stable' | 'beta' = 'stable';
  private updateStatus: AppUpdateStatus = {
    currentVersion: app.getVersion(),
    state: 'idle',
    message: 'Ready to check for updates.'
  };

  constructor(private readonly discovery: ReleaseDiscovery = releaseDiscovery) {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;
    autoUpdater.on('checking-for-update', () => this.setStatus('checking', 'Checking GitHub Releases for an update…'));
    autoUpdater.on('update-not-available', () => this.setStatus('not-available', 'FORGE is up to date.'));
    autoUpdater.on('download-progress', (progress) => this.setStatus('downloading', `Downloading update: ${Math.round(progress.percent)}%.`, this.updateStatus.availableVersion));
    autoUpdater.on('update-downloaded', (info) => this.setStatus('downloaded', `FORGE ${info.version} is ready. Restart to apply it.`, info.version));
    autoUpdater.on('error', (error) => this.setStatus('error', `Automatic update failed: ${error.message} Download the latest release manually.`));
  }

  setChannel(channel: 'stable' | 'beta'): void {
    this.channel = channel;
    const policy = buildUpdatePolicy(channel);
    autoUpdater.allowPrerelease = policy.allowPrerelease;
    autoUpdater.allowDowngrade = policy.allowDowngrade;
  }

  status(): AppUpdateStatus {
    return { ...this.updateStatus, currentVersion: app.getVersion() };
  }

  async check(): Promise<AppUpdateStatus> {
    if (!app.isPackaged) {
      const localUpdateCommand = process.platform === 'win32'
        ? 'npm run update:win'
        : process.platform === 'darwin'
          ? 'npm run update:mac'
          : './scripts/package-linux.sh';
      this.setStatus('development', `Update checks run only in the packaged app. Use ${localUpdateCommand} for this platform.`);
      return this.status();
    }
    try {
      this.setStatus('checking', 'Checking GitHub Releases for an update…');
      const policy = buildUpdatePolicy(this.channel);
      const selected = await this.discovery.discover(app.getVersion(), this.channel);
      if (!selected) {
        this.setStatus('not-available', 'FORGE is up to date. Older versions and releases outside the selected channel are never installed.');
        return this.status();
      }
      autoUpdater.setFeedURL({ provider: 'generic', url: selected.feedBaseUrl, channel: selected.feedChannel });
      autoUpdater.allowPrerelease = policy.allowPrerelease;
      autoUpdater.channel = selected.feedChannel;
      // electron-updater enables downgrade checks when its channel changes.
      // Provider feed selection never authorizes a version downgrade.
      autoUpdater.allowDowngrade = false;
      const result = await autoUpdater.checkForUpdates();
      const candidateVersion = result?.updateInfo.version;
      if (!candidateVersion || candidateVersion !== selected.version || !isUpdateVersionEligible(app.getVersion(), candidateVersion, this.channel)) {
        this.setStatus('not-available', 'FORGE is up to date. Older versions and releases outside the selected channel are never installed.');
        return this.status();
      }
      this.setStatus('available', `FORGE ${candidateVersion} is newer and will download now.`, candidateVersion);
      await autoUpdater.downloadUpdate();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown update error.';
      this.setStatus('error', `Automatic update failed: ${message} Download the latest release manually.`);
    }
    return this.status();
  }

  install(): void {
    if (this.updateStatus.state !== 'downloaded') throw new Error('No downloaded update is ready to install.');
    autoUpdater.quitAndInstall(false, true);
  }

  async openLatestRelease(): Promise<void> {
    await shell.openExternal(releasesUrl);
  }

  private setStatus(state: AppUpdateStatus['state'], message: string, availableVersion?: string): void {
    this.updateStatus = { currentVersion: app.getVersion(), state, message, availableVersion };
  }
}
