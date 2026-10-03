import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { extractFile } from '@electron/asar';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(repositoryRoot, 'dist_electron');
const execute = promisify(execFile);
const manifestPath = path.resolve(repositoryRoot, process.argv[2] ?? 'dist_electron/build-manifest.json');
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const packageManifest = JSON.parse(await fs.readFile(path.join(repositoryRoot, 'package.json'), 'utf8'));

if (manifest.schemaVersion !== 1 || manifest.product !== 'FORGE') throw new Error('Unsupported build manifest.');
if (manifest.version !== packageManifest.version || manifest.tag !== `v${packageManifest.version}`) throw new Error('Build manifest version does not match package.json.');
if (!['darwin', 'linux', 'win32'].includes(manifest.platform)) throw new Error('Build manifest platform is unsupported.');
if (!Array.isArray(manifest.artifacts) || !Array.isArray(manifest.packagedApplications)) throw new Error('Build manifest is incomplete.');
if (!/^[0-9a-f]{40}$/.test(manifest.gitCommit) || Number.isNaN(Date.parse(manifest.buildDate))) throw new Error('Build manifest provenance is malformed.');
const expectedChannel = packageManifest.version.includes('-') ? 'beta' : 'stable';
if (manifest.channel !== expectedChannel) throw new Error('Build manifest channel does not match package.json.');
const expectedArtifactKinds = manifest.platform === 'win32'
  ? ['blockmap', 'nsis']
  : manifest.platform === 'linux'
    ? ['appimage', 'deb']
  : manifest.artifacts.length === 4
    ? ['blockmap', 'blockmap', 'dmg', 'zip']
    : ['blockmap', 'blockmap', 'blockmap', 'blockmap', 'dmg', 'dmg', 'zip', 'zip'];
if (JSON.stringify(manifest.artifacts.map((entry) => entry.kind).sort()) !== JSON.stringify(expectedArtifactKinds.sort())) {
  throw new Error('Build manifest artifact topology is incomplete or unexpected.');
}
if (manifest.platform !== 'darwin' && (manifest.packagedApplications.length !== 1 || JSON.stringify(manifest.architectures) !== JSON.stringify(['x64']))) {
  throw new Error(`${manifest.platform === 'win32' ? 'Windows' : 'Linux'} build manifest architecture topology is invalid.`);
}

const verify = async (record) => {
  if (!record || typeof record.path !== 'string' || !/^[0-9a-f]{64}$/.test(record.sha256) || !Number.isSafeInteger(record.size)) throw new Error('Malformed manifest file record.');
  const absolutePath = path.resolve(repositoryRoot, record.path);
  if (!absolutePath.startsWith(`${outputDirectory}${path.sep}`)) throw new Error(`Manifest path escapes packaging output: ${record.path}`);
  const data = await fs.readFile(absolutePath);
  const digest = createHash('sha256').update(data).digest('hex');
  if (data.byteLength !== record.size || digest !== record.sha256) throw new Error(`Build artifact verification failed: ${record.path}`);
};

for (const artifact of manifest.artifacts) await verify(artifact);
for (const app of manifest.packagedApplications) {
  await verify(app.executable);
  await verify(app.appAsar);
  const appRoot = path.resolve(repositoryRoot, app.path);
  if (manifest.platform === 'win32' && appRoot !== path.join(outputDirectory, 'win-unpacked')) throw new Error('Windows packaged application path is invalid.');
  if (manifest.platform === 'linux' && appRoot !== path.join(outputDirectory, 'linux-unpacked')) throw new Error('Linux packaged application path is invalid.');
  const runtimeMetadataPath = manifest.platform === 'darwin'
    ? path.join(appRoot, 'Contents', 'Resources', 'forge-runtime.json')
    : path.join(appRoot, 'resources', 'forge-runtime.json');
  const metadataBytes = await fs.readFile(runtimeMetadataPath);
  let packagedVersion;
  if (manifest.platform !== 'darwin') {
    packagedVersion = JSON.parse(extractFile(path.resolve(repositoryRoot, app.appAsar.path), 'package.json').toString('utf8')).version;
  } else {
    const infoPlist = path.join(appRoot, 'Contents', 'Info.plist');
    packagedVersion = (await execute('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleShortVersionString', infoPlist])).stdout.trim();
  }
  if (packagedVersion !== packageManifest.version) throw new Error(`Packaged app version does not match package.json: ${app.path}`);
  let runtimeMetadata;
  try { runtimeMetadata = JSON.parse(metadataBytes.toString('utf8')); }
  catch { throw new Error(`Packaged runtime metadata is malformed: ${app.path}`); }
  if (!runtimeMetadata || runtimeMetadata.schemaVersion !== 1 || runtimeMetadata.product !== 'FORGE' || runtimeMetadata.platform !== manifest.platform || runtimeMetadata.version !== packageManifest.version || runtimeMetadata.gitCommit !== manifest.gitCommit || runtimeMetadata.buildDate !== manifest.buildDate) {
    throw new Error(`Packaged runtime metadata does not match the manifest: ${app.path}`);
  }
  const compiledMain = extractFile(path.resolve(repositoryRoot, app.appAsar.path), path.join('apps', 'desktop', 'out', 'main', 'index.js')).toString('utf8');
  const embeddedCommit = compiledMain.match(/commit:\s*"([0-9a-f]{40})"/)?.[1];
  const embeddedBuildDate = compiledMain.match(/buildDate:\s*"([^"]+)"/)?.[1];
  if (embeddedCommit !== manifest.gitCommit || embeddedBuildDate !== manifest.buildDate) throw new Error(`Packaged UI provenance does not match the manifest: ${app.path}`);
}

console.log(`Verified ${manifest.artifacts.length} artifacts and ${manifest.packagedApplications.length} packaged applications for ${manifest.tag}.`);
