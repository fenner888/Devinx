import { generateKeyPairSync, randomBytes, randomUUID, sign } from 'node:crypto';

import {
  AcpBusyError,
  type AcpLoadedSession,
  type AcpElicitationResponse,
  type AcpPendingElicitation,
  type AcpSessionActivity,
  type AcpSessionPage,
} from '../../bridge/src/acp';
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

class FakeSessionAdapter implements SessionDiscoveryAdapter {
  supported = true;
  loadSupported = true;
  promptSupported = true;
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
  activity: AcpSessionActivity | null = {
    active: true,
    kind: 'editing',
    label: 'Editing\nsrc/session.ts',
    updatedAt: NOW,
  };
  elicitationSupported = true;
  elicitation: AcpPendingElicitation | null = {
    id: `interaction_${'Q'.repeat(43)}`,
    sessionId: 'raw-private-session-id',
    message: 'Which implementation should I use?',
    title: 'Choose an approach',
    fields: [
      {
        key: 'approach',
        type: 'single_select',
        title: 'Approach',
        required: true,
        options: [
          { value: 'safe', label: 'Preserve the current API' },
          { value: 'migrate', label: 'Migrate the API' },
        ],
      },
    ],
    createdAt: NOW,
  };
  elicitationResponses: Array<{
    sessionId: string;
    interactionId: string;
    response: AcpElicitationResponse;
  }> = [];
  prompts: Array<{ sessionId: string; text: string; modelId?: string }> = [];
  continuedSessionId: string | null = null;
  promptFailure: Error | null = null;
  createSupported = true;
  createOptions = {
    workspaces: [{ path: '/Users/frank/Secret Project' }],
    models: [
      {
        id: 'gpt-5-6-sol-medium',
        name: 'GPT-5.6 Sol Medium Thinking',
        description: 'Recommended for coding',
        supportsImages: true,
        badge: 'new' as const,
        recent: true,
        recommended: true,
      },
    ],
    defaultModelId: 'gpt-5-6-sol-medium',
    catalogSource: 'live' as const,
  };
  creations: Array<{ cwd: string; modelId: string | null; text: string }> = [];

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

  isSessionActivitySupported(): boolean {
    return true;
  }

  async getSessionActivity(): Promise<AcpSessionActivity | null> {
    return this.activity;
  }

  isSessionElicitationSupported(): boolean {
    return this.elicitationSupported;
  }

  getPendingElicitation(): AcpPendingElicitation | null {
    return this.elicitation;
  }

  respondToElicitation(
    sessionId: string,
    interactionId: string,
    response: AcpElicitationResponse,
  ): void {
    this.elicitationResponses.push({ sessionId, interactionId, response });
    this.elicitation = null;
  }

  isSessionPromptSupported(): boolean {
    return this.promptSupported;
  }

  async promptSession(
    sessionId: string,
    text: string,
    modelId?: string,
  ): Promise<void | { continuedSessionId: string }> {
    this.prompts.push({ sessionId, text, ...(modelId ? { modelId } : {}) });
    if (this.promptFailure) throw this.promptFailure;
    return this.continuedSessionId ? { continuedSessionId: this.continuedSessionId } : undefined;
  }

  isSessionCreateSupported(): boolean {
    return this.createSupported;
  }

  async listCreateOptions() {
    return this.createOptions;
  }

