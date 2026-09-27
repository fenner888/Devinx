import React from 'react';
import { Keyboard } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import type { QueryClient } from '@tanstack/react-query';

const mockMutate = jest.fn();
const mockRefetch = jest.fn(async () => {});
const mockCompanionProps = jest.fn();
const mockAnswerMutate = jest.fn();
const mockRefreshComputerCreateOptions = jest.fn(async () => undefined);
const mockReact = React;
let mockQueryClient: QueryClient;
let mockSessionWorkspaceName: string | undefined = 'DevinX';
let mockPromptError: Error | null = null;
let mockSessionElicitationSupported = true;
let mockSessionActivity:
  | {
      active: boolean;
      kind: string;
      label: string;
      updatedAt: number;
      turn?: {
        startedAt: number;
        reply: string;
        activity: Array<Record<string, unknown>>;
      };
    }
  | undefined;
let mockActivityTimeline: boolean | undefined;
let mockLoadedActivity: Array<Record<string, unknown>> | undefined;
let mockInteraction: {
  id: string;
  message: string;
  fields: Array<{
    key: string;
    type: 'single_select';
    title: string;
    required: boolean;
    options: Array<{ value: string; label: string }>;
  }>;
  createdAt: number;
} | null = null;

jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: () => mockQueryClient,
}));

jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) =>
    mockReact.useEffect(callback, [callback]),
  useLocalSearchParams: () => ({
    bridgeId: 'bridge_1234567890',
    id: `local_${'L'.repeat(43)}`,
  }),
  useRouter: () => ({ back: jest.fn() }),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
}));

jest.mock('../../src/api/bridge/queries', () => ({
  computerSessionsQueryKey: (computers: Array<{ bridgeId: string }>) => [
    'computerSessions',
    ...computers.map((computer) => computer.bridgeId).sort(),
  ],
  useComputerBridgeFeatures: () => ({
    data: {
      sessionElicitation: mockSessionElicitationSupported,
      ...(mockActivityTimeline === undefined ? {} : { activityTimeline: mockActivityTimeline }),
    },
  }),
  useComputerSessionAccess: () => ({
    data: {
      capabilities: {
        sessionList: true,
        sessionLoad: true,
        sessionPrompt: true,
      },
    },
  }),
  useComputerSessionDetail: () => ({
    data: {
      session: {
        id: `local_${'L'.repeat(43)}`,
        origin: 'computer',
        workspaceName: mockSessionWorkspaceName,
        model: { id: 'swe-1.7-high', name: 'SWE-1.7 High' },
      },
      messages: [
        { sequence: 1, source: 'user', text: 'Do the tasks.' },
        { sequence: 2, source: 'devin', text: 'Ready.' },
      ],
      ...(mockLoadedActivity ? { activity: mockLoadedActivity } : {}),
      truncated: false,
    },
    isLoading: false,
    isRefetching: false,
    error: null,
    refetch: mockRefetch,
  }),
  useComputerSessionActivity: () => ({ data: mockSessionActivity }),
  useComputerSessionElicitation: () => ({ data: { interaction: mockInteraction } }),
  useRespondComputerSessionElicitation: () => ({
    mutate: mockAnswerMutate,
    isPending: false,
    error: null,
  }),
  usePromptComputerSession: () => ({
    mutate: mockMutate,
    isPending: false,
    error: mockPromptError,
  }),
  useComputerCreateOptions: () => ({
    data: {
      workspaces: [{ id: `workspace_${'W'.repeat(43)}`, name: 'DevinX' }],
      models: [
        {
          id: 'swe-1.7-high',
          name: 'SWE-1.7 High',
          recent: true,
          recommended: true,
        },
        {
          id: 'swe-1.7-medium',
          name: 'SWE-1.7 Medium',
          recent: false,
          recommended: false,
        },
      ],
      defaultModelId: 'swe-1.7-high',
      catalogSource: 'live',
    },
    isLoading: false,
    error: null,
    refreshCatalog: mockRefreshComputerCreateOptions,
    isRefreshingCatalog: false,
    refreshCatalogError: null,
  }),
}));

jest.mock('../../src/auth/ConnectionContext', () => ({
  useConnections: () => ({
    computers: [
      {
        bridgeId: 'bridge_1234567890',
        computerName: 'My Mac',
        transportKind: 'tailscale_vpn',
        permissions: ['bridge:health', 'session:metadata:read'],
      },
    ],
  }),
}));

