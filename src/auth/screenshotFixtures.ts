export const SCREENSHOT_FIXTURE_BRIDGE_ID = 'fixture_studio_mac_0001';

export const SCREENSHOT_FIXTURE_SESSION_IDS = {
  working: `local_${'A'.repeat(43)}`,
  question: `local_${'B'.repeat(43)}`,
  permission: `local_${'C'.repeat(43)}`,
  readme: `local_${'D'.repeat(43)}`,
  reminders: `local_${'E'.repeat(43)}`,
  olderOne: `local_${'F'.repeat(43)}`,
  olderTwo: `local_${'G'.repeat(43)}`,
  olderThree: `local_${'H'.repeat(43)}`,
  created: `local_${'I'.repeat(43)}`,
} as const;

const SCREENSHOT_FIXTURE_WORKSPACE_IDS = {
  weather: `workspace_${'A'.repeat(43)}`,
  recipes: `workspace_${'B'.repeat(43)}`,
  portfolio: `workspace_${'C'.repeat(43)}`,
  habits: `workspace_${'D'.repeat(43)}`,
} as const;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const SCREENSHOT_FIXTURE_DEMO_REPLY_DELAY_MS = 4_000;

type ScreenshotFixturePermissionDecision = 'allow_once' | 'allow_session' | 'reject_once';
type ScreenshotFixtureElicitationAction = 'accept' | 'decline' | 'cancel';

type ScreenshotFixtureDemoAction = {
  startedAt: number;
  userMessage?: string;
  assistantReply: string;
  cancelledAt?: number;
};

type ScreenshotFixtureCreatedSession = {
  workspaceId: string;
  modelId?: string | null;
  text: string;
  createdAt: number;
};

export type ScreenshotFixtureDemoActivity = {
  active: boolean;
  kind: 'responding';
  state: 'working' | 'completed' | 'interrupted';
  updatedAt: number;
};

export type ScreenshotFixtureDemoMessage = {
  source: 'user' | 'devin';
  text: string;
  createdAt: number;
};

const permissionResponses = new Map<
  string,
  { respondedAt: number; decision: ScreenshotFixturePermissionDecision }
>();
const elicitationResponses = new Map<
  string,
  { respondedAt: number; action: ScreenshotFixtureElicitationAction }
>();
const demoActions = new Map<string, ScreenshotFixtureDemoAction[]>();
const cancelledAtBySession = new Map<string, number>();
let createdSession: ScreenshotFixtureCreatedSession | null = null;

export function resetScreenshotFixtureDemoState(): void {
  permissionResponses.clear();
  elicitationResponses.clear();
  demoActions.clear();
  cancelledAtBySession.clear();
  createdSession = null;
}

function appendDemoAction(sessionId: string, action: ScreenshotFixtureDemoAction): void {
  const actions = demoActions.get(sessionId) ?? [];
  actions.push(action);
  demoActions.set(sessionId, actions);
  cancelledAtBySession.delete(sessionId);
}

export function recordScreenshotFixtureCreatedSession(
  input: ScreenshotFixtureCreatedSession,
): void {
  createdSession = input;
  appendDemoAction(SCREENSHOT_FIXTURE_SESSION_IDS.created, {
    startedAt: input.createdAt,
    userMessage: input.text,
    assistantReply: 'Added a 7-day forecast view to the home screen. The forecast tests pass.',
  });
}

export function getScreenshotFixtureCreatedSession(): ScreenshotFixtureCreatedSession | null {
  return createdSession;
}

export function recordScreenshotFixturePermissionResponse(
  sessionId: string,
  decision: ScreenshotFixturePermissionDecision,
  respondedAt: number,
): void {
  permissionResponses.set(sessionId, { respondedAt, decision });
  appendDemoAction(sessionId, {
    startedAt: respondedAt,
    assistantReply:
      decision === 'reject_once'
        ? "OK, I won't run that. Want me to try something else?"
        : 'Ran the recipe search tests: 14 passed, 0 failed.',
  });
}

export function recordScreenshotFixtureElicitationResponse(
  sessionId: string,
  action: ScreenshotFixtureElicitationAction,
  respondedAt: number,
): void {
  elicitationResponses.set(sessionId, { respondedAt, action });
  appendDemoAction(sessionId, {
    startedAt: respondedAt,
    assistantReply:
      action === 'accept'
        ? 'I kept the redirect and finished the login checks.'
        : 'Okay, I left the login route unchanged.',
  });
}

