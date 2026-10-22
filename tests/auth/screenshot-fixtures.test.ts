const mockGetSecret = jest.fn();
const mockDeleteSecret = jest.fn();
const mockStoreSecret = jest.fn();
const mockCreateRequestIdentity = jest.fn();
const mockDeleteDeviceIdentity = jest.fn();
const mockHasDeviceIdentity = jest.fn();
const mockIsDeviceCryptoAvailable = jest.fn();
const mockIsPinnedBridgeTransportAvailable = jest.fn();
const mockPostPinnedBridgeJson = jest.fn();
const mockPostTailnetBridgeJson = jest.fn();
const mockSign = jest.fn();

jest.mock('../../src/auth/keychain', () => ({
  getSecret: (...args: unknown[]) => mockGetSecret(...args),
  deleteSecret: (...args: unknown[]) => mockDeleteSecret(...args),
  storeSecret: (...args: unknown[]) => mockStoreSecret(...args),
}));

jest.mock('../../src/auth/deviceSigning', () => ({
  createRequestIdentity: (...args: unknown[]) => mockCreateRequestIdentity(...args),
  deleteDeviceIdentity: (...args: unknown[]) => mockDeleteDeviceIdentity(...args),
  hasDeviceIdentity: (...args: unknown[]) => mockHasDeviceIdentity(...args),
  isDeviceCryptoAvailable: (...args: unknown[]) => mockIsDeviceCryptoAvailable(...args),
  isPinnedBridgeTransportAvailable: (...args: unknown[]) =>
    mockIsPinnedBridgeTransportAvailable(...args),
  postPinnedBridgeJson: (...args: unknown[]) => mockPostPinnedBridgeJson(...args),
  postTailnetBridgeJson: (...args: unknown[]) => mockPostTailnetBridgeJson(...args),
  sign: (...args: unknown[]) => mockSign(...args),
}));

import {
  cancelComputerSession,
  computerActivityEntrySchema,
  computerBridgeFeaturesSchema,
  computerBridgeHealthSchema,
  computerBridgePlatformSchema,
  computerBridgePresentationSchema,
  computerBridgeVersionSchema,
  computerLoadedSessionSchema,
  computerSessionActivitySchema,
  computerSessionElicitationSchema,
  computerSessionPageSchema,
  computerSessionPermissionSchema,
  createComputerSession,
  disconnectComputer,
  getComputerBridgeFeatures,
  getComputerBridgeHealth,
  getComputerBridgePlatform,
  getComputerBridgePresentation,
  getComputerBridgeVersion,
  getComputerCreateOptions,
  getComputerSessionActivity,
  getComputerSessionElicitation,
  getComputerSessionPermission,
  listComputerSessions,
  loadComputerSession,
  openComputerBridge,
  openComputerBridges,
  promptComputerSession,
  removeComputerFromThisIPhone,
  respondToComputerSessionElicitation,
  respondToComputerSessionPermission,
  sessionCreateOptionsResponseSchema,
  sessionCreateResponseSchema,
  sessionElicitationResponseSchema,
  sessionPermissionResponseSchema,
  sessionPromptResponseSchema,
  verifyComputerBridgeCredential,
} from '../../src/auth/computerBridge';
import {
  loadPairedComputerSummaries,
  loadPairedComputers,
  pairedComputerCredentialSchema,
} from '../../src/auth/pairedComputers';
import {
  createScreenshotFixtureData,
  isScreenshotFixtureMode,
  resetScreenshotFixtureDemoState,
  SCREENSHOT_FIXTURE_BRIDGE_ID,
  SCREENSHOT_FIXTURE_DEMO_REPLY_DELAY_MS,
  SCREENSHOT_FIXTURE_SESSION_IDS,
} from '../../src/auth/screenshotFixtures';
import { statusLabels } from '../../src/theme/tokens';

const FIXTURE_NOW = 1_800_000_000_000;
const ORIGINAL_DEV = Reflect.get(globalThis, '__DEV__') as unknown;
const ORIGINAL_FIXTURE_ENV = process.env.EXPO_PUBLIC_SCREENSHOT_FIXTURES;
let setFixtureNow: (now: number) => void;

function setDevMode(enabled: boolean) {
  Object.defineProperty(globalThis, '__DEV__', {
    configurable: true,
    value: enabled,
    writable: true,
  });
}

