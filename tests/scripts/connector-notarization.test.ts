import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repositoryRoot = resolve(__dirname, '..', '..');
const scriptPath = resolve(repositoryRoot, 'scripts', 'connector', 'notarize-macos.mjs');
const runtimeEntitlementsPath = resolve(
  repositoryRoot,
  'connector',
  'macos',
  'NodeRuntime.entitlements',
);

function checkWithEnvironment(environment: Record<string, string | undefined>) {
  const env = { ...process.env };
  delete env.DEVINX_CODESIGN_IDENTITY;
  delete env.DEVINX_NOTARYTOOL_PROFILE;
  for (const [name, value] of Object.entries(environment)) {
    if (value !== undefined) env[name] = value;
  }
  return spawnSync(process.execPath, [scriptPath, '--check'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env,
    shell: false,
  });
}

describe('macOS Connector notarization policy', () => {
  it('fails closed when release credentials are not explicitly selected', () => {
    const result = checkWithEnvironment({});
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('DEVINX_CODESIGN_IDENTITY is required');
  });

  it('rejects development identities before any notary operation', () => {
    const result = checkWithEnvironment({
      DEVINX_CODESIGN_IDENTITY: 'Apple Development: Example',
      DEVINX_NOTARYTOOL_PROFILE: 'example-profile',
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('must be a Developer ID Application identity');
  });

  it('uses the current two-stage notarytool workflow and release verifiers', () => {
    const source = readFileSync(scriptPath, 'utf8');
    expect(source).toContain("'notarytool'");
    expect(source).toContain("'stapler'");
    expect(source).toContain("'/usr/bin/hdiutil'");
    expect(source).toContain("'/usr/sbin/spctl'");
    expect(source).not.toContain("'altool'");
    expect(source.match(/submitAndReview\(/g)).toHaveLength(3); // definition + app + DMG
  });

  it('grants the bundled runtime only JIT permission', () => {
    const entitlements = readFileSync(runtimeEntitlementsPath, 'utf8');
    expect(entitlements).toContain('com.apple.security.cs.allow-jit');
    expect(entitlements).not.toContain('com.apple.security.get-task-allow');
    expect(entitlements).not.toContain('allow-dyld-environment-variables');
    expect(entitlements).not.toContain('disable-executable-page-protection');
    expect(entitlements).not.toContain('disable-library-validation');
  });
});
