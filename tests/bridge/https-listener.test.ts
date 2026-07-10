import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, mkdtempSync } from 'node:fs';
import { request as httpsRequest } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  HttpsBridgeListener,
  type HttpsBridgeListenerAddress,
} from '../../bridge/src/listener';
import type { BridgeServiceResponse } from '../../bridge/src/service';

interface TestResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}

interface Deferred {
  promise: Promise<void>;
  resolve(): void;
}

function deferred(): Deferred {
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: () => resolvePromise?.() };
}

function generateCertificate(directory: string, name: string): { certificate: string; key: string } {
  const certificatePath = join(directory, `${name}.crt`);
  const keyPath = join(directory, `${name}.key`);
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
      '/CN=127.0.0.1',
      '-days',
      '1',
      '-keyout',
      keyPath,
      '-out',
      certificatePath,
    ],
    { stdio: 'ignore' },
  );
  return {
    certificate: readFileSync(certificatePath, 'utf8'),
    key: readFileSync(keyPath, 'utf8'),
  };
}

function post(
  address: HttpsBridgeListenerAddress,
  body: string,
  headers: Record<string, string> = {},
): Promise<TestResponse> {
  return new Promise((resolve, reject) => {
    const request = httpsRequest(
      {
        host: '127.0.0.1',
        port: address.port,
        path: '/v1/request',
        method: 'POST',
        rejectUnauthorized: false,
        agent: false,
        headers: {
          Host: `127.0.0.1:${address.port}`,
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(body, 'utf8').toString(),
          ...headers,
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        response.on('end', () => {
          try {
            const text = Buffer.concat(chunks).toString('utf8');
            resolve({
              status: response.statusCode ?? 0,
              headers: response.headers,
              body: JSON.parse(text) as unknown,
            });
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    request.on('error', reject);
    request.end(body);
  });
}

describe('encrypted Desktop Bridge listener', () => {
  let directory: string;
  let tls: { certificate: string; key: string };
  let secondTls: { certificate: string; key: string };
  let listener: HttpsBridgeListener | null = null;

  beforeAll(() => {
    directory = mkdtempSync(join(tmpdir(), 'devinx-listener-test-'));
    tls = generateCertificate(directory, 'bridge');
    secondTls = generateCertificate(directory, 'other');
  });

  afterEach(async () => {
    await listener?.stop();
    listener = null;
  });

  afterAll(() => rmSync(directory, { recursive: true, force: true }));

  function service(
    handle: (
      input: unknown,
      context: { peerKey: string; now: number },
    ) => Promise<BridgeServiceResponse> = async () => ({ status: 200, body: { ok: true } }),
  ) {
    return { handle: jest.fn(handle) };
  }

  function createListener(
    bridgeService: ReturnType<typeof service>,
    overrides: Partial<ConstructorParameters<typeof HttpsBridgeListener>[0]> = {},
  ): HttpsBridgeListener {
    listener = new HttpsBridgeListener({
      service: bridgeService,
      tlsCertificatePem: tls.certificate,
      tlsPrivateKeyPem: tls.key,
      port: 0,
      ...overrides,
    });
    return listener;
  }

  it('binds only after start and dispatches bounded HTTPS JSON with a socket-derived peer key', async () => {
    const bridgeService = service();
    const server = createListener(bridgeService);
    const address = await server.start();

    expect(address).toEqual({
      host: '127.0.0.1',
      port: expect.any(Number),
      certificateFingerprint: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    });
    const result = await post(address, JSON.stringify({ signed: 'request' }));

    expect(result).toMatchObject({ status: 200, body: { ok: true } });
    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.headers['x-content-type-options']).toBe('nosniff');
    expect(bridgeService.handle).toHaveBeenCalledWith(
      { signed: 'request' },
      {
        peerKey: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
        now: expect.any(Number),
      },
    );
    expect(JSON.stringify(bridgeService.handle.mock.calls)).not.toContain('127.0.0.1');
  });

  it('rejects Host confusion and browser-origin credentials before dispatch', async () => {
    const bridgeService = service();
    const address = await createListener(bridgeService).start();
    const json = JSON.stringify({ signed: 'request' });

    await expect(post(address, json, { Host: `attacker.invalid:${address.port}` })).resolves.toMatchObject({
      status: 404,
      body: { error: 'not_found' },
    });
    await expect(post(address, json, { Origin: 'https://attacker.invalid' })).resolves.toMatchObject({
      status: 404,
      body: { error: 'not_found' },
    });
    await expect(post(address, json, { Cookie: 'ambient=credential' })).resolves.toMatchObject({
      status: 404,
      body: { error: 'not_found' },
    });
    expect(bridgeService.handle).not.toHaveBeenCalled();
  });

  it('rejects invalid JSON, unsupported media, and oversized declarations before dispatch', async () => {
    const bridgeService = service();
    const address = await createListener(bridgeService, { maximumBodyBytes: 1_024 }).start();

    await expect(post(address, '{invalid')).resolves.toMatchObject({
      status: 400,
      body: { error: 'invalid_request' },
    });
    await expect(post(address, '{}', { 'Content-Type': 'text/plain' })).resolves.toMatchObject({
      status: 415,
      body: { error: 'unsupported_media_type' },
    });
    await expect(post(address, '{}', { 'Content-Length': '2048' })).resolves.toMatchObject({
      status: 413,
      body: { error: 'request_too_large' },
    });
    expect(bridgeService.handle).not.toHaveBeenCalled();
  });

  it('rate limits peers before parsing another request body', async () => {
    const bridgeService = service();
    const address = await createListener(bridgeService, { requestLimitPerMinute: 1 }).start();
    const json = JSON.stringify({ signed: 'request' });

    await expect(post(address, json)).resolves.toMatchObject({ status: 200 });
    await expect(post(address, json)).resolves.toMatchObject({
      status: 429,
      body: { error: 'rate_limited' },
    });
    expect(bridgeService.handle).toHaveBeenCalledTimes(1);
  });

  it('terminates a slow client that does not finish its declared body', async () => {
    const bridgeService = service();
    const address = await createListener(bridgeService, { bodyTimeoutMs: 1_000 }).start();

    const closed = new Promise<string>((resolve, reject) => {
      const request = httpsRequest({
        host: '127.0.0.1',
        port: address.port,
        path: '/v1/request',
        method: 'POST',
        rejectUnauthorized: false,
        agent: false,
        headers: {
          Host: `127.0.0.1:${address.port}`,
          'Content-Type': 'application/json',
          'Content-Length': '10',
        },
      });
      const failureTimer = setTimeout(() => reject(new Error('slow client remained open')), 3_000);
      request.on('error', (error: NodeJS.ErrnoException) => {
        clearTimeout(failureTimer);
        resolve(error.code ?? 'closed');
      });
      request.write('{');
    });

    await expect(closed).resolves.toMatch(/ECONNRESET|EPIPE|closed/);
    expect(bridgeService.handle).not.toHaveBeenCalled();
  });

  it('enforces per-peer concurrency before a second dispatch', async () => {
    const gate = deferred();
    const entered = deferred();
    const bridgeService = service(async () => {
      entered.resolve();
      await gate.promise;
      return { status: 200, body: { ok: true } };
    });
    const address = await createListener(bridgeService, {
      maximumConcurrentRequests: 1,
      maximumConcurrentRequestsPerPeer: 1,
    }).start();
    const first = post(address, JSON.stringify({ request: 1 }));
    await entered.promise;

    await expect(post(address, JSON.stringify({ request: 2 }))).resolves.toMatchObject({
      status: 429,
      body: { error: 'rate_limited' },
    });
    gate.resolve();
    await expect(first).resolves.toMatchObject({ status: 200 });
    expect(bridgeService.handle).toHaveBeenCalledTimes(1);
  });

  it('requires explicit LAN configuration and rejects a mismatched TLS private key', () => {
    const bridgeService = service();
    expect(
      () =>
        new HttpsBridgeListener({
          service: bridgeService,
          tlsCertificatePem: tls.certificate,
          tlsPrivateKeyPem: tls.key,
          host: '0.0.0.0',
          allowedHosts: ['192.168.1.20'],
        }),
    ).toThrow('Non-loopback binding');

    expect(
      () =>
        new HttpsBridgeListener({
          service: bridgeService,
          tlsCertificatePem: tls.certificate,
          tlsPrivateKeyPem: tls.key,
          host: '8.8.8.8',
          allowLan: true,
          allowedHosts: ['bridge.example.test'],
        }),
    ).toThrow('private, link-local, or unspecified');

    expect(
      () =>
        new HttpsBridgeListener({
          service: bridgeService,
          tlsCertificatePem: tls.certificate,
          tlsPrivateKeyPem: secondTls.key,
        }),
    ).toThrow('do not match');

    const lanListener = new HttpsBridgeListener({
      service: bridgeService,
      tlsCertificatePem: tls.certificate,
      tlsPrivateKeyPem: tls.key,
      host: '0.0.0.0',
      allowLan: true,
      allowedHosts: ['192.168.1.20'],
    });
    expect(lanListener).toBeInstanceOf(HttpsBridgeListener);
  });
});
