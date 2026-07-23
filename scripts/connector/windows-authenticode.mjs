import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function run(executable, args) {
  const result = spawnSync(executable, args, {
    encoding: 'utf8',
    shell: false,
    stdio: 'pipe',
  });
  if (result.error || result.status !== 0) {
    const detail = `${result.stderr ?? ''}${result.stdout ?? ''}`.trim();
    throw new Error(`Authenticode operation failed${detail ? `: ${detail}` : ''}`);
  }
}

export function findSignTool() {
  if (process.platform !== 'win32') {
    throw new Error('Authenticode operations require Windows');
  }
  const direct = spawnSync('where.exe', ['signtool.exe'], {
    encoding: 'utf8',
    shell: false,
  });
  const located =
    direct.status === 0
      ? direct.stdout
          .split(/\r?\n/)
          .map((value) => value.trim())
          .find((value) => value && existsSync(value))
      : undefined;
  if (located) return located;

  const programFiles = process.env['ProgramFiles(x86)'];
  if (!programFiles) throw new Error('The Windows SDK SignTool is unavailable');
  const kitsRoot = resolve(programFiles, 'Windows Kits', '10', 'bin');
  if (!existsSync(kitsRoot)) throw new Error('The Windows SDK SignTool is unavailable');
  const versions = readdirSync(kitsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d+\.\d+\.\d+\.\d+$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));
  for (const version of versions) {
    const candidate = resolve(kitsRoot, version, 'x64', 'signtool.exe');
    if (existsSync(candidate)) return candidate;
  }
  throw new Error('The Windows SDK SignTool is unavailable');
}

export function signWindowsFile(path) {
  const thumbprint = process.env.DEVINX_WINDOWS_SIGN_CERT_SHA1?.replace(/\s/g, '').toUpperCase();
  if (!thumbprint || !/^[A-F0-9]{40}$/.test(thumbprint)) {
    throw new Error('A valid current-user Authenticode certificate thumbprint is required');
  }
  const timestamp = process.env.DEVINX_WINDOWS_TIMESTAMP_URL;
  let timestampUrl;
  try {
    timestampUrl = timestamp ? new URL(timestamp) : null;
  } catch {
    throw new Error('A valid Authenticode timestamp URL is required');
  }
  if (!timestampUrl || !['http:', 'https:'].includes(timestampUrl.protocol)) {
    throw new Error('A valid Authenticode timestamp URL is required');
  }
  run(findSignTool(), [
    'sign',
    '/sha1',
    thumbprint,
    '/s',
    'My',
    '/fd',
    'SHA256',
    '/tr',
    timestampUrl.toString(),
    '/td',
    'SHA256',
    '/d',
    'DevinX Connector',
    path,
  ]);
  verifyWindowsSignature(path);
}

export function verifyWindowsSignature(path) {
  run(findSignTool(), ['verify', '/pa', '/all', path]);
}
