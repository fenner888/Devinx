import { createHmac, randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer, type Server as HttpsServer } from 'node:https';
import { isIP } from 'node:net';
import type { Socket } from 'node:net';
import { TextDecoder } from 'node:util';

import { z } from 'zod';

import { FixedWindowRateLimiter, type RateLimiter } from './rate-limit';
import type { BridgeServiceResponse } from './service';
import { tlsIdentityFromPem, type TlsIdentity } from './tls-identity';
import type { PairingPollResult, PairingSubmissionResult } from './pairing';

const DEFAULT_PORT = 45_831;
const DEFAULT_MAXIMUM_BODY_BYTES = 256 * 1024;
const JSON_CONTENT_TYPE = /^application\/json(?:;\s*charset=utf-8)?$/i;

const hostNameSchema = z
  .string()
  .min(1)
  .max(253)
  .transform((value) => value.toLowerCase())
  .refine(
    (value) =>
      isIP(value) !== 0 ||
      (/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/.test(
        value,
      ) &&
        value !== 'localhost'),
    'Allowed host must be an IP literal or canonical DNS name',
  );

const listenerOptionsSchema = z
  .object({
    host: z.string().refine((value) => isIP(value) !== 0, 'Bind host must be an IP literal'),
    port: z.number().int().min(0).max(65_535),
    allowLan: z.boolean(),
    allowedHosts: z.array(hostNameSchema).min(1).max(32),
    tlsCertificatePem: z
      .string()
      .min(1)
      .max(128 * 1024),
    tlsPrivateKeyPem: z
      .string()
      .min(1)
      .max(128 * 1024),
    maximumBodyBytes: z
      .number()
      .int()
      .min(1_024)
      .max(1024 * 1024),
    maximumConnections: z.number().int().min(1).max(1_000),
    maximumConcurrentRequests: z.number().int().min(1).max(1_000),
    maximumConcurrentRequestsPerPeer: z.number().int().min(1).max(100),
    requestLimitPerMinute: z.number().int().min(1).max(10_000),
    pairingSubmitLimitPerMinute: z.number().int().min(1).max(1_000),
    pairingStatusLimitPerMinute: z.number().int().min(1).max(1_000),
    bodyTimeoutMs: z.number().int().min(1_000).max(60_000),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.allowLan && !isLoopbackAddress(value.host)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['host'],
        message: 'Non-loopback binding requires explicit LAN enablement',
      });
    }
    if (value.allowLan && !isUnspecifiedAddress(value.host) && !isPrivatePeerAddress(value.host)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['host'],
        message: 'LAN binding must use a private, link-local, or unspecified address',
      });
    }
    if (value.allowedHosts.some(isUnspecifiedAddress)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['allowedHosts'],
        message: 'An unspecified address cannot be advertised',
      });
    }
    if (new Set(value.allowedHosts).size !== value.allowedHosts.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['allowedHosts'],
        message: 'Allowed hosts must be unique',
      });
    }
    if (value.maximumConcurrentRequestsPerPeer > value.maximumConcurrentRequests) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maximumConcurrentRequestsPerPeer'],
        message: 'Per-peer concurrency cannot exceed global concurrency',
      });
    }
  });

interface BridgeRequestHandler {
  handle(input: unknown, context: { peerKey: string; now: number }): Promise<BridgeServiceResponse>;
}

interface PairingRequestHandler {
  submit(input: unknown, now?: number): PairingSubmissionResult;
  poll(input: unknown, now?: number): PairingPollResult;
}

export interface HttpsBridgeListenerOptions {
  service: BridgeRequestHandler;
  pairing?: PairingRequestHandler;
  tlsCertificatePem: string;
  tlsPrivateKeyPem: string;
  host?: string;
  port?: number;
  allowLan?: boolean;
  allowedHosts?: string[];
  maximumBodyBytes?: number;
  maximumConnections?: number;
  maximumConcurrentRequests?: number;
  maximumConcurrentRequestsPerPeer?: number;
  requestLimitPerMinute?: number;
  pairingSubmitLimitPerMinute?: number;
  pairingStatusLimitPerMinute?: number;
  bodyTimeoutMs?: number;
  rateLimiter?: RateLimiter;
}

