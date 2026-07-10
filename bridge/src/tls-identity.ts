import { spawn } from 'node:child_process';
import { createHash, createPrivateKey, X509Certificate } from 'node:crypto';
import { isAbsolute } from 'node:path';
import type { Readable } from 'node:stream';

import { z } from 'zod';

const DEFAULT_OPENSSL_PATH = '/usr/bin/openssl';
const DEFAULT_TIMEOUT_MS = 30_000;
const MAXIMUM_PEM_BYTES = 128 * 1024;
const MAXIMUM_VALIDITY_MS = 370 * 24 * 60 * 60 * 1_000;

const base64UrlSha256Schema = z
  .string()
  .length(43)
  .regex(/^[A-Za-z0-9_-]+$/);

export const tlsIdentitySchema = z
  .object({
    certificatePem: z
      .string()
      .min(1)
      .max(MAXIMUM_PEM_BYTES)
      .regex(/^-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----\s*$/),
    privateKeyPem: z
      .string()
      .min(1)
      .max(MAXIMUM_PEM_BYTES)
      .regex(/^-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]+-----END (?:RSA )?PRIVATE KEY-----\s*$/),
    certificateFingerprint: base64UrlSha256Schema,
    validFrom: z.number().int().nonnegative(),
    validTo: z.number().int().positive(),
    createdAt: z.number().int().nonnegative(),
  })
  .strict();

const generatorOptionsSchema = z
  .object({
    executablePath: z
      .string()
      .min(1)
      .max(4096)
      .refine(isAbsolute, 'OpenSSL executable path must be absolute')
      .default(DEFAULT_OPENSSL_PATH),
    validityDays: z.number().int().min(1).max(365).default(365),
    timeoutMs: z.number().int().min(1_000).max(60_000).default(DEFAULT_TIMEOUT_MS),
  })
  .strict();

export type TlsIdentity = z.infer<typeof tlsIdentitySchema>;

export interface TlsIdentityGenerator {
  generate(): Promise<TlsIdentity>;
}

export interface OpenSslTlsIdentityGeneratorOptions {
  executablePath?: string;
  validityDays?: number;
  timeoutMs?: number;
}

export interface ParseTlsIdentityOptions {
  now?: number;
  requireCurrentlyValid?: boolean;
}

function certificateFingerprint(certificate: X509Certificate): string {
  return createHash('sha256').update(certificate.raw).digest('base64url');
}

function safeEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    NODE_ENV: process.env.NODE_ENV ?? 'production',
    NO_COLOR: '1',
  };
  for (const key of ['HOME', 'LANG', 'LC_ALL', 'LOGNAME', 'PATH', 'TMPDIR', 'USER'] as const) {
    const value = process.env[key];
    if (value) environment[key] = value;
  }
  return environment;
}

export function parseTlsIdentity(
  input: unknown,
  options: ParseTlsIdentityOptions = {},
): TlsIdentity {
  const result = tlsIdentitySchema.safeParse(input);
  if (!result.success) throw new Error('Desktop Bridge TLS identity failed validation');
  const identity = result.data;
  const now = options.now ?? Date.now();
  if (!Number.isSafeInteger(now) || now < 0) {
    throw new Error('Desktop Bridge TLS validation time is invalid');
  }

  try {
    const certificate = new X509Certificate(identity.certificatePem);
    const privateKey = createPrivateKey(identity.privateKeyPem);
    const validFrom = Date.parse(certificate.validFrom);
    const validTo = Date.parse(certificate.validTo);
    const modulusLength = privateKey.asymmetricKeyDetails?.modulusLength;
    const requireCurrentlyValid = options.requireCurrentlyValid ?? true;
    if (
      privateKey.asymmetricKeyType !== 'rsa' ||
      modulusLength === undefined ||
      modulusLength < 2_048 ||
      !certificate.checkPrivateKey(privateKey) ||
      certificate.publicKey.asymmetricKeyType !== 'rsa' ||
      certificate.ca ||
      certificate.subject !== certificate.issuer ||
      !certificate.verify(certificate.publicKey) ||
      !Number.isSafeInteger(validFrom) ||
      !Number.isSafeInteger(validTo) ||
      validFrom !== identity.validFrom ||
      validTo !== identity.validTo ||
      validTo <= validFrom ||
      validTo - validFrom > MAXIMUM_VALIDITY_MS ||
      identity.createdAt < validFrom - 5_000 ||
      identity.createdAt > validTo ||
      certificateFingerprint(certificate) !== identity.certificateFingerprint ||
      (requireCurrentlyValid && (validFrom > now + 5_000 || validTo <= now))
    ) {
      throw new Error('Invalid TLS identity');
    }
  } catch {
    throw new Error('Desktop Bridge TLS identity failed cryptographic validation');
  }
  return { ...identity };
}

