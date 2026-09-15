import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
// Run after fetching origin. Release code must include every current main fix.
execFileSync('git', ['merge-base', '--is-ancestor', 'origin/main', 'HEAD'], { cwd: root });
if (git('status', '--porcelain')) throw new Error('Commit and review source before archiving.');
const config = JSON.parse(read('app.json')).expo;
if (Number(config.ios.buildNumber) <= 81) throw new Error('Recovery build must be newer than 81.');
if (!config.ios.infoPlist.NSCameraUsageDescription) throw new Error('Camera purpose is missing.');
const mobile = read('src/auth/computerPairing.ts').match(/const PROTOCOL_VERSION = (\d+)/)?.[1];
const bridge = read('bridge/src/schemas.ts').match(/const BRIDGE_PROTOCOL_VERSION = (\d+)/)?.[1];
if (mobile !== '2' || mobile !== bridge) throw new Error('Pairing protocol mismatch.');
if (!read('src/auth/deviceSigning.ts').includes('export async function postTailnetBridgeJson(')) {
  throw new Error('Tailscale transport is missing.');
}
if (
  !read('modules/devinx-device-crypto/ios/DevinXDeviceCryptoModule.swift').includes(
    'View(DevinXQrScannerView.self)',
  )
) {
  throw new Error('Native pairing scanner is missing.');
}
if (!read('src/lib/connections.ts').includes("label: 'Local'"))
  throw new Error('Local mode label is missing.');
process.stdout.write(
  `${JSON.stringify(
    {
      sourceCommit: git('rev-parse', 'HEAD'),
      mainCommit: git('rev-parse', 'origin/main'),
      appVersion: config.version,
      buildNumber: config.ios.buildNumber,
      pairingProtocol: Number(mobile),
      lockfileBlob: git('rev-parse', 'HEAD:package-lock.json'),
    },
    null,
    2,
  )}\n`,
);
