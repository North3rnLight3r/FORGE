import { homedir } from 'node:os';
import { join } from 'node:path';

export interface LocalUpdateCommand {
  command: string;
  arguments: string[];
  cwd: string;
  label: string;
}

export function localUpdateCommand(
  platform: NodeJS.Platform = process.platform,
  environment: NodeJS.ProcessEnv = process.env,
): LocalUpdateCommand {
  const forgeRoot = environment.FORGE_SOURCE_DIR?.trim() || join(homedir(), 'FORGE');
  if (platform === 'linux' && environment.FORGE_OS_SESSION === '1') {
    const osRoot = environment.FORGE_OS_SOURCE_DIR?.trim() || join(homedir(), 'FORGE-OS');
    return { command: 'bash', arguments: ['update.sh'], cwd: osRoot, label: 'bash update.sh' };
  }
  const npm = platform === 'win32' ? 'npm.cmd' : 'npm';
  const target = platform === 'win32' ? 'windows' : platform === 'darwin' ? 'macos' : 'linux';
  return { command: npm, arguments: ['run', `update:${target}`], cwd: forgeRoot, label: `npm run update:${target}` };
}
