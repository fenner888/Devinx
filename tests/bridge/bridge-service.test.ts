import { generateKeyPairSync, randomBytes, randomUUID, sign } from 'node:crypto';

import type { AcpLoadedSession, AcpSessionPage } from '../../bridge/src/acp';
import { FixedWindowRateLimiter } from '../../bridge/src/rate-limit';
import { InMemoryReplayGuard } from '../../bridge/src/replay';
import { BridgeService, type SessionDiscoveryAdapter } from '../../bridge/src/service';
import { signingPayload, type DeviceStore } from '../../bridge/src/security';
import { SessionHandleRegistry } from '../../bridge/src/session-handles';
import {
  BRIDGE_PROTOCOL_VERSION,
  type BridgeMethod,
  type BridgePermission,
  type DeviceRecord,
  type SignedRequestEnvelope,
} from '../../bridge/src/schemas';

const NOW = 1_800_000_000_000;
const BRIDGE_ID = 'bridge_1234567890';
const DEVICE_ID = 'device_1234567890';

class FakeSessionAdapter implements SessionDiscoveryAdapter {
  supported = true;
  loadSupported = true;
  calls = 0;
  loadCalls = 0;
  page: AcpSessionPage = {
    sessions: [
      {
        sessionId: 'raw-private-session-id',
        cwd: '/Users/frank/Secret Project',
        additionalDirectories: ['/Users/frank/Private Library'],
        title: 'Private\nSession Title',
        updatedAt: '2026-07-10T12:00:00Z',
      },
    ],
    nextCursor: 'opaque-cursor',
  };
  pending: Promise<AcpSessionPage> | null = null;
  failure: Error | null = null;
  loaded: AcpLoadedSession = {
    sessionId: 'raw-private-session-id',
    cwd: '/Users/frank/Secret Project',
    messages: [
      { source: 'user', text: 'Please review this.' },
      { source: 'devin', text: 'The review is complete.' },
    ],
    truncated: false,
  };
  loadPending: Promise<AcpLoadedSession> | null = null;
  loadFailure: Error | null = null;

  isSessionListSupported(): boolean {
    return this.supported;
  }

  async listSessions(): Promise<AcpSessionPage> {
    this.calls += 1;
    if (this.failure) throw this.failure;
    if (this.pending) return this.pending;
    return this.page;
  }

  isSessionLoadSupported(): boolean {
    return this.loadSupported;
  }

  async loadSession(): Promise<AcpLoadedSession> {
    this.loadCalls += 1;
    if (this.loadFailure) throw this.loadFailure;
    if (this.loadPending) return this.loadPending;
    return this.loaded;
  }
}