export interface HttpsBridgeListenerAddress {
  host: string;
  port: number;
  certificateFingerprint: string;
}

type TransportStatus = 400 | 404 | 413 | 415 | 429 | 503;
type TransportRoute = 'request' | 'pairing.submit' | 'pairing.status';

interface TransportHandlerResponse {
  status: 200 | 202 | 400 | 404 | 429 | 503;
  body: unknown;
}

class TransportError extends Error {
  constructor(readonly status: TransportStatus) {
    super('Bridge transport request rejected');
  }
}

function isUnspecifiedAddress(address: string): boolean {
  return address === '0.0.0.0' || address === '::';
}

function normalizedAddress(address: string): string {
  const lower = address.toLowerCase();
  return lower.startsWith('::ffff:') ? lower.slice(7) : lower;
}

function isLoopbackAddress(address: string): boolean {
  const value = normalizedAddress(address);
  return value === '::1' || value.startsWith('127.');
}

function isPrivatePeerAddress(address: string): boolean {
  const value = normalizedAddress(address);
  if (isLoopbackAddress(value)) return true;
  if (isIP(value) === 4) {
    const octets = value.split('.').map(Number);
    const first = octets[0];
    const second = octets[1];
    if (first === undefined || second === undefined) return false;
    return (
      first === 10 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    );
  }
  if (isIP(value) === 6) {
    const firstSegment = Number.parseInt(value.split(':')[0] ?? '', 16);
    return (
      Number.isFinite(firstSegment) &&
      ((firstSegment >= 0xfc00 && firstSegment <= 0xfdff) ||
        (firstSegment >= 0xfe80 && firstSegment <= 0xfebf))
    );
  }
  return false;
}

function countRawHeader(requestHeaders: string[], name: string): number {
  let count = 0;
  for (let index = 0; index < requestHeaders.length; index += 2) {
    if (requestHeaders[index]?.toLowerCase() === name) count += 1;
  }
  return count;
}

