import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execute = promisify(execFile);
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(repositoryRoot, 'dist_electron');
const expectedArchitectures = new Set((process.argv[2] ?? '').split(',').filter(Boolean));
const platform = process.argv[3] ?? 'darwin';
const allowedArchitectures = platform === 'darwin' ? new Set(['arm64', 'x64', 'universal']) : new Set(['x64']);
const appDirectoryFor = (architecture) => {
  if (platform === 'win32') return 'win-unpacked';
  if (platform === 'linux') return 'linux-unpacked';
  return architecture === 'arm64' ? 'mac-arm64' : architecture === 'x64' ? 'mac' : 'mac-universal';
};

if (!['darwin', 'linux', 'win32'].includes(platform) || expectedArchitectures.size === 0 || [...expectedArchitectures].some((entry) => !allowedArchitectures.has(entry))) {
  throw new Error('Usage: node scripts/write-build-manifest.mjs arm64|x64|universal|arm64,universal [darwin] OR node scripts/write-build-manifest.mjs x64 linux|win32');
}

const packageManifest = JSON.parse(await fs.readFile(path.join(repositoryRoot, 'package.json'), 'utf8'));
const version = packageManifest.version;
const channel = version.includes('-') ? 'beta' : 'latest';
const compiledMain = await fs.readFile(path.join(repositoryRoot, 'apps/desktop/out/main/index.js'), 'utf8');
const commit = compiledMain.match(/commit:\s*"([0-9a-f]{40})"/)?.[1];
const buildDate = compiledMain.match(/buildDate:\s*"([^"]+)"/)?.[1];
if (!commit || !buildDate) throw new Error('Compiled build provenance was not found. Run npm run build first.');
const [{ stdout: currentCommit }, { stdout: workingTree }] = await Promise.all([
  execute('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot }),
  // `npm run build` rewrites this tracked generated runtime bundle with the
  // current build provenance. It is verified separately above; every other
  // source change must still make a release manifest ineligible for upload.
  execute('git', ['status', '--porcelain', '--', '.', ':(exclude)apps/desktop/out/main/index.js'], { cwd: repositoryRoot })
]);
const expectedCommit = process.env.FORGE_BUILD_COMMIT?.trim() || currentCommit.trim();
if (!/^[0-9a-f]{40}$/.test(expectedCommit)) throw new Error('The build commit provenance is unavailable or malformed.');
if (commit !== expectedCommit) throw new Error(`Compiled build commit does not match the expected source commit: ${expectedCommit}.`);

const sha256 = async (filePath) => createHash('sha256').update(await fs.readFile(filePath)).digest('hex');
const windowsExecutableArchitecture = async (filePath) => {
  const data = await fs.readFile(filePath);
  if (data.length < 64 || data.readUInt16LE(0) !== 0x5a4d) throw new Error(`Invalid Windows executable: ${filePath}`);
  const peOffset = data.readUInt32LE(0x3c);
  if (peOffset + 6 > data.length || data.toString('ascii', peOffset, peOffset + 4) !== 'PE\0\0') throw new Error(`Invalid Windows PE header: ${filePath}`);
  const machine = data.readUInt16LE(peOffset + 4);
  if (machine !== 0x8664) throw new Error(`Unexpected Windows executable architecture 0x${machine.toString(16)}: ${filePath}`);
  return ['x64'];
};
const linuxExecutableArchitecture = async (filePath) => {
  const data = await fs.readFile(filePath);
  if (data.length < 20 || data[0] !== 0x7f || data.toString('ascii', 1, 4) !== 'ELF') throw new Error(`Invalid Linux executable: ${filePath}`);
  if (data[4] !== 2 || data[5] !== 1) throw new Error(`Unexpected Linux ELF class or byte order: ${filePath}`);
  const machine = data.readUInt16LE(18);
  if (machine !== 0x3e) throw new Error(`Unexpected Linux executable architecture 0x${machine.toString(16)}: ${filePath}`);
  return ['x64'];
};
const fileRecord = async (kind, absolutePath, architectures) => {
  const stat = await fs.stat(absolutePath);
  return {
    kind,
    path: path.relative(repositoryRoot, absolutePath),
    size: stat.size,
    sha256: await sha256(absolutePath),
    architectures
  };
};

await Promise.all([
  fs.rm(path.join(outputDirectory, 'builder-debug.yml'), { force: true }),
  fs.rm(path.join(outputDirectory, 'builder-effective-config.yaml'), { force: true }),
  fs.rm(path.join(outputDirectory, platform === 'win32' ? '.icon-ico' : platform === 'darwin' ? '.icon-icns' : '.icon-set'), { recursive: true, force: true })
]);

const outputEntries = await fs.readdir(outputDirectory, { withFileTypes: true });
const metadataName = platform === 'win32' ? `${channel}.yml` : `${channel}-${platform === 'linux' ? 'linux' : 'mac'}.yml`;
const staleFiles = outputEntries
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .filter((name) => name !== metadataName && !name.startsWith(`FORGE-${version}-`));
if (staleFiles.length > 0) throw new Error(`Packaging output contains stale or unexpected files: ${staleFiles.join(', ')}`);
const expectedAppDirectories = new Set([...expectedArchitectures].map(appDirectoryFor));
const staleDirectories = outputEntries.filter((entry) => entry.isDirectory() && !expectedAppDirectories.has(entry.name)).map((entry) => entry.name);
if (staleDirectories.length > 0) throw new Error(`Packaging output contains stale or unexpected directories: ${staleDirectories.join(', ')}`);

const artifacts = [];
if (platform === 'win32') {
  const installerPath = path.join(outputDirectory, `FORGE-${version}-x64.exe`);
  artifacts.push(await fileRecord('nsis', installerPath, ['x64']));
  artifacts.push(await fileRecord('blockmap', `${installerPath}.blockmap`, ['x64']));
} else if (platform === 'linux') {
  artifacts.push(await fileRecord('appimage', path.join(outputDirectory, `FORGE-${version}-x64.AppImage`), ['x64']));
  artifacts.push(await fileRecord('deb', path.join(outputDirectory, `FORGE-${version}-x64.deb`), ['x64']));
} else {
  for (const architecture of expectedArchitectures) {
    for (const extension of ['dmg', 'dmg.blockmap', 'zip', 'zip.blockmap']) {
      const absolutePath = path.join(outputDirectory, `FORGE-${version}-${architecture}.${extension}`);
      artifacts.push(await fileRecord(extension.includes('blockmap') ? 'blockmap' : extension, absolutePath, architecture === 'universal' ? ['x86_64', 'arm64'] : [architecture]));
    }
  }
}
const metadataPath = path.join(outputDirectory, metadataName);
artifacts.push(await fileRecord('updater-metadata', metadataPath, expectedArchitectures.has('universal') ? ['x86_64', 'arm64'] : [...expectedArchitectures]));

const packagedApplications = [];
for (const architecture of expectedArchitectures) {
  const appPath = path.join(outputDirectory, appDirectoryFor(architecture), 'FORGE.app');
  const actualAppPath = platform === 'darwin' ? appPath : path.join(outputDirectory, appDirectoryFor(architecture));
  const executablePath = platform === 'win32' ? path.join(actualAppPath, 'FORGE.exe') : platform === 'linux' ? path.join(actualAppPath, 'forge') : path.join(actualAppPath, 'Contents/MacOS/FORGE');
  const appAsarPath = platform === 'darwin' ? path.join(actualAppPath, 'Contents/Resources/app.asar') : path.join(actualAppPath, 'resources/app.asar');
  const observedArchitectures = platform === 'win32'
    ? await windowsExecutableArchitecture(executablePath)
    : platform === 'linux'
      ? await linuxExecutableArchitecture(executablePath)
    : (await execute('lipo', ['-archs', executablePath])).stdout.trim().split(/\s+/).sort();
  const required = architecture === 'universal' ? ['arm64', 'x86_64'] : [architecture];
  if (JSON.stringify(observedArchitectures) !== JSON.stringify(required.sort())) {
    throw new Error(`Unexpected executable architectures for ${appPath}: ${observedArchitectures.join(', ')}`);
  }
  packagedApplications.push({
    path: path.relative(repositoryRoot, actualAppPath),
    architectures: observedArchitectures,
    executable: await fileRecord('executable', executablePath, observedArchitectures),
    appAsar: await fileRecord('app-asar', appAsarPath, observedArchitectures)
  });
}

const manifest = {
  schemaVersion: 1,
  product: 'FORGE',
  version,
  tag: `v${version}`,
  gitCommit: commit,
  sourceTreeClean: workingTree.trim().length === 0,
  buildDate,
  channel: channel === 'beta' ? 'beta' : 'stable',
  platform,
  architectures: [...new Set(packagedApplications.flatMap((entry) => entry.architectures))].sort(),
  artifacts,
  packagedApplications
};

await fs.writeFile(path.join(outputDirectory, 'build-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o644 });
console.log(`Wrote dist_electron/build-manifest.json for ${manifest.tag} at ${manifest.gitCommit}.`);
