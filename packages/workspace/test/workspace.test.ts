import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { classifyFile, shouldWatchRecursively, WorkspaceService } from '../src';

describe('WorkspaceService state', () => {
  it('does not recursively watch home or its ancestors on launch', () => {
    expect(shouldWatchRecursively('/Users/example', '/Users/example')).toBe(false);
    expect(shouldWatchRecursively('/Users', '/Users/example')).toBe(false);
    expect(shouldWatchRecursively('/', '/Users/example')).toBe(false);
    expect(shouldWatchRecursively('/Users/example/Dev/project', '/Users/example')).toBe(true);
  });
  it('preserves opened Git and creation metadata in subsequent info reads', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'forge-workspace-info-'));
    try {
      await fs.mkdir(join(root, '.git'));
      const service = new WorkspaceService();
      const opened = await service.open(root);
      expect(service.info()).toEqual(opened);
      expect(service.info()?.gitRoot).toBe(join(root, '.git'));
      await service.close();
      expect(service.info()).toBeNull();
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('recursively lists and edits any UTF-8 text file, then copies it without overwrite', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'forge-workspace-files-'));
    try {
      const service = new WorkspaceService();
      await service.open(root);
      await service.create('src/nested', 'directory');
      await service.writeFile('src/nested/module.toml', 'title = "FORGE"\n');
      const tree = await service.list();
      expect(tree[0]?.children?.[0]?.children?.[0]?.relativePath).toBe('src/nested/module.toml');
      expect((await service.readFile('src/nested/module.toml')).content).toContain('FORGE');
      await service.copy('src/nested/module.toml', 'src/nested/module copy.toml');
      expect((await service.readFile('src/nested/module copy.toml')).content).toContain('FORGE');
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('keeps a home-sized workspace usable when protected and container-backed paths are present', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'forge-workspace-home-'));
    const protectedDirectory = join(root, 'protected');
    try {
      await fs.writeFile(join(root, 'visible.txt'), 'visible');
      await fs.mkdir(join(root, '.local', 'share', 'containers', 'storage', 'overlay'), { recursive: true });
      await fs.writeFile(join(root, '.local', 'share', 'containers', 'storage', 'overlay', 'container.txt'), 'skip');
      await fs.mkdir(protectedDirectory);
      if (process.platform !== 'win32') await fs.chmod(protectedDirectory, 0o000);
      const service = new WorkspaceService();
      await service.open(root);
      const tree = await service.list();
      expect(tree.some((entry) => entry.name === 'visible.txt')).toBe(true);
      expect(JSON.stringify(tree)).not.toContain('container.txt');
      if (process.platform !== 'win32') expect(tree.find((entry) => entry.name === 'protected')?.children).toEqual([]);
    } finally {
      if (process.platform !== 'win32') await fs.chmod(protectedDirectory, 0o700).catch(() => undefined);
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('supports bounded shallow listing for a lazy home explorer', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'forge-workspace-lazy-'));
    try {
      await fs.mkdir(join(root, 'parent', 'child'), { recursive: true });
      await fs.writeFile(join(root, 'parent', 'child', 'deep.txt'), 'deep');
      const service = new WorkspaceService();
      await service.open(root);
      const rootEntries = await service.list('', { recursive: false });
      expect(rootEntries.find((entry) => entry.name === 'parent')?.children).toBeUndefined();
      expect(rootEntries.find((entry) => entry.name === 'parent')?.modifiedAt).toBe(0);
      const parentEntries = await service.list('parent', { recursive: false });
      expect(parentEntries.map((entry) => entry.name)).toEqual(['child']);
      const bounded = await service.list('', { maxEntries: 1 });
      expect(JSON.stringify(bounded)).not.toContain('deep.txt');
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('shows hidden entries only when requested and classifies media and executables', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'forge-workspace-hidden-'));
    try {
      await fs.writeFile(join(root, '.env'), 'SECRET=false\n'); await fs.writeFile(join(root, 'pixel.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      const service = new WorkspaceService(); await service.open(root);
      expect((await service.list()).some((entry) => entry.name === '.env')).toBe(false);
      expect((await service.list('', { showHidden: true })).some((entry) => entry.name === '.env')).toBe(true);
      await expect(service.metadata('pixel.png')).resolves.toMatchObject({ kind: 'image', mimeType: 'image/png', signature: '89 50 4e 47 00 00 00 00' });
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });

  it('returns binary files as base64 while preserving metadata access', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'forge-workspace-binary-'));
    try {
      await fs.writeFile(join(root, 'sample.bin'), Buffer.from([0, 1, 2, 255]));
      const service = new WorkspaceService(); await service.open(root);
      await expect(service.readFile('sample.bin')).resolves.toMatchObject({ content: 'AAEC/w==', encoding: 'base64', binary: true });
      await expect(service.metadata('sample.bin')).resolves.toMatchObject({ kind: 'binary', size: 4 });
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });

  it('refuses oversized direct reads before allocating the complete file', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'forge-workspace-read-bound-'));
    try {
      await fs.writeFile(join(root, 'oversized.log'), '');
      await fs.truncate(join(root, 'oversized.log'), (32 * 1024 * 1024) + 1);
      const service = new WorkspaceService(); await service.open(root);
      await expect(service.readFile('oversized.log')).rejects.toThrow(/limited to 32 MB/);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });

  it('classifies source and configuration files as text even with an ambiguous MIME type', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'forge-workspace-text-classification-'));
    try {
      const source = 'import { something } from "./something";\nexport const answer = 42;\n';
      await fs.writeFile(join(root, 'agent.ts'), source);
      await fs.writeFile(join(root, 'component.tsx'), 'export const View = () => <div>FORGE</div>;\n');
      await fs.writeFile(join(root, 'module.js'), 'export default 1;\n');
      await fs.writeFile(join(root, 'module.mjs'), 'export default 2;\n');
      await fs.writeFile(join(root, 'module.cjs'), 'module.exports = 3;\n');
      await fs.writeFile(join(root, 'notes.txt'), 'plain text\n');
      await fs.writeFile(join(root, 'README.md'), '# FORGE\n');
      await fs.writeFile(join(root, 'settings.json'), '{ "enabled": true }\n');
      await fs.writeFile(join(root, 'pipeline.yaml'), 'steps:\n  - test\n');
      await fs.writeFile(join(root, '.env'), 'FORGE_TEST=true\n');
      const service = new WorkspaceService(); await service.open(root);
      for (const name of ['agent.ts', 'component.tsx', 'module.js', 'module.mjs', 'module.cjs', 'notes.txt', 'README.md', 'settings.json', 'pipeline.yaml', '.env']) {
        await expect(service.metadata(name)).resolves.toMatchObject({ kind: 'text', text: true });
      }
      await expect(service.readFile('agent.ts')).resolves.toMatchObject({ content: source });
      expect(classifyFile({ extension: 'ts', mimeType: 'application/octet-stream', sample: Buffer.from(source), executable: false }).kind).toBe('text');
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });

  it('keeps executable shell scripts executable while opening them as text', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'forge-workspace-script-'));
    try {
      const script = '#!/usr/bin/env bash\necho "hello"\n';
      await fs.writeFile(join(root, 'script.sh'), script);
      if (process.platform !== 'win32') await fs.chmod(join(root, 'script.sh'), 0o755);
      const service = new WorkspaceService(); await service.open(root);
      await expect(service.metadata('script.sh')).resolves.toMatchObject({ kind: process.platform === 'win32' ? 'text' : 'executable', executable: process.platform === 'win32' ? false : true, text: true });
      await expect(service.readFile('script.sh')).resolves.toMatchObject({ content: script });
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });

  it('classifies valid UTF-8 with an unknown extension as text', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'forge-workspace-unknown-text-'));
    try {
      await fs.writeFile(join(root, 'notes.data'), 'こんにちは FORGE — textual data\n');
      const service = new WorkspaceService(); await service.open(root);
      await expect(service.metadata('notes.data')).resolves.toMatchObject({ kind: 'text', text: true, mimeType: 'application/octet-stream' });
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });

  it('keeps binary files binary when they contain NUL bytes', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'forge-workspace-real-binary-'));
    try {
      await fs.writeFile(join(root, 'payload.data'), Buffer.from([0x7f, 0x00, 0xff, 0x10, 0x01]));
      const service = new WorkspaceService(); await service.open(root);
      await expect(service.metadata('payload.data')).resolves.toMatchObject({ kind: 'binary', text: false });
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });

  it('allows media previews larger than the legacy limit and preserves audio classification', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'forge-workspace-audio-'));
    try {
      await fs.writeFile(join(root, 'track.mp3'), Buffer.alloc(26 * 1024 * 1024, 0));
      const service = new WorkspaceService(); await service.open(root);
      await expect(service.metadata('track.mp3')).resolves.toMatchObject({ kind: 'audio', mimeType: 'audio/mpeg' });
      await expect(service.preview('track.mp3')).resolves.toMatchObject({ mimeType: 'audio/mpeg', dataUrl: expect.stringContaining('data:audio/mpeg;base64,') });
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });
});