function parseHostHeader(value: string): { host: string; port?: number } | null {
  if (!value || /[\s,/@#?\\]/.test(value)) return null;
  const ipv6 = /^\[([0-9a-f:.]+)\](?::([0-9]{1,5}))?$/i.exec(value);
  if (ipv6) {
    const host = ipv6[1]?.toLowerCase();
    const portText = ipv6[2];
    if (!host || isIP(host) !== 6) return null;
    const port = portText === undefined ? undefined : Number(portText);
    if (port !== undefined && (port < 1 || port > 65_535)) return null;
    return { host, port };
  }
  const regular = /^([a-z0-9.-]+)(?::([0-9]{1,5}))?$/i.exec(value);
  if (!regular) return null;
  const hostResult = hostNameSchema.safeParse(regular[1]);
  if (!hostResult.success) return null;
  const portText = regular[2];
  const port = portText === undefined ? undefined : Number(portText);
  if (port !== undefined && (port < 1 || port > 65_535)) return null;
  return { host: hostResult.data, port };
}

function publicBody(status: TransportStatus): { error: string } {
  if (status === 413) return { error: 'request_too_large' };
  if (status === 415) return { error: 'unsupported_media_type' };
  if (status === 429) return { error: 'rate_limited' };
  if (status === 503) return { error: 'temporarily_unavailable' };
  if (status === 404) return { error: 'not_found' };
  return { error: 'invalid_request' };
}

export class HttpsBridgeListener {
  private readonly service: BridgeRequestHandler;
  private readonly pairing: PairingRequestHandler | undefined;
  private readonly options: Omit<
    z.infer<typeof listenerOptionsSchema>,
    'tlsCertificatePem' | 'tlsPrivateKeyPem'
  >;
  private readonly rateLimiter: RateLimiter;
  private readonly server: HttpsServer;
  private readonly sockets = new Set<Socket>();
  private readonly activeByPeer = new Map<string, number>();
  private readonly fingerprint: string;
  private readonly certificateValidTo: number;
  private readonly peerHashKey = randomBytes(32);
  private activeRequests = 0;
  private stopped = false;

  constructor(input: HttpsBridgeListenerOptions) {
    this.service = input.service;
    this.pairing = input.pairing;
    const host = input.host ?? '127.0.0.1';
    const allowedHosts = input.allowedHosts ?? (isUnspecifiedAddress(host) ? [] : [host]);
    const parsedOptions = listenerOptionsSchema.parse({
      host,
      port: input.port ?? DEFAULT_PORT,
      allowLan: input.allowLan ?? false,
      allowedHosts,
      tlsCertificatePem: input.tlsCertificatePem,
      tlsPrivateKeyPem: input.tlsPrivateKeyPem,
      maximumBodyBytes: input.maximumBodyBytes ?? DEFAULT_MAXIMUM_BODY_BYTES,
      maximumConnections: input.maximumConnections ?? 32,
      maximumConcurrentRequests: input.maximumConcurrentRequests ?? 16,
      maximumConcurrentRequestsPerPeer: input.maximumConcurrentRequestsPerPeer ?? 4,
      requestLimitPerMinute: input.requestLimitPerMinute ?? 120,
      pairingSubmitLimitPerMinute: input.pairingSubmitLimitPerMinute ?? 10,
      pairingStatusLimitPerMinute: input.pairingStatusLimitPerMinute ?? 120,
      bodyTimeoutMs: input.bodyTimeoutMs ?? 10_000,
    });
    const { tlsCertificatePem, tlsPrivateKeyPem, ...runtimeOptions } = parsedOptions;
    this.options = runtimeOptions;
    this.rateLimiter = input.rateLimiter ?? new FixedWindowRateLimiter(2_000);

    let tlsIdentity: TlsIdentity;
    try {
      tlsIdentity = tlsIdentityFromPem(tlsCertificatePem, tlsPrivateKeyPem);
    } catch {
      throw new Error('Bridge TLS certificate is invalid');
    }
    this.certificateValidTo = tlsIdentity.validTo;
    this.fingerprint = tlsIdentity.certificateFingerprint;

    this.server = createServer(
      {
        cert: tlsCertificatePem,
        key: tlsPrivateKeyPem,
        minVersion: 'TLSv1.3',
        maxHeaderSize: 16 * 1024,
        insecureHTTPParser: false,
        handshakeTimeout: 10_000,
      },
      (request, response) => {
        this.handleRequest(request, response).catch(() => response.destroy());
      },
    );
    this.server.maxConnections = this.options.maximumConnections;
    this.server.maxHeadersCount = 32;
    this.server.headersTimeout = 5_000;
    this.server.requestTimeout = 15_000;
    this.server.keepAliveTimeout = 5_000;
    this.server.maxRequestsPerSocket = 100;
    this.server.on('connection', (socket) => {
      this.sockets.add(socket);
      socket.setNoDelay(true);
      socket.setTimeout(45_000, () => socket.destroy());
      socket.once('close', () => this.sockets.delete(socket));
    });
    this.server.on('error', () => {
      for (const socket of this.sockets) socket.destroy();
    });
    this.server.on('clientError', (_error, socket) => socket.destroy());
    this.server.on('tlsClientError', (_error, socket) => socket.destroy());
    this.server.on('upgrade', (_request, socket) => socket.destroy());
    this.server.on('checkContinue', (_request, response) => this.send(response, 400));
    this.server.on('checkExpectation', (_request, response) => this.send(response, 400));
  }

  async start(): Promise<HttpsBridgeListenerAddress> {
    if (this.stopped) throw new Error('Bridge listener cannot restart after secure shutdown');
    if (this.server.listening) throw new Error('Bridge listener is already running');
    if (Date.now() >= this.certificateValidTo) {
      throw new Error('Bridge TLS certificate has expired');
    }
    await new Promise<void>((resolve, reject) => {
      const onError = () => {
        this.server.off('listening', onListening);
        reject(new Error('Bridge listener could not bind'));
      };
      const onListening = () => {
        this.server.off('error', onError);
        resolve();
      };
      this.server.once('error', onError);
      this.server.once('listening', onListening);
      this.server.listen({ host: this.options.host, port: this.options.port, exclusive: true });
    });
    const address = this.server.address();
    if (!address || typeof address === 'string') {
      await this.stop();
      throw new Error('Bridge listener returned an invalid address');
    }
    return {
      host: this.options.host,
      port: address.port,
      certificateFingerprint: this.fingerprint,
    };
  }

  async stop(): Promise<void> {
    if (this.stopped) return;
    if (this.server.listening) {
      for (const socket of this.sockets) socket.destroy();
      await new Promise<void>((resolve) => this.server.close(() => resolve()));
    }
    this.activeByPeer.clear();
    this.activeRequests = 0;
    this.peerHashKey.fill(0);
    this.stopped = true;
  }

  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    let peerKey: string | null = null;
    let counted = false;
    try {
      const peerAddress = request.socket.remoteAddress;
      if (!peerAddress || !this.peerIsAllowed(peerAddress)) throw new TransportError(404);
      peerKey = createHmac('sha256', this.peerHashKey)
        .update(normalizedAddress(peerAddress))
        .digest('base64url');
      const route = this.validateRequestMetadata(request, this.boundPort());
      const now = Date.now();
      if (now >= this.certificateValidTo) throw new TransportError(503);
      if (
        !this.rateLimiter.consume(
          `transport:${peerKey}`,
          { limit: this.options.requestLimitPerMinute, windowMs: 60_000 },
          now,
        )
      ) {
        throw new TransportError(429);
      }
      if (
        route !== 'request' &&
        !this.rateLimiter.consume(
          `pairing:${route}:${peerKey}`,
          {
            limit:
              route === 'pairing.submit'
                ? this.options.pairingSubmitLimitPerMinute
                : this.options.pairingStatusLimitPerMinute,
            windowMs: 60_000,
          },
          now,
        )
      ) {
        throw new TransportError(429);
      }
      this.beginRequest(peerKey);
      counted = true;
      const input = await this.readJsonBody(request);
      const result = await this.dispatch(route, input, peerKey, now);
      this.sendServiceResponse(response, result);
    } catch (error) {
      if (!response.headersSent && !response.destroyed) {
        const closeConnection = !request.complete;
        this.send(response, error instanceof TransportError ? error.status : 503, closeConnection);
        if (closeConnection) response.once('finish', () => request.socket.destroy());
      } else if (!response.destroyed) {
        response.destroy();
      }
    } finally {
      if (counted && peerKey) this.endRequest(peerKey);
    }
  }

  private peerIsAllowed(address: string): boolean {
    return this.options.allowLan ? isPrivatePeerAddress(address) : isLoopbackAddress(address);
  }

  private boundPort(): number {
    const address = this.server.address();
    if (!address || typeof address === 'string') throw new TransportError(503);
    return address.port;
  }

  private validateRequestMetadata(request: IncomingMessage, port: number): TransportRoute {
    if (request.method !== 'POST') throw new TransportError(404);
    let route: TransportRoute;
    if (request.url === '/v1/request') route = 'request';
    else if (request.url === '/v1/pair/submit') route = 'pairing.submit';
    else if (request.url === '/v1/pair/status') route = 'pairing.status';
    else throw new TransportError(404);
    if (route !== 'request' && !this.pairing) throw new TransportError(404);
    if (countRawHeader(request.rawHeaders, 'host') !== 1) throw new TransportError(404);
    if (countRawHeader(request.rawHeaders, 'content-length') !== 1) {
      throw new TransportError(400);
    }
    if (countRawHeader(request.rawHeaders, 'content-type') !== 1) {
      throw new TransportError(415);
    }
    const parsedHost = parseHostHeader(request.headers.host ?? '');
    if (
      !parsedHost ||
      !this.options.allowedHosts.includes(parsedHost.host) ||
      (parsedHost.port ?? 443) !== port
    ) {
      throw new TransportError(404);
    }
    if (
      request.headers.origin !== undefined ||
      request.headers.cookie !== undefined ||
      request.headers.authorization !== undefined ||
      request.headers['proxy-authorization'] !== undefined ||
      request.headers['sec-fetch-site'] !== undefined
    ) {
      throw new TransportError(404);
    }
    if (!JSON_CONTENT_TYPE.test(request.headers['content-type'] ?? '')) {
      throw new TransportError(415);
    }
    if (request.headers['content-encoding'] !== undefined) throw new TransportError(415);
    if (request.headers['transfer-encoding'] !== undefined) throw new TransportError(400);
    const contentLength = request.headers['content-length'];
    if (!contentLength || !/^[0-9]+$/.test(contentLength)) throw new TransportError(400);
    const length = Number(contentLength);
    if (!Number.isSafeInteger(length) || length < 1) throw new TransportError(400);
    if (length > this.options.maximumBodyBytes) throw new TransportError(413);
    return route;
  }

  private async dispatch(
    route: TransportRoute,
    input: unknown,
    peerKey: string,
    now: number,
  ): Promise<TransportHandlerResponse> {
    if (route === 'request') return this.service.handle(input, { peerKey, now });
    if (!this.pairing) return { status: 404, body: { error: 'not_found' } };
    if (route === 'pairing.submit') {
      const submission = this.pairing.submit(input, now);
      if (!submission.ok) return { status: submission.status, body: submission.body };
      return {
        status: 202,
        body: {
          status: 'pending',
          pollToken: submission.pollToken,
          expiresAt: submission.pending.expiresAt,
        },
      };
    }
    const poll = this.pairing.poll(input, now);
    return { status: poll.status, body: poll.body };
  }

  private beginRequest(peerKey: string): void {
    const peerCount = this.activeByPeer.get(peerKey) ?? 0;
    if (
      this.activeRequests >= this.options.maximumConcurrentRequests ||
      peerCount >= this.options.maximumConcurrentRequestsPerPeer
    ) {
      throw new TransportError(429);
    }
    this.activeRequests += 1;
    this.activeByPeer.set(peerKey, peerCount + 1);
  }

  private endRequest(peerKey: string): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    const peerCount = this.activeByPeer.get(peerKey) ?? 0;
    if (peerCount <= 1) this.activeByPeer.delete(peerKey);
    else this.activeByPeer.set(peerKey, peerCount - 1);
  }

  private readJsonBody(request: IncomingMessage): Promise<unknown> {
    const declaredLength = Number(request.headers['content-length']);
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let received = 0;
      let settled = false;
      const wipe = () => {
        for (const chunk of chunks) chunk.fill(0);
        chunks.length = 0;
      };
      const finish = (operation: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        operation();
      };
      const timer = setTimeout(() => {
        finish(() => {
          wipe();
          request.destroy();
          reject(new TransportError(400));
        });
      }, this.options.bodyTimeoutMs);
      timer.unref();

      request.on('aborted', () =>
        finish(() => {
          wipe();
          reject(new TransportError(400));
        }),
      );
      request.on('error', () =>
        finish(() => {
          wipe();
          reject(new TransportError(400));
        }),
      );
      request.on('data', (chunk: Buffer) => {
        if (settled) return;
        received += chunk.length;
        if (received > declaredLength || received > this.options.maximumBodyBytes) {
          finish(() => {
            wipe();
            request.destroy();
            reject(new TransportError(413));
          });
          return;
        }
        chunks.push(Buffer.from(chunk));
      });
      request.on('end', () => {
        finish(() => {
          if (received !== declaredLength) {
            wipe();
            reject(new TransportError(400));
            return;
          }
          const body = Buffer.concat(chunks);
          wipe();
          try {
            const text = new TextDecoder('utf-8', { fatal: true }).decode(body);
            const parsed: unknown = JSON.parse(text);
            body.fill(0);
            resolve(parsed);
          } catch {
            body.fill(0);
            reject(new TransportError(400));
          }
        });
      });
    });
  }

  private sendServiceResponse(
    response: ServerResponse,
    result: BridgeServiceResponse | TransportHandlerResponse,
  ): void {
    try {
      this.sendJson(response, result.status, result.body);
    } catch {
      this.send(response, 503);
    }
  }

  private send(response: ServerResponse, status: TransportStatus, closeConnection = false): void {
    this.sendJson(response, status, publicBody(status), closeConnection);
  }

  private sendJson(
    response: ServerResponse,
    status: number,
    body: unknown,
    closeConnection = false,
  ): void {
    const serialized = JSON.stringify(body);
    response.sendDate = false;
    response.writeHead(status, {
      'Cache-Control': 'no-store',
      'Content-Length': Buffer.byteLength(serialized, 'utf8'),
      'Content-Security-Policy': "default-src 'none'",
      'Content-Type': 'application/json; charset=utf-8',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      ...(closeConnection ? { Connection: 'close' } : {}),
    });
    response.end(serialized);
  }
}
