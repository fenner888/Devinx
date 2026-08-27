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
});