jest.mock('../../src/components/pets', () => ({
  DevinCompanion: (props: unknown) => {
    mockCompanionProps(props);
    return null;
  },
}));

jest.mock('../../src/components/DevinMarkdown', () => ({
  DevinMarkdown: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../../src/theme/index', () => ({
  useTheme: () => ({
    tokens: {
      textMid: { hex: '#777777' },
      textLow: { hex: '#666666' },
      textHi: { hex: '#eeeeee' },
      textHiStrong: { hex: '#ffffff' },
      brandText: { hex: '#0088ff' },
      brand: { hex: '#0088ff' },
      running: { hex: '#0088ff' },
      finished: { hex: '#00dd88' },
      blocked: { hex: '#ee8833' },
      merged: { hex: '#9966dd' },
      textAlwaysWhite: { hex: '#ffffff' },
      tintPrimary: { hex: '#FFFFFF14' },
      composerSurface: { hex: '#1F1F1F' },
    },
  }),
}));

import ComputerSessionDetailScreen, {
  devinReplySignature,
  hasSettledNewDevinReply,
  promptErrorMessage,
} from '../../src/app/(main)/computer-session/[bridgeId]/[id]';
import { ComputerBridgeError } from '../../src/auth/computerBridge';

describe('Computer session detail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { QueryClient } = jest.requireActual('@tanstack/react-query') as {
      QueryClient: new () => QueryClient;
    };
    mockQueryClient = new QueryClient();
    mockSessionWorkspaceName = 'DevinX';
    mockPromptError = null;
    mockSessionElicitationSupported = true;
    mockSessionActivity = undefined;
    mockInteraction = null;
    mockActivityTimeline = undefined;
    mockLoadedActivity = undefined;
  });

  it('uses the cached list title with the workspace as a subtitle', () => {
    mockSessionWorkspaceName = undefined;
    mockQueryClient.setQueryData(['computerSessions', 'bridge_1234567890'], {
      sessions: [
        {
          id: `local_${'L'.repeat(43)}`,
          bridgeId: 'bridge_1234567890',
          title: 'Review the release branch',
          workspaceName: 'Workspace from list',
        },
      ],
    });

    const screen = render(<ComputerSessionDetailScreen />);

    expect(screen.getByText('Review the release branch')).toBeTruthy();
    expect(screen.getByText('Workspace from list')).toBeTruthy();
  });

  it('uses the current computer board instead of an older cached board', () => {
    mockSessionWorkspaceName = undefined;
    mockQueryClient.setQueryData(['computerSessions', 'bridge_old'], {
      sessions: [
        {
          id: `local_${'L'.repeat(43)}`,
          bridgeId: 'bridge_1234567890',
          title: 'Draft',
          workspaceName: 'Old workspace',
        },
      ],
    });
    mockQueryClient.setQueryData(['computerSessions', 'bridge_1234567890'], {
      sessions: [
        {
          id: `local_${'L'.repeat(43)}`,
          bridgeId: 'bridge_1234567890',
          title: 'Final',
          workspaceName: 'Current workspace',
        },
      ],
    });

    const screen = render(<ComputerSessionDetailScreen />);

    expect(screen.getByText('Final')).toBeTruthy();
    expect(screen.queryByText('Draft')).toBeNull();
  });

  it('falls back to the loaded workspace name without adding a subtitle when the list is uncached', () => {
    mockSessionWorkspaceName = 'Loaded workspace';
    const screen = render(<ComputerSessionDetailScreen />);

    expect(screen.getAllByText('Loaded workspace').length).toBeGreaterThan(0);
    expect(screen.queryByText('Workspace from list')).toBeNull();
  });

  it('renders and submits a structured Devin question without using the chat composer', () => {
    mockSessionActivity = {
      active: true,
      kind: 'thinking',
      label: 'Waiting for your answer',
      updatedAt: Date.now(),
    };
    mockInteraction = {
      id: `interaction_${'Q'.repeat(43)}`,
      message: 'Which implementation should I use?',
      fields: [
        {
          key: 'approach',
          type: 'single_select',
          title: 'Approach',
          required: true,
          options: [
            { value: 'safe', label: 'Preserve the API' },
            { value: 'migrate', label: 'Migrate the API' },
          ],
        },
      ],
      createdAt: 1_800_000_000_000,
    };
    const screen = render(<ComputerSessionDetailScreen />);

    expect(screen.getByText('Devin needs your input')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Approach: Preserve the API'));
    fireEvent.press(screen.getByLabelText('Send answer to Devin'));

    expect(mockAnswerMutate).toHaveBeenCalledWith(
      {
        interactionId: `interaction_${'Q'.repeat(43)}`,
        action: 'accept',
        content: { approach: 'safe' },
      },
      expect.any(Object),
    );
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('does not call the question endpoint when the installed Connector lacks the feature', () => {
    mockSessionElicitationSupported = false;
    mockSessionActivity = {
      active: true,
      kind: 'thinking',
      label: 'Waiting for your answer',
      updatedAt: Date.now(),
    };
    mockInteraction = {
      id: `interaction_${'Q'.repeat(43)}`,
      message: 'Which implementation should I use?',
      fields: [
        {
          key: 'approach',
          type: 'single_select',
          title: 'Approach',
          required: true,
          options: [{ value: 'safe', label: 'Preserve the API' }],
        },
      ],
      createdAt: 1_800_000_000_000,
    };

    const screen = render(<ComputerSessionDetailScreen />);

    expect(screen.queryByText('Devin needs your input')).toBeNull();
    expect(
      screen.getByText(
        'Update DevinX Connector on this local device to answer structured Devin questions from your iPhone.',
      ),
    ).toBeTruthy();
  });

  it('uses authoritative Mac capabilities to show and submit the steering composer', () => {
    const screen = render(<ComputerSessionDetailScreen />);

    expect(screen.getByText('Steering enabled')).toBeTruthy();
    const companionDock = screen.getByTestId('computer-session-companion-dock');
    expect(companionDock.props.className).toContain('absolute');
    expect(companionDock.props.className).not.toContain('bg-canvas');
    expect(companionDock.props.pointerEvents).toBe('none');
    expect(
      screen.getByTestId('computer-session-history').props.contentContainerStyle.paddingBottom,
    ).toBe(288);
    const composerShell = screen.getByTestId('computer-session-composer-shell');
    expect(composerShell.props.className).toContain('absolute');
    expect(composerShell.props.className).not.toContain('bg-canvas');
    let composerAncestor = composerShell.parent;
    while (
      composerAncestor &&
      composerAncestor.props.testID !== 'computer-session-keyboard-viewport'
    ) {
      composerAncestor = composerAncestor.parent;
    }
    expect(composerAncestor?.props.testID).toBe('computer-session-keyboard-viewport');
    const composer = screen.getByTestId('computer-session-composer');
    expect(composer.props.className).toContain('rounded-card');
    expect(composer.props.className).not.toContain('bg-surface1');
    expect(composer.props.style.backgroundColor).toBe('#1F1F1F');
    expect(screen.getByLabelText('Local session message').props.textAlignVertical).toBe('top');
    expect(screen.getByLabelText('Local session message').props.className).toContain(
      'min-h-[44px]',
    );
    expect(screen.getByTestId('computer-session-history').props.keyboardDismissMode).toBe(
      'interactive',
    );
    expect(screen.getByTestId('computer-session-history').props.keyboardShouldPersistTaps).toBe(
      'handled',
    );
    expect(screen.getByLabelText('Model: SWE-1.7')).toBeTruthy();
    expect(screen.getByTestId('model-family-mark-swe')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Reasoning and speed: High'));
    fireEvent.press(screen.getByLabelText('Use Medium for SWE-1.7'));
    expect(screen.getByLabelText('Reasoning and speed: Medium')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Local session message'), 'Continue the task.');
    fireEvent.press(screen.getByLabelText('Send local session message'));

    expect(screen.getByLabelText('Workspace: DevinX')).toBeTruthy();
    expect(mockMutate).toHaveBeenCalledWith(
      { text: 'Continue the task.', modelId: 'swe-1.7-medium' },
      expect.any(Object),
    );
    expect(screen.getByText('Continue the task.')).toBeTruthy();
    expect(screen.queryByTestId('session-live-activity')).toBeNull();
    expect(mockCompanionProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        message: 'Devin working',
        state: 'thinking',
        travel: true,
        travelTrack: true,
      }),
    );
  });

  it('lets the user explicitly hide the keyboard without clearing the draft', () => {
    const dismissKeyboard = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
    const screen = render(<ComputerSessionDetailScreen />);
    const input = screen.getByLabelText('Local session message');

    fireEvent.changeText(input, 'Keep this local draft');
    fireEvent(input, 'focus');
    fireEvent.press(screen.getByLabelText('Hide keyboard'));

    expect(dismissKeyboard).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Local session message').props.value).toBe(
      'Keep this local draft',
    );
  });

  it('waits for a changed Devin reply to remain stable before ending refresh', () => {
    const baseline = devinReplySignature({
      session: { id: `local_${'L'.repeat(43)}`, origin: 'computer', workspaceName: 'DevinX' },
      messages: [
        { sequence: 1, source: 'user', text: 'First' },
        { sequence: 2, source: 'devin', text: 'Original' },
      ],
      truncated: false,
    });
    const changed = JSON.stringify(['Original', 'New reply']);

    expect(hasSettledNewDevinReply(baseline, null, baseline)).toBe(false);
    expect(hasSettledNewDevinReply(baseline, null, changed)).toBe(false);
    expect(hasSettledNewDevinReply(baseline, changed, changed)).toBe(true);
  });

  it('explains Connector conflicts without falsely claiming steering is disabled', () => {
    expect(promptErrorMessage(new ComputerBridgeError('Busy', 'busy'))).toBe(
      'Devin is finishing the previous turn. Try again in a moment.',
    );
    expect(promptErrorMessage(new ComputerBridgeError('Revoked', 'authorization_failed'))).toBe(
      'This iPhone is no longer authorized. Re-pair this local device in Settings.',
    );
  });

  it('renders no activity groups for a Connector without activityTimeline', () => {
    mockActivityTimeline = undefined;
    mockLoadedActivity = [
      {
        id: 'tool_1',
        afterSequence: 1,
        kind: 'tool',
        toolKind: 'read',
        status: 'completed',
        title: 'Read file',
        truncated: false,
      },
    ];
    mockSessionActivity = {
      active: true,
      kind: 'editing',
      label: 'Editing files',
      updatedAt: Date.now(),
    };
    const screen = render(<ComputerSessionDetailScreen />);

    expect(screen.queryByTestId(/^activity-group-/)).toBeNull();
    expect(screen.queryByTestId('computer-session-activity-indicator')).toBeNull();
  });

  it('renders activity groups between messages when the Connector supports them', () => {
    mockActivityTimeline = true;
    mockLoadedActivity = [
      {
        id: 'thought_1',
        afterSequence: 1,
        kind: 'thought',
        status: 'completed',
        title: 'Thought',
        truncated: false,
      },
      {
        id: 'tool_1',
        afterSequence: 2,
        kind: 'tool',
        toolKind: 'edit',
        status: 'completed',
        title: 'Edit file',
        truncated: false,
      },
    ];
    const screen = render(<ComputerSessionDetailScreen />);

    expect(screen.getByTestId('activity-group-g1')).toBeTruthy();
    expect(screen.getByTestId('activity-group-g2')).toBeTruthy();
  });

  it('shows the running indicator only when the session activity is active', () => {
    mockActivityTimeline = true;
    mockSessionActivity = {
      active: true,
      kind: 'executing',
      label: 'Running a command',
      updatedAt: Date.now(),
    };
    const activeScreen = render(<ComputerSessionDetailScreen />);
    expect(activeScreen.getByTestId('computer-session-activity-indicator')).toBeTruthy();
    expect(activeScreen.getByText('Running a command')).toBeTruthy();
    activeScreen.unmount();

    mockSessionActivity = {
      active: false,
      kind: 'thinking',
      label: 'Idle',
      updatedAt: Date.now(),
    };
    const idleScreen = render(<ComputerSessionDetailScreen />);
    expect(idleScreen.queryByTestId('computer-session-activity-indicator')).toBeNull();
  });

  it('keeps the composer read-only while the Connector reports active work', () => {
    mockSessionActivity = {
      active: true,
      kind: 'thinking',
      label: 'Working',
      updatedAt: Date.now(),
    };
    const screen = render(<ComputerSessionDetailScreen />);

    expect(screen.getByLabelText('Local session message').props.editable).toBe(false);
    fireEvent.changeText(screen.getByLabelText('Local session message'), 'Do not send yet');
    fireEvent.press(screen.getByLabelText('Send local session message'));
    expect(mockMutate).not.toHaveBeenCalled();
  });
});