export function tlsIdentityFromPem(
  certificatePem: string,
  privateKeyPem: string,
  createdAt = Date.now(),
): TlsIdentity {
  try {
    const certificate = new X509Certificate(certificatePem);
    return parseTlsIdentity({
      certificatePem,
      privateKeyPem,
      certificateFingerprint: certificateFingerprint(certificate),
      validFrom: Date.parse(certificate.validFrom),
      validTo: Date.parse(certificate.validTo),
      createdAt,
    });
  } catch {
    throw new Error('Desktop Bridge TLS identity failed cryptographic validation');
  }
}

export class OpenSslTlsIdentityGenerator implements TlsIdentityGenerator {
  private readonly options: z.infer<typeof generatorOptionsSchema>;

  constructor(options: OpenSslTlsIdentityGeneratorOptions = {}) {
    this.options = generatorOptionsSchema.parse(options);
  }

  generate(): Promise<TlsIdentity> {
    return new Promise((resolve, reject) => {
      const environment = safeEnvironment();
      const workingDirectory = environment.HOME;
      if (!workingDirectory || !isAbsolute(workingDirectory)) {
        reject(new Error('TLS identity generation requires an absolute home directory'));
        return;
      }

      const child = spawn(
        this.options.executablePath,
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
          String(this.options.validityDays),
          '-addext',
          'basicConstraints=critical,CA:FALSE',
          '-addext',
          'keyUsage=critical,digitalSignature,keyEncipherment',
          '-addext',
          'extendedKeyUsage=serverAuth',
          '-keyout',
          '/dev/fd/3',
          '-out',
          '/dev/fd/4',
        ],
        {
          cwd: workingDirectory,
          env: environment,
          shell: false,
          stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'],
        },
      );
      const keyStream = child.stdio[3] as Readable | null;
      const certificateStream = child.stdio[4] as Readable | null;
      if (!keyStream || !certificateStream || !child.stderr) {
        child.kill('SIGKILL');
        reject(new Error('OpenSSL did not provide secure output pipes'));
        return;
      }

      const keyChunks: Buffer[] = [];
      const certificateChunks: Buffer[] = [];
      let keyBytes = 0;
      let certificateBytes = 0;
      let settled = false;
      const wipe = () => {
        for (const chunk of keyChunks) chunk.fill(0);
        for (const chunk of certificateChunks) chunk.fill(0);
        keyChunks.length = 0;
        certificateChunks.length = 0;
      };
      const terminate = () => {
        if (child.exitCode !== null || child.signalCode !== null) return;
        child.kill('SIGTERM');
        const forceTimer = setTimeout(() => {
          if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
        }, 250);
        forceTimer.unref();
      };
      const finish = (operation: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        operation();
      };
      const fail = (message: string) => {
        finish(() => {
          wipe();
          terminate();
          reject(new Error(message));
        });
      };
      const timer = setTimeout(
        () => fail('TLS identity generation timed out'),
        this.options.timeoutMs,
      );
      timer.unref();

      child.stderr.resume();
      child.on('error', () => fail('OpenSSL could not be started'));
      keyStream.on('error', () => fail('OpenSSL private-key output failed'));
      certificateStream.on('error', () => fail('OpenSSL certificate output failed'));
      keyStream.on('data', (chunk: Buffer) => {
        if (settled) return;
        keyBytes += chunk.length;
        if (keyBytes > MAXIMUM_PEM_BYTES) {
          fail('OpenSSL private-key output exceeded the size limit');
          return;
        }
        keyChunks.push(Buffer.from(chunk));
      });
      certificateStream.on('data', (chunk: Buffer) => {
        if (settled) return;
        certificateBytes += chunk.length;
        if (certificateBytes > MAXIMUM_PEM_BYTES) {
          fail('OpenSSL certificate output exceeded the size limit');
          return;
        }
        certificateChunks.push(Buffer.from(chunk));
      });
      child.on('close', (code) => {
        finish(() => {
          if (code !== 0 || keyBytes === 0 || certificateBytes === 0) {
            wipe();
            reject(new Error('TLS identity generation failed'));
            return;
          }
          const key = Buffer.concat(keyChunks);
          const certificateBytesBuffer = Buffer.concat(certificateChunks);
          wipe();
          try {
            const certificatePem = certificateBytesBuffer.toString('utf8');
            const privateKeyPem = key.toString('utf8');
            const identity = tlsIdentityFromPem(certificatePem, privateKeyPem);
            key.fill(0);
            certificateBytesBuffer.fill(0);
            resolve(identity);
          } catch {
            key.fill(0);
            certificateBytesBuffer.fill(0);
            reject(new Error('Generated TLS identity failed validation'));
          }
        });
      });
    });
  }
}
