import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'darwin') process.exit(0);

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..', '..');
const sourcePath = resolve(repositoryRoot, 'bridge', 'macos-keychain-helper.swift');
const outputPath = resolve(repositoryRoot, 'dist', 'bridge', 'macos-keychain-helper');
mkdirSync(dirname(outputPath), { recursive: true });

const result = spawnSync(
  '/usr/bin/xcrun',
  ['swiftc', sourcePath, '-framework', 'Security', '-o', outputPath],
  { stdio: 'inherit', shell: false },
);
if (result.error || result.status !== 0) {
  process.stderr.write('Failed to build the macOS Keychain helper.\n');
  process.exit(1);
}
