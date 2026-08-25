import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repositoryRoot = resolve(__dirname, '../..');
const supervisorSource = resolve(
  repositoryRoot,
  'connector/macos/ConnectorProcessSupervisor.swift',
);
const harnessSource = resolve(
  repositoryRoot,
  'scripts/connector/ConnectorProcessSupervisorHarness.swift',
);

describe('macOS Connector process supervisor', () => {
  it('cleans EOF and every failure path, permits restart, and passes the repeated-exit soak gates', () => {
    if (process.platform !== 'darwin') return;
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'devinx-supervisor-test-'));
    const executable = join(temporaryDirectory, 'supervisor-harness');
    try {
      const compilation = spawnSync(
        '/usr/bin/xcrun',
        [
          'swiftc',
          '-parse-as-library',
          supervisorSource,
          harnessSource,
          '-o',
          executable,
        ],
        { encoding: 'utf8', timeout: 60_000 },
      );
      expect({ status: compilation.status, stderr: compilation.stderr }).toEqual({
        status: 0,
        stderr: '',
      });

      const run = spawnSync(executable, [], { encoding: 'utf8', timeout: 60_000 });
      expect({ status: run.status, stderr: run.stderr }).toEqual({ status: 0, stderr: '' });
      expect(run.stdout).toContain(
        'PASS normal-exit launch-failure stop restart soak=100',
      );
      expect(run.stdout).toContain('diskGrowth=0');
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it('does not introduce a project-owned file or log writer', () => {
    const source = readFileSync(supervisorSource, 'utf8');
    expect(source).not.toMatch(/FileHandle\s*\(\s*forWritingTo:/);
    expect(source).not.toMatch(/createFile\s*\(/);
    expect(source).not.toMatch(/\.log["']/);
    expect(source).not.toMatch(/write\s*\(\s*to:/);
  });
});
