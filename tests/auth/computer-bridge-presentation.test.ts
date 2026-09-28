const mockLoadPairedComputers = jest.fn();
const mockCreateRequestIdentity = jest.fn();
const mockSign = jest.fn();
const mockPostBridgeJson = jest.fn();

jest.mock('../../src/auth/pairedComputers', () => ({
  loadPairedComputers: () => mockLoadPairedComputers(),
}));

jest.mock('../../src/auth/deviceSigning', () => ({
  createRequestIdentity: () => mockCreateRequestIdentity(),
  deleteDeviceIdentity: jest.fn(),
  sign: (keyId: string, message: string) => mockSign(keyId, message),
  postTailnetBridgeJson: (...arguments_: unknown[]) => mockPostBridgeJson(...arguments_),
  postPinnedBridgeJson: (...arguments_: unknown[]) => mockPostBridgeJson(...arguments_),
}));

import {
  computerLoadedSessionSchema,
  getComputerBridgeFeatures,
  loadComputerSession,
} from '../../src/auth/computerBridge';

const SESSION_ID = `local_${'L'.repeat(43)}`;
const NOW = 1_800_000_000_000;

function credential(bridgeId: string) {
  return {
    version: 3,
    bridgeId,
    computerName: 'Test Mac',
    endpoint: 'http://100.100.1.1:45831/',
    transportSecurity: 'tailscale_wireguard',
    tlsCertificateFingerprint: 'T'.repeat(43),
    bridgePublicKeySpki: 'B'.repeat(59),
    bridgeKeyFingerprint: 'F'.repeat(43),
    deviceId: `device_${bridgeId}`,
    deviceKeyId: `key_${bridgeId}`,
    devicePublicKeySpki: 'D'.repeat(59),
    permissions: [
      'bridge:health',
      'session:metadata:read',
      'session:content:read',
      'session:prompt:send',
      'session:create',
    ],
    pairedAt: NOW - 60_000,
  };
}

function requests(method: string) {
  return mockPostBridgeJson.mock.calls
    .map((call) => call[2] as { method: string; body: Record<string, unknown> })
    .filter((envelope) => envelope.method === method);
}

function loadedSession(createdAt?: number) {
  return {
    session: { id: SESSION_ID, origin: 'computer', workspaceName: 'Workspace' },
    messages: [
      {
        sequence: 1,
        source: 'devin',
        text: 'Ready.',
        ...(createdAt !== undefined ? { createdAt } : {}),
      },
    ],
    truncated: false,
  };
}