describe('authenticated Desktop Bridge service', () => {
  const deviceKeys = generateKeyPairSync('ed25519');
  let device: DeviceRecord;
  let devices: DeviceStore;
  let adapter: FakeSessionAdapter;

  beforeEach(() => {
    device = {
      bridgeId: BRIDGE_ID,
      deviceId: DEVICE_ID,
      deviceName: 'Frank’s iPhone',
      publicKeySpki: deviceKeys.publicKey
        .export({ format: 'der', type: 'spki' })
        .toString('base64url'),
      status: 'active',
      pairedAt: NOW - 60_000,
      permissions: ['bridge:health', 'session:metadata:read'],
    };
    devices = { get: (deviceId) => (deviceId === DEVICE_ID ? device : undefined) };
    adapter = new FakeSessionAdapter();
  });

  function envelope(
    method: BridgeMethod,
    body: unknown,
    permissions?: BridgePermission[],
  ): SignedRequestEnvelope {
    if (permissions) device.permissions = permissions;
    const unsigned: Omit<SignedRequestEnvelope, 'signature'> = {
      protocolVersion: BRIDGE_PROTOCOL_VERSION,
      bridgeId: BRIDGE_ID,
      deviceId: DEVICE_ID,
      requestId: randomUUID(),
      issuedAt: NOW - 100,
      expiresAt: NOW + 10_000,
      nonce: randomBytes(24).toString('base64url'),
      method,
      body,
    };
    return {
      ...unsigned,
      signature: sign(
        null,
        Buffer.from(signingPayload(unsigned), 'utf8'),
        deviceKeys.privateKey,
      ).toString('base64url'),
    };
  }

  function service(overrides: Partial<ConstructorParameters<typeof BridgeService>[0]> = {}) {
    return new BridgeService({
      bridgeId: BRIDGE_ID,
      devices,
      replayGuard: new InMemoryReplayGuard(),
      rateLimiter: new FixedWindowRateLimiter(),
      sessionHandles: new SessionHandleRegistry(BRIDGE_ID, randomBytes(32)),
      sessions: adapter,
      ...overrides,
    });
  }

  const context = (peerKey = 'loopback-peer') => ({ peerKey, now: NOW });

  it('returns authenticated health with only enabled capabilities', async () => {
    const result = await service().handle(envelope('bridge.health', {}), context());

    expect(result).toEqual({
      status: 200,
      body: {
        protocolVersion: 1,
        status: 'ready',
        capabilities: { sessionList: true, sessionLoad: true, sessionPrompt: false },
      },
    });
  });

  it('returns opaque, namespaced, minimized session metadata by default', async () => {
    const bridge = service();
    const first = await bridge.handle(envelope('session.list', {}), context());
    const second = await bridge.handle(envelope('session.list', {}), context());

    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      sessions: [
        {
          id: expect.stringMatching(/^local_[A-Za-z0-9_-]{43}$/),
          origin: 'computer',
          workspaceName: 'Secret Project',
          hasTitle: true,
          updatedAt: '2026-07-10T12:00:00Z',
        },
      ],
      nextCursor: 'opaque-cursor',
    });
    const serialized = JSON.stringify(first.body);
    expect(serialized).not.toContain('raw-private-session-id');
    expect(serialized).not.toContain('/Users/frank');
    expect(serialized).not.toContain('Private Library');
    expect(serialized).not.toContain('Private Session Title');
    expect((first.body as { sessions: Array<{ id: string }> }).sessions[0]?.id).toBe(
      (second.body as { sessions: Array<{ id: string }> }).sessions[0]?.id,
    );
  });

  it('reveals a sanitized title only with the content grant', async () => {
    const result = await service().handle(
      envelope('session.list', {}, [
        'bridge:health',
        'session:metadata:read',
        'session:content:read',
      ]),
      context(),
    );

    expect(result).toMatchObject({
      status: 200,
      body: { sessions: [{ title: 'Private Session Title' }] },
    });
  });

  it('returns 404 before dispatch when the device lacks the required grant', async () => {
    const result = await service().handle(
      envelope('session.list', {}, ['bridge:health']),
      context(),
    );

    expect(result).toEqual({ status: 404, body: { error: 'not_found' } });
    expect(adapter.calls).toBe(0);
  });

  it('loads only a previously listed opaque handle and minimizes replay content', async () => {
    const bridge = service();
    const listed = await bridge.handle(envelope('session.list', {}), context());
    const handle = (listed.body as { sessions: Array<{ id: string }> }).sessions[0]?.id;

    const result = await bridge.handle(
      envelope('session.load', { sessionId: handle }, [
        'bridge:health',
        'session:metadata:read',
        'session:content:read',
      ]),
      context(),
    );

    expect(result).toEqual({
      status: 200,
      body: {
        session: { id: handle, origin: 'computer', workspaceName: 'Secret Project' },
        messages: [
          { sequence: 1, source: 'user', text: 'Please review this.' },
          { sequence: 2, source: 'devin', text: 'The review is complete.' },
        ],
        truncated: false,
      },
    });
    expect(adapter.loadCalls).toBe(1);
    expect(JSON.stringify(result)).not.toContain('raw-private-session-id');
    expect(JSON.stringify(result)).not.toContain('/Users/frank');
  });

  it('conceals missing permission, unknown handles, and denied session scopes with 404', async () => {
    const bridge = service();
    const listed = await bridge.handle(envelope('session.list', {}), context());
    const handle = (listed.body as { sessions: Array<{ id: string }> }).sessions[0]?.id ?? '';

    await expect(
      bridge.handle(envelope('session.load', { sessionId: handle }), context()),
    ).resolves.toEqual({ status: 404, body: { error: 'not_found' } });
    await expect(
      bridge.handle(
        envelope('session.load', { sessionId: `local_${'U'.repeat(43)}` }, [
          'session:content:read',
        ]),
        context(),
      ),
    ).resolves.toEqual({ status: 404, body: { error: 'not_found' } });
    device.allowedSessionIds = [`local_${'D'.repeat(43)}`];
    await expect(
      bridge.handle(
        envelope('session.load', { sessionId: handle }, ['session:content:read']),
        context(),
      ),
    ).resolves.toEqual({ status: 404, body: { error: 'not_found' } });
    expect(adapter.loadCalls).toBe(0);
  });

  it('allows only one ACP session-load operation at a time', async () => {
    let resolveLoad: ((loaded: AcpLoadedSession) => void) | undefined;
    adapter.loadPending = new Promise((resolve) => {
      resolveLoad = resolve;
    });
    const bridge = service();
    const listed = await bridge.handle(envelope('session.list', {}), context());
    const handle = (listed.body as { sessions: Array<{ id: string }> }).sessions[0]?.id ?? '';
    const permissions: BridgePermission[] = ['session:content:read'];
    const first = bridge.handle(
      envelope('session.load', { sessionId: handle }, permissions),
      context('peer-one'),
    );
    await Promise.resolve();

    await expect(
      bridge.handle(
        envelope('session.load', { sessionId: handle }, permissions),
        context('peer-two'),
      ),
    ).resolves.toEqual({ status: 429, body: { error: 'busy' } });
    resolveLoad?.(adapter.loaded);
    await expect(first).resolves.toMatchObject({ status: 200 });
  });

  it('bounds escaped replay content below the local response limit and reports truncation', async () => {
    adapter.loaded.messages = [{ source: 'devin', text: '\\'.repeat(100_000) }];
    const bridge = service();
    const listed = await bridge.handle(envelope('session.list', {}), context());
    const handle = (listed.body as { sessions: Array<{ id: string }> }).sessions[0]?.id ?? '';

    const result = await bridge.handle(
      envelope('session.load', { sessionId: handle }, ['session:content:read']),
      context(),
    );

    expect(result).toMatchObject({ status: 200, body: { truncated: true } });
    expect(Buffer.byteLength(JSON.stringify(result.body), 'utf8')).toBeLessThanOrEqual(192 * 1024);
  });

  it('returns a generic availability error for invalid or failed session loads', async () => {
    const bridge = service();
    const listed = await bridge.handle(envelope('session.list', {}), context());
    const handle = (listed.body as { sessions: Array<{ id: string }> }).sessions[0]?.id ?? '';
    adapter.loaded = { ...adapter.loaded, sessionId: 'wrong-raw-session-id' };

    const mismatch = await bridge.handle(
      envelope('session.load', { sessionId: handle }, ['session:content:read']),
      context(),
    );
    expect(mismatch).toEqual({ status: 503, body: { error: 'temporarily_unavailable' } });
    adapter.loaded = { ...adapter.loaded, sessionId: 'raw-private-session-id' };
    adapter.loadFailure = new Error('/private/path and raw ACP details');
    const failed = await bridge.handle(
      envelope('session.load', { sessionId: handle }, ['session:content:read']),
      context(),
    );
    expect(failed).toEqual({ status: 503, body: { error: 'temporarily_unavailable' } });
    expect(JSON.stringify(failed)).not.toContain('/private/path');
  });

  it('rate-limits malformed requests by transport peer before authentication', async () => {
    const bridge = service({ peerLimit: 2, windowMs: 60_000 });

    await expect(bridge.handle({}, context())).resolves.toMatchObject({ status: 400 });
    await expect(bridge.handle({}, context())).resolves.toMatchObject({ status: 400 });
    await expect(bridge.handle({}, context())).resolves.toEqual({
      status: 429,
      body: { error: 'rate_limited' },
    });
  });

  it('allows only one ACP session-list operation at a time', async () => {
    let resolvePage: ((page: AcpSessionPage) => void) | undefined;
    adapter.pending = new Promise((resolve) => {
      resolvePage = resolve;
    });
    const bridge = service();
    const first = bridge.handle(envelope('session.list', {}), context('peer-one'));
    await Promise.resolve();

    await expect(
      bridge.handle(envelope('session.list', {}), context('peer-two')),
    ).resolves.toEqual({ status: 429, body: { error: 'busy' } });
    resolvePage?.(adapter.page);
    await expect(first).resolves.toMatchObject({ status: 200 });
  });

  it('returns a generic availability error without leaking adapter failures', async () => {
    adapter.failure = new Error('/private/path and raw session details');

    const result = await service().handle(envelope('session.list', {}), context());
    expect(result).toEqual({ status: 503, body: { error: 'temporarily_unavailable' } });
    expect(JSON.stringify(result)).not.toContain('/private/path');
  });

  it('keeps schema-reserved mutation methods disabled', async () => {
    const result = await service().handle(
      envelope('session.prompt', { sessionId: 'local_existing', text: 'Do work' }, [
        'session:prompt:send',
      ]),
      context(),
    );

    expect(result).toEqual({ status: 404, body: { error: 'not_found' } });
    expect(adapter.calls).toBe(0);
  });
});

