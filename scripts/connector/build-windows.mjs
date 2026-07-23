import { createHash } from 'node:crypto';
import {
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { build } from 'esbuild';
import { signWindowsFile } from './windows-authenticode.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..', '..');
const connectorVersion = '0.1.0';
const architecture = 'x64';
const runtimeIdentifier = `win-${architecture}`;
const pinnedNodeVersion = readFileSync(resolve(repositoryRoot, '.nvmrc'), 'utf8').trim();
if (!/^24\.\d+\.\d+$/.test(pinnedNodeVersion)) {
  throw new Error('DevinX Connector requires a pinned Node 24 runtime in .nvmrc');
}
const nodeVersion = `v${pinnedNodeVersion}`;
const nodeArchive = `node-${nodeVersion}-${runtimeIdentifier}.zip`;
const outputRoot = resolve(repositoryRoot, 'artifacts', 'connector', 'windows');
const packageRoot = resolve(
  outputRoot,
  `DevinX-Connector-${connectorVersion}-windows-${architecture}`,
);
const resourcesRoot = resolve(packageRoot, 'Resources');
const runtimeRoot = resolve(resourcesRoot, 'runtime');
const zipPath = `${packageRoot}.zip`;
const installerPath = resolve(
  outputRoot,
  `DevinX-Connector-Setup-${connectorVersion}-windows-${architecture}.exe`,
);
const signedRelease = process.env.DEVINX_WINDOWS_SIGNING_REQUIRED === '1';

function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: repositoryRoot,
    stdio: 'inherit',
    shell: false,
    ...options,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${basename(executable)} failed while building DevinX Connector for Windows`);
  }
}

async function download(url, destination) {
  const response = await fetch(url, { redirect: 'error' });
  if (!response.ok || !response.body) {
    throw new Error('The pinned Node runtime could not be downloaded');
  }
  await pipeline(response.body, createWriteStream(destination, { mode: 0o600 }));
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

async function ensurePinnedNodeRuntime() {
  const cacheRoot = resolve(homedir(), '.cache', 'devinx-connector', nodeVersion);
  const archivePath = resolve(cacheRoot, nodeArchive);
  const sumsPath = resolve(cacheRoot, 'SHASUMS256.txt');
  const extractRoot = resolve(cacheRoot, `extracted-${runtimeIdentifier}`);
  const nodePath = resolve(extractRoot, nodeArchive.replace(/\.zip$/, ''), 'node.exe');
  mkdirSync(cacheRoot, { recursive: true, mode: 0o700 });
  if (!existsSync(sumsPath)) {
    await download(`https://nodejs.org/dist/${nodeVersion}/SHASUMS256.txt`, sumsPath);
  }
  const expectedLine = readFileSync(sumsPath, 'utf8')
    .split(/\r?\n/)
    .find((line) => line.endsWith(`  ${nodeArchive}`));
  const expected = expectedLine?.split(/\s+/)[0];
  if (!expected || !/^[a-f0-9]{64}$/.test(expected)) {
    throw new Error('The pinned Windows Node runtime checksum is unavailable');
  }
  if (!existsSync(archivePath)) {
    await download(`https://nodejs.org/dist/${nodeVersion}/${nodeArchive}`, archivePath);
  }
  if (sha256(archivePath) !== expected) {
    rmSync(archivePath, { force: true });
    throw new Error('The pinned Windows Node runtime checksum did not match');
  }
  if (!existsSync(nodePath)) {
    rmSync(extractRoot, { recursive: true, force: true });
    mkdirSync(extractRoot, { recursive: true, mode: 0o700 });
    run(
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Expand-Archive -LiteralPath $env:DEVINX_NODE_ARCHIVE -DestinationPath $env:DEVINX_NODE_EXTRACT -Force',
      ],
      {
        env: {
          ...process.env,
          DEVINX_NODE_ARCHIVE: archivePath,
          DEVINX_NODE_EXTRACT: extractRoot,
        },
      },
    );
  }
  if (!existsSync(nodePath)) throw new Error('The verified Windows Node runtime was not extracted');
  return nodePath;
}

if (process.platform !== 'win32') {
  throw new Error('The Windows Connector package can only be built on Windows');
}

