import { canonicalJson } from '../../src/auth/canonicalJson';

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
  getComputerBridgeFeatures,
  getComputerSessionPermission,
  listComputerSessions,
  loadComputerSession,
  getComputerSessionActivity,
  respondToComputerSessionPermission,
} from '../../src/auth/computerBridge';

const SESSION_ID = `local_${'L'.repeat(43)}`;
const PERMISSION_ID = `permission_${'P'.repeat(43)}`;
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
    ],
    pairedAt: NOW - 60_000,
  };
}

function requestEnvelopes(method: string) {
  return mockPostBridgeJson.mock.calls
    .map((call) => call[2] as { method: string; body: Record<string, unknown> })
    .filter((envelope) => envelope.method === method);
}

describe('Computer Bridge interaction compatibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    mockCreateRequestIdentity.mockResolvedValue({ requestId: 'request_1234567890', nonce: 'N'.repeat(32) });
    mockSign.mockResolvedValue('S'.repeat(86));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opts into interaction features and reuses the cached capability for session requests', async () => {
    mockLoadPairedComputers.mockResolvedValue([credential('bridge_interaction_enabled')]);
    mockPostBridgeJson.mockImplementation(async (_endpoint: string, _path: string, envelope: unknown) => {
      const request = envelope as { method: string };
      if (request.method === 'bridge.features') {
        return {
          status: 200,
          body: {
            sessionElicitation: true,
            activityTimeline: true,
            permissionPrompts: true,
            futureFlag: true,
          },
        };
      }
      if (request.method === 'session.list') return { status: 200, body: { sessions: [] } };
      if (request.method === 'session.load') {
        return {
          status: 200,
          body: {
            session: { id: SESSION_ID, origin: 'computer', workspaceName: 'Workspace' },
            messages: [{ sequence: 1, source: 'devin', text: 'Ready.' }],
            truncated: false,
          },
        };
      }
      if (request.method === 'session.activity') {
        return {
          status: 200,
          body: {
            active: true,
            kind: 'thinking',
            label: 'Waiting for your answer',
            updatedAt: NOW,
            awaiting: 'answer',
          },
        };
      }
      throw new Error(`Unexpected method ${request.method}`);
    });

    await expect(getComputerBridgeFeatures('bridge_interaction_enabled')).resolves.toMatchObject({
      permissionPrompts: true,
    });
    await getComputerBridgeFeatures('bridge_interaction_enabled');
    await listComputerSessions('bridge_interaction_enabled');
    await loadComputerSession('bridge_interaction_enabled', SESSION_ID);
    await getComputerSessionActivity('bridge_interaction_enabled', SESSION_ID);

    expect(requestEnvelopes('bridge.features')).toHaveLength(1);
    expect(requestEnvelopes('bridge.features')[0]?.body).toEqual({ interaction: true });
    expect(requestEnvelopes('session.list')[0]?.body).toEqual({ interaction: true });
    expect(requestEnvelopes('session.load')[0]?.body).toEqual({
      sessionId: SESSION_ID,
      interaction: true,
    });
    expect(requestEnvelopes('session.activity')[0]?.body).toEqual({
      sessionId: SESSION_ID,
      interaction: true,
    });
    expect(mockSign).toHaveBeenCalledWith(
      `key_bridge_interaction_enabled`,
      expect.any(String),
    );
    expect(mockSign.mock.calls.map((call) => call[1])).toContain(
      canonicalJson(JSON.parse(mockSign.mock.calls[0]?.[1] as string)),
    );
  });

  it('keeps interaction enabled after the feature promise cache expires', async () => {
    mockLoadPairedComputers.mockResolvedValue([credential('bridge_interaction_ttl')]);
    mockPostBridgeJson.mockImplementation(async (_endpoint: string, _path: string, envelope: unknown) => {
      const request = envelope as { method: string };
      if (request.method === 'bridge.features') {
        return {
          status: 200,
          body: { sessionElicitation: true, activityTimeline: true, permissionPrompts: true },
        };
      }
      if (request.method === 'session.activity') {
        return {
          status: 200,
          body: {
            active: true,
            kind: 'thinking',
            label: 'Waiting for your answer',
            updatedAt: NOW,
            awaiting: 'answer',
          },
        };
      }
      throw new Error(`Unexpected method ${request.method}`);
    });

    await getComputerBridgeFeatures('bridge_interaction_ttl');
    jest.spyOn(Date, 'now').mockReturnValue(NOW + 60_001);
    await getComputerSessionActivity('bridge_interaction_ttl', SESSION_ID);

    expect(requestEnvelopes('bridge.features')).toHaveLength(1);
    expect(requestEnvelopes('session.activity')[0]?.body).toEqual({
      sessionId: SESSION_ID,
      interaction: true,
    });
  });

  it('retries old Connector feature negotiation without interaction and keeps opt-in disabled', async () => {
    mockLoadPairedComputers.mockResolvedValue([credential('bridge_legacy_connector')]);
    mockPostBridgeJson
      .mockResolvedValueOnce({ status: 400, body: { error: 'invalid_request' } })
      .mockResolvedValueOnce({
        status: 200,
        body: { sessionElicitation: false, activityTimeline: false },
      })
      .mockResolvedValueOnce({ status: 200, body: { sessions: [] } })
      .mockResolvedValueOnce({
        status: 200,
        body: {
          session: { id: SESSION_ID, origin: 'computer', workspaceName: 'Workspace' },
          messages: [{ sequence: 1, source: 'devin', text: 'Ready.' }],
          truncated: false,
        },
      })
      .mockResolvedValueOnce({
        status: 200,
        body: {
          active: true,
          kind: 'thinking',
          label: 'Thinking',
          updatedAt: NOW,
        },
      });

    const features = await getComputerBridgeFeatures('bridge_legacy_connector');
    expect(features).toMatchObject({
      sessionElicitation: false,
      activityTimeline: false,
    });
    expect(features.permissionPrompts ?? false).toBe(false);
    await listComputerSessions('bridge_legacy_connector');
    await loadComputerSession('bridge_legacy_connector', SESSION_ID);
    await getComputerSessionActivity('bridge_legacy_connector', SESSION_ID);

    expect(requestEnvelopes('bridge.features').map(({ body }) => body)).toEqual([
      { interaction: true },
      {},
    ]);
    expect(requestEnvelopes('session.list')[0]?.body).toEqual({});
    expect(requestEnvelopes('session.load')[0]?.body).toEqual({ sessionId: SESSION_ID });
    expect(requestEnvelopes('session.activity')[0]?.body).toEqual({ sessionId: SESSION_ID });
  });

  it('downgrades after an invalid interaction request and omits opt-in thereafter', async () => {
    mockLoadPairedComputers.mockResolvedValue([credential('bridge_interaction_downgrade')]);
    const activity = {
      active: true,
      kind: 'thinking',
      label: 'Waiting for your approval',
      updatedAt: NOW,
      awaiting: 'approval',
    };
    mockPostBridgeJson
      .mockResolvedValueOnce({
        status: 200,
        body: { sessionElicitation: true, activityTimeline: true, permissionPrompts: true },
      })
      .mockResolvedValueOnce({ status: 400, body: { error: 'invalid_request' } })
      .mockResolvedValueOnce({ status: 200, body: activity })
      .mockResolvedValueOnce({ status: 200, body: activity });

    await getComputerBridgeFeatures('bridge_interaction_downgrade');
    await expect(
      getComputerSessionActivity('bridge_interaction_downgrade', SESSION_ID),
    ).resolves.toMatchObject({ awaiting: 'approval' });
    await getComputerSessionActivity('bridge_interaction_downgrade', SESSION_ID);

    expect(requestEnvelopes('session.activity').map(({ body }) => body)).toEqual([
      { sessionId: SESSION_ID, interaction: true },
      { sessionId: SESSION_ID },
      { sessionId: SESSION_ID },
    ]);
    expect(requestEnvelopes('bridge.features')).toHaveLength(1);
  });

  it('does not retry interaction requests for unrelated Connector errors', async () => {
    mockLoadPairedComputers.mockResolvedValue([credential('bridge_interaction_error')]);
    mockPostBridgeJson
      .mockResolvedValueOnce({
        status: 200,
        body: { sessionElicitation: true, activityTimeline: true, permissionPrompts: true },
      })
      .mockResolvedValueOnce({ status: 503, body: { error: 'temporarily_unavailable' } });

    await getComputerBridgeFeatures('bridge_interaction_error');
    await expect(
      getComputerSessionActivity('bridge_interaction_error', SESSION_ID),
    ).rejects.toMatchObject({ code: 'unavailable' });

    expect(requestEnvelopes('session.activity')).toHaveLength(1);
    expect(requestEnvelopes('session.activity')[0]?.body).toEqual({
      sessionId: SESSION_ID,
      interaction: true,
    });
  });

  it('reads and responds to bounded command permissions using the granted methods', async () => {
    mockLoadPairedComputers.mockResolvedValue([credential('bridge_permission')]);
    mockPostBridgeJson
      .mockResolvedValueOnce({
        status: 200,
        body: {
          permission: {
            id: PERMISSION_ID,
            title: 'Run git push',
            toolKind: 'execute',
            command: 'git push --dry-run',
            paths: ['src/file.ts'],
            decisions: ['allow_once', 'allow_session', 'reject_once'],
            createdAt: NOW,
            expiresAt: NOW + 60_000,
          },
        },
      })
      .mockResolvedValueOnce({ status: 200, body: { accepted: true } });

    await expect(
      getComputerSessionPermission('bridge_permission', SESSION_ID),
    ).resolves.toMatchObject({ id: PERMISSION_ID, command: 'git push --dry-run' });
    await expect(
      respondToComputerSessionPermission('bridge_permission', {
        sessionId: SESSION_ID,
        permissionId: PERMISSION_ID,
        decision: 'allow_once',
      }),
    ).resolves.toBeUndefined();

    expect(requestEnvelopes('session.permission')[0]?.body).toEqual({ sessionId: SESSION_ID });
    expect(requestEnvelopes('session.permission.respond')[0]?.body).toEqual({
      sessionId: SESSION_ID,
      permissionId: PERMISSION_ID,
      decision: 'allow_once',
    });
  });
});
