import { describe, expect, it } from 'vitest';
import { localUpdateCommand } from './update-command';

describe('localUpdateCommand', () => {
  it('uses the current FORGE checkout for each native platform', () => {
    const environment = { FORGE_SOURCE_DIR: '/work/FORGE' };

    expect(localUpdateCommand('linux', environment)).toMatchObject({
      command: 'npm',
      arguments: ['run', 'update:linux'],
      cwd: '/work/FORGE',
    });
    expect(localUpdateCommand('darwin', environment)).toMatchObject({ arguments: ['run', 'update:macos'] });
    expect(localUpdateCommand('win32', environment)).toMatchObject({ command: 'npm.cmd', arguments: ['run', 'update:windows'] });
  });

  it('uses the sibling FORGE-OS checkout for a Linux FORGE-OS session', () => {
    expect(localUpdateCommand('linux', {
      FORGE_OS_SESSION: '1',
      FORGE_OS_SOURCE_DIR: '/work/FORGE-OS',
    })).toMatchObject({
      command: 'bash',
      arguments: ['update.sh'],
      cwd: '/work/FORGE-OS',
    });
  });
});
