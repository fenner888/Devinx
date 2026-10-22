import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repositoryRoot = resolve(__dirname, '..', '..');

describe('Windows Store runtime staging', () => {
  const program = readFileSync(
    resolve(repositoryRoot, 'connector/windows/Program.cs'),
    'utf8',
  );
  const verifier = readFileSync(
    resolve(repositoryRoot, 'scripts/connector/verify-windows-msix.mjs'),
    'utf8',
  );
  const artifactVerifier = readFileSync(
    resolve(repositoryRoot, 'scripts/connector/verify-windows-artifact.mjs'),
    'utf8',
  );
  const dpapiHelper = readFileSync(
    resolve(repositoryRoot, 'bridge/windows-dpapi-helper/Program.cs'),
    'utf8',
  );
  const windowsDpapi = readFileSync(
    resolve(repositoryRoot, 'bridge/src/windows-dpapi.ts'),
    'utf8',
  );

  it('launches only an integrity-checked per-user copy of the packaged runtime', () => {
    expect(program).toContain('Environment.SpecialFolder.LocalApplicationData');
    expect(program).toContain('DEVINX_RUNTIME_STAGE_ROOT');
    expect(program).toContain('SHA256.HashData');
    expect(program).toContain('HasReparsePoint');
    expect(program).toContain('File.Copy(source, destination, overwrite: false)');
    expect(program).toContain('Directory.Move(temporaryRoot, stagedRoot)');
    expect(program).toContain('FileName = staged.NodePath');
    expect(program).toContain('ArgumentList = { staged.ScriptPath }');
    expect(program).not.toContain(
      'FileName = Path.Combine(AppContext.BaseDirectory, "Resources", "runtime", "node.exe")',
    );
  });

  it('makes a real staged-runtime launch part of MSIX acceptance', () => {
    expect(program).toContain('--verify-runtime-launch');
    expect(verifier).toContain("['--verify-runtime-launch']");
    expect(verifier).toContain('Store runtime staging did not create exactly one verified version');
    expect(verifier).toContain("'runtime/node.exe'");
    expect(verifier).toContain("'windows-dpapi-helper.exe'");
  });

  it('isolates DPAPI verification from the real Connector state', () => {
    expect(dpapiHelper).toContain('DEVINX_DPAPI_STATE_ROOT');
    expect(dpapiHelper).toContain('Path.IsPathFullyQualified(stateRoot)');
    expect(artifactVerifier).toContain('DEVINX_DPAPI_STATE_ROOT: isolatedDpapiStateRoot');
    expect(artifactVerifier).toContain(
      "join(localAppData, 'DevinX', 'Connector', 'bridge-state-v1.dpapi')",
    );
    expect(artifactVerifier).toContain('Verification modified the real Connector state');
    expect(verifier).toContain('DEVINX_DPAPI_STATE_ROOT: isolatedDpapiStateRoot');
    expect(verifier).toContain('LOCALAPPDATA: isolatedLocalAppData');
    expect(verifier).toContain('Verification modified the real Connector state');
    expect(windowsDpapi).not.toContain('DEVINX_DPAPI_STATE_ROOT');
  });

  it('keeps paired-iPhone card layout free of docked children', () => {
    const createDeviceCardStart = program.indexOf(
      'private FlowLayoutPanel CreateDeviceCard(',
    );
    const saveSelectedPermissionsStart = program.indexOf(
      'private async Task SaveSelectedPermissionsAsync(',
      createDeviceCardStart,
    );

    expect(createDeviceCardStart).toBeGreaterThanOrEqual(0);
    expect(saveSelectedPermissionsStart).toBeGreaterThan(createDeviceCardStart);
    expect(
      program.slice(createDeviceCardStart, saveSelectedPermissionsStart),
    ).not.toContain('DockStyle');
  });
});