describe('Computer Bridge presentation compatibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    mockCreateRequestIdentity.mockResolvedValue({
      requestId: 'request_1234567890',
      nonce: 'N'.repeat(32),
    });
    mockSign.mockResolvedValue('S'.repeat(86));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('falls back from presentation through interaction and legacy, then remembers the rejection', async () => {
    const bridgeId = 'bridge_presentation_fallback';
    mockLoadPairedComputers.mockResolvedValue([credential(bridgeId)]);
    let interactionAttempts = 0;
    mockPostBridgeJson.mockImplementation(
      async (_endpoint: string, _path: string, envelope: unknown) => {
        const request = envelope as { method: string; body: Record<string, unknown> };
        if (request.method !== 'bridge.features') {
          throw new Error(`Unexpected method ${request.method}`);
        }
        if (request.body.presentation === true) {
          return { status: 200, body: { sessionElicitation: 'invalid' } };
        }
        if (request.body.interaction === true) {
          interactionAttempts += 1;
          if (interactionAttempts === 1) {
            return { status: 400, body: { error: 'invalid_request' } };
          }
        }
        return {
          status: 200,
          body: { sessionElicitation: false, activityTimeline: false },
        };
      },
    );

    await getComputerBridgeFeatures(bridgeId);
    await getComputerBridgeFeatures(bridgeId);

    expect(requests('bridge.features').map((request) => request.body)).toEqual([
      { interaction: true, presentation: true },
      { interaction: true },
      {},
      { interaction: true },
    ]);
  });

  it('requests bounded timestamps with session history only when advertised', async () => {
    const bridgeId = 'bridge_presentation_timestamps';
    mockLoadPairedComputers.mockResolvedValue([credential(bridgeId)]);
    mockPostBridgeJson.mockImplementation(
      async (_endpoint: string, _path: string, envelope: unknown) => {
        const request = envelope as { method: string };
        if (request.method === 'bridge.features') {
          return {
            status: 200,
            body: {
              sessionElicitation: true,
              activityTimeline: true,
              permissionPrompts: true,
              messageTimestamps: true,
              grants: { viewSessions: true, sendPrompts: true, startSessions: true },
            },
          };
        }
        if (request.method === 'session.load') {
          return { status: 200, body: loadedSession(1_790_610_060_123) };
        }
        throw new Error(`Unexpected method ${request.method}`);
      },
    );

    await getComputerBridgeFeatures(bridgeId);
    await loadComputerSession(bridgeId, SESSION_ID);

    expect(requests('bridge.features')[0]?.body).toEqual({
      interaction: true,
      presentation: true,
    });
    expect(requests('session.load')[0]?.body).toEqual({
      sessionId: SESSION_ID,
      interaction: true,
      timestamps: true,
    });

    mockLoadPairedComputers.mockResolvedValue([credential('bridge_presentation_no_timestamps')]);
    mockPostBridgeJson.mockImplementation(
      async (_endpoint: string, _path: string, envelope: unknown) => {
        const request = envelope as { method: string; body: Record<string, unknown> };
        if (request.method === 'bridge.features') {
          return {
            status: 200,
            body: {
              sessionElicitation: true,
              permissionPrompts: true,
              messageTimestamps: false,
            },
          };
        }
        if (request.method === 'session.load') {
          return { status: 200, body: loadedSession() };
        }
        throw new Error(`Unexpected method ${request.method}`);
      },
    );

    await getComputerBridgeFeatures('bridge_presentation_no_timestamps');
    await loadComputerSession('bridge_presentation_no_timestamps', SESSION_ID);

    expect(requests('session.load').at(-1)?.body).toEqual({
      sessionId: SESSION_ID,
      interaction: true,
    });
  });

  it('drops interaction and timestamp flags together after an invalid session-load request', async () => {
    const bridgeId = 'bridge_presentation_load_fallback';
    mockLoadPairedComputers.mockResolvedValue([credential(bridgeId)]);
    let loadAttempts = 0;
    mockPostBridgeJson.mockImplementation(
      async (_endpoint: string, _path: string, envelope: unknown) => {
        const request = envelope as { method: string };
        if (request.method === 'bridge.features') {
          return {
            status: 200,
            body: {
              sessionElicitation: false,
              permissionPrompts: true,
              messageTimestamps: true,
            },
          };
        }
        if (request.method === 'session.load') {
          loadAttempts += 1;
          if (loadAttempts === 1) return { status: 400, body: { error: 'invalid_request' } };
          return { status: 200, body: loadedSession() };
        }
        throw new Error(`Unexpected method ${request.method}`);
      },
    );

    await getComputerBridgeFeatures(bridgeId);
    await loadComputerSession(bridgeId, SESSION_ID);

    expect(requests('session.load').map((request) => request.body)).toEqual([
      { sessionId: SESSION_ID, interaction: true, timestamps: true },
      { sessionId: SESSION_ID },
    ]);
  });

  it('accepts only integer createdAt values within the supported date range', () => {
    const valid = computerLoadedSessionSchema.safeParse(loadedSession(8_640_000_000_000_000));
    const negative = computerLoadedSessionSchema.safeParse(loadedSession(-1));
    const fractional = computerLoadedSessionSchema.safeParse(loadedSession(1.5));
    const tooLarge = computerLoadedSessionSchema.safeParse(loadedSession(8_640_000_000_000_001));

    expect(valid.success).toBe(true);
    expect(negative.success).toBe(false);
    expect(fractional.success).toBe(false);
    expect(tooLarge.success).toBe(false);
  });
});
