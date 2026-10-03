import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { IPC_CHANNELS } from '@forge/ipc';

const rendererRoot = dirname(fileURLToPath(import.meta.url));
const files = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const target = join(directory, entry.name);
  if (entry.isDirectory()) return files(target);
  return entry.name.endsWith('.tsx') ? [target] : [];
});

describe('renderer control routing', () => {
  it('routes every visible button through a click handler or form submission', () => {
    const unrouted: string[] = [];
    for (const file of files(rendererRoot)) {
      const source = readFileSync(file, 'utf8');
      const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (node: ts.Node): void => {
        if (ts.isJsxElement(node) && node.openingElement.tagName.getText(parsed) === 'button') {
          const attributes = node.openingElement.attributes.properties.filter(ts.isJsxAttribute);
          const click = attributes.some((attribute) => attribute.name.getText(parsed) === 'onClick');
          const submit = attributes.some((attribute) => attribute.name.getText(parsed) === 'type' && attribute.initializer?.getText(parsed).replaceAll(/["']/g, '') === 'submit');
          if (!click && !submit) unrouted.push(`${file}:${parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line + 1}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(parsed);
    }
    expect(unrouted).toEqual([]);
  });

  it('uses in-app text dialogs and allowlisted IPC for creation actions', () => {
    const app = readFileSync(join(rendererRoot, 'App.tsx'), 'utf8');
    const workspaceOpening = readFileSync(join(rendererRoot, 'workspace-opening.ts'), 'utf8');
    const taskPanel = readFileSync(join(rendererRoot, 'components', 'TaskPanel.tsx'), 'utf8');
    const chatPanel = readFileSync(join(rendererRoot, 'components', 'ChatPanel.tsx'), 'utf8');
    expect(`${app}\n${taskPanel}\n${chatPanel}`).not.toContain('window.prompt');
    expect(app).toContain("forgeInvoke('file.create'");
    expect(app).toContain("forgeInvoke('meta.goal.create'");
    expect(app).toContain("forgeInvoke('meta.task.create'");
    expect(app).toContain("openWorkspaceFrom('workspace.open.home'");
    expect(app).toContain('className="workspace-actions"');
    expect(app).toContain('title="Open workspace (⌘/Ctrl+O)"');
    expect(workspaceOpening).toContain("'workspace.info'");
    expect(Object.values(IPC_CHANNELS)).toEqual(expect.arrayContaining(['file.create', 'meta.goal.create', 'meta.task.create', 'workspace.open.home']));
  });
});
