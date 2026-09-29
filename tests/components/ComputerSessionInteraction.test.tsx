import React from 'react';
import { render } from '@testing-library/react-native';

const mockReact = React;
const mockMutate = jest.fn();
const mockRespond = jest.fn();
const mockAnswerPermission = jest.fn();
const mockRefetch = jest.fn(async () => ({ data: undefined }));
let mockActivity: Record<string, unknown> | undefined;
let mockInteraction: Record<string, unknown> | null;

jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: () => ({
    getQueryData: () => undefined,
    invalidateQueries: jest.fn(async () => undefined),
  }),
}));
jest.mock('../../src/api/bridge/presentation', () => ({
  computerBridgePresentationQueryKey: ['computerBridgePresentation'],
  useComputerPresentation: () => ({
    data: { messageTimestamps: true, grants: { viewSessions: true, sendPrompts: true, startSessions: true } },
    settled: true,
  }),
  useComputerGrants: () => ({
    grants: { viewSessions: true, sendPrompts: true, startSessions: true },
    source: 'connector',
  }),
}));

jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) =>
    mockReact.useEffect(callback, [callback]),
  useLocalSearchParams: () => ({
    bridgeId: 'bridge_1234567890',
    id: `local_${'L'.repeat(43)}`,
  }),
  useRouter: () => ({ back: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('../../src/api/bridge/queries', () => ({
  computerSessionAccessQueryKey: ['computerSessionAccess'],
  computerSessionsQueryKey: () => ['computerSessions', 'bridge_1234567890'],
  useComputerBridgeFeatures: () => ({
    data: { activityTimeline: true, sessionElicitation: true, permissionPrompts: true },
  }),
  useComputerSessionAccess: () => ({
    data: { capabilities: { sessionLoad: true, sessionPrompt: true } },
  }),
  useComputerSessionActivity: () => ({ data: mockActivity }),
  useComputerSessionDetail: () => ({
    data: {
      session: {
        id: `local_${'L'.repeat(43)}`,
        origin: 'computer',
        workspaceName: 'DevinX',
        model: { id: 'swe-1.7-high', name: 'SWE-1.7 High' },
      },
      messages: [],
      activity: [],
      truncated: false,
    },
    isLoading: false,
    isRefetching: false,
    error: null,
    refetch: mockRefetch,
  }),
  useComputerSessionElicitation: () => ({ data: { interaction: mockInteraction } }),
  useComputerSessionPermission: () => ({ data: null }),
  useRespondComputerSessionElicitation: () => ({
    mutate: mockRespond,
    isPending: false,
    error: null,
  }),
  useRespondComputerSessionPermission: () => ({
    mutate: mockAnswerPermission,
    isPending: false,
    error: null,
  }),
  usePromptComputerSession: () => ({ mutate: mockMutate, isPending: false, error: null }),
  useComputerCreateOptions: () => ({
    data: { models: [], catalogSource: 'live' },
    isLoading: false,
    error: null,
    refreshCatalog: jest.fn(),
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
        permissions: ['bridge:health', 'session:content:read', 'session:prompt:send'],
      },
    ],
  }),
}));

jest.mock('../../src/components/pets', () => ({ DevinCompanion: () => null }));
jest.mock('../../src/components/DevinMarkdown', () => ({
  DevinMarkdown: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../../src/components/sessions/ComputerModelPickerSheets', () => ({
  ComputerModelPickerSheets: () => null,
}));
jest.mock('../../src/components/sessions/ModelFamilyMark', () => ({
  ModelFamilyMark: () => null,
}));
jest.mock('../../src/components/KeyboardDismissButton', () => ({
  KeyboardDismissButton: () => null,
}));
jest.mock('../../src/components/VoiceInput', () => ({
  useVoiceComposer: () => ({
    inputRef: { current: null },
    onSelectionChange: jest.fn(),
    isRecording: false,
  }),
  VoiceComposerStatus: () => null,
  VoiceMicButton: () => null,
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
      failed: { hex: '#ff0000' },
      finished: { hex: '#00dd88' },
      blocked: { hex: '#ee8833' },
      merged: { hex: '#9966dd' },
      textAlwaysWhite: { hex: '#ffffff' },
      tintPrimary: { hex: '#FFFFFF14' },
      composerSurface: { hex: '#1F1F1F' },
    },
  }),
}));

import ComputerSessionDetailScreen from '../../src/app/(main)/computer-session/[bridgeId]/[id]';

describe('local session interaction integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActivity = undefined;
    mockInteraction = null;
  });

  it('shows the answer status in the header and docks the question outside history', () => {
    mockActivity = {
      active: true,
      kind: 'thinking',
      label: 'Waiting for your answer',
      awaiting: 'answer',
      updatedAt: 1,
    };
    mockInteraction = {
      id: `interaction_${'Q'.repeat(43)}`,
      message: 'Which approach should I use?',
      fields: [
        {
          key: 'approach',
          type: 'single_select',
          title: 'Approach',
          required: true,
          options: [{ value: 'safe', label: 'Preserve the API' }],
        },
      ],
      createdAt: 1,
    };

    const screen = render(<ComputerSessionDetailScreen />);

    expect(screen.getByText('Waiting for your answer')).toBeTruthy();
    expect(screen.getByTestId('computer-interaction-dock')).toBeTruthy();
    let ancestor: ReturnType<typeof screen.getByText> | null =
      screen.getByText('Devin needs your input');
    let foundDock = false;
    let foundHistory = false;
    while (ancestor) {
      if (ancestor.props.testID === 'computer-interaction-dock') foundDock = true;
      if (ancestor.props.testID === 'computer-session-history') foundHistory = true;
      ancestor = ancestor.parent;
    }
    expect(foundDock).toBe(true);
    expect(foundHistory).toBe(false);
  });

  it('shows Terminal instructions and disables the composer for a read-only question', () => {
    mockActivity = {
      active: true,
      kind: 'thinking',
      label: 'Waiting for your answer',
      awaiting: 'answer',
      terminalQuestion: {
        questions: [
          {
            question: 'Which files should I inspect?',
            header: 'Files',
            options: ['All files', 'Changed files'],
            multiSelect: false,
          },
        ],
      },
      updatedAt: 1,
    };

    const screen = render(<ComputerSessionDetailScreen />);

    expect(screen.getByText('Answer in Terminal on My Mac')).toBeTruthy();
    expect(screen.getByLabelText('Local session message').props.editable).toBe(false);
    expect(screen.getByLabelText('Local session message').props.placeholder).toBe(
      'Answer in Terminal on My Mac',
    );
  });
});
