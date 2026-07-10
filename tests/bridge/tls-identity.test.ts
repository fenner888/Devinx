import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { OpenSslTlsIdentityGenerator, parseTlsIdentity } from '../../bridge/src/tls-identity';

describe('Desktop Bridge TLS identity generator', () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  function fakeOpenSsl(): { executablePath: string; argumentLog: string } {
    const directory = mkdtempSync(join(tmpdir(), 'devinx-openssl-test-'));
    temporaryDirectories.push(directory);
    const certificatePath = join(directory, 'fixture.crt');
    const keyPath = join(directory, 'fixture.key');
    const argumentLog = join(directory, 'arguments.json');
    execFileSync(
      '/usr/bin/openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-sha256',
        '-subj',
        '/CN=DevinX Desktop Bridge',
        '-days',
        '1',
        '-addext',
        'basicConstraints=critical,CA:FALSE',
        '-keyout',
        keyPath,
        '-out',
        certificatePath,
      ],
      { stdio: 'ignore' },
    );

    const executablePath = join(directory, 'openssl');
    writeFileSync(
      executablePath,
      `#!/usr/bin/env node
const fs = require('node:fs');
fs.writeFileSync(${JSON.stringify(argumentLog)}, JSON.stringify(process.argv.slice(2)));
fs.writeSync(3, fs.readFileSync(${JSON.stringify(keyPath)}));
fs.writeSync(4, fs.readFileSync(${JSON.stringify(certificatePath)}));
`,
      { encoding: 'utf8', mode: 0o700 },
    );
    chmodSync(executablePath, 0o700);
    return { executablePath, argumentLog };
  }

  it('returns a validated self-signed identity through dedicated pipes', async () => {
    const { executablePath, argumentLog } = fakeOpenSsl();
    const identity = await new OpenSslTlsIdentityGenerator({
      executablePath,
      validityDays: 1,
      timeoutMs: 2_000,
    }).generate();

    expect(identity.certificateFingerprint).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(identity.certificatePem).toContain('BEGIN CERTIFICATE');
    expect(identity.privateKeyPem).toContain('BEGIN PRIVATE KEY');
    expect(parseTlsIdentity(identity)).toEqual(identity);

    const args = JSON.parse(readFileSync(argumentLog, 'utf8')) as string[];
    expect(args).toEqual(expect.arrayContaining(['/dev/fd/3', '/dev/fd/4']));
    expect(JSON.stringify(args)).not.toContain('BEGIN PRIVATE KEY');
    expect(args).not.toContain(expect.stringContaining('fixture.key'));
  });

  it('fails closed on a modified fingerprint or private key', async () => {
    const first = fakeOpenSsl();
    const second = fakeOpenSsl();
    const firstIdentity = await new OpenSslTlsIdentityGenerator({
      executablePath: first.executablePath,
      timeoutMs: 2_000,
    }).generate();
    const secondIdentity = await new OpenSslTlsIdentityGenerator({
      executablePath: second.executablePath,
      timeoutMs: 2_000,
    }).generate();

    expect(() =>
      parseTlsIdentity({ ...firstIdentity, certificateFingerprint: 'A'.repeat(43) }),
    ).toThrow('cryptographic validation');
    expect(() =>
      parseTlsIdentity({ ...firstIdentity, privateKeyPem: secondIdentity.privateKeyPem }),
    ).toThrow('cryptographic validation');
    expect(() =>
      parseTlsIdentity({ ...firstIdentity, createdAt: firstIdentity.validFrom - 5_001 }),
    ).toThrow('cryptographic validation');
  });

  it('rejects relative executable paths', () => {
    expect(() => new OpenSslTlsIdentityGenerator({ executablePath: './openssl' })).toThrow();
  });
});
