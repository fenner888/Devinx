import { createHash } from 'node:crypto';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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
  return `${result.stdout ?? ''}${result.stderr ?? ''}`;
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

if (process.platform !== 'win32') {
  throw new Error('The Microsoft Store MSIX can only be built on Windows');
}

const identity = loadStoreIdentity();
const outputRoot = resolve(repositoryRoot, 'artifacts', 'connector', 'windows');
const unpackagedRoot = resolve(
  outputRoot,
  `DevinX-Connector-0.1.0-windows-${identity.architecture}`,
);
if (!existsSync(resolve(unpackagedRoot, 'DevinX Connector.exe'))) {
  throw new Error('Build the Windows Connector payload before creating the Store MSIX');
}

const stagingRoot = resolve(outputRoot, 'store-msix-staging');
const msixPath = resolve(outputRoot, storeArtifactName(identity));
rmSync(stagingRoot, { recursive: true, force: true });
rmSync(msixPath, { force: true });
rmSync(`${msixPath}.sha256`, { force: true });
mkdirSync(stagingRoot, { recursive: true });
cpSync(unpackagedRoot, stagingRoot, { recursive: true });
renameSync(
  resolve(stagingRoot, 'DevinX Connector.exe'),
  resolve(stagingRoot, 'DevinXConnector.exe'),
);
mkdirSync(resolve(stagingRoot, 'Assets'), { recursive: true });
for (const asset of ['Square44x44Logo.png', 'Square150x150Logo.png', 'StoreLogo.png']) {
  copyFileSync(resolve(storePackagingRoot, 'Assets', asset), resolve(stagingRoot, 'Assets', asset));
}
writeFileSync(resolve(stagingRoot, 'AppxManifest.xml'), renderStoreManifest(identity), 'utf8');

const makeAppx = findMakeAppx();
run(makeAppx, ['pack', '/d', stagingRoot, '/p', msixPath, '/o']);
if (!existsSync(msixPath)) throw new Error('MakeAppx did not produce the Store MSIX');

const digest = sha256(msixPath);
writeFileSync(`${msixPath}.sha256`, `${digest}  ${basename(msixPath)}\n`, {
  encoding: 'utf8',
  mode: 0o644,
});
process.stdout.write(
  `Built Microsoft Store upload package ${msixPath}\n` +
    `Store ID ${identity.storeId}\n` +
    `MSIX SHA-256 ${digest}\n` +
    'The package is unsigned for Partner Center upload; Microsoft Store signs it after acceptance.\n',
);
