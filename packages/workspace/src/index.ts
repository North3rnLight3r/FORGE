import { EventEmitter } from 'node:events';
import { promises as fs, watch as watchFs, type Dirent } from 'node:fs';
import { homedir } from 'node:os';
import * as path from 'node:path';
import type { DetectedFileKind, FileContent, FileMetadata, FileNode, ParsedMarkdown, WorkspaceInfo } from '@forge/ipc';

const IGNORED = new Set(['.git', 'node_modules', 'dist', 'out', 'build', '.next', '.forge', 'coverage', '__pycache__']);
const IGNORED_PATH_PATTERNS = [
  /(?:^|[/])\.local[/]share[/]containers(?:[/]|$)/i,
  /(?:^|[/])\.cache(?:[/]|$)/i,
  /(?:^|[/])\.npm(?:[/]|$)/i,
  /(?:^|[/])\.cargo[/]registry(?:[/]|$)/i,
  /(?:^|[/])\.rustup(?:[/]|$)/i
];
function isSkippableFileSystemError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && ['EACCES', 'EPERM', 'ENOENT'].includes(String(error.code));
}
function shouldIgnore(relativePath: string, showHidden = true): boolean {
  const normalized = relativePath.replaceAll('\\', '/');
  return normalized.split('/').some((part) => (part.startsWith('.') && !showHidden) || (IGNORED.has(part) && !(showHidden && part.startsWith('.')))) || IGNORED_PATH_PATTERNS.some((pattern) => pattern.test(normalized) && !showHidden);
}
export function shouldWatchRecursively(workspaceRoot: string, homeDirectory = homedir()): boolean {
  const root = path.resolve(workspaceRoot);
  const home = path.resolve(homeDirectory);
  return root !== home && root !== path.parse(root).root && !home.startsWith(`${root}${path.sep}`);
}
const mimeByExtension: Record<string, string> = {
  txt: 'text/plain', md: 'text/markdown', markdown: 'text/markdown', log: 'text/plain', csv: 'text/csv', ini: 'text/plain', conf: 'text/plain', env: 'text/plain',
  json: 'application/json', jsonc: 'application/json', yaml: 'application/yaml', yml: 'application/yaml', toml: 'application/toml', xml: 'application/xml',
  sh: 'text/x-shellscript', bash: 'text/x-shellscript', zsh: 'text/x-shellscript', fish: 'text/x-shellscript', ps1: 'text/x-powershell', bat: 'text/plain', cmd: 'text/plain',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac', m4a: 'audio/mp4', aac: 'audio/aac',
  mp4: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', mov: 'video/quicktime'
};
const textExtensions = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json', 'jsonc', 'md', 'markdown', 'txt', 'log', 'html', 'htm', 'css', 'scss', 'sass', 'less', 'xml', 'yaml', 'yml', 'toml', 'ini', 'conf', 'env', 'py', 'rb', 'php', 'java', 'kt', 'kts', 'c', 'h', 'cpp', 'hpp', 'cc', 'rs', 'go', 'swift', 'sql', 'graphql', 'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd']);
const textNames = new Set(['.env', '.env.local', '.env.example', '.gitignore', '.gitattributes', '.editorconfig', '.npmrc', '.yarnrc', 'dockerfile', 'makefile', 'readme', 'license', 'changelog']);
const CLASSIFICATION_SAMPLE_BYTES = 64 * 1024;
const MAX_EDITOR_FILE_BYTES = 32 * 1024 * 1024;
const MAX_MEDIA_PREVIEW_BYTES = 100 * 1024 * 1024;
type FileClassification = { kind: DetectedFileKind; text: boolean };
function isKnownTextFile(name: string, extension: string): boolean { return textExtensions.has(extension) || textNames.has(name.toLowerCase()) || name.toLowerCase().startsWith('.env.'); }
function isTextSample(sample: Buffer, knownText: boolean): boolean {
  if (sample.length === 0 || sample.includes(0)) return false;
  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(sample);
    if (decoded.startsWith('#!') || knownText) return true;
    let controls = 0;
    for (const character of decoded) { const code = character.codePointAt(0)!; if ((code < 32 && ![9, 10, 13, 12].includes(code)) || (code >= 0x7f && code <= 0x9f)) controls += 1; }
    return controls / Math.max(1, decoded.length) <= 0.02;
  } catch { return false; }
}
export function classifyFile(input: { name?: string; extension: string; mimeType: string; sample: Buffer; executable: boolean }): FileClassification {
  const extension = input.extension.toLowerCase(); const mimeType = input.mimeType.toLowerCase(); const knownText = isKnownTextFile(input.name ?? '', extension);
  if (mimeType.startsWith('image/')) return { kind: 'image', text: false };
  if (mimeType.startsWith('audio/')) return { kind: 'audio', text: false };
  if (mimeType.startsWith('video/')) return { kind: 'video', text: false };
  const text = input.sample.length === 0 ? knownText || mimeType.startsWith('text/') : isTextSample(input.sample, knownText || mimeType.startsWith('text/'));
  if (text) return { kind: input.executable ? 'executable' : 'text', text: true };
  return { kind: input.executable ? 'executable' : 'binary', text: false };
}
export function parseMarkdown(content: string): ParsedMarkdown {
  const frontmatter: Record<string, string | string[]> = {};
  const matched = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const body = matched ? content.slice(matched[0].length) : content;
  if (matched) for (const line of matched[1].split(/\r?\n/)) {
    const pair = line.match(/^([\w-]+):\s*(.+)$/);
    if (pair) frontmatter[pair[1]] = pair[2].startsWith('[') ? pair[2].slice(1, -1).split(',').map((item) => item.trim()).filter(Boolean) : pair[2].replace(/^['"]|['"]$/g, '');
  }
  const wikiLinks = [...body.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)].map((m) => m[1].trim());
  const tags: string[] = []; let fenced = false;
  for (const line of body.split(/\r?\n/)) { if (line.trim().startsWith('```')) { fenced = !fenced; continue; } if (!fenced) tags.push(...[...line.matchAll(/(?:^|\s)#([\w-]+)/g)].map((m) => m[1])); }
  const headings = [...body.matchAll(/^(#{1,6})\s+(.+)$/gm)].map((m) => ({ level: m[1].length, text: m[2].trim(), slug: m[2].trim().toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-') }));
  return { content: body, frontmatter, wikiLinks: [...new Set(wikiLinks)], tags: [...new Set(tags)], headings };
}

export class WorkspaceService extends EventEmitter {
  private rootPath: string | null = null;
  private realRoot: string | null = null;
  private workspaceInfo: WorkspaceInfo | null = null;
  private watcher?: ReturnType<typeof watchFs>;

  async open(rootPath: string): Promise<WorkspaceInfo> {
    const stat = await fs.stat(rootPath); if (!stat.isDirectory()) throw new Error('Workspace must be a directory.');
    this.rootPath = path.resolve(rootPath); this.realRoot = await fs.realpath(this.rootPath);
    const gitPath = path.join(this.rootPath, '.git'); const gitRoot = await fs.access(gitPath).then(() => gitPath).catch(() => null);
    this.workspaceInfo = { rootPath: this.rootPath, name: path.basename(this.rootPath), gitRoot, createdAt: stat.birthtimeMs };
    return { ...this.workspaceInfo };
  }
  info(): WorkspaceInfo | null { return this.workspaceInfo ? { ...this.workspaceInfo } : null; }
  async close(): Promise<void> { this.watcher?.close(); this.watcher = undefined; this.rootPath = null; this.realRoot = null; this.workspaceInfo = null; }
  async list(relativePath = '', options: { recursive?: boolean; maxEntries?: number; showHidden?: boolean } = {}): Promise<FileNode[]> {
    const budget = { count: 0, maximum: Math.max(1, options.maxEntries ?? 5_000) };
    return this.listDirectory(await this.resolve(relativePath), relativePath, options.recursive !== false, budget, options.showHidden ?? false);
  }
  async readFile(relativePath: string): Promise<FileContent> {
    const absolute = await this.resolve(relativePath);
    const stat = await fs.stat(absolute);
    if (!stat.isFile()) throw new Error('Path is not a file.');
    if (stat.size > MAX_EDITOR_FILE_BYTES) throw new Error('Direct file reads are limited to 32 MB to protect the FORGE runtime. Use a bounded tool, external viewer, or split the file.');
    const bytes = await fs.readFile(absolute);
    if (bytes.includes(0)) return { path: relativePath, content: bytes.toString('base64'), modifiedAt: stat.mtimeMs, encoding: 'base64', binary: true };
    let content: string;
    try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { throw new Error('Forge could not decode this file as UTF-8 text.'); }
    return { path: relativePath, content, modifiedAt: stat.mtimeMs, encoding: content.startsWith('\ufeff') ? 'utf8-bom' : 'utf8' };
  }
  async metadata(relativePath: string): Promise<FileMetadata> {
    const absolute = await this.resolve(relativePath); const stat = await fs.stat(absolute); const extension = path.extname(absolute).slice(1).toLowerCase();
    const bytes = stat.isFile() ? await fs.open(absolute, 'r').then(async (handle) => { const buffer = Buffer.alloc(CLASSIFICATION_SAMPLE_BYTES); try { const result = await handle.read(buffer, 0, buffer.length, 0); return buffer.subarray(0, result.bytesRead); } finally { await handle.close(); } }) : Buffer.alloc(0);
    const signatureBytes = Buffer.alloc(8); bytes.copy(signatureBytes);
    const signature = bytes.length >= 4 ? signatureBytes.toString('hex').match(/.{2}/g)?.join(' ') : undefined;
    const executable = process.platform === 'win32' ? ['.exe', '.bat', '.cmd', '.ps1'].includes(path.extname(absolute).toLowerCase()) : Boolean(stat.mode & 0o111);
    const name = path.basename(absolute); const lowerName = name.toLowerCase(); const resolvedExtension = extension || (textNames.has(lowerName) || lowerName.startsWith('.env.') ? lowerName.slice(1) : '');
    const mimeType = mimeByExtension[resolvedExtension] ?? (bytes[0] === 0x7f && bytes[1] === 0x45 ? 'application/x-elf' : 'application/octet-stream');
    const classification = classifyFile({ name, extension: resolvedExtension, mimeType, sample: bytes, executable });
    return { path: relativePath, name, extension: extension || undefined, size: stat.size, modifiedAt: stat.mtimeMs, createdAt: stat.birthtimeMs, mimeType, kind: classification.kind, text: classification.text, executable, permissions: process.platform === 'win32' ? undefined : (stat.mode & 0o777).toString(8), signature };
  }
  async preview(relativePath: string): Promise<{ path: string; mimeType: string; dataUrl: string }> {
    const metadata = await this.metadata(relativePath);
    if (!['image', 'audio', 'video'].includes(metadata.kind)) throw new Error('This file does not have a safe media preview.');
    if (metadata.size > MAX_MEDIA_PREVIEW_BYTES) throw new Error('Media preview is limited to 100 MB.');
    const bytes = await fs.readFile(await this.resolve(relativePath));
    return { path: relativePath, mimeType: metadata.mimeType, dataUrl: `data:${metadata.mimeType};base64,${bytes.toString('base64')}` };
  }
  async writeFile(relativePath: string, content: string): Promise<FileContent> { const absolute = await this.resolve(relativePath, true); await fs.mkdir(path.dirname(absolute), { recursive: true }); await fs.writeFile(absolute, content, 'utf8'); const stat = await fs.stat(absolute); return { path: relativePath, content, modifiedAt: stat.mtimeMs }; }
  async create(relativePath: string, type: 'file' | 'directory', content = ''): Promise<FileNode> { const absolute = await this.resolve(relativePath, true); await fs.mkdir(path.dirname(absolute), { recursive: true }); if (type === 'directory') await fs.mkdir(absolute, { recursive: false }); else await fs.writeFile(absolute, content, { flag: 'wx' }); return this.nodeFor(absolute); }
  async delete(relativePath: string): Promise<void> { const absolute = await this.resolve(relativePath); if (absolute === this.realRoot) throw new Error('Cannot delete the workspace root.'); await fs.rm(absolute, { recursive: true, force: false }); }
  async rename(oldPath: string, newPath: string): Promise<FileNode> { const oldAbsolute = await this.resolve(oldPath); const newAbsolute = await this.resolve(newPath, true); await fs.mkdir(path.dirname(newAbsolute), { recursive: true }); await fs.rename(oldAbsolute, newAbsolute); return this.nodeFor(newAbsolute); }
  async copy(sourcePath: string, destinationPath: string): Promise<FileNode> {
    const source = await this.resolve(sourcePath);
    const destination = await this.resolve(destinationPath, true);
    if (source === destination) throw new Error('Cannot paste a file or folder onto itself.');
    await fs.access(destination).then(() => { throw new Error(`A file or folder already exists at ${destinationPath}.`); }).catch((error: unknown) => {
      if (error instanceof Error && !('code' in error && error.code === 'ENOENT')) throw error;
    });
    await fs.mkdir(path.dirname(destination), { recursive: true });
    const sourceStat = await fs.stat(source);
    if (sourceStat.isDirectory() && destination.startsWith(`${source}${path.sep}`)) throw new Error('A folder cannot be copied into itself or one of its children.');
    await fs.cp(source, destination, { recursive: sourceStat.isDirectory(), force: false, errorOnExist: true });
    return this.nodeFor(destination);
  }
  async parse(relativePath: string): Promise<ParsedMarkdown> { return parseMarkdown((await this.readFile(relativePath)).content); }
  watch(): void {
    if (!this.rootPath) throw new Error('No workspace is open.');
    this.watcher?.close();
    try {
      this.watcher = watchFs(this.rootPath, { recursive: shouldWatchRecursively(this.rootPath) }, (_event, filename) => { if (filename && !shouldIgnore(filename.toString())) this.emit('changed', filename.toString()); });
      this.watcher.on('error', (error) => { this.watcher?.close(); if (!isSkippableFileSystemError(error)) this.emit('watch-error', error); });
    } catch (error) {
      if (!isSkippableFileSystemError(error)) throw error;
    }
  }

  private async listDirectory(absolute: string, relative: string, recursive: boolean, budget: { count: number; maximum: number }, showHidden = true): Promise<FileNode[]> {
    let entries: Dirent[];
    try { entries = await fs.readdir(absolute, { withFileTypes: true }); }
    catch (error) { if (isSkippableFileSystemError(error)) return []; throw error; }
    const nodes: FileNode[] = [];
    for (const entry of entries) {
      if (budget.count >= budget.maximum) break;
      const childRelative = relative ? path.join(relative, entry.name) : entry.name;
      if (shouldIgnore(childRelative, showHidden) || entry.isSymbolicLink()) continue;
      const childAbsolute = path.join(absolute, entry.name);
      try {
        // A shallow Explorer listing must not probe protected directory contents.
        const node: FileNode = entry.isDirectory() && !recursive
          ? { path: childAbsolute, relativePath: childRelative.replaceAll('\\', '/'), name: entry.name, type: 'directory', modifiedAt: 0 }
          : await this.nodeFor(childAbsolute, childRelative);
        budget.count += 1;
        if (entry.isDirectory() && recursive) node.children = await this.listDirectory(childAbsolute, childRelative, recursive, budget, showHidden);
        nodes.push(node);
      } catch (error) {
        if (!isSkippableFileSystemError(error)) throw error;
      }
    }
    return nodes.sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1);
  }
  private async nodeFor(absolute: string, relative = path.relative(this.rootPath!, absolute)): Promise<FileNode> { const stat = await fs.stat(absolute); return { path: absolute, relativePath: relative.replaceAll('\\', '/'), name: path.basename(absolute), type: stat.isDirectory() ? 'directory' : 'file', extension: stat.isFile() ? path.extname(absolute).slice(1) || undefined : undefined, size: stat.isFile() ? stat.size : undefined, modifiedAt: stat.mtimeMs }; }
  private async resolve(input: string, allowMissing = false): Promise<string> { if (!this.rootPath || !this.realRoot) throw new Error('No workspace is open.'); if (path.isAbsolute(input)) throw new Error('Workspace paths must be relative.'); const candidate = path.resolve(this.rootPath, input); if (candidate !== this.rootPath && !candidate.startsWith(`${this.rootPath}${path.sep}`)) throw new Error('Path escapes the workspace.'); let inspect = candidate; if (allowMissing) while (inspect !== this.rootPath) { try { await fs.access(inspect); break; } catch { inspect = path.dirname(inspect); } } const resolved = await fs.realpath(inspect); if (resolved !== this.realRoot && !resolved.startsWith(`${this.realRoot}${path.sep}`)) throw new Error('Symlink escapes the workspace.'); return candidate; }
}
