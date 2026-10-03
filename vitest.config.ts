import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: { environment: 'node', include: ['packages/**/test/**/*.test.ts', 'apps/desktop/src/**/*.test.ts'] },
  resolve: { alias: { '@forge/ipc': resolve('packages/ipc/src'), '@forge/workspace': resolve('packages/workspace/src'), '@forge/git': resolve('packages/git/src'), '@forge/storage': resolve('packages/storage/src'), '@forge/agent-tools': resolve('packages/agent-tools/src'), '@forge/tool-runtime': resolve('packages/tool-runtime/src'), '@forge/shell': resolve('packages/shell/src'), '@forge/web': resolve('packages/web/src') } }
});
