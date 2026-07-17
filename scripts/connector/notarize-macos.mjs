import { createHash } from 'node:crypto';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { arch, homedir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..', '..');
const outputRoot = resolve(repositoryRoot, 'artifacts', 'connector');
const appRoot = resolve(outputRoot, 'DevinX Connector.app');
const nodeRuntimePath = resolve(appRoot, 'Contents', 'Resources', 'runtime', 'node');
const architecture = arch() === 'arm64' ? 'arm64' : arch() === 'x64' ? 'x64' : null;
const dmgPath = resolve(outputRoot, `DevinX-Connector-0.1.2-macos-${architecture}.dmg`);
const zipPath = resolve(outputRoot, 'DevinX-Connector-notarization.zip');
const stagingRoot = resolve(outputRoot, 'notarization-dmg-staging');
const auditPath = resolve(outputRoot, 'notarization-audit.json');
const checkOnly = process.argv.slice(2).includes('--check');

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

function runJson(executable, args, label) {
  const result = spawnSync(executable, args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    shell: false,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${label} failed`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`${label} returned an invalid response`);
  }
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function optionalKeychainPath() {
  const configured = process.env.DEVINX_NOTARYTOOL_KEYCHAIN?.trim();
  if (!configured) return null;
  if (configured === '~') return homedir();
  if (configured.startsWith('~/')) return resolve(homedir(), configured.slice(2));
  return resolve(configured);
}

function notaryCredentials(profile, keychainPath) {
  return [
    '--keychain-profile',
    profile,
    ...(keychainPath ? ['--keychain', keychainPath] : []),
  ];
}

function validateIdentityFormat(identity) {
  if (!identity.startsWith('Developer ID Application: ')) {
    throw new Error('DEVINX_CODESIGN_IDENTITY must be a Developer ID Application identity');
  }
}

function validateIdentityAvailability(identity) {
  const identities = run('/usr/bin/security', ['find-identity', '-v', '-p', 'codesigning']);
  if (!identities.includes(`\"${identity}\"`)) {
    throw new Error('The requested Developer ID Application identity is not available in Keychain');
  }
}

function validateNotaryProfile(profile, keychainPath) {
  run('/usr/bin/xcrun', [
    'notarytool',
    'history',
    ...notaryCredentials(profile, keychainPath),
    '--output-format',
    'json',
  ]);
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function requireArtifact(path) {
  if (!existsSync(path)) throw new Error(`Missing release artifact: ${basename(path)}`);
}

function verifyDeveloperIdApp(identity) {
  run('/usr/bin/codesign', ['--verify', '--deep', '--strict', '--verbose=2', appRoot]);
  const details = run('/usr/bin/codesign', ['-dv', '--verbose=4', appRoot]);
  if (!details.includes(`Authority=${identity}`) || details.includes('Signature=adhoc')) {
    throw new Error('The app is not sealed by the requested Developer ID identity');
  }
  const runtimeDetails = run('/usr/bin/codesign', ['-dv', '--verbose=4', nodeRuntimePath]);
  if (!runtimeDetails.includes(`Authority=${identity}`) || runtimeDetails.includes('Signature=adhoc')) {
    throw new Error('The bundled runtime is not sealed by the requested Developer ID identity');
  }
  const entitlements = run('/usr/bin/codesign', ['-d', '--entitlements', ':-', nodeRuntimePath]);
  if (!entitlements.includes('<key>com.apple.security.cs.allow-jit</key>')) {
    throw new Error('The bundled runtime is missing its required JIT entitlement');
  }
  for (const forbidden of [
    'com.apple.security.get-task-allow',
    'com.apple.security.cs.allow-dyld-environment-variables',
    'com.apple.security.cs.disable-executable-page-protection',
    'com.apple.security.cs.disable-library-validation',
  ]) {
    if (entitlements.includes(`<key>${forbidden}</key>`)) {
      throw new Error(`The bundled runtime contains forbidden entitlement ${forbidden}`);
    }
  }
}

function submitAndReview(path, profile, keychainPath, label) {
  const submission = runJson('/usr/bin/xcrun', [
    'notarytool',
    'submit',
    path,
    ...notaryCredentials(profile, keychainPath),
    '--wait',
    '--output-format',
    'json',
  ], `${label} notarization`);
  if (submission.status !== 'Accepted' || typeof submission.id !== 'string') {
    throw new Error(`${label} notarization was not accepted`);
  }

  const logPath = resolve(outputRoot, `${label.toLowerCase()}-notarization-log.json`);
  rmSync(logPath, { force: true });
  run('/usr/bin/xcrun', [
    'notarytool',
    'log',
    submission.id,
    ...notaryCredentials(profile, keychainPath),
    logPath,
  ]);
  const log = JSON.parse(readFileSync(logPath, 'utf8'));
  const issues = Array.isArray(log.issues) ? log.issues : [];
  if (issues.length > 0) {
    throw new Error(`${label} notarization log contains ${issues.length} issue(s)`);
  }
  return { id: submission.id, status: submission.status };
}

function rebuildSignedDmg(identity) {
  rmSync(stagingRoot, { recursive: true, force: true });
  rmSync(dmgPath, { force: true });
  mkdirSync(stagingRoot, { recursive: true });
  cpSync(appRoot, resolve(stagingRoot, 'DevinX Connector.app'), { recursive: true });
  copyFileSync(resolve(repositoryRoot, 'LICENSE'), resolve(stagingRoot, 'LICENSE.txt'));
  symlinkSync('/Applications', resolve(stagingRoot, 'Applications'));
  run('/usr/bin/hdiutil', [
    'create',
    '-volname',
    'DevinX Connector',
    '-srcfolder',
    stagingRoot,
    '-ov',
    '-format',
    'UDZO',
    dmgPath,
  ]);
  rmSync(stagingRoot, { recursive: true, force: true });
  run('/usr/bin/codesign', ['--force', '--timestamp', '--sign', identity, dmgPath]);
  run('/usr/bin/codesign', ['--verify', '--verbose=2', dmgPath]);
  run('/usr/bin/hdiutil', ['verify', dmgPath]);
}

const identity = requiredEnvironment('DEVINX_CODESIGN_IDENTITY');
const profile = requiredEnvironment('DEVINX_NOTARYTOOL_PROFILE');
const keychainPath = optionalKeychainPath();
validateIdentityFormat(identity);
if (process.platform !== 'darwin' || !architecture) {
  throw new Error('Connector notarization requires an arm64 or x64 Mac');
}
validateIdentityAvailability(identity);
validateNotaryProfile(profile, keychainPath);

if (checkOnly) {
  process.stdout.write('Developer ID identity and notarytool profile are ready.\n');
  process.exit(0);
}

requireArtifact(appRoot);
verifyDeveloperIdApp(identity);

rmSync(zipPath, { force: true });
run('/usr/bin/ditto', ['-c', '-k', '--keepParent', appRoot, zipPath]);
const appSubmission = submitAndReview(zipPath, profile, keychainPath, 'App');
run('/usr/bin/xcrun', ['stapler', 'staple', appRoot]);
run('/usr/bin/xcrun', ['stapler', 'validate', appRoot]);
run('/usr/sbin/spctl', ['--assess', '--type', 'execute', '--verbose=4', appRoot]);
rmSync(zipPath, { force: true });

rebuildSignedDmg(identity);
const dmgSubmission = submitAndReview(dmgPath, profile, keychainPath, 'Dmg');
run('/usr/bin/xcrun', ['stapler', 'staple', dmgPath]);
run('/usr/bin/xcrun', ['stapler', 'validate', dmgPath]);
run('/usr/sbin/spctl', [
  '--assess',
  '--type',
  'open',
  '--context',
  'context:primary-signature',
  '--verbose=4',
  dmgPath,
]);

const digest = sha256(dmgPath);
writeFileSync(`${dmgPath}.sha256`, `${digest}  ${basename(dmgPath)}\n`, {
  encoding: 'utf8',
  mode: 0o644,
});
writeFileSync(
  auditPath,
  `${JSON.stringify(
    {
      appSubmission,
      dmgSubmission,
      identity,
      sha256: digest,
      completedAt: new Date().toISOString(),
    },
    null,
    2,
  )}\n`,
  { encoding: 'utf8', mode: 0o600 },
);

process.stdout.write(`Notarized and stapled ${appRoot}\n`);
process.stdout.write(`Notarized and stapled ${dmgPath}\n`);
process.stdout.write(`SHA-256 ${digest}\n`);
