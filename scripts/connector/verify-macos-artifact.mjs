import { createHash } from 'node:crypto';
import {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { arch, tmpdir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..', '..');
const outputRoot = resolve(repositoryRoot, 'artifacts', 'connector');
const architecture = arch() === 'arm64' ? 'arm64' : arch() === 'x64' ? 'x64' : null;
const appName = 'DevinX Connector.app';
const appRoot = resolve(outputRoot, appName);
const dmgPath = resolve(outputRoot, `DevinX-Connector-0.1.0-macos-${architecture}.dmg`);
const checksumPath = `${dmgPath}.sha256`;
const auditPath = resolve(outputRoot, 'verification-audit.json');
const temporaryRoot = mkdtempSync(resolve(tmpdir(), 'devinx-connector-verify-'));
const mountPoint = resolve(temporaryRoot, 'mounted');
const installRoot = resolve(temporaryRoot, 'clean-install');
const installedApp = resolve(installRoot, appName);
let mounted = false;

function result(executable, args) {
  return spawnSync(executable, args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    shell: false,
  });
}

function run(executable, args, label) {
  const command = result(executable, args);
  if (command.error || command.status !== 0) {
    const detail = `${command.stderr ?? ''}${command.stdout ?? ''}`.trim();
    throw new Error(`${label} failed${detail ? `: ${detail}` : ''}`);
  }
  return `${command.stdout ?? ''}${command.stderr ?? ''}`;
}

function requirePath(path, label) {
  if (!existsSync(path)) throw new Error(`Missing ${label}: ${basename(path)}`);
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function plistValue(app, key) {
  return run(
    '/usr/libexec/PlistBuddy',
    ['-c', `Print :${key}`, resolve(app, 'Contents', 'Info.plist')],
    `Info.plist ${key}`,
  ).trim();
}

function validateRuntimeEntitlements(app) {
  const nodeRuntime = resolve(app, 'Contents', 'Resources', 'runtime', 'node');
  const entitlements = run(
    '/usr/bin/codesign',
    ['-d', '--entitlements', ':-', nodeRuntime],
    'runtime entitlement inspection',
  );
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
  const expectedNode = `v${readFileSync(resolve(repositoryRoot, '.nvmrc'), 'utf8').trim()}`;
  const actualNode = run(nodeRuntime, ['--version'], 'bundled Node version').trim();
  if (actualNode !== expectedNode) {
    throw new Error(`Bundled Node version mismatch: expected ${expectedNode}`);
  }
  return actualNode;
}

function validateApp(app) {
  run('/usr/bin/codesign', ['--verify', '--deep', '--strict', '--verbose=2', app], 'app signature');
  const details = run('/usr/bin/codesign', ['-dv', '--verbose=4', app], 'app signature details');
  const signatureKind = details.includes('Signature=adhoc') ? 'ad-hoc' : 'developer-id';
  if (plistValue(app, 'CFBundleIdentifier') !== 'com.devinx.connector') {
    throw new Error('Unexpected Connector bundle identifier');
  }
  if (plistValue(app, 'CFBundleShortVersionString') !== '0.1.0') {
    throw new Error('Unexpected Connector marketing version');
  }
  if (plistValue(app, 'LSMinimumSystemVersion') !== '13.0') {
    throw new Error('Unexpected Connector minimum macOS version');
  }
  const executable = resolve(app, 'Contents', 'MacOS', 'DevinXConnector');
  const helper = resolve(app, 'Contents', 'Resources', 'macos-keychain-helper');
  for (const path of [executable, helper]) {
    requirePath(path, 'Connector executable');
    if ((lstatSync(path).mode & 0o111) === 0) {
      throw new Error(`${basename(path)} is not executable`);
    }
  }
  const packagedFiles = readdirSync(resolve(app, 'Contents', 'Resources'), {
    recursive: true,
  }).map(String);
  if (packagedFiles.some((path) => path.endsWith('.map'))) {
    throw new Error('The Connector contains a source map');
  }
  return { signatureKind, nodeVersion: validateRuntimeEntitlements(app) };
}

if (process.platform !== 'darwin' || !architecture) {
  throw new Error('Connector artifact verification requires an arm64 or x64 Mac');
}

requirePath(appRoot, 'Connector app');
requirePath(dmgPath, 'Connector DMG');
requirePath(checksumPath, 'Connector checksum');

try {
  const expectedChecksum = readFileSync(checksumPath, 'utf8').trim().split(/\s+/)[0];
  const actualChecksum = sha256(dmgPath);
  if (!/^[a-f0-9]{64}$/.test(expectedChecksum) || actualChecksum !== expectedChecksum) {
    throw new Error('Connector DMG checksum mismatch');
  }
  run('/usr/bin/hdiutil', ['verify', dmgPath], 'DMG verification');
  const sourceApp = validateApp(appRoot);

  mkdirSync(mountPoint, { mode: 0o700 });
  mkdirSync(installRoot, { mode: 0o700 });
  run(
    '/usr/bin/hdiutil',
    ['attach', '-readonly', '-nobrowse', '-mountpoint', mountPoint, dmgPath],
    'read-only DMG mount',
  );
  mounted = true;
  const mountedApp = resolve(mountPoint, appName);
  requirePath(mountedApp, 'mounted Connector app');
  const applicationsLink = resolve(mountPoint, 'Applications');
  if (
    !lstatSync(applicationsLink).isSymbolicLink() ||
    readlinkSync(applicationsLink) !== '/Applications'
  ) {
    throw new Error('DMG Applications link is invalid');
  }

  cpSync(mountedApp, installedApp, { recursive: true, preserveTimestamps: true });
  const installed = validateApp(installedApp);
  if (sourceApp.signatureKind !== installed.signatureKind) {
    throw new Error('Installed Connector signature kind changed during copy');
  }
  const installedBundleIdentifier = plistValue(installedApp, 'CFBundleIdentifier');
  const installedVersion = plistValue(installedApp, 'CFBundleShortVersionString');

  const gatekeeper = result('/usr/sbin/spctl', [
    '--assess',
    '--type',
    'execute',
    '--verbose=4',
    installedApp,
  ]);
  if (sourceApp.signatureKind === 'developer-id') {
    if (gatekeeper.error || gatekeeper.status !== 0) {
      throw new Error('Developer ID Connector failed Gatekeeper assessment');
    }
    run('/usr/bin/xcrun', ['stapler', 'validate', installedApp], 'app staple validation');
    run('/usr/bin/xcrun', ['stapler', 'validate', dmgPath], 'DMG staple validation');
  } else if (gatekeeper.status === 0) {
    throw new Error('Ad-hoc Connector unexpectedly passed Gatekeeper assessment');
  }

  // v1 updates are deliberate signed-DMG replacements, not a silent network
  // updater. Exercise that filesystem path without touching the real
  // /Applications directory or the user's Keychain-backed Connector state.
  rmSync(installedApp, { recursive: true, force: true });
  cpSync(mountedApp, installedApp, { recursive: true, preserveTimestamps: true });
  const replacement = validateApp(installedApp);
  if (
    replacement.signatureKind !== installed.signatureKind ||
    plistValue(installedApp, 'CFBundleIdentifier') !== installedBundleIdentifier
  ) {
    throw new Error('Replacement install changed the Connector identity');
  }
  rmSync(installedApp, { recursive: true, force: true });
  if (existsSync(installedApp)) throw new Error('Temporary Connector uninstall did not remove app');

  writeFileSync(
    auditPath,
    `${JSON.stringify(
      {
        sourceCommit: run('/usr/bin/git', ['rev-parse', 'HEAD'], 'source commit').trim(),
        architecture,
        sha256: actualChecksum,
        signatureKind: sourceApp.signatureKind,
        nodeVersion: sourceApp.nodeVersion,
        bundleIdentifier: installedBundleIdentifier,
        version: installedVersion,
        cleanInstallCopyVerified: true,
        replacementInstallVerified: true,
        temporaryAppRemovalVerified: true,
        gatekeeperExpectedForSignature: true,
        verifiedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    { encoding: 'utf8', mode: 0o600 },
  );
  chmodSync(auditPath, 0o600);
  process.stdout.write(`Verified ${dmgPath}\n`);
  process.stdout.write(`SHA-256 ${actualChecksum}\n`);
  process.stdout.write(`Signature ${sourceApp.signatureKind}\n`);
  process.stdout.write(`Node ${sourceApp.nodeVersion}\n`);
} finally {
  if (mounted) {
    result('/usr/bin/hdiutil', ['detach', mountPoint]);
  }
  rmSync(temporaryRoot, { recursive: true, force: true });
}
