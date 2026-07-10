import { generateKeyPairSync, sign as nodeSign } from 'node:crypto';

const mockLoadPairedComputers = jest.fn();
const mockCreateRequestIdentity = jest.fn();
const mockSign = jest.fn();
const mockPostPinnedBridgeJson = jest.fn();

jest.mock('../../src/auth/pairedComputers', () => ({
  loadPairedComputers: () => mockLoadPairedComputers(),
}));

jest.mock('../../src/auth/deviceSigning', () => ({
  createRequestIdentity: () => mockCreateRequestIdentity(),
  sign: (keyId: string, message: string) => mockSign(keyId, message),
  postPinnedBridgeJson: (endpoint: string, path: string, fingerprint: string, body: unknown) =>
    mockPostPinnedBridgeJson(endpoint, path, fingerprint, body),
}));

import { canonicalJson } from '../../src/auth/canonicalJson';
import { FixedWindowRateLimiter } from '../../bridge/src/rate-limit';
import { InMemoryReplayGuard } from '../../bridge/src/replay';
import { BridgeService } from '../../bridge/src/service';
import { SessionHandleRegistry } from '../../bridge/src/session-handles';
import {
  ComputerBridgeError,
  getComputerBridgeHealth,
  listComputerSessions,
  openComputerBridge,
  openComputerBridges,
} from '../../src/auth/computerBridge';

const NOW = 1_800_000_000_000;
const BRIDGE_ID = 'bridge_1234567890';
const DEVICE_ID = 'device_1234567890';
const KEY_ID = '3e399a5d-79c4-4a23-8aa7-a418565d974d';
const REQUEST_ID = 'd9428888-122b-11e1-b85c-61cd3cbb3210';
const NONCE = 'N'.repeat(32);
const SIGNATURE = 'S'.repeat(86);

const COMPUTER = {
  version: 2,
  bridgeId: BRIDGE_ID,
  computerName: 'Frank’s MacBook',
  endpoint: 'https://192.168.1.20:45831/',
  tlsCertificateFingerprint: 'T'.repeat(43),
  bridgePublicKeySpki: 'B'.repeat(59),
  bridgeKeyFingerprint: 'F'.repeat(43),
  deviceId: DEVICE_ID,
  deviceKeyId: KEY_ID,
  devicePublicKeySpki: 'D'.repeat(59),
  permissions: ['bridge:health', 'session:metadata:read'],
  pairedAt: NOW - 60_000,
};