describe('bridge rate limits and session handles', () => {
  it('isolates rate-limit keys and resets expired windows', () => {
    const limiter = new FixedWindowRateLimiter(2);
    const rule = { limit: 1, windowMs: 1_000 };

    expect(limiter.consume('peer-one', rule, NOW)).toBe(true);
    expect(limiter.consume('peer-one', rule, NOW + 1)).toBe(false);
    expect(limiter.consume('peer-two', rule, NOW + 1)).toBe(true);
    expect(limiter.consume('peer-one', rule, NOW + 1_000)).toBe(true);
  });

  it('resolves only registered, unexpired opaque handles', () => {
    const registry = new SessionHandleRegistry(BRIDGE_ID, randomBytes(32), 60_000, 2);
    const handle = registry.register('raw-session-id', NOW);

    expect(handle).toMatch(/^local_[A-Za-z0-9_-]{43}$/);
    expect(registry.register('raw-session-id', NOW + 1)).toBe(handle);
    expect(registry.resolve(handle, NOW + 2)).toBe('raw-session-id');
    expect(registry.resolve(`local_${'A'.repeat(43)}`, NOW + 2)).toBeNull();
    expect(registry.resolve(handle, NOW + 60_001)).toBeNull();
  });

  it('clears session mappings and zeroizes access on destroy', () => {
    const registry = new SessionHandleRegistry(BRIDGE_ID, randomBytes(32));
    const handle = registry.register('raw-session-id', NOW);

    registry.destroy();
    expect(registry.resolve(handle, NOW)).toBeNull();
    expect(() => registry.register('another-session', NOW)).toThrow('destroyed');
  });
});