export function recordScreenshotFixturePrompt(
  sessionId: string,
  text: string,
  startedAt: number,
): void {
  appendDemoAction(sessionId, {
    startedAt,
    userMessage: text,
    assistantReply: 'Done. I updated the forecast card and the tests still pass.',
  });
}

export function recordScreenshotFixtureCancellation(
  sessionId: string,
  cancelledAt: number,
): void {
  cancelledAtBySession.set(sessionId, cancelledAt);
  for (const action of demoActions.get(sessionId) ?? []) {
    if (
      action.cancelledAt === undefined &&
      cancelledAt < action.startedAt + SCREENSHOT_FIXTURE_DEMO_REPLY_DELAY_MS
    ) {
      action.cancelledAt = cancelledAt;
    }
  }
}

export function hasScreenshotFixturePermissionResponse(sessionId: string): boolean {
  return permissionResponses.has(sessionId);
}

export function hasScreenshotFixtureElicitationResponse(sessionId: string): boolean {
  return elicitationResponses.has(sessionId);
}

export function isScreenshotFixtureSessionCancelled(sessionId: string): boolean {
  return cancelledAtBySession.has(sessionId);
}

export function getScreenshotFixtureDemoActivity(
  sessionId: string,
  now = Date.now(),
): ScreenshotFixtureDemoActivity | null {
  const cancelledAt = cancelledAtBySession.get(sessionId);
  if (cancelledAt !== undefined) {
    return { active: false, kind: 'responding', state: 'interrupted', updatedAt: cancelledAt };
  }

  const actions = demoActions.get(sessionId);
  const action = actions?.[actions.length - 1];
  if (!action) return null;

  if (action.cancelledAt !== undefined) {
    return {
      active: false,
      kind: 'responding',
      state: 'interrupted',
      updatedAt: action.cancelledAt,
    };
  }

  const completed = now >= action.startedAt + SCREENSHOT_FIXTURE_DEMO_REPLY_DELAY_MS;
  return {
    active: !completed,
    kind: 'responding',
    state: completed ? 'completed' : 'working',
    updatedAt: action.startedAt,
  };
}

export function getScreenshotFixtureDemoMessages(
  sessionId: string,
  now = Date.now(),
): ScreenshotFixtureDemoMessage[] {
  const messages: ScreenshotFixtureDemoMessage[] = [];
  for (const action of demoActions.get(sessionId) ?? []) {
    if (action.userMessage !== undefined) {
      messages.push({
        source: 'user',
        text: action.userMessage,
        createdAt: action.startedAt,
      });
    }
    if (
      action.cancelledAt === undefined &&
      now >= action.startedAt + SCREENSHOT_FIXTURE_DEMO_REPLY_DELAY_MS
    ) {
      messages.push({
        source: 'devin',
        text: action.assistantReply,
        createdAt: action.startedAt + SCREENSHOT_FIXTURE_DEMO_REPLY_DELAY_MS,
      });
    }
  }
  return messages;
}

export function isScreenshotFixtureMode(): boolean {
  return __DEV__ && process.env.EXPO_PUBLIC_SCREENSHOT_FIXTURES === '1';
}