describe('authenticated mobile Computer Bridge client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    mockLoadPairedComputers.mockResolvedValue([COMPUTER]);
    mockCreateRequestIdentity.mockResolvedValue({ requestId: REQUEST_ID, nonce: NONCE });
    mockSign.mockResolvedValue(SIGNATURE);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('signs a short-lived health envelope and sends it only through the pinned route', async () => {
    mockPostPinnedBridgeJson.mockResolvedValue({
      status: 200,
      body: {
        protocolVersion: 1,
        status: 'ready',
        capabilities: { sessionList: true, sessionLoad: false, sessionPrompt: false },
      },
    });

    await expect(getComputerBridgeHealth(BRIDGE_ID)).resolves.toEqual({
      protocolVersion: 1,
      status: 'ready',
      capabilities: { sessionList: true, sessionLoad: false, sessionPrompt: false },
    });

    expect(mockSign).toHaveBeenCalledTimes(1);
    const unsigned = JSON.parse(mockSign.mock.calls[0]?.[1] as string) as Record<string, unknown>;
    expect(mockSign).toHaveBeenCalledWith(KEY_ID, canonicalJson(unsigned));
    expect(unsigned).toEqual({
      body: {},
      bridgeId: BRIDGE_ID,
      deviceId: DEVICE_ID,
      expiresAt: NOW + 15_000,
      issuedAt: NOW,
      method: 'bridge.health',
      nonce: NONCE,
      protocolVersion: 1,
      requestId: REQUEST_ID,
    });
    expect(mockPostPinnedBridgeJson).toHaveBeenCalledWith(
      COMPUTER.endpoint,
      '/v1/request',
      COMPUTER.tlsCertificateFingerprint,
      { ...unsigned, signature: SIGNATURE },
    );
  });

  it('interoperates with the real server authorization and canonicalization path', async () => {
    const keys = generateKeyPairSync('ed25519');
    const publicKeySpki = keys.publicKey
      .export({ format: 'der', type: 'spki' })
      .toString('base64url');
    mockLoadPairedComputers.mockResolvedValue([
      { ...COMPUTER, devicePublicKeySpki: publicKeySpki },
    ]);
    mockSign.mockImplementation(async (_keyId: string, message: string) =>
      nodeSign(null, Buffer.from(message, 'utf8'), keys.privateKey).toString('base64url'),
    );
    const sessionHandles = new SessionHandleRegistry(BRIDGE_ID, Buffer.alloc(32, 7));
    const service = new BridgeService({
      bridgeId: BRIDGE_ID,
      devices: {
        get: (deviceId) =>
          deviceId === DEVICE_ID
            ? {
                bridgeId: BRIDGE_ID,
                deviceId: DEVICE_ID,
                deviceName: 'Frank’s iPhone',
                publicKeySpki,
                status: 'active',
                pairedAt: NOW - 60_000,
                permissions: ['bridge:health', 'session:metadata:read'],
              }
            : undefined,
      },
      replayGuard: new InMemoryReplayGuard(),
      rateLimiter: new FixedWindowRateLimiter(),
      sessionHandles,
      sessions: {
        isSessionListSupported: () => true,
        listSessions: async () => ({ sessions: [] }),
      },
    });
    mockPostPinnedBridgeJson.mockImplementation(
      async (_endpoint: string, _path: string, _fingerprint: string, envelope: unknown) => {
        const response = await service.handle(envelope, { peerKey: 'phone', now: NOW });
        return { status: response.status, body: response.body };
      },
    );

    await expect(getComputerBridgeHealth(BRIDGE_ID)).resolves.toMatchObject({
      status: 'ready',
      capabilities: { sessionList: true },
    });
    sessionHandles.destroy();
  });

  it('validates a privacy-redacted local session page and optional cursor', async () => {
    mockPostPinnedBridgeJson.mockResolvedValue({
      status: 200,
      body: {
        sessions: [
          {
            id: `local_${'L'.repeat(43)}`,
            origin: 'computer',
            workspaceName: 'DevinX',
            hasTitle: true,
            updatedAt: '2027-01-15T12:00:00.000Z',
          },
        ],
        nextCursor: 'next-page',
      },
    });

    await expect(listComputerSessions(BRIDGE_ID, { cursor: 'current-page' })).resolves.toEqual({
      sessions: [
        {
          id: `local_${'L'.repeat(43)}`,
          origin: 'computer',
          workspaceName: 'DevinX',
          hasTitle: true,
          updatedAt: '2027-01-15T12:00:00.000Z',
        },
      ],
      nextCursor: 'next-page',
    });
    const envelope = mockPostPinnedBridgeJson.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(envelope).toMatchObject({ method: 'session.list', body: { cursor: 'current-page' } });
  });

  it('validates the Keychain credential once for a multi-request discovery cycle', async () => {
    mockPostPinnedBridgeJson
      .mockResolvedValueOnce({
        status: 200,
        body: {
          protocolVersion: 1,
          status: 'ready',
          capabilities: { sessionList: true, sessionLoad: false, sessionPrompt: false },
        },
      })
      .mockResolvedValueOnce({ status: 200, body: { sessions: [] } });

    const connection = await openComputerBridge(BRIDGE_ID);
    await connection.getHealth();
    await connection.listSessions();

    expect(mockLoadPairedComputers).toHaveBeenCalledTimes(1);
    expect(mockCreateRequestIdentity).toHaveBeenCalledTimes(2);
    expect(mockSign).toHaveBeenCalledTimes(2);
  });

  it('opens all selected paired Macs from one validated credential-registry read', async () => {
    const second = {
      ...COMPUTER,
      bridgeId: 'bridge_0987654321',
      deviceId: 'device_0987654321',
    };
    mockLoadPairedComputers.mockResolvedValue([COMPUTER, second]);

    const connections = await openComputerBridges([COMPUTER.bridgeId, second.bridgeId]);

    expect(connections.get(COMPUTER.bridgeId)?.bridgeId).toBe(COMPUTER.bridgeId);
    expect(connections.get(second.bridgeId)?.bridgeId).toBe(second.bridgeId);
    expect(mockLoadPairedComputers).toHaveBeenCalledTimes(1);
  });

  it('fails before signing when the local grant is absent', async () => {
    mockLoadPairedComputers.mockResolvedValue([{ ...COMPUTER, permissions: ['bridge:health'] }]);

    await expect(listComputerSessions(BRIDGE_ID)).rejects.toMatchObject({
      code: 'permission_denied',
    });
    expect(mockCreateRequestIdentity).not.toHaveBeenCalled();
    expect(mockSign).not.toHaveBeenCalled();
    expect(mockPostPinnedBridgeJson).not.toHaveBeenCalled();
  });

  it.each([
    [404, 'authorization_failed'],
    [429, 'rate_limited'],
    [503, 'unavailable'],
    [400, 'invalid_response'],
  ])('maps status %s without exposing server details', async (status, code) => {
    mockPostPinnedBridgeJson.mockResolvedValue({ status, body: { error: 'private_detail' } });

    const request = getComputerBridgeHealth(BRIDGE_ID);
    await expect(request).rejects.toBeInstanceOf(ComputerBridgeError);
    await expect(request).rejects.toMatchObject({ code });
  });

  it('fails closed on malformed response fields, duplicate sessions, or transport errors', async () => {
    mockPostPinnedBridgeJson.mockResolvedValueOnce({
      status: 200,
      body: {
        sessions: [
          {
            id: `local_${'L'.repeat(43)}`,
            origin: 'computer',
            workspaceName: 'Repo',
            hasTitle: false,
            title: 'Leaked title',
          },
        ],
      },
    });
    await expect(listComputerSessions(BRIDGE_ID)).rejects.toMatchObject({
      code: 'invalid_response',
    });

    mockPostPinnedBridgeJson.mockResolvedValueOnce({
      status: 200,
      body: {
        sessions: [
          {
            id: `local_${'M'.repeat(43)}`,
            origin: 'computer',
            workspaceName: 'Repo',
            hasTitle: true,
            title: 'Content outside the metadata grant',
          },
        ],
      },
    });
    await expect(listComputerSessions(BRIDGE_ID)).rejects.toMatchObject({
      code: 'invalid_response',
    });

    mockPostPinnedBridgeJson.mockRejectedValueOnce(new Error('certificate mismatch details'));
    await expect(getComputerBridgeHealth(BRIDGE_ID)).rejects.toEqual(
      expect.objectContaining({
        code: 'unavailable',
        message: 'The paired Mac could not be reached securely.',
      }),
    );
  });
});
