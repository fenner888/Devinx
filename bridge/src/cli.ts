import { isAbsolute } from 'node:path';
import { networkInterfaces } from 'node:os';
import { createInterface } from 'node:readline/promises';

import { z } from 'zod';

import { discoverPrivateLanAddresses, validateAdvertisedLanHost } from './network';
import { createProductionRunnerDependencies, DesktopBridgeRunner } from './runner';
import { TerminalQrRenderer } from './terminal-qr';

const cliOptionsSchema = z
  .object({
    host: z.string().min(1).max(64),
    port: z.number().int().min(1_024).max(65_535).default(45_831),
    devinCliPath: z
      .string()
      .min(1)
      .max(4_096)
      .refine(isAbsolute, 'Devin CLI path must be absolute')
      .optional(),
  })
  .strict();

export interface DesktopBridgeCliOptions {
  host: string;
  port: number;
  devinCliPath?: string;
}

export type DesktopBridgeCliArguments =
  | { help: true }
  | { help: false; options: DesktopBridgeCliOptions };

export function parseDesktopBridgeArguments(argv: string[]): DesktopBridgeCliArguments {
  if (argv.length === 1 && (argv[0] === '--help' || argv[0] === '-h')) return { help: true };
  const parsed: Record<string, unknown> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument !== '--host' && argument !== '--port' && argument !== '--devin-cli') {
      throw new Error('Unknown Desktop Bridge option');
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error('Desktop Bridge option is missing a value');
    index += 1;
    const key = argument === '--host' ? 'host' : argument === '--port' ? 'port' : 'devinCliPath';
    if (key in parsed) throw new Error('Desktop Bridge option was provided more than once');
    parsed[key] = key === 'port' ? Number(value) : value;
  }
  const result = cliOptionsSchema.safeParse(parsed);
  if (!result.success) throw new Error('Desktop Bridge options are invalid');
  return { help: false, options: result.data };
}

export function safeTerminalText(input: string, maximumLength = 80): string {
  const characters = [...input].map((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    const unsafe =
      codePoint <= 31 ||
      (codePoint >= 127 && codePoint <= 159) ||
      (codePoint >= 0x200b && codePoint <= 0x200f) ||
      (codePoint >= 0x2028 && codePoint <= 0x202f) ||
      (codePoint >= 0x2060 && codePoint <= 0x206f) ||
      codePoint === 0xfeff;
    return unsafe ? ' ' : character;
  });
  const collapsed = characters.join('').replace(/\s+/g, ' ').trim();
  return [...collapsed].slice(0, maximumLength).join('') || 'Unnamed iPhone';
}

function helpText(addresses: string[]): string {
  const detected = addresses.length > 0 ? addresses.join(', ') : 'none detected';
  return [
    'DevinX Desktop Bridge',
    '',
    'Usage:',
    '  npm run bridge:start -- --host <private-ip> [--port 45831] [--devin-cli /absolute/path]',
    '',
    'The --devin-cli option explicitly enables read-only ACP session discovery.',
    `Private addresses detected on this Mac: ${detected}`,
  ].join('\n');
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    timer.unref();
  });
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const interfaces = networkInterfaces();
  const addresses = discoverPrivateLanAddresses(interfaces);
  const argumentsResult = parseDesktopBridgeArguments(argv);
  if (argumentsResult.help) {
    process.stdout.write(`${helpText(addresses)}\n`);
    return;
  }
  const host = validateAdvertisedLanHost(argumentsResult.options.host, interfaces);
  if (process.platform !== 'darwin') throw new Error('Desktop Bridge requires macOS');

  const qrRenderer = new TerminalQrRenderer();
  const runner = new DesktopBridgeRunner(
    {
      advertisedHost: host,
      port: argumentsResult.options.port,
      devinCliPath: argumentsResult.options.devinCliPath,
    },
    createProductionRunnerDependencies(qrRenderer),
  );
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  const questionAbort = new AbortController();
  let stopping = false;
  let resolveShutdown: (() => void) | undefined;
  const shutdown = new Promise<void>((resolve) => {
    resolveShutdown = resolve;
  });
  const requestShutdown = () => {
    if (stopping) return;
    stopping = true;
    questionAbort.abort();
    readline.close();
    resolveShutdown?.();
  };
  process.once('SIGINT', requestShutdown);
  process.once('SIGTERM', requestShutdown);

  try {
    const started = await runner.start();
    process.stdout.write(`DevinX Desktop Bridge is listening securely at ${started.endpoint}\n`);
    process.stdout.write(
      started.sessionDiscoveryEnabled
        ? 'Read-only Devin ACP session discovery is enabled.\n'
        : 'Pairing and bridge health are enabled; Devin ACP session discovery is off.\n',
    );
    process.stdout.write('On your iPhone, open Computer Connection and scan the QR code above.\n');

    let offerExpiresAt = started.pairingOfferExpiresAt;
    let paired = false;
    while (!stopping && !paired) {
      const pending = runner.pendingReviews();
      const review = pending[0];
      if (review) {
        const deviceName = safeTerminalText(review.deviceName);
        let answer = '';
        try {
          answer = await readline.question(
            `Approve pairing for ${deviceName}? Type yes to approve: `,
            { signal: questionAbort.signal },
          );
        } catch {
          if (!stopping) throw new Error('Desktop pairing approval prompt failed');
        }
        if (stopping) break;
        if (answer.trim().toLowerCase() === 'yes') {
          paired = await runner.approve(review.pairingId);
          process.stdout.write(
            paired ? 'iPhone paired successfully. Press Control-C to stop the bridge.\n' : 'Pairing request expired.\n',
          );
        } else {
          runner.deny(review.pairingId);
          process.stdout.write('Pairing request denied. A new QR code is available.\n');
          offerExpiresAt = runner.showPairingOffer();
        }
        continue;
      }
      if (Date.now() >= offerExpiresAt) {
        process.stdout.write('Pairing code expired. Scan the refreshed QR code.\n');
        offerExpiresAt = runner.showPairingOffer();
      }
      await Promise.race([delay(250), shutdown]);
    }
    if (!stopping) await shutdown;
  } finally {
    process.off('SIGINT', requestShutdown);
    process.off('SIGTERM', requestShutdown);
    readline.close();
    await runner.stop();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Desktop Bridge failed';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
