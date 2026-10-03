import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };

describe('native lifecycle contract', () => {
  it('exposes one package, install, update, and uninstall target per platform', () => {
    expect(packageJson.scripts).toMatchObject({
      'package:linux': 'bash scripts/package-linux.sh',
      'package:windows': 'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-windows.ps1',
      'package:macos': 'bash scripts/package-macos.sh',
      'install:linux': 'bash scripts/install-linux.sh',
      'install:windows': 'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-windows.ps1',
      'install:macos': 'bash scripts/install-macos.sh',
      'update:linux': 'bash scripts/update-linux.sh',
      'update:windows': 'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/update-windows.ps1',
      'update:macos': 'bash scripts/update-macos.sh',
      'uninstall:linux': 'bash scripts/uninstall-linux.sh',
      'uninstall:windows': 'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/uninstall-windows.ps1',
      'uninstall:macos': 'bash scripts/uninstall-macos.sh',
    });
    for (const staleTarget of ['package:mac', 'package:mac:universal', 'package:mac:all', 'package:win', 'install:mac', 'update:mac', 'update:win']) {
      expect(packageJson.scripts).not.toHaveProperty(staleTarget);
    }
    expect(packageJson).not.toHaveProperty('build.publish');
    expect(packageJson).not.toHaveProperty('build.generateUpdatesFilesForAllChannels');
    expect(existsSync('update.sh')).toBe(false);
  });

  it('keeps update wrappers local-source-only', () => {
    for (const file of ['scripts/update-linux.sh', 'scripts/update-macos.sh', 'scripts/update-windows.ps1']) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(/git\s+(fetch|merge|reset)|electron-updater|github.*release/i);
    }
  });
});
