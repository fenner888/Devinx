import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

it('expires codes once, recovers after restart, and decodes the native QR in light and dark appearance', () => {
  if (process.platform !== 'darwin') return;
  const root = resolve(__dirname, '../..');
  const directory = mkdtempSync(join(tmpdir(), 'devinx-qr-test-'));
  try {
    const executable = join(directory, 'qr-harness');
    const compile = spawnSync(
      '/usr/bin/xcrun',
      [
        'swiftc',
        '-parse-as-library',
        join(root, 'connector/macos/ConnectorPairingCode.swift'),
        join(root, 'scripts/connector/ConnectorPairingCodeHarness.swift'),
        '-o',
        executable,
      ],
      { encoding: 'utf8', timeout: 60_000 },
    );
    expect({ status: compile.status, stderr: compile.stderr }).toEqual({ status: 0, stderr: '' });
    const run = spawnSync(executable, [], { encoding: 'utf8', timeout: 30_000 });
    expect({ status: run.status, stderr: run.stderr }).toEqual({ status: 0, stderr: '' });
    expect(run.stdout).toContain('PASS expiry refresh-once stop restart QR light dark 360px');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
