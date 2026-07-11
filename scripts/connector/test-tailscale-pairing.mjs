import { spawn } from 'node:child_process';
import { createHmac, generateKeyPairSync } from 'node:crypto';
import { resolve } from 'node:path';

import { canonicalJson } from '../../dist/bridge/canonical.js';

const root = resolve(import.meta.dirname, '..', '..');
const controller = spawn(process.execPath, [resolve(root, 'dist/bridge/connector-cli.js')], {
  cwd: root,
  env: process.env,
  stdio: ['pipe', 'pipe', 'inherit'],
});

let buffer = '';
let settled = false;

function stopController() {
  if (controller.exitCode === null) {
    controller.stdin.end(`${JSON.stringify({ version: 1, type: 'shutdown' })}\n`);
  }
}

async function probe(payload) {
  const offer = JSON.parse(payload);
  const { publicKey } = generateKeyPairSync('ed25519');
  const publicKeySpki = publicKey.export({ format: 'der', type: 'spki' }).toString('base64url');
  const unsigned = {
    protocolVersion: offer.protocolVersion,
    bridgeId: offer.bridgeId,
    pairingId: offer.pairingId,
    bridgeKeyFingerprint: offer.bridgeKeyFingerprint,
    transportSecurity: offer.transportSecurity,
    bridgeEndpoint: offer.bridgeEndpoint,
    tlsCertificateFingerprint: offer.tlsCertificateFingerprint,
    deviceId: 'device_automatedprobe1234567890',
    deviceName: 'Automated Tailscale Probe',
    devicePublicKeySpki: publicKeySpki,
  };
  const secret = Buffer.from(offer.pairingSecret, 'base64url');
  let proof;
  try {
    proof = createHmac('sha256', secret).update(canonicalJson(unsigned)).digest('base64url');
  } finally {
    secret.fill(0);
  }
  const body = JSON.stringify({ ...unsigned, proof });
  const swift = spawn('/usr/bin/swift', [resolve(root, 'scripts/connector/PinnedPairingProbe.swift')], {
    cwd: root,
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  swift.stdin.end(
    JSON.stringify({
      endpoint: offer.bridgeEndpoint,
      certificateFingerprint: offer.tlsCertificateFingerprint,
      body,
    }),
  );
  let output = '';
  swift.stdout.setEncoding('utf8');
  swift.stdout.on('data', (chunk) => {
    output += chunk;
  });
  const code = await new Promise((resolveExit) => swift.once('close', resolveExit));
  if (code !== 0) throw new Error(`Pinned Swift probe failed: ${output.trim()}`);
  const response = JSON.parse(output);
  if (response.status !== 202) {
    throw new Error(`Pinned pairing submission returned HTTP ${response.status}`);
  }
  process.stdout.write('Automated pinned Tailscale pairing submission passed with HTTP 202.\n');
}

controller.stdout.setEncoding('utf8');
controller.stdout.on('data', (chunk) => {
  buffer += chunk;
  let newline = buffer.indexOf('\n');
  while (newline >= 0) {
    const line = buffer.slice(0, newline);
    buffer = buffer.slice(newline + 1);
    if (line) {
      const event = JSON.parse(line);
      if (!settled && event.type === 'pairing_offer') {
        settled = true;
        probe(event.payload)
          .then(() => {
            stopController();
          })
          .catch((error) => {
            process.stderr.write(`${error instanceof Error ? error.message : 'Probe failed'}\n`);
            stopController();
            process.exitCode = 1;
          });
      }
    }
    newline = buffer.indexOf('\n');
  }
});

controller.once('close', (code) => {
  if (!settled || (code !== 0 && process.exitCode !== 1)) {
    process.stderr.write('Connector controller exited before the automated pairing probe completed.\n');
    process.exitCode = 1;
  }
});

setTimeout(() => {
  if (!settled) {
    process.stderr.write('Timed out waiting for a Connector pairing offer.\n');
    process.exitCode = 1;
    stopController();
  }
}, 30_000).unref();
