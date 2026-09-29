import { generateKeyPairSync, randomBytes, randomUUID, sign } from 'node:crypto';

import type { AcpLoadedSession } from '../../bridge/src/acp';
import { FixedWindowRateLimiter } from '../../bridge/src/rate-limit';
import { InMemoryReplayGuard } from '../../bridge/src/replay';
import { BridgeService, type SessionDiscoveryAdapter } from '../../bridge/src/service';
import { signingPayload, type DeviceStore } from '../../bridge/src/security';
import { SessionHandleRegistry } from '../../bridge/src/session-handles';
import { WorkspaceHandleRegistry } from '../../bridge/src/workspace-handles';
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
const RAW_SESSION_ID = 'raw-private-session-id';

describe('Bridge presentation features and message timestamps', () => {
  const deviceKeys = generateKeyPairSync('ed25519');
  let device: DeviceRecord;
  let devices: DeviceStore;
  let adapter: SessionDiscoveryAdapter;
  let messages: AcpLoadedSession['messages'];
  let messageTimes: Array<number | undefined>;

  beforeEach(() => {
    device = {
      bridgeId: BRIDGE_ID,
      deviceId: DEVICE_ID,
      deviceName: 'Presentation test phone',
      publicKeySpki: deviceKeys.publicKey
        .export({ format: 'der', type: 'spki' })
        .toString('base64url'),
      status: 'active',
      pairedAt: NOW - 60_000,
      permissions: ['bridge:health', 'session:metadata:read', 'session:content:read'],
    };
    devices = { get: (deviceId) => (deviceId === DEVICE_ID ? device : undefined) };
    messages = [
      { source: 'user', text: '  ' },
      { source: 'user', text: 'Hello.' },
      { source: 'devin', text: 'Done.' },
    ];
    messageTimes = [undefined, 1_234, 5_678];
    adapter = {
      isSessionListSupported: () => true,
      listSessions: async () => ({
        sessions: [{ sessionId: RAW_SESSION_ID, cwd: '/Users/example/project' }],
      }),
      isSessionLoadSupported: () => true,
      loadSession: async (sessionId) => {
        const loaded: AcpLoadedSession = {
          sessionId,
          cwd: '/Users/example/project',
          messages,
          truncated: false,
        };
        Object.defineProperty(loaded, 'messageTimes', {
          value: messageTimes,
          enumerable: false,
          writable: true,
          configurable: true,
        });
        return loaded;
      },
      isSessionPromptSupported: () => false,
      promptSession: async () => undefined,
    };
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

  function service() {
    return new BridgeService({
      bridgeId: BRIDGE_ID,
      platform: 'macos',
      devices,
      replayGuard: new InMemoryReplayGuard(),
      rateLimiter: new FixedWindowRateLimiter(),
      sessionHandles: new SessionHandleRegistry(BRIDGE_ID, randomBytes(32)),
      workspaceHandles: new WorkspaceHandleRegistry(BRIDGE_ID, randomBytes(32)),
      sessions: adapter,
    });
  }

  const context = { peerKey: 'test-peer', now: NOW };

  async function listedSessionId(bridge: BridgeService): Promise<string> {
    const response = await bridge.handle(
      envelope('session.list', {}, ['session:metadata:read']),
      context,
    );
    return (response.body as { sessions: Array<{ id: string }> }).sessions[0]?.id ?? '';
  }

  it('adds strict presentation fields only for an opted-in request', async () => {
    const bridge = service();

    await expect(bridge.handle(envelope('bridge.features', {}), context)).resolves.toEqual({
      status: 200,
      body: { sessionElicitation: false, activityTimeline: true },
    });

    await expect(
      bridge.handle(
        envelope(
          'bridge.features',
          { presentation: true },
          ['bridge:health', 'session:content:read'],
        ),
        context,
      ),
    ).resolves.toEqual({
      status: 200,
      body: {
        sessionElicitation: false,
        activityTimeline: true,
        messageTimestamps: true,
        grants: { viewSessions: true, sendPrompts: false, startSessions: false },
      },
    });

    await expect(
      bridge.handle(
        envelope(
          'bridge.features',
          { interaction: true, presentation: true },
          [
            'bridge:health',
            'session:content:read',
            'session:prompt:send',
            'session:create',
          ],
        ),
        context,
      ),
    ).resolves.toMatchObject({
      status: 200,
      body: {
        permissionPrompts: false,
        messageTimestamps: true,
        grants: { viewSessions: true, sendPrompts: true, startSessions: true },
      },
    });
  });

  it('returns timestamps only when requested and keeps source indexes after empty messages', async () => {
    const bridge = service();
    const sessionId = await listedSessionId(bridge);

    const legacy = await bridge.handle(
      envelope('session.load', { sessionId }, ['session:content:read']),
      context,
    );
    expect(legacy.body).toMatchObject({
      messages: [
        { sequence: 1, source: 'user', text: 'Hello.' },
        { sequence: 2, source: 'devin', text: 'Done.' },
      ],
    });
    expect((legacy.body as { messages: Array<Record<string, unknown>> }).messages).not.toContainEqual(
      expect.objectContaining({ createdAt: expect.any(Number) }),
    );

    const optedIn = await bridge.handle(
      envelope('session.load', { sessionId, timestamps: true }, ['session:content:read']),
      context,
    );
    expect(optedIn.body).toMatchObject({
      messages: [
        { sequence: 1, source: 'user', text: 'Hello.', createdAt: 1_234 },
        { sequence: 2, source: 'devin', text: 'Done.', createdAt: 5_678 },
      ],
    });
  });

  it('preserves timestamp alignment when fitting a large response', async () => {
    messages = Array.from({ length: 3 }, () => ({ source: 'user' as const, text: 'x'.repeat(90_000) }));
    messageTimes = [1_000, 2_000, 3_000];
    const bridge = service();
    const sessionId = await listedSessionId(bridge);

    const response = await bridge.handle(
      envelope('session.load', { sessionId, timestamps: true }, ['session:content:read']),
      context,
    );

    expect(response.body).toMatchObject({
      truncated: true,
      messages: [
        { sequence: 1, createdAt: 2_000 },
        { sequence: 2, createdAt: 3_000 },
      ],
    });
  });
});