run(process.execPath, [
  resolve(repositoryRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
  '-p',
  'bridge/tsconfig.json',
]);

rmSync(packageRoot, { recursive: true, force: true });
rmSync(zipPath, { force: true });
rmSync(installerPath, { force: true });
mkdirSync(runtimeRoot, { recursive: true });

await build({
  entryPoints: [resolve(repositoryRoot, 'dist', 'bridge', 'connector-cli.js')],
  outfile: resolve(resourcesRoot, 'connector-runtime.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node24',
  sourcemap: false,
  legalComments: 'eof',
  logLevel: 'info',
});

const helperPublishRoot = resolve(outputRoot, 'dpapi-publish');
const appPublishRoot = resolve(outputRoot, 'app-publish');
const installerPublishRoot = resolve(outputRoot, 'installer-publish');
rmSync(helperPublishRoot, { recursive: true, force: true });
rmSync(appPublishRoot, { recursive: true, force: true });
rmSync(installerPublishRoot, { recursive: true, force: true });
run('dotnet.exe', [
  'restore',
  resolve(repositoryRoot, 'bridge', 'windows-dpapi-helper', 'DevinX.WindowsDpapiHelper.csproj'),
  '--locked-mode',
]);
run('dotnet.exe', [
  'restore',
  resolve(repositoryRoot, 'connector', 'windows', 'DevinXConnector.csproj'),
  '--locked-mode',
]);
run('dotnet.exe', [
  'publish',
  resolve(repositoryRoot, 'bridge', 'windows-dpapi-helper', 'DevinX.WindowsDpapiHelper.csproj'),
  '--configuration',
  'Release',
  '--runtime',
  runtimeIdentifier,
  '--self-contained',
  'true',
  '--no-restore',
  '--output',
  helperPublishRoot,
]);
run('dotnet.exe', [
  'publish',
  resolve(repositoryRoot, 'connector', 'windows', 'DevinXConnector.csproj'),
  '--configuration',
  'Release',
  '--runtime',
  runtimeIdentifier,
  '--self-contained',
  'true',
  '--no-restore',
  '--output',
  appPublishRoot,
]);

const applicationExecutable = resolve(appPublishRoot, 'DevinX Connector.exe');
const helperExecutable = resolve(helperPublishRoot, 'windows-dpapi-helper.exe');
if (!existsSync(applicationExecutable) || !existsSync(helperExecutable)) {
  throw new Error('The native Windows Connector executables were not published');
}
if (signedRelease) {
  signWindowsFile(applicationExecutable);
  signWindowsFile(helperExecutable);
}
copyFileSync(applicationExecutable, resolve(packageRoot, 'DevinX Connector.exe'));
copyFileSync(helperExecutable, resolve(resourcesRoot, 'windows-dpapi-helper.exe'));
copyFileSync(await ensurePinnedNodeRuntime(), resolve(runtimeRoot, 'node.exe'));
copyFileSync(resolve(repositoryRoot, 'LICENSE'), resolve(packageRoot, 'LICENSE.txt'));

run(
  'powershell.exe',
  [
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    'Compress-Archive -LiteralPath $env:DEVINX_PACKAGE_ROOT -DestinationPath $env:DEVINX_PACKAGE_ZIP -CompressionLevel Optimal -Force',
  ],
  {
    env: {
      ...process.env,
      DEVINX_PACKAGE_ROOT: packageRoot,
      DEVINX_PACKAGE_ZIP: zipPath,
    },
  },
);

const digest = sha256(zipPath);
writeFileSync(`${zipPath}.sha256`, `${digest}  ${basename(zipPath)}\n`, {
  encoding: 'utf8',
  mode: 0o644,
});

run('dotnet.exe', [
  'restore',
  resolve(repositoryRoot, 'connector', 'windows-installer', 'DevinXConnectorInstaller.csproj'),
  '--locked-mode',
  `-p:ConnectorPayload=${zipPath}`,
]);
run('dotnet.exe', [
  'publish',
  resolve(repositoryRoot, 'connector', 'windows-installer', 'DevinXConnectorInstaller.csproj'),
  '--configuration',
  'Release',
  '--runtime',
  runtimeIdentifier,
  '--self-contained',
  'true',
  '--no-restore',
  '--output',
  installerPublishRoot,
  `-p:ConnectorPayload=${zipPath}`,
]);
const publishedInstaller = resolve(installerPublishRoot, 'DevinX Connector Setup.exe');
if (!existsSync(publishedInstaller)) {
  throw new Error('The native Windows Connector installer was not published');
}
copyFileSync(publishedInstaller, installerPath);
if (signedRelease) signWindowsFile(installerPath);
const installerDigest = sha256(installerPath);
writeFileSync(`${installerPath}.sha256`, `${installerDigest}  ${basename(installerPath)}\n`, {
  encoding: 'utf8',
  mode: 0o644,
});

process.stdout.write(
  `Built ${packageRoot}\n` +
    `Built ${zipPath}\n` +
    `ZIP SHA-256 ${digest}\n` +
    `Built ${installerPath}\n` +
    `Installer SHA-256 ${installerDigest}\n`,
);
