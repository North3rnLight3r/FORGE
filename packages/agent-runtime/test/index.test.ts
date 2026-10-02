import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { HermesRuntimeDetector, discoverSkills, hermesIntegrationMode, parseSkillMetadata, platformCapabilities, resolveAgentRuntime, skillRootsForWorkspace } from '../src/index';

describe('Hermes runtime integration boundary', () => {
  it('keeps native FORGE available when Hermes is absent', async () => {
    const status = await new HermesRuntimeDetector().status({ command: 'missing-hermes-forge-test', execute: async () => { throw new Error('not found'); } });
    expect(status.availability).toBe('unavailable');
    expect(resolveAgentRuntime('hermes', status)).toMatchObject({ requested: 'hermes', active: 'native' });
  });
  it('detects a headless Hermes CLI without treating it as workspace authority', async () => {
    let receivedArgs: string[] = [];
    const status = await new HermesRuntimeDetector().status({ command: 'hermes', execute: async (_command, args) => { receivedArgs = args; return { stdout: 'Hermes 1.2.3\n', stderr: '' }; } });
    expect(status).toMatchObject({ availability: 'available', version: 'Hermes 1.2.3' });
    expect(receivedArgs).toEqual(['--version']);
    expect(status.message).toContain('FORGE retains workspace state');
  });
  it('derives skill roots from a CLI-reported install location without hard-coded platform paths', async () => {
    const status = await new HermesRuntimeDetector().status({ command: 'hermes', execute: async () => ({ stdout: 'Hermes 1.2.3\nInstall directory: C:\\tools\\hermes-agent\n', stderr: '' }) });
    expect(status.installDirectory).toBe('C:\\tools\\hermes-agent');
  });
  it('discovers skill metadata progressively across workspace and global roots', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'forge-skills-'));
    const workspaceSkill = path.join(root, '.forge', 'skills', 'release'); const globalSkill = path.join(root, 'hermes', 'skills', 'research');
    await mkdir(workspaceSkill, { recursive: true }); await mkdir(globalSkill, { recursive: true });
    await writeFile(path.join(workspaceSkill, 'SKILL.md'), '---\nname: forge-release\ndescription: Release a FORGE workspace safely.\nplatforms: [windows, linux]\n---\n# Forge release\n');
    await writeFile(path.join(globalSkill, 'SKILL.md'), '# Research\n');
    const skills = await discoverSkills([{ path: path.join(root, '.forge', 'skills'), scope: 'workspace' }, { path: path.join(root, 'hermes', 'skills'), scope: 'global' }]);
    expect(skills.map((skill) => [skill.name, skill.scope])).toEqual([['forge-release', 'workspace'], ['Research', 'global']]);
    expect(skillRootsForWorkspace(root, { hermesRoots: [path.join(root, 'hermes', 'skills')], platform: 'win32' }).map((entry) => entry.scope)).toEqual(['workspace', 'repository', 'global']);
  });
  it('reads compatible frontmatter without loading a skill body into model context', () => {
    expect(parseSkillMetadata('---\nname: test\ndescription: Tiny test.\n---\n# Ignored title\nlong body', '/tmp/test/SKILL.md', 'workspace')).toMatchObject({ name: 'test', description: 'Tiny test.' });
  });
  it.each([
    ['linux', 'headless-http'],
    ['darwin', 'headless-http'],
    ['win32', 'headless-http']
  ] as const)('centralizes %s capability differences without changing workspace behavior', (platform, integrationMode) => {
    const status = { kind: 'hermes' as const, availability: 'available' as const, command: 'hermes', endpoint: 'http://127.0.0.1:9119', endpointReachable: true, skillRoots: [], message: 'ready' };
    expect(hermesIntegrationMode(platform, status)).toBe(integrationMode);
    expect(platformCapabilities({ platform, appDataPath: '/tmp/forge-data', resourcePath: '/tmp/forge-resources', hermesStatus: status, embeddingProviderAvailable: true, embeddingModelAvailable: true, semanticIndexHealthy: true, workspaceDatabaseHealthy: true })).toMatchObject({ platform, nativeRuntimeAvailable: true, hermesAvailable: true, hermesIntegrationMode: integrationMode, embeddingProviderAvailable: true, semanticIndexHealthy: true, toolRouterAvailable: true, workspaceDatabaseHealthy: true });
  });
  it('reports Hermes unavailable and preserves native runtime when a platform bridge cannot be reached', () => {
    const status = { kind: 'hermes' as const, availability: 'degraded' as const, command: 'hermes', endpointReachable: false, skillRoots: [], message: 'offline' };
    expect(hermesIntegrationMode('win32', status)).toBe('unavailable');
    expect(resolveAgentRuntime('hermes', status, false).active).toBe('native');
  });

  it('activates the Ollama bridge when the OpenAI-compatible models endpoint is reachable without a Hermes CLI', async () => {
    let requestedUrl = '';
    const status = await new HermesRuntimeDetector().status({
      command: 'missing-hermes-forge-test',
      endpoint: 'http://127.0.0.1:11434/v1',
      fetcher: async (url) => { requestedUrl = url.toString(); return new Response(JSON.stringify({ data: [{ id: 'llama3.2:3b' }] }), { status: 200 }); },
      execute: async () => { throw new Error('not found'); }
    });
    expect(requestedUrl).toBe('http://127.0.0.1:11434/v1/models');
    expect(status).toMatchObject({ availability: 'available', endpointReachable: true });
    expect(resolveAgentRuntime('hermes', status).active).toBe('hermes');
  });
});
