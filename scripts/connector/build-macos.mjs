import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  cpSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { arch, homedir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { build } from 'esbuild';

const NODE_VERSION = 'v24.18.0';
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..', '..');
const outputRoot = resolve(repositoryRoot, 'artifacts', 'connector');
const appRoot = resolve(outputRoot, 'DevinX Connector.app');
const contentsRoot = resolve(appRoot, 'Contents');
const macOSRoot = resolve(contentsRoot, 'MacOS');
const resourcesRoot = resolve(contentsRoot, 'Resources');
const runtimeRoot = resolve(resourcesRoot, 'runtime');
const architecture = arch() === 'arm64' ? 'arm64' : arch() === 'x64' ? 'x64' : null;

function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: repositoryRoot,
    stdio: 'inherit',
    shell: false,
    ...options,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${basename(executable)} failed while building DevinX Connector`);
  }
}

function capture(executable, args) {
  const result = spawnSync(executable, args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    shell: false,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${basename(executable)} failed while validating DevinX Connector signing`);
  }
  return `${result.stdout ?? ''}${result.stderr ?? ''}`;
}

function validatedSigningIdentity() {
  const identity = process.env.DEVINX_CODESIGN_IDENTITY?.trim() || '-';
  if (identity === '-') return identity;
  if (!identity.startsWith('Developer ID Application: ')) {
    throw new Error('Public Connector builds require a Developer ID Application identity');
  }
  const identities = capture('/usr/bin/security', ['find-identity', '-v', '-p', 'codesigning']);
  if (!identities.includes(`\"${identity}\"`)) {
    throw new Error('The requested Developer ID Application identity is not available in Keychain');
  }
  return identity;
}

function signOwnedCode(path, identity, entitlements) {
  const args = ['--force', '--options', 'runtime'];
  if (identity !== '-') args.push('--timestamp');
  if (entitlements) args.push('--entitlements', entitlements);
  args.push('--sign', identity, path);
  run('/usr/bin/codesign', args);
}

function validateRuntimeEntitlements(path) {
  const entitlements = capture('/usr/bin/codesign', ['-d', '--entitlements', ':-', path]);
  if (!entitlements.includes('<key>com.apple.security.cs.allow-jit</key>')) {
    throw new Error('The bundled Node runtime is missing its required JIT entitlement');
  }
  for (const forbidden of [
    'com.apple.security.get-task-allow',
    'com.apple.security.cs.allow-dyld-environment-variables',
    'com.apple.security.cs.disable-executable-page-protection',
    'com.apple.security.cs.disable-library-validation',
  ]) {
    if (entitlements.includes(`<key>${forbidden}</key>`)) {
      throw new Error(`The bundled Node runtime contains forbidden entitlement ${forbidden}`);
    }
  }
}

function nodePlatformArchive() {
  if (architecture === 'arm64') return `node-${NODE_VERSION}-darwin-arm64.tar.gz`;
  if (architecture === 'x64') return `node-${NODE_VERSION}-darwin-x64.tar.gz`;
  throw new Error('DevinX Connector macOS builds require arm64 or x64');
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
  const archive = nodePlatformArchive();
  const cacheRoot = resolve(homedir(), '.cache', 'devinx-connector', NODE_VERSION);
  const archivePath = resolve(cacheRoot, archive);
  const sumsPath = resolve(cacheRoot, 'SHASUMS256.txt');
  mkdirSync(cacheRoot, { recursive: true, mode: 0o700 });
  if (!existsSync(sumsPath)) {
    await download(`https://nodejs.org/dist/${NODE_VERSION}/SHASUMS256.txt`, sumsPath);
  }
  const expectedLine = readFileSync(sumsPath, 'utf8')
    .split(/\r?\n/)
    .find((line) => line.endsWith(`  ${archive}`));
  const expected = expectedLine?.split(/\s+/)[0];
  if (!expected || !/^[a-f0-9]{64}$/.test(expected)) {
    throw new Error('The pinned Node runtime checksum is unavailable');
  }
  if (!existsSync(archivePath)) {
    await download(`https://nodejs.org/dist/${NODE_VERSION}/${archive}`, archivePath);
  }
  if (sha256(archivePath) !== expected) {
    rmSync(archivePath, { force: true });
    throw new Error('The pinned Node runtime checksum did not match');
  }
  const extractRoot = resolve(cacheRoot, 'extracted');
  const nodePath = resolve(
    extractRoot,
    archive.replace(/\.tar\.gz$/, ''),
    'bin',
    'node',
  );
  if (!existsSync(nodePath)) {
    rmSync(extractRoot, { recursive: true, force: true });
    mkdirSync(extractRoot, { recursive: true, mode: 0o700 });
    run('/usr/bin/tar', ['-xzf', archivePath, '-C', extractRoot]);
  }
  return nodePath;
}