function setFixtureMode(enabled: boolean, dev = true) {
  setDevMode(dev);
  if (enabled) {
    process.env.EXPO_PUBLIC_SCREENSHOT_FIXTURES = '1';
  } else {
    delete process.env.EXPO_PUBLIC_SCREENSHOT_FIXTURES;
  }
}

function restoreFixtureEnvironment() {
  if (ORIGINAL_DEV === undefined) {
    Reflect.deleteProperty(globalThis, '__DEV__');
  } else {
    setDevMode(Boolean(ORIGINAL_DEV));
  }
  if (ORIGINAL_FIXTURE_ENV === undefined) {
    delete process.env.EXPO_PUBLIC_SCREENSHOT_FIXTURES;
  } else {
    process.env.EXPO_PUBLIC_SCREENSHOT_FIXTURES = ORIGINAL_FIXTURE_ENV;
  }
}

describe('screenshot fixture mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSecret.mockResolvedValue(null);
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(FIXTURE_NOW);
    setFixtureNow = (now) => {
      nowSpy.mockReturnValue(now);
    };
    resetScreenshotFixtureDemoState();
    setFixtureMode(false);
  });

  afterEach(() => {
    resetScreenshotFixtureDemoState();
    jest.restoreAllMocks();
    restoreFixtureEnvironment();
  });

  it('requires development mode and the explicit Expo environment flag', () => {
    setFixtureMode(true, false);
    expect(isScreenshotFixtureMode()).toBe(false);

    setFixtureMode(false, true);
    expect(isScreenshotFixtureMode()).toBe(false);

    setFixtureMode(true, true);
    expect(isScreenshotFixtureMode()).toBe(true);
  });

  it('parses every fixture through its Local boundary schema', () => {
    const fixture = createScreenshotFixtureData(FIXTURE_NOW);

    expect(pairedComputerCredentialSchema.parse(fixture.pairedComputers[0])).toMatchObject({
      computerName: 'Studio Mac',
      permissions: [
        'bridge:health',
        'session:metadata:read',
        'session:content:read',
        'session:prompt:send',
        'session:create',
      ],
    });
    expect(computerBridgeHealthSchema.parse(fixture.health)).toBeDefined();
    expect(computerBridgeFeaturesSchema.parse(fixture.features)).toBeDefined();
    expect(computerBridgePresentationSchema.parse(fixture.presentation)).toBeDefined();
    expect(computerBridgeVersionSchema.parse(fixture.version)).toBeDefined();
    expect(computerBridgePlatformSchema.parse(fixture.platform)).toBeDefined();
    expect(sessionCreateOptionsResponseSchema.parse(fixture.createOptions)).toBeDefined();
    expect(computerSessionPageSchema.parse(fixture.sessionPage)).toBeDefined();
    expect(
      Object.values(fixture.loadedSessions).map((session) =>
        computerLoadedSessionSchema.parse(session),
      ),
    ).toHaveLength(4);
    expect(
      fixture.activityEntries.map((entry) => computerActivityEntrySchema.parse(entry)),
    ).toHaveLength(5);
    expect(
      Object.values(fixture.sessionActivities).map((activity) =>
        computerSessionActivitySchema.parse(activity),
      ),
    ).toHaveLength(5);
    expect(computerSessionElicitationSchema.parse(fixture.elicitation)).toBeDefined();
    expect(computerSessionPermissionSchema.parse(fixture.permission)).toBeDefined();
    expect(sessionElicitationResponseSchema.parse(fixture.mutationResponses.accepted)).toBeDefined();
    expect(sessionPermissionResponseSchema.parse(fixture.mutationResponses.accepted)).toBeDefined();
    expect(sessionPromptResponseSchema.parse(fixture.mutationResponses.prompt)).toBeDefined();
    expect(sessionCreateResponseSchema.parse(fixture.mutationResponses.created)).toBeDefined();
  });

  it('serves validated device and session fixtures without Keychain or bridge traffic', async () => {
    setFixtureMode(true);
    const paired = await loadPairedComputers();
    const credential = paired[0];
    expect(credential).toBeDefined();
    expect(await loadPairedComputerSummaries()).toEqual([
      {
        bridgeId: SCREENSHOT_FIXTURE_BRIDGE_ID,
        computerName: 'Studio Mac',
        pairedAt: credential!.pairedAt,
        permissions: credential!.permissions,
        transportKind: 'tailscale_vpn',
      },
    ]);

    await expect(verifyComputerBridgeCredential(credential!)).resolves.toMatchObject({
      status: 'ready',
    });
    const connections = await openComputerBridges([SCREENSHOT_FIXTURE_BRIDGE_ID]);
    const bridge = await openComputerBridge(SCREENSHOT_FIXTURE_BRIDGE_ID);
    expect(connections.get(SCREENSHOT_FIXTURE_BRIDGE_ID)).toBeDefined();
    await expect(getComputerBridgeHealth(SCREENSHOT_FIXTURE_BRIDGE_ID)).resolves.toMatchObject({
      status: 'ready',
    });
    await expect(getComputerBridgeFeatures(SCREENSHOT_FIXTURE_BRIDGE_ID)).resolves.toMatchObject({
      sessionElicitation: true,
      activityTimeline: true,
      permissionPrompts: true,
    });
    await expect(getComputerBridgePresentation(SCREENSHOT_FIXTURE_BRIDGE_ID)).resolves.toMatchObject({
      grants: { viewSessions: true, sendPrompts: true, startSessions: true },
    });
    await expect(getComputerBridgeVersion(SCREENSHOT_FIXTURE_BRIDGE_ID)).resolves.toEqual({
      kind: 'supported',
      version: '0.1.17',
    });
    await expect(getComputerBridgePlatform(SCREENSHOT_FIXTURE_BRIDGE_ID)).resolves.toBe('macos');
    await expect(listComputerSessions(SCREENSHOT_FIXTURE_BRIDGE_ID)).resolves.toMatchObject({
      sessions: expect.arrayContaining([
        expect.objectContaining({ title: 'Add hourly forecast chart' }),
        expect.objectContaining({ title: 'Fix login redirect loop' }),
        expect.objectContaining({ title: 'Write tests for recipe search' }),
      ]),
    });
    await expect(
      loadComputerSession(
        SCREENSHOT_FIXTURE_BRIDGE_ID,
        SCREENSHOT_FIXTURE_SESSION_IDS.working,
      ),
    ).resolves.toMatchObject({ messages: expect.arrayContaining([expect.objectContaining({ source: 'user' })]) });
    await expect(
      getComputerSessionActivity(
        SCREENSHOT_FIXTURE_BRIDGE_ID,
        SCREENSHOT_FIXTURE_SESSION_IDS.working,
      ),
    ).resolves.toMatchObject({ active: true, kind: 'editing' });
    await expect(
      getComputerSessionElicitation(
        SCREENSHOT_FIXTURE_BRIDGE_ID,
        SCREENSHOT_FIXTURE_SESSION_IDS.question,
      ),
    ).resolves.toMatchObject({
      interaction: { fields: [{ options: [{ label: 'Keep as redirect' }, { label: 'Remove it' }] }] },
    });
    await expect(
      getComputerSessionPermission(
        SCREENSHOT_FIXTURE_BRIDGE_ID,
        SCREENSHOT_FIXTURE_SESSION_IDS.permission,
      ),
    ).resolves.toMatchObject({ id: expect.stringMatching(/^permission_/) });
    await expect(getComputerCreateOptions(SCREENSHOT_FIXTURE_BRIDGE_ID)).resolves.toMatchObject({
      defaultModelId: 'claude-sonnet-4.5',
      workspaces: expect.arrayContaining([expect.objectContaining({ name: 'weather-app' })]),
    });
    await expect(bridge.getCreateOptions()).resolves.toBeDefined();
    await expect(
      respondToComputerSessionElicitation(SCREENSHOT_FIXTURE_BRIDGE_ID, {
        sessionId: SCREENSHOT_FIXTURE_SESSION_IDS.question,
        interactionId: `interaction_${'A'.repeat(43)}`,
        action: 'accept',
        content: { route_behavior: 'keep_redirect' },
      }),
    ).resolves.toBeUndefined();
    await expect(
      respondToComputerSessionPermission(SCREENSHOT_FIXTURE_BRIDGE_ID, {
        sessionId: SCREENSHOT_FIXTURE_SESSION_IDS.permission,
        permissionId: `permission_${'B'.repeat(43)}`,
        decision: 'allow_once',
      }),
    ).resolves.toBeUndefined();
    await expect(
      promptComputerSession(
        SCREENSHOT_FIXTURE_BRIDGE_ID,
        SCREENSHOT_FIXTURE_SESSION_IDS.working,
        'Add a small test case.',
        'claude-sonnet-4.5',
      ),
    ).resolves.toMatchObject({ sessionId: SCREENSHOT_FIXTURE_SESSION_IDS.working });
    await expect(
      createComputerSession(SCREENSHOT_FIXTURE_BRIDGE_ID, {
        workspaceId: `workspace_${'A'.repeat(43)}`,
        modelId: 'claude-sonnet-4.5',
        text: 'Add a forecast chart.',
      }),
    ).resolves.toMatchObject({ sessionId: `local_${'I'.repeat(43)}` });
    await disconnectComputer(SCREENSHOT_FIXTURE_BRIDGE_ID);
    await removeComputerFromThisIPhone(SCREENSHOT_FIXTURE_BRIDGE_ID);

    expect(mockGetSecret).not.toHaveBeenCalled();
    expect(mockPostPinnedBridgeJson).not.toHaveBeenCalled();
    expect(mockPostTailnetBridgeJson).not.toHaveBeenCalled();
    expect(mockCreateRequestIdentity).not.toHaveBeenCalled();
    expect(mockDeleteDeviceIdentity).not.toHaveBeenCalled();
    expect(mockDeleteSecret).not.toHaveBeenCalled();
    expect(mockStoreSecret).not.toHaveBeenCalled();
    expect(mockHasDeviceIdentity).not.toHaveBeenCalled();
    expect(mockIsDeviceCryptoAvailable).not.toHaveBeenCalled();
    expect(mockIsPinnedBridgeTransportAvailable).not.toHaveBeenCalled();
    expect(mockSign).not.toHaveBeenCalled();
  });

  it('uses the normal Keychain-backed paired-computer path when fixture mode is off', async () => {
    setFixtureMode(false);

    await expect(loadPairedComputerSummaries()).resolves.toEqual([]);

    expect(mockGetSecret).toHaveBeenCalledTimes(1);
    expect(mockPostPinnedBridgeJson).not.toHaveBeenCalled();
  });

  it('clears an allowed permission and shows a completed reply after four seconds', async () => {
    setFixtureMode(true);
    const sessionId = SCREENSHOT_FIXTURE_SESSION_IDS.permission;

    await expect(getComputerSessionPermission(SCREENSHOT_FIXTURE_BRIDGE_ID, sessionId)).resolves
      .toMatchObject({ id: expect.stringMatching(/^permission_/) });
    await respondToComputerSessionPermission(SCREENSHOT_FIXTURE_BRIDGE_ID, {
      sessionId,
      permissionId: `permission_${'B'.repeat(43)}`,
      decision: 'allow_once',
    });

    await expect(getComputerSessionPermission(SCREENSHOT_FIXTURE_BRIDGE_ID, sessionId)).resolves.toBeNull();
    await expect(getComputerSessionActivity(SCREENSHOT_FIXTURE_BRIDGE_ID, sessionId)).resolves
      .toMatchObject({
        active: true,
        kind: 'responding',
        label: 'Working on your task',
        updatedAt: FIXTURE_NOW,
      });
    await expect(loadComputerSession(SCREENSHOT_FIXTURE_BRIDGE_ID, sessionId)).resolves
      .not.toMatchObject({
        messages: expect.arrayContaining([
          expect.objectContaining({
            text: 'Ran the recipe search tests: 14 passed, 0 failed.',
          }),
        ]),
      });

    setFixtureNow(FIXTURE_NOW + SCREENSHOT_FIXTURE_DEMO_REPLY_DELAY_MS - 1);
    await expect(getComputerSessionActivity(SCREENSHOT_FIXTURE_BRIDGE_ID, sessionId)).resolves
      .toMatchObject({ active: true });

    setFixtureNow(FIXTURE_NOW + SCREENSHOT_FIXTURE_DEMO_REPLY_DELAY_MS);
    await expect(getComputerSessionActivity(SCREENSHOT_FIXTURE_BRIDGE_ID, sessionId)).resolves
      .toMatchObject({ active: false, label: statusLabels.completed });
    const loaded = await loadComputerSession(SCREENSHOT_FIXTURE_BRIDGE_ID, sessionId);
    expect(loaded.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sequence: 3,
          source: 'devin',
          text: 'Ran the recipe search tests: 14 passed, 0 failed.',
          createdAt: FIXTURE_NOW + SCREENSHOT_FIXTURE_DEMO_REPLY_DELAY_MS,
        }),
      ]),
    );
    expect(
      (await loadComputerSession(SCREENSHOT_FIXTURE_BRIDGE_ID, sessionId)).messages.filter(
        ({ text }) => text === 'Ran the recipe search tests: 14 passed, 0 failed.',
      ),
    ).toHaveLength(1);
  });

  it('shows the denial reply after a permission is rejected', async () => {
    setFixtureMode(true);
    const sessionId = SCREENSHOT_FIXTURE_SESSION_IDS.permission;

    await respondToComputerSessionPermission(SCREENSHOT_FIXTURE_BRIDGE_ID, {
      sessionId,
      permissionId: `permission_${'B'.repeat(43)}`,
      decision: 'reject_once',
    });
    setFixtureNow(FIXTURE_NOW + SCREENSHOT_FIXTURE_DEMO_REPLY_DELAY_MS);

    const loaded = await loadComputerSession(SCREENSHOT_FIXTURE_BRIDGE_ID, sessionId);
    expect(loaded.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'devin',
          text: "OK, I won't run that. Want me to try something else?",
        }),
      ]),
    );
  });

  it('clears an answered elicitation and completes a reply after four seconds', async () => {
    setFixtureMode(true);
    const sessionId = SCREENSHOT_FIXTURE_SESSION_IDS.question;

    await respondToComputerSessionElicitation(SCREENSHOT_FIXTURE_BRIDGE_ID, {
      sessionId,
      interactionId: `interaction_${'A'.repeat(43)}`,
      action: 'accept',
      content: { route_behavior: 'keep_redirect' },
    });
    await expect(getComputerSessionElicitation(SCREENSHOT_FIXTURE_BRIDGE_ID, sessionId)).resolves
      .toMatchObject({ interaction: null });
    await expect(getComputerSessionActivity(SCREENSHOT_FIXTURE_BRIDGE_ID, sessionId)).resolves
      .toMatchObject({ active: true, kind: 'responding', label: 'Working on your task' });

    setFixtureNow(FIXTURE_NOW + SCREENSHOT_FIXTURE_DEMO_REPLY_DELAY_MS);
    const loaded = await loadComputerSession(SCREENSHOT_FIXTURE_BRIDGE_ID, sessionId);
    expect(loaded.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'devin',
          text: 'I kept the redirect and finished the login checks.',
        }),
      ]),
    );
  });

  it('marks a cancelled session interrupted without adding a simulated reply', async () => {
    setFixtureMode(true);
    const sessionId = SCREENSHOT_FIXTURE_SESSION_IDS.working;

    await cancelComputerSession(SCREENSHOT_FIXTURE_BRIDGE_ID, sessionId);

    await expect(getComputerSessionActivity(SCREENSHOT_FIXTURE_BRIDGE_ID, sessionId)).resolves
      .toMatchObject({
        active: false,
        label: statusLabels.interrupted,
        updatedAt: FIXTURE_NOW,
      });
    await expect(listComputerSessions(SCREENSHOT_FIXTURE_BRIDGE_ID)).resolves.toMatchObject({
      sessions: expect.arrayContaining([
        expect.objectContaining({
          id: sessionId,
          activity: expect.objectContaining({ active: false }),
        }),
      ]),
    });
    const loaded = await loadComputerSession(SCREENSHOT_FIXTURE_BRIDGE_ID, sessionId);
    expect(loaded.messages).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: 'Done. I updated the forecast card and the tests still pass.',
        }),
      ]),
    );
  });

  it('adds a prompt immediately and its assistant reply after four seconds', async () => {
    setFixtureMode(true);
    const sessionId = SCREENSHOT_FIXTURE_SESSION_IDS.working;
    const prompt = 'Update the forecast card for the demo.';

    await expect(
      promptComputerSession(
        SCREENSHOT_FIXTURE_BRIDGE_ID,
        sessionId,
        prompt,
        'claude-sonnet-4.5',
      ),
    ).resolves.toMatchObject({ sessionId });
    await expect(loadComputerSession(SCREENSHOT_FIXTURE_BRIDGE_ID, sessionId)).resolves
      .toMatchObject({
        messages: expect.arrayContaining([
          expect.objectContaining({
            source: 'user',
            text: prompt,
            createdAt: FIXTURE_NOW,
          }),
        ]),
      });
    await expect(getComputerSessionActivity(SCREENSHOT_FIXTURE_BRIDGE_ID, sessionId)).resolves
      .toMatchObject({ active: true, label: 'Working on your task' });

    setFixtureNow(FIXTURE_NOW + SCREENSHOT_FIXTURE_DEMO_REPLY_DELAY_MS);
    const loaded = await loadComputerSession(SCREENSHOT_FIXTURE_BRIDGE_ID, sessionId);
    expect(loaded.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'devin',
          text: 'Done. I updated the forecast card and the tests still pass.',
          createdAt: FIXTURE_NOW + SCREENSHOT_FIXTURE_DEMO_REPLY_DELAY_MS,
        }),
      ]),
    );
  });

  it('loads and lists a newly created fixture session with its prompt and reply', async () => {
    setFixtureMode(true);
    const sessionId = SCREENSHOT_FIXTURE_SESSION_IDS.created;
    const prompt = 'Add a 7-day forecast view to the home screen.';
    const createOptions = await getComputerCreateOptions(SCREENSHOT_FIXTURE_BRIDGE_ID);

    await expect(
      createComputerSession(SCREENSHOT_FIXTURE_BRIDGE_ID, {
        workspaceId: createOptions.workspaces[0]!.id,
        modelId: createOptions.defaultModelId,
        text: prompt,
      }),
    ).resolves.toEqual({ sessionId });

    const loaded = await loadComputerSession(SCREENSHOT_FIXTURE_BRIDGE_ID, sessionId);
    expect(loaded.messages).toEqual([
      expect.objectContaining({
        sequence: 1,
        source: 'user',
        text: prompt,
        createdAt: FIXTURE_NOW,
      }),
    ]);
    await expect(getComputerSessionActivity(SCREENSHOT_FIXTURE_BRIDGE_ID, sessionId)).resolves
      .toMatchObject({ active: true, label: 'Working on your task' });

    const page = computerSessionPageSchema.parse(
      await listComputerSessions(SCREENSHOT_FIXTURE_BRIDGE_ID),
    );
    expect(page.sessions[0]).toMatchObject({
      id: sessionId,
      origin: 'computer',
      workspaceName: 'weather-app',
      hasTitle: true,
      title: prompt,
      model: { id: createOptions.defaultModelId },
      activity: { active: true, kind: 'responding', updatedAt: FIXTURE_NOW },
    });

    setFixtureNow(FIXTURE_NOW + SCREENSHOT_FIXTURE_DEMO_REPLY_DELAY_MS);
    const completed = await loadComputerSession(SCREENSHOT_FIXTURE_BRIDGE_ID, sessionId);
    expect(completed.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'devin',
          text: 'Added a 7-day forecast view to the home screen. The forecast tests pass.',
          createdAt: FIXTURE_NOW + SCREENSHOT_FIXTURE_DEMO_REPLY_DELAY_MS,
        }),
      ]),
    );
    await expect(getComputerSessionActivity(SCREENSHOT_FIXTURE_BRIDGE_ID, sessionId)).resolves
      .toMatchObject({ active: false, label: statusLabels.completed });

    resetScreenshotFixtureDemoState();
    await expect(loadComputerSession(SCREENSHOT_FIXTURE_BRIDGE_ID, sessionId)).rejects.toThrow();
  });

  it('keeps a prompt message but drops its pending reply when cancelled', async () => {
    setFixtureMode(true);
    const sessionId = SCREENSHOT_FIXTURE_SESSION_IDS.working;
    const prompt = 'Make one more demo adjustment.';

    await promptComputerSession(SCREENSHOT_FIXTURE_BRIDGE_ID, sessionId, prompt);
    await cancelComputerSession(SCREENSHOT_FIXTURE_BRIDGE_ID, sessionId);
    setFixtureNow(FIXTURE_NOW + SCREENSHOT_FIXTURE_DEMO_REPLY_DELAY_MS);

    const loaded = await loadComputerSession(SCREENSHOT_FIXTURE_BRIDGE_ID, sessionId);
    expect(loaded.messages).toEqual(
      expect.arrayContaining([expect.objectContaining({ source: 'user', text: prompt })]),
    );
    expect(loaded.messages).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: 'Done. I updated the forecast card and the tests still pass.',
        }),
      ]),
    );
    await expect(getComputerSessionActivity(SCREENSHOT_FIXTURE_BRIDGE_ID, sessionId)).resolves
      .toMatchObject({ active: false, label: statusLabels.interrupted });
  });
});
