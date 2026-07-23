import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..', '..');
const outputRoot = resolve(repositoryRoot, 'artifacts', 'connector', 'windows');
const packageName = 'DevinX-Connector-0.1.0-windows-x64';
const packageRoot = resolve(outputRoot, packageName);
const zipPath = `${packageRoot}.zip`;
const checksumPath = `${zipPath}.sha256`;
const auditPath = resolve(outputRoot, 'verification-audit.json');
const expectedLicense = readFileSync(resolve(repositoryRoot, 'LICENSE'), 'utf8');
const temporaryRoot = mkdtempSync(resolve(tmpdir(), 'devinx-windows-verify-'));

function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    shell: false,
    ...options,
  });
  if (result.error || result.status !== 0) {
    const detail = `${result.stderr ?? ''}${result.stdout ?? ''}`.trim();
    throw new Error(`${basename(executable)} failed${detail ? `: ${detail}` : ''}`);
  }
  return `${result.stdout ?? ''}${result.stderr ?? ''}`;
}

function requirePath(path, label) {
  if (!existsSync(path)) throw new Error(`Missing ${label}: ${basename(path)}`);
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

if (process.platform !== 'win32') {
  throw new Error('Windows Connector artifact verification must run on Windows');
}

try {
  requirePath(zipPath, 'Connector ZIP');
  requirePath(checksumPath, 'Connector checksum');
  const expectedChecksum = readFileSync(checksumPath, 'utf8').trim().split(/\s+/)[0];
  const actualChecksum = sha256(zipPath);
  if (!/^[a-f0-9]{64}$/.test(expectedChecksum) || expectedChecksum !== actualChecksum) {
    throw new Error('Connector ZIP checksum mismatch');
  }
  for (const [path, label] of [
    [resolve(packageRoot, 'DevinX Connector.exe'), 'native application'],
    [resolve(packageRoot, 'Resources', 'connector-runtime.cjs'), 'Connector runtime'],
    [resolve(packageRoot, 'Resources', 'runtime', 'node.exe'), 'pinned Node runtime'],
    [resolve(packageRoot, 'Resources', 'windows-dpapi-helper.exe'), 'DPAPI helper'],
    [resolve(packageRoot, 'LICENSE.txt'), 'MIT license'],
  ]) requirePath(path, label);
  if (readFileSync(resolve(packageRoot, 'LICENSE.txt'), 'utf8') !== expectedLicense) {
    throw new Error('Bundled MIT license does not match the repository license');
  }
  const packagedFiles = readdirSync(packageRoot, { recursive: true }).map(String);
  if (packagedFiles.some((path) => path.endsWith('.map') || path.endsWith('.pdb'))) {
    throw new Error('The Connector package contains source maps or debug symbols');
  }
  const expectedNode = `v${readFileSync(resolve(repositoryRoot, '.nvmrc'), 'utf8').trim()}`;
  const actualNode = run(resolve(packageRoot, 'Resources', 'runtime', 'node.exe'), ['--version']).trim();
  if (actualNode !== expectedNode) throw new Error(`Bundled Node mismatch: ${actualNode}`);

  const isolatedLocalAppData = resolve(temporaryRoot, 'LocalAppData');
  const helper = resolve(packageRoot, 'Resources', 'windows-dpapi-helper.exe');
  const secret = `connector-verification-${Date.now()}`;
  const environment = { ...process.env, LOCALAPPDATA: isolatedLocalAppData };
  run(helper, ['set'], { input: secret, env: environment });
  const restored = run(helper, ['get'], { env: environment }).trimEnd();
  if (restored !== secret) throw new Error('DPAPI protected-state round trip failed');
  run(helper, ['delete'], { env: environment });
  const deleted = spawnSync(helper, ['get'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: environment,
    shell: false,
  });
  if (deleted.status !== 44) throw new Error('DPAPI protected-state deletion failed');

  const oversized = spawnSync(helper, ['set'], {
    cwd: repositoryRoot,
    input: 'x'.repeat(1024 * 1024 + 1),
    encoding: 'utf8',
    env: environment,
    shell: false,
  });
  if (oversized.status === 0) throw new Error('DPAPI helper accepted an oversized plaintext');
  const invalidOperation = spawnSync(helper, ['export'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: environment,
    shell: false,
  });
  if (invalidOperation.status !== 2) throw new Error('DPAPI helper accepted an unsupported operation');

  writeFileSync(
    auditPath,
    `${JSON.stringify({
      sourceCommit: run('git.exe', ['rev-parse', 'HEAD']).trim(),
      platform: 'windows',
      architecture: 'x64',
      sha256: actualChecksum,
      nodeVersion: actualNode,
      dpapiRoundTripVerified: true,
      dpapiBoundsVerified: true,
      dpapiOperationAllowlistVerified: true,
      signatureStatus: 'unsigned-ci-artifact',
      publishable: false,
      verifiedAt: new Date().toISOString(),
    }, null, 2)}\n`,
    { encoding: 'utf8', mode: 0o600 },
  );
  process.stdout.write(`Verified ${zipPath}\nSHA-256 ${actualChecksum}\nNode ${actualNode}\n`);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