function buildApplicationIcon() {
  const iconsetRoot = resolve(outputRoot, 'DevinXConnector.iconset');
  const source = resolve(repositoryRoot, 'assets', 'icon.png');
  rmSync(iconsetRoot, { recursive: true, force: true });
  mkdirSync(iconsetRoot, { recursive: true });
  for (const [points, pixels] of [
    [16, 16],
    [16, 32],
    [32, 32],
    [32, 64],
    [128, 128],
    [128, 256],
    [256, 256],
    [256, 512],
    [512, 512],
    [512, 1024],
  ]) {
    const suffix = pixels === points ? '' : '@2x';
    run('/usr/bin/sips', [
      '-z',
      String(pixels),
      String(pixels),
      source,
      '--out',
      resolve(iconsetRoot, `icon_${points}x${points}${suffix}.png`),
    ], { stdio: 'ignore' });
  }
  run('/usr/bin/iconutil', [
    '-c',
    'icns',
    iconsetRoot,
    '-o',
    resolve(resourcesRoot, 'DevinXConnector.icns'),
  ]);
  rmSync(iconsetRoot, { recursive: true, force: true });
}

if (process.platform !== 'darwin') {
  throw new Error('The macOS connector can only be built on macOS');
}

run(process.execPath, [
  resolve(repositoryRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
  '-p',
  'bridge/tsconfig.json',
]);
run(process.execPath, [resolve(repositoryRoot, 'scripts', 'bridge', 'build-keychain-helper.mjs')]);

rmSync(appRoot, { recursive: true, force: true });
mkdirSync(macOSRoot, { recursive: true });
mkdirSync(runtimeRoot, { recursive: true });
copyFileSync(
  resolve(repositoryRoot, 'connector', 'macos', 'Info.plist'),
  resolve(contentsRoot, 'Info.plist'),
);
buildApplicationIcon();

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

const nodeRuntime = await ensurePinnedNodeRuntime();
copyFileSync(nodeRuntime, resolve(runtimeRoot, 'node'));
chmodSync(resolve(runtimeRoot, 'node'), 0o755);
copyFileSync(
  resolve(repositoryRoot, 'dist', 'bridge', 'macos-keychain-helper'),
  resolve(resourcesRoot, 'macos-keychain-helper'),
);
chmodSync(resolve(resourcesRoot, 'macos-keychain-helper'), 0o755);

run('/usr/bin/xcrun', [
  'swiftc',
  resolve(repositoryRoot, 'connector', 'macos', 'DevinXConnector.swift'),
  '-parse-as-library',
  '-O',
  '-target',
  `${architecture === 'arm64' ? 'arm64' : 'x86_64'}-apple-macos13.0`,
  '-framework',
  'AppKit',
  '-framework',
  'CoreImage',
  '-framework',
  'ServiceManagement',
  '-o',
  resolve(macOSRoot, 'DevinXConnector'),
]);

// The checksum-verified upstream Node runtime ships with debugging and dynamic
// loader entitlements that are broader than this fixed Connector runtime
// needs. Re-sign it with only JIT permission, then sign DevinX-owned
// executables bottom-up and seal the bundle. `--deep` signing is deliberately
// avoided for release correctness.
const identity = validatedSigningIdentity();
const nodeRuntimePath = resolve(runtimeRoot, 'node');
signOwnedCode(
  nodeRuntimePath,
  identity,
  resolve(repositoryRoot, 'connector', 'macos', 'NodeRuntime.entitlements'),
);
validateRuntimeEntitlements(nodeRuntimePath);
signOwnedCode(resolve(resourcesRoot, 'macos-keychain-helper'), identity);
signOwnedCode(resolve(macOSRoot, 'DevinXConnector'), identity);
signOwnedCode(appRoot, identity);
run('/usr/bin/codesign', ['--verify', '--deep', '--strict', '--verbose=2', appRoot]);

const stagingRoot = resolve(outputRoot, 'dmg-staging');
const dmgPath = resolve(outputRoot, `DevinX-Connector-0.1.0-macos-${architecture}.dmg`);
rmSync(stagingRoot, { recursive: true, force: true });
rmSync(dmgPath, { force: true });
mkdirSync(stagingRoot, { recursive: true });
cpSync(appRoot, resolve(stagingRoot, 'DevinX Connector.app'), { recursive: true });
symlinkSync('/Applications', resolve(stagingRoot, 'Applications'));
run('/usr/bin/hdiutil', [
  'create',
  '-volname',
  'DevinX Connector',
  '-srcfolder',
  stagingRoot,
  '-ov',
  '-format',
  'UDZO',
  dmgPath,
]);
rmSync(stagingRoot, { recursive: true, force: true });
if (identity !== '-') {
  run('/usr/bin/codesign', ['--force', '--timestamp', '--sign', identity, dmgPath]);
  run('/usr/bin/codesign', ['--verify', '--verbose=2', dmgPath]);
}
const digest = sha256(dmgPath);
writeFileSync(`${dmgPath}.sha256`, `${digest}  ${basename(dmgPath)}\n`, {
  encoding: 'utf8',
  mode: 0o644,
});

process.stdout.write(`Built ${appRoot}\nBuilt ${dmgPath}\nSHA-256 ${digest}\n`);
