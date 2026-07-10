import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MacOSKeychainSecretStore } from '../../bridge/src/macos-keychain';

describe('macOS Keychain secret adapter', () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  function fakeSecurity(): { executablePath: string; argumentLog: string } {
    const directory = mkdtempSync(join(tmpdir(), 'devinx-security-'));
    temporaryDirectories.push(directory);
    const executablePath = join(directory, 'security');
    const valuePath = join(directory, 'keychain-value');
    const argumentLog = join(directory, 'arguments.log');
    writeFileSync(
      executablePath,
      `#!/usr/bin/env node
const fs = require('node:fs');
const valuePath = ${JSON.stringify(valuePath)};
const argumentLog = ${JSON.stringify(argumentLog)};
const args = process.argv.slice(2);
fs.appendFileSync(argumentLog, JSON.stringify(args) + '\\n');
const command = args[0];
if (command === 'find-generic-password') {
  if (!fs.existsSync(valuePath)) process.exit(44);
  process.stdout.write(fs.readFileSync(valuePath));
  process.stdout.write('\\n');
} else if (command === 'add-generic-password') {
  let input = '';
  process.stdin.on('data', (chunk) => { input += chunk.toString('utf8'); });
  process.stdin.on('end', () => {
    fs.writeFileSync(valuePath, input.replace(/\\r?\\n$/, ''), { mode: 0o600 });
  });
} else if (command === 'delete-generic-password') {
  if (!fs.existsSync(valuePath)) process.exit(44);
  fs.unlinkSync(valuePath);
} else {
  process.exit(2);
}
`,
      { encoding: 'utf8' },
    );
    chmodSync(executablePath, 0o700);
    return { executablePath, argumentLog };
  }

  it('round-trips a secret without placing it in process arguments', async () => {
    const { executablePath, argumentLog } = fakeSecurity();
    const keychain = new MacOSKeychainSecretStore({
      executablePath,
      service: 'com.devinx.test',
      account: 'bridge-state-test',
      timeoutMs: 2_000,
    });
    const value = JSON.stringify({ privateValue: 'sensitive 🦦 bridge state' });

    await expect(keychain.get()).resolves.toBeNull();
    await keychain.set(value);
    await expect(keychain.get()).resolves.toBe(value);

    const loggedArguments = readFileSync(argumentLog, 'utf8');
    expect(loggedArguments).not.toContain('sensitive');
    expect(loggedArguments).not.toContain('bridge state');
    const addArguments = loggedArguments
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as string[])
      .find((args) => args[0] === 'add-generic-password');
    expect(addArguments?.at(-1)).toBe('-w');
    expect(addArguments).toEqual(expect.arrayContaining(['-T', '']));

    await keychain.delete();
    await expect(keychain.get()).resolves.toBeNull();
    expect(existsSync(argumentLog)).toBe(true);
  });

  it('rejects relative security executable paths', () => {
    expect(() => new MacOSKeychainSecretStore({ executablePath: './security' })).toThrow();
  });
});