  async createSession(cwd: string, modelId: string | null, text: string): Promise<string> {
    this.creations.push({ cwd, modelId, text });
    return 'raw-private-created-session-id';
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
      workspaceHandles: new WorkspaceHandleRegistry(BRIDGE_ID, randomBytes(32)),
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
        protocolVersion: 2,
        status: 'ready',
        capabilities: {
          sessionList: true,
          sessionLoad: false,
          sessionPrompt: false,
        },
      },
    });
  });

  it('revokes the authenticated device through the server-authoritative registry', async () => {
    const revoke = jest.fn(async () => true);
    const bridge = service({ devices: { get: devices.get, revoke } });

    await expect(bridge.handle(envelope('device.revoke', {}), context())).resolves.toEqual({
      status: 200,
      body: { revoked: true },
    });
    expect(revoke).toHaveBeenCalledWith(DEVICE_ID);
  });

  it('advertises and accepts prompting only for the authorized device and opaque handle', async () => {
    const bridge = service();
    const permissions: BridgePermission[] = [
      'bridge:health',
      'session:metadata:read',
      'session:content:read',
      'session:prompt:send',
    ];
    const health = await bridge.handle(envelope('bridge.health', {}, permissions), context());
    expect(health).toMatchObject({
      body: { capabilities: { sessionLoad: true, sessionPrompt: true } },
    });
    const listed = await bridge.handle(envelope('session.list', {}, permissions), context());
    const handle = (listed.body as { sessions: Array<{ id: string }> }).sessions[0]?.id ?? '';
    await expect(
      bridge.handle(
        envelope(
          'session.prompt',
          {
            sessionId: handle,
            text: 'Continue the review.',
            modelId: 'gpt-5-6-sol-medium',
          },
          permissions,
        ),
        context(),
      ),
    ).resolves.toEqual({ status: 200, body: { accepted: true } });
    expect(adapter.prompts).toEqual([
      {
        sessionId: 'raw-private-session-id',
        text: 'Continue the review.',
        modelId: 'gpt-5-6-sol-medium',
      },
    ]);
  });

  it('returns only an opaque handle when a locked session is continued', async () => {
    adapter.continuedSessionId = 'raw-private-continuation-id';
    const bridge = service();
    const permissions: BridgePermission[] = [
      'bridge:health',
      'session:metadata:read',
      'session:content:read',
      'session:prompt:send',
    ];
    const listed = await bridge.handle(envelope('session.list', {}, permissions), context());
    const handle = (listed.body as { sessions: Array<{ id: string }> }).sessions[0]?.id ?? '';
    const result = await bridge.handle(
      envelope('session.prompt', { sessionId: handle, text: 'Continue.' }, permissions),
      context(),
    );

    expect(result).toMatchObject({
      status: 200,
      body: { accepted: true, sessionId: expect.stringMatching(/^local_[A-Za-z0-9_-]{43}$/) },
    });
    expect(JSON.stringify(result)).not.toContain('raw-private-continuation-id');
  });

  it('returns a minimized conflict when ACP is finishing the previous prompt', async () => {
    adapter.promptFailure = new AcpBusyError();
    const bridge = service();
    const permissions: BridgePermission[] = ['session:metadata:read', 'session:prompt:send'];
    const listed = await bridge.handle(envelope('session.list', {}, permissions), context());
    const handle = (listed.body as { sessions: Array<{ id: string }> }).sessions[0]?.id ?? '';

    const result = await bridge.handle(
      envelope('session.prompt', { sessionId: handle, text: 'Continue.' }, permissions),
      context(),
    );

    expect(result).toEqual({ status: 409, body: { error: 'conflict' } });
    expect(JSON.stringify(result)).not.toContain('ACP');
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

  it('returns only opaque workspace handles and sanitized local model metadata', async () => {
    const result = await service().handle(
      envelope('session.create_options', {}, ['session:metadata:read']),
      context(),
    );

    expect(result).toEqual({
      status: 200,
      body: {
        workspaces: [
          {
            id: expect.stringMatching(/^workspace_[A-Za-z0-9_-]{43}$/),
            name: 'Secret Project',
          },
        ],
        models: [
          {
            id: 'gpt-5-6-sol-medium',
            name: 'GPT-5.6 Sol Medium Thinking',
            description: 'Recommended for coding',
            supportsImages: true,
            badge: 'new',
            recent: true,
            recommended: true,
          },
        ],
        defaultModelId: 'gpt-5-6-sol-medium',
        catalogSource: 'live',
      },
    });
    expect(JSON.stringify(result)).not.toContain('/Users/frank');
  });

  it('creates a local session only with the separate create grant and validated options', async () => {
    const bridge = service();
    const options = await bridge.handle(
      envelope('session.create_options', {}, ['session:metadata:read']),
      context(),
    );
    const workspaceId = (options.body as { workspaces: Array<{ id: string }> }).workspaces[0]?.id;
    const body = { workspaceId, modelId: 'gpt-5-6-sol-medium', text: 'Build this safely.' };

    await expect(
      bridge.handle(envelope('session.create', body, ['session:metadata:read']), context()),
    ).resolves.toEqual({ status: 404, body: { error: 'not_found' } });
    const created = await bridge.handle(
      envelope('session.create', body, ['session:create']),
      context(),
    );

    expect(created).toMatchObject({
      status: 200,
      body: { accepted: true, sessionId: expect.stringMatching(/^local_[A-Za-z0-9_-]{43}$/) },
    });
    expect(adapter.creations).toEqual([
      {
        cwd: '/Users/frank/Secret Project',
        modelId: 'gpt-5-6-sol-medium',
        text: 'Build this safely.',
      },
    ]);
    expect(JSON.stringify(created)).not.toContain('raw-private-created-session-id');
  });

  it('conceals stale workspace and model selections with 404 before ACP creation', async () => {
    const bridge = service();
    const options = await bridge.handle(
      envelope('session.create_options', {}, ['session:metadata:read']),
      context(),
    );
    const workspaceId = (options.body as { workspaces: Array<{ id: string }> }).workspaces[0]?.id;
    adapter.createOptions.models = [];

    await expect(
      bridge.handle(
        envelope(
          'session.create',
          { workspaceId, modelId: 'gpt-5-6-sol-medium', text: 'Do not dispatch.' },
          ['session:create'],
        ),
        context(),
      ),
    ).resolves.toEqual({ status: 404, body: { error: 'not_found' } });
    await expect(
      bridge.handle(
        envelope(
          'session.create',
          {
            workspaceId: `workspace_${'A'.repeat(43)}`,
            modelId: null,
            text: 'Do not dispatch.',
          },
          ['session:create'],
        ),
        context(),
      ),
    ).resolves.toEqual({ status: 404, body: { error: 'not_found' } });
    expect(adapter.creations).toEqual([]);
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

  it('omits empty replay entries and keeps message sequences contiguous', async () => {
    adapter.loaded.messages = [
      { source: 'user', text: 'Please review this.' },
      { source: 'devin', text: '' },
      { source: 'devin', text: '   ' },
      { source: 'devin', text: 'The review is complete.' },
    ];
    const bridge = service();
    const listed = await bridge.handle(envelope('session.list', {}), context());
    const handle = (listed.body as { sessions: Array<{ id: string }> }).sessions[0]?.id;

    const result = await bridge.handle(
      envelope('session.load', { sessionId: handle }, ['session:content:read']),
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

  it('returns minimized live activity only for an authorized listed session', async () => {
    const bridge = service();
    const listed = await bridge.handle(envelope('session.list', {}), context());
    const handle = (listed.body as { sessions: Array<{ id: string }> }).sessions[0]?.id ?? '';

    await expect(
      bridge.handle(
        envelope('session.activity', { sessionId: handle }, ['session:content:read']),
        context(),
      ),
    ).resolves.toEqual({
      status: 200,
      body: {
        active: true,
        kind: 'editing',
        label: 'Editing src/session.ts',
        updatedAt: NOW,
      },
    });
    await expect(
      bridge.handle(
        envelope('session.activity', { sessionId: handle }, ['bridge:health']),
        context(),
      ),
    ).resolves.toEqual({ status: 404, body: { error: 'not_found' } });
    await expect(
      bridge.handle(
        envelope('session.activity', { sessionId: `local_${'U'.repeat(43)}` }, [
          'session:content:read',
        ]),
        context(),
      ),
    ).resolves.toEqual({ status: 404, body: { error: 'not_found' } });
  });

  it('returns and answers only the current validated session question', async () => {
    const bridge = service();
    const listed = await bridge.handle(envelope('session.list', {}), context());
    const handle = (listed.body as { sessions: Array<{ id: string }> }).sessions[0]?.id ?? '';
    const readPermissions: BridgePermission[] = ['session:content:read'];

    await expect(
      bridge.handle(
        envelope('session.elicitation', { sessionId: handle }, readPermissions),
        context(),
      ),
    ).resolves.toMatchObject({
      status: 200,
      body: {
        interaction: {
          id: `interaction_${'Q'.repeat(43)}`,
          message: 'Which implementation should I use?',
          fields: [{ key: 'approach', type: 'single_select' }],
        },
      },
    });
    const responsePermissions: BridgePermission[] = ['session:prompt:send'];
    await expect(
      bridge.handle(
        envelope(
          'session.elicitation.respond',
          {
            sessionId: handle,
            interactionId: `interaction_${'Q'.repeat(43)}`,
            action: 'accept',
            content: { approach: 'safe' },
          },
          responsePermissions,
        ),
        context(),
      ),
    ).resolves.toEqual({ status: 200, body: { accepted: true } });
    expect(adapter.elicitationResponses).toEqual([
      {
        sessionId: 'raw-private-session-id',
        interactionId: `interaction_${'Q'.repeat(43)}`,
        response: { action: 'accept', content: { approach: 'safe' } },
      },
    ]);

    await expect(
      bridge.handle(
        envelope(
          'session.elicitation.respond',
          {
            sessionId: handle,
            interactionId: `interaction_${'Q'.repeat(43)}`,
            action: 'decline',
          },
          responsePermissions,
        ),
        context(),
      ),
    ).resolves.toEqual({ status: 404, body: { error: 'not_found' } });
  });

  it('conceals session questions without the exact read or response permission', async () => {
    const bridge = service();
    const listed = await bridge.handle(envelope('session.list', {}), context());
    const handle = (listed.body as { sessions: Array<{ id: string }> }).sessions[0]?.id ?? '';

    await expect(
      bridge.handle(
        envelope('session.elicitation', { sessionId: handle }, ['bridge:health']),
        context(),
      ),
    ).resolves.toEqual({ status: 404, body: { error: 'not_found' } });
    await expect(
      bridge.handle(
        envelope(
          'session.elicitation.respond',
          {
            sessionId: handle,
            interactionId: `interaction_${'Q'.repeat(43)}`,
            action: 'decline',
          },
          ['session:content:read'],
        ),
        context(),
      ),
    ).resolves.toEqual({ status: 404, body: { error: 'not_found' } });
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

  it('rate-limits session history reads independently from write operations', async () => {
    const bridge = service({ sessionLoadLimit: 1, mutationLimit: 10, windowMs: 60_000 });
    const permissions: BridgePermission[] = [
      'bridge:health',
      'session:metadata:read',
      'session:content:read',
    ];
    const listed = await bridge.handle(envelope('session.list', {}, permissions), context());
    const handle = (listed.body as { sessions: Array<{ id: string }> }).sessions[0]?.id ?? '';

    await expect(
      bridge.handle(envelope('session.load', { sessionId: handle }, permissions), context()),
    ).resolves.toMatchObject({ status: 200 });
    await expect(
      bridge.handle(envelope('session.load', { sessionId: handle }, permissions), context()),
    ).resolves.toEqual({ status: 429, body: { error: 'rate_limited' } });
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

    await expect(bridge.handle(envelope('session.list', {}), context('peer-two'))).resolves.toEqual(
      { status: 429, body: { error: 'busy' } },
    );
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

  it('resolves only registered, unexpired opaque workspace handles', () => {
    const registry = new WorkspaceHandleRegistry(BRIDGE_ID, randomBytes(32), 60_000, 2);
    const handle = registry.register('/Users/frank/Secret Project', NOW);

    expect(handle).toMatch(/^workspace_[A-Za-z0-9_-]{43}$/);
    expect(registry.register('/Users/frank/Secret Project', NOW + 1)).toBe(handle);
    expect(registry.resolve(handle, NOW + 2)).toBe('/Users/frank/Secret Project');
    expect(registry.resolve(`workspace_${'A'.repeat(43)}`, NOW + 2)).toBeNull();
    expect(registry.resolve(handle, NOW + 60_001)).toBeNull();
    registry.destroy();
    expect(registry.resolve(handle, NOW)).toBeNull();
  });
});
