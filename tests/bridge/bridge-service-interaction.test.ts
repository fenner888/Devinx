import { generateKeyPairSync, randomBytes, randomUUID, sign } from 'node:crypto';

import type {
  AcpLoadedSession,
  AcpPendingElicitation,
  AcpPendingPermission,
} from '../../bridge/src/acp';
import type { ActivityEntry } from '../../bridge/src/activity';
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
const PERMISSION_ID = `permission_${'P'.repeat(43)}`;

describe('Bridge service interaction compatibility', () => {
  const deviceKeys = generateKeyPairSync('ed25519');
  let device: DeviceRecord;
  let devices: DeviceStore;
  let adapter: SessionDiscoveryAdapter;
  let pendingPermission: AcpPendingPermission | null;
  const permissionResponses: Array<{
    sessionId: string;
    permissionId: string;
    decision: 'allow_once' | 'allow_session' | 'reject_once';
  }> = [];

  beforeEach(() => {
    device = {
      bridgeId: BRIDGE_ID,
      deviceId: DEVICE_ID,
      deviceName: 'Interaction test phone',
      publicKeySpki: deviceKeys.publicKey
        .export({ format: 'der', type: 'spki' })
        .toString('base64url'),
      status: 'active',
      pairedAt: NOW - 60_000,
      permissions: ['bridge:health', 'session:metadata:read', 'session:content:read'],
    };
    devices = { get: (deviceId) => (deviceId === DEVICE_ID ? device : undefined) };
    pendingPermission = {
      id: PERMISSION_ID,
      title: 'Run the release command',
      toolKind: 'execute',
      command: 'npm run release:check',
      paths: ['package.json'],
      decisions: ['allow_once', 'allow_session', 'reject_once'],
      createdAt: NOW - 1_000,
      expiresAt: NOW + 600_000,
    };
    permissionResponses.length = 0;
    adapter = {
      isSessionListSupported: () => true,
      listSessions: async () => ({
        sessions: [
          {
            sessionId: RAW_SESSION_ID,
            cwd: '/Users/frank/DevinX',
            activity: {
              active: true,
              kind: 'executing',
              label: 'Waiting for your approval',
              awaiting: 'approval',
              updatedAt: NOW,
            },
          },
        ],
      }),
      isSessionLoadSupported: () => true,
      loadSession: async (sessionId): Promise<AcpLoadedSession> => ({
        sessionId,
        cwd: '/Users/frank/DevinX',
        messages: [{ source: 'devin', text: 'Waiting for approval.' }],
        activity: [
          {
            id: 'activity-entry',
            afterSequence: 1,
            kind: 'tool',
            toolKind: 'execute',
            status: 'awaiting_input',
            title: 'Run the release command',
            truncated: false,
          } satisfies ActivityEntry,
        ],
        truncated: false,
      }),
      isSessionActivitySupported: () => true,
      getSessionActivity: async () => ({
        active: true,
        kind: 'executing',
        label: 'Waiting for your approval',
        awaiting: 'approval',
        updatedAt: NOW,
      }),
      isSessionElicitationSupported: () => false,
      isSessionPermissionSupported: () => true,
      getPendingPermission: (sessionId) =>
        sessionId === RAW_SESSION_ID ? pendingPermission : null,
      respondToPermission: (sessionId, permissionId, decision) => {
        permissionResponses.push({ sessionId, permissionId, decision });
        pendingPermission = null;
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

  it('advertises permission prompts only for an opted-in supported adapter', async () => {
    const bridge = service();

    await expect(
      bridge.handle(envelope('bridge.features', {}), context),
    ).resolves.toEqual({
      status: 200,
      body: { sessionElicitation: false, activityTimeline: true },
    });
    await expect(
      bridge.handle(envelope('bridge.features', { interaction: true }), context),
    ).resolves.toEqual({
      status: 200,
      body: {
        sessionElicitation: false,
        activityTimeline: true,
        permissionPrompts: true,
      },
    });
  });

  it('uses the exact read and response grants and conceals mismatched handles', async () => {
    const bridge = service();
    const listed = await bridge.handle(
      envelope('session.list', {}, ['session:metadata:read']),
      context,
    );
    const sessionId = (listed.body as { sessions: Array<{ id: string }> }).sessions[0]?.id ?? '';

    await expect(
      bridge.handle(
        envelope('session.permission', { sessionId }, ['bridge:health']),
        context,
      ),
    ).resolves.toEqual({ status: 404, body: { error: 'not_found' } });
    await expect(
      bridge.handle(
        envelope('session.permission', { sessionId }, ['session:content:read']),
        context,
      ),
    ).resolves.toMatchObject({
      status: 200,
      body: {
        permission: {
          id: PERMISSION_ID,
          title: 'Run the release command',
          decisions: ['allow_once', 'allow_session', 'reject_once'],
        },
      },
    });

    await expect(
      bridge.handle(
        envelope(
          'session.permission.respond',
          {
            sessionId,
            permissionId: `permission_${'X'.repeat(43)}`,
            decision: 'allow_once',
          },
          ['session:prompt:send'],
        ),
        context,
      ),
    ).resolves.toEqual({ status: 404, body: { error: 'not_found' } });
    await expect(
      bridge.handle(
        envelope(
          'session.permission.respond',
          { sessionId, permissionId: PERMISSION_ID, decision: 'allow_session' },
          ['session:content:read'],
        ),
        context,
      ),
    ).resolves.toEqual({ status: 404, body: { error: 'not_found' } });
    await expect(
      bridge.handle(
        envelope(
          'session.permission.respond',
          { sessionId, permissionId: PERMISSION_ID, decision: 'allow_once' },
          ['session:prompt:send'],
        ),
        context,
      ),
    ).resolves.toEqual({ status: 200, body: { accepted: true } });
    expect(permissionResponses).toEqual([
      {
        sessionId: RAW_SESSION_ID,
        permissionId: PERMISSION_ID,
        decision: 'allow_once',
      },
    ]);
  });

  it('returns and accepts free-text answers for an allowOther elicitation field', async () => {
    const bridge = service();
    const listed = await bridge.handle(
      envelope('session.list', {}, ['session:metadata:read']),
      context,
    );
    const sessionId = (listed.body as { sessions: Array<{ id: string }> }).sessions[0]?.id ?? '';
    const interactionId = `interaction_${'I'.repeat(43)}`;
    const pendingElicitation: AcpPendingElicitation = {
      sessionId: RAW_SESSION_ID,
      id: interactionId,
      message: 'Which files should I list?',
      fields: [
        {
          key: 'q0',
          type: 'single_select',
          title: 'Files',
          required: true,
          allowOther: true,
          options: [
            { value: 'all', label: 'All files' },
            { value: 'changed', label: 'Changed files' },
          ],
        },
      ],
      createdAt: NOW - 1_000,
    };
    const elicitationResponses: Array<{
      sessionId: string;
      interactionId: string;
      response: Parameters<
        NonNullable<SessionDiscoveryAdapter['respondToElicitation']>
      >[2];
    }> = [];
    adapter.isSessionElicitationSupported = () => true;
    adapter.getPendingElicitation = (rawSessionId) =>
      rawSessionId === RAW_SESSION_ID ? pendingElicitation : null;
    adapter.respondToElicitation = (rawSessionId, id, response) => {
      elicitationResponses.push({ sessionId: rawSessionId, interactionId: id, response });
    };

    await expect(
      bridge.handle(
        envelope('session.elicitation', { sessionId }, ['session:content:read']),
        context,
      ),
    ).resolves.toMatchObject({
      status: 200,
      body: {
        interaction: {
          id: interactionId,
          fields: [{ key: 'q0', type: 'single_select', allowOther: true }],
        },
      },
    });

    const answer = 'Neither — just list the files';
    await expect(
      bridge.handle(
        envelope(
          'session.elicitation.respond',
          {
            sessionId,
            interactionId,
            action: 'accept',
            content: { q0: answer },
          },
          ['session:prompt:send'],
        ),
        context,
      ),
    ).resolves.toEqual({ status: 200, body: { accepted: true } });
    expect(elicitationResponses).toEqual([
      {
        sessionId: RAW_SESSION_ID,
        interactionId,
        response: { action: 'accept', content: { q0: answer } },
      },
    ]);
  });

  it('keeps legacy response shapes while opting into awaiting fields and statuses', async () => {
    const bridge = service();
    const listed = await bridge.handle(
      envelope('session.list', {}, ['session:metadata:read']),
      context,
    );
    const sessionId = (listed.body as { sessions: Array<{ id: string }> }).sessions[0]?.id ?? '';

    await expect(
      bridge.handle(
        envelope('session.list', { interaction: true }, ['session:metadata:read']),
        context,
      ),
    ).resolves.toMatchObject({
      status: 200,
      body: { sessions: [{ activity: { awaiting: 'approval' } }] },
    });

    await expect(
      bridge.handle(
        envelope('session.activity', { sessionId }, ['session:content:read']),
        context,
      ),
    ).resolves.toEqual({
      status: 200,
      body: {
        active: true,
        kind: 'executing',
        label: 'Waiting for your approval',
        updatedAt: NOW,
      },
    });
    await expect(
      bridge.handle(
        envelope(
          'session.activity',
          { sessionId, interaction: true },
          ['session:content:read'],
        ),
        context,
      ),
    ).resolves.toEqual({
      status: 200,
      body: {
        active: true,
        kind: 'executing',
        label: 'Waiting for your approval',
        updatedAt: NOW,
        awaiting: 'approval',
      },
    });

    await expect(
      bridge.handle(
        envelope('session.load', { sessionId }, ['session:content:read']),
        context,
      ),
    ).resolves.toMatchObject({
      status: 200,
      body: { activity: [{ status: 'running' }] },
    });
    await expect(
      bridge.handle(
        envelope(
          'session.load',
          { sessionId, interaction: true },
          ['session:content:read'],
        ),
        context,
      ),
    ).resolves.toMatchObject({
      status: 200,
      body: { activity: [{ status: 'awaiting_input' }] },
    });
  });
});
