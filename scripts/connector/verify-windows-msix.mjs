import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  findMakeAppx,
  loadStoreIdentity,
  renderStoreManifest,
  repositoryRoot,
  storeArtifactName,
  storePackagingRoot,
} from './windows-store-identity.mjs';

function requireText(value, expected, label) {
  if (!value.includes(expected)) throw new Error(`Store manifest is missing ${label}`);
}

function pngDimensions(path) {
  const contents = readFileSync(path);
  const signature = contents.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a' || contents.subarray(12, 16).toString('ascii') !== 'IHDR') {
    throw new Error(`${basename(path)} is not a valid PNG`);
  }
  return {
    width: contents.readUInt32BE(16),
    height: contents.readUInt32BE(20),
  };
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function run(executable, args) {
  const result = spawnSync(executable, args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    shell: false,
  });
  if (result.error || result.status !== 0) {
    const detail = `${result.stderr ?? ''}${result.stdout ?? ''}`.trim();
    throw new Error(`${basename(executable)} failed${detail ? `: ${detail}` : ''}`);
  }
}

const identity = loadStoreIdentity();
const manifest = renderStoreManifest(identity);
for (const [expected, label] of [
  [`Name="${identity.identityName}"`, 'Partner Center identity name'],
  [`Publisher="${identity.publisher}"`, 'Partner Center publisher'],
  [`Version="${identity.version}"`, 'four-part package version'],
  [`ProcessorArchitecture="${identity.architecture}"`, 'x64 architecture'],
  [`<PublisherDisplayName>${identity.publisherDisplayName}</PublisherDisplayName>`, 'publisher name'],
  ['Name="Windows.Desktop"', 'Windows Desktop target'],
  [`MinVersion="${identity.minimumWindowsVersion}"`, 'Windows 11 minimum'],
  ['<desktop:Extension', 'desktop extension'],
  ['EntryPoint="Windows.FullTrustApplication"', 'startup-task full-trust entry point'],
  ['<rescap:Capability Name="runFullTrust" />', 'runFullTrust capability'],
  ['Category="windows.startupTask"', 'packaged startup task'],
  ['TaskId="DevinXConnectorStartup"', 'startup task identifier'],
  ['Enabled="false"', 'opt-in startup behavior'],
]) {
  requireText(manifest, expected, label);
}
if (manifest.includes('internetClient') || manifest.includes('broadFileSystemAccess')) {
  throw new Error('Store manifest requests an unsupported broad capability');
}

for (const [name, width, height] of [
  ['Square44x44Logo.png', 44, 44],
  ['Square150x150Logo.png', 150, 150],
  ['StoreLogo.png', 50, 50],
]) {
  const actual = pngDimensions(resolve(storePackagingRoot, 'Assets', name));
  if (actual.width !== width || actual.height !== height) {
    throw new Error(`${name} must be ${width}x${height}`);
  }
}

const outputRoot = resolve(repositoryRoot, 'artifacts', 'connector', 'windows');
const msixPath = resolve(outputRoot, storeArtifactName(identity));
const checksumPath = `${msixPath}.sha256`;
if (process.env.DEVINX_REQUIRE_MSIX_ARTIFACT === '1' || existsSync(msixPath)) {
  if (process.platform !== 'win32') {
    throw new Error('A generated MSIX must be verified on Windows');
  }
  if (!existsSync(msixPath) || !existsSync(checksumPath)) {
    throw new Error('Store MSIX or checksum is missing');
  }
  const expectedDigest = readFileSync(checksumPath, 'utf8').trim().split(/\s+/)[0];
  if (expectedDigest !== sha256(msixPath)) throw new Error('Store MSIX checksum mismatch');

  const makeAppx = findMakeAppx();
  const unpackRoot = mkdtempSync(resolve(tmpdir(), 'devinx-store-msix-'));
  try {
    run(makeAppx, ['unpack', '/p', msixPath, '/d', unpackRoot, '/o']);
    const packagedManifest = readFileSync(resolve(unpackRoot, 'AppxManifest.xml'), 'utf8');
    if (packagedManifest !== manifest) throw new Error('Packaged manifest differs from source');
    for (const required of [
      'DevinX Connector.exe',
      'LICENSE.txt',
      'Resources/connector-runtime.cjs',
      'Resources/runtime/node.exe',
      'Resources/windows-dpapi-helper.exe',
    ]) {
      if (!existsSync(resolve(unpackRoot, required))) {
        throw new Error(`Store MSIX is missing ${required}`);
      }
    }
  } finally {
    rmSync(unpackRoot, { recursive: true, force: true });
  }
}

process.stdout.write(
  `Verified Microsoft Store identity ${identity.identityName}\n` +
    `Verified Store ID ${identity.storeId}\n` +
    `Verified package family ${identity.packageFamilyName}\n`,
);