export function createScreenshotFixtureData(now = Date.now()) {
  const modelCatalog = [
    {
      id: 'claude-sonnet-4.5',
      name: 'Claude Sonnet 4.5',
      description: 'Balanced capability for everyday coding work.',
      costTier: 'medium',
      recommended: true,
      recent: false,
    },
    {
      id: 'gpt-5',
      name: 'GPT-5',
      description: 'A versatile model for complex coding tasks.',
      costTier: 'high',
      recommended: false,
      recent: true,
    },
    {
      id: 'claude-opus-4.1',
      name: 'Claude Opus 4.1',
      description: 'Careful reasoning for demanding changes.',
      costTier: 'high',
      recommended: false,
      recent: false,
    },
    {
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
      description: 'A capable model for larger codebases.',
      costTier: 'high',
      recommended: false,
      recent: false,
    },
    {
      id: 'grok-4',
      name: 'Grok 4',
      description: 'A general-purpose coding model.',
      costTier: 'high',
      recommended: false,
      recent: false,
    },
    {
      id: 'gpt-5-mini',
      name: 'GPT-5 mini',
      description: 'A quick option for smaller changes.',
      costTier: 'low',
      recommended: false,
      recent: false,
    },
  ] as const;
  const workspaces = [
    { id: SCREENSHOT_FIXTURE_WORKSPACE_IDS.weather, name: 'weather-app' },
    { id: SCREENSHOT_FIXTURE_WORKSPACE_IDS.recipes, name: 'recipe-api' },
    { id: SCREENSHOT_FIXTURE_WORKSPACE_IDS.portfolio, name: 'portfolio-site' },
    { id: SCREENSHOT_FIXTURE_WORKSPACE_IDS.habits, name: 'habit-tracker' },
  ] as const;

  const activityEntries = [
    {
      id: 'forecast-thought',
      afterSequence: 1,
      kind: 'thought',
      status: 'completed',
      title: 'Check the city view and forecast data',
      detail: {
        type: 'text',
        text: 'I’ll use the existing forecast response and keep the chart consistent with the city page.',
      },
      truncated: false,
      startedAt: now - 5 * MINUTE,
      endedAt: now - 4.8 * MINUTE,
    },
    {
      id: 'forecast-read',
      afterSequence: 1,
      kind: 'tool',
      toolKind: 'read',
      status: 'completed',
      title: 'Read the city view and forecast client',
      paths: ['src/app/city/[cityId].tsx', 'src/api/forecast.ts'],
      detail: {
        type: 'text',
        text: 'The existing API client already returns the hourly forecast points.',
      },
      truncated: false,
      startedAt: now - 4.7 * MINUTE,
      endedAt: now - 4.4 * MINUTE,
    },
    {
      id: 'forecast-edit',
      afterSequence: 2,
      kind: 'tool',
      toolKind: 'edit',
      status: 'completed',
      title: 'Add the hourly chart component',
      paths: ['src/components/HourlyChart.tsx'],
      detail: {
        type: 'diff',
        path: 'src/components/HourlyChart.tsx',
        oldText: 'export function HourlyChart() {\n  return null;\n}',
        newText:
          'export function HourlyChart({ hours }: Props) {\n  return <HourlyForecast data={hours} />;\n}',
      },
      truncated: false,
      startedAt: now - 4.2 * MINUTE,
      endedAt: now - 2.7 * MINUTE,
    },
    {
      id: 'forecast-test',
      afterSequence: 3,
      kind: 'tool',
      toolKind: 'execute',
      status: 'completed',
      title: 'Run npm test',
      detail: {
        type: 'text',
        text: 'Test Suites: 1 passed, 1 total\nTests:       8 passed, 8 total',
      },
      truncated: false,
      startedAt: now - 2.5 * MINUTE,
      endedAt: now - 2.2 * MINUTE,
    },
    {
      id: 'forecast-final',
      afterSequence: 4,
      kind: 'thought',
      status: 'completed',
      title: 'Hourly forecast chart is ready',
      detail: {
        type: 'text',
        text: 'The chart uses the existing API client, and the tests pass.',
      },
      truncated: false,
      startedAt: now - 2 * MINUTE,
      endedAt: now - 1.9 * MINUTE,
    },
  ] as const;

  const sessions = [
    {
      id: SCREENSHOT_FIXTURE_SESSION_IDS.working,
      origin: 'computer',
      workspaceName: 'weather-app',
      hasTitle: true,
      title: 'Add hourly forecast chart',
      updatedAt: new Date(now - 2 * MINUTE).toISOString(),
      model: modelCatalog[0],
      activity: { active: true, kind: 'editing', updatedAt: now - 20_000 },
    },
    {
      id: SCREENSHOT_FIXTURE_SESSION_IDS.question,
      origin: 'computer',
      workspaceName: 'recipe-api',
      hasTitle: true,
      title: 'Fix login redirect loop',
      updatedAt: new Date(now - 5 * MINUTE).toISOString(),
      model: modelCatalog[0],
      activity: {
        active: true,
        kind: 'responding',
        updatedAt: now - 30_000,
        awaiting: 'answer',
      },
    },
    {
      id: SCREENSHOT_FIXTURE_SESSION_IDS.permission,
      origin: 'computer',
      workspaceName: 'recipe-api',
      hasTitle: true,
      title: 'Write tests for recipe search',
      updatedAt: new Date(now - 10 * MINUTE).toISOString(),
      model: modelCatalog[1],
      activity: {
        active: true,
        kind: 'executing',
        updatedAt: now - 45_000,
        awaiting: 'approval',
      },
    },
    {
      id: SCREENSHOT_FIXTURE_SESSION_IDS.readme,
      origin: 'computer',
      workspaceName: 'portfolio-site',
      hasTitle: true,
      title: 'Update project README',
      updatedAt: new Date(now - HOUR).toISOString(),
      model: modelCatalog[0],
      activity: { active: false, updatedAt: now - HOUR },
    },
    {
      id: SCREENSHOT_FIXTURE_SESSION_IDS.reminders,
      origin: 'computer',
      workspaceName: 'habit-tracker',
      hasTitle: true,
      title: 'Add streak reminders',
      updatedAt: new Date(now - DAY).toISOString(),
      model: modelCatalog[1],
      activity: { active: false, updatedAt: now - DAY },
    },
    {
      id: SCREENSHOT_FIXTURE_SESSION_IDS.olderOne,
      origin: 'computer',
      workspaceName: 'portfolio-site',
      hasTitle: true,
      title: 'Tighten mobile header spacing',
      updatedAt: new Date(now - 3 * DAY).toISOString(),
      model: modelCatalog[0],
      activity: { active: false, updatedAt: now - 3 * DAY },
    },
    {
      id: SCREENSHOT_FIXTURE_SESSION_IDS.olderTwo,
      origin: 'computer',
      workspaceName: 'weather-app',
      hasTitle: true,
      title: 'Add city search suggestions',
      updatedAt: new Date(now - 5 * DAY).toISOString(),
      model: modelCatalog[2],
      activity: { active: false, updatedAt: now - 5 * DAY },
    },
    {
      id: SCREENSHOT_FIXTURE_SESSION_IDS.olderThree,
      origin: 'computer',
      workspaceName: 'recipe-api',
      hasTitle: true,
      title: 'Improve ingredient matching',
      updatedAt: new Date(now - 8 * DAY).toISOString(),
      model: modelCatalog[1],
      activity: { active: false, updatedAt: now - 8 * DAY },
    },
  ] as const;

  const sessionActivities: Record<string, unknown> = {
    [SCREENSHOT_FIXTURE_SESSION_IDS.working]: {
      active: true,
      kind: 'editing',
      label: 'Editing files',
      updatedAt: now - 20_000,
      turn: {
        startedAt: now - 5 * MINUTE,
        reply: 'The chart now uses the existing forecast API client. Tests are passing.',
        activity: activityEntries,
      },
    },
    [SCREENSHOT_FIXTURE_SESSION_IDS.question]: {
      active: true,
      kind: 'responding',
      label: 'Waiting for your answer',
      updatedAt: now - 30_000,
      awaiting: 'answer',
    },
    [SCREENSHOT_FIXTURE_SESSION_IDS.permission]: {
      active: true,
      kind: 'executing',
      label: 'Waiting for your approval',
      updatedAt: now - 45_000,
      awaiting: 'approval',
    },
    [SCREENSHOT_FIXTURE_SESSION_IDS.readme]: {
      active: false,
      kind: 'responding',
      label: 'Completed',
      updatedAt: now - HOUR,
    },
    [SCREENSHOT_FIXTURE_SESSION_IDS.reminders]: {
      active: false,
      kind: 'responding',
      label: 'Completed',
      updatedAt: now - DAY,
    },
  };

  const loadedSessions: Record<string, unknown> = {
    [SCREENSHOT_FIXTURE_SESSION_IDS.working]: {
      session: {
        id: SCREENSHOT_FIXTURE_SESSION_IDS.working,
        origin: 'computer',
        workspaceName: 'weather-app',
        model: modelCatalog[0],
      },
      messages: [
        {
          sequence: 1,
          source: 'user',
          text: 'Add an hourly forecast chart to the city page, use the existing API client.',
          createdAt: now - 5 * MINUTE,
        },
        {
          sequence: 2,
          source: 'devin',
          text: 'I’ll check the city view and the existing forecast API first.',
          createdAt: now - 4.8 * MINUTE,
        },
        {
          sequence: 3,
          source: 'devin',
          text: 'The forecast client already returns hourly points. I’m adding a compact chart to the city page.',
          createdAt: now - 4 * MINUTE,
        },
        {
          sequence: 4,
          source: 'devin',
          text: 'The chart is wired to the existing API client, and the tests pass.',
          createdAt: now - 2 * MINUTE,
        },
      ],
      activity: activityEntries,
      truncated: false,
    },
    [SCREENSHOT_FIXTURE_SESSION_IDS.question]: {
      session: {
        id: SCREENSHOT_FIXTURE_SESSION_IDS.question,
        origin: 'computer',
        workspaceName: 'recipe-api',
        model: modelCatalog[0],
      },
      messages: [
        {
          sequence: 1,
          source: 'user',
          text: 'Fix the login redirect loop for the recipe API.',
          createdAt: now - 8 * MINUTE,
        },
        {
          sequence: 2,
          source: 'devin',
          text: 'I found an older callback route still referenced in the sign-in flow. Which behavior should it use?',
          createdAt: now - 5 * MINUTE,
        },
      ],
      truncated: false,
    },
    [SCREENSHOT_FIXTURE_SESSION_IDS.permission]: {
      session: {
        id: SCREENSHOT_FIXTURE_SESSION_IDS.permission,
        origin: 'computer',
        workspaceName: 'recipe-api',
        model: modelCatalog[1],
      },
      messages: [
        {
          sequence: 1,
          source: 'user',
          text: 'Write tests for recipe search.',
          createdAt: now - 12 * MINUTE,
        },
        {
          sequence: 2,
          source: 'devin',
          text: 'The search cases are ready. May I run the focused test command?',
          createdAt: now - 10 * MINUTE,
        },
      ],
      truncated: false,
    },
    [SCREENSHOT_FIXTURE_SESSION_IDS.readme]: {
      session: {
        id: SCREENSHOT_FIXTURE_SESSION_IDS.readme,
        origin: 'computer',
        workspaceName: 'portfolio-site',
        model: modelCatalog[0],
      },
      messages: [
        {
          sequence: 1,
          source: 'user',
          text: 'Update the project README with the latest setup steps.',
          createdAt: now - 2 * HOUR,
        },
        {
          sequence: 2,
          source: 'devin',
          text: 'The README now matches the current setup flow.',
          createdAt: now - HOUR,
        },
      ],
      truncated: false,
    },
  };

  return {
    pairedComputers: [
      {
        version: 3,
        bridgeId: SCREENSHOT_FIXTURE_BRIDGE_ID,
        computerName: 'Studio Mac',
        endpoint: 'http://100.100.1.20:3939/',
        transportSecurity: 'tailscale_wireguard',
        tlsCertificateFingerprint: 'T'.repeat(43),
        bridgePublicKeySpki: 'B'.repeat(59),
        bridgeKeyFingerprint: 'F'.repeat(43),
        deviceId: 'fixture_device_studio_mac_01',
        deviceKeyId: '89b7c2d4-42a8-4ea4-a5d9-e8d5c0f2e941',
        devicePublicKeySpki: 'D'.repeat(59),
        permissions: [
          'bridge:health',
          'session:metadata:read',
          'session:content:read',
          'session:prompt:send',
          'session:create',
        ],
        pairedAt: now - 30 * DAY,
      },
    ],
    health: {
      protocolVersion: 2,
      status: 'ready',
      capabilities: { sessionList: true, sessionLoad: true, sessionPrompt: true },
    },
    features: {
      sessionElicitation: true,
      activityTimeline: true,
      permissionPrompts: true,
      sessionCancel: true,
      autoApprove: true,
    },
    presentation: {
      messageTimestamps: true,
      grants: { viewSessions: true, sendPrompts: true, startSessions: true },
    },
    version: { version: '0.1.17' },
    platform: { platform: 'macos' },
    createOptions: {
      workspaces,
      models: modelCatalog,
      defaultModelId: 'claude-sonnet-4.5',
      catalogSource: 'live',
    },
    sessionPage: { sessions },
    loadedSessions,
    activityEntries,
    sessionActivities,
    elicitation: {
      interaction: {
        id: `interaction_${'A'.repeat(43)}`,
        title: 'Choose what should happen',
        message:
          'The old /auth/callback route is still linked from emails. Keep it as a redirect to /login, or remove it?',
        fields: [
          {
            key: 'route_behavior',
            type: 'single_select',
            title: 'Route behavior',
            required: true,
            options: [
              { value: 'keep_redirect', label: 'Keep as redirect' },
              { value: 'remove_route', label: 'Remove it' },
            ],
          },
        ],
        createdAt: now - 5 * MINUTE,
      },
    },
    permission: {
      permission: {
        id: `permission_${'B'.repeat(43)}`,
        title: 'Run a test command',
        toolKind: 'execute',
        command: 'npm test -- search',
        paths: ['package.json'],
        decisions: ['allow_once', 'allow_session', 'reject_once'],
        createdAt: now - MINUTE,
        expiresAt: now + 10 * MINUTE,
      },
    },
    mutationResponses: {
      accepted: { accepted: true },
      prompt: { accepted: true, sessionId: SCREENSHOT_FIXTURE_SESSION_IDS.working },
      created: { accepted: true, sessionId: SCREENSHOT_FIXTURE_SESSION_IDS.created },
    },
  };
}
