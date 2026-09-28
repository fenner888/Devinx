import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

const mockReact = React;
const mockText = Text;
const mockQueryClient = { getQueryData: jest.fn(() => undefined) };
let mockMessages: Array<{
  sequence: number;
  source: 'user' | 'devin';
  text: string;
  createdAt?: number;
}> = [];
const mockRefetch = jest.fn(async () => {});

jest.mock('@tanstack/react-query', () => ({
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
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('../../src/api/bridge/queries', () => ({
  computerSessionsQueryKey: () => ['computerSessions', 'bridge_1234567890'],
  useComputerBridgeFeatures: () => ({
    data: {
      sessionElicitation: false,
      activityTimeline: false,
      grants: { viewSessions: true, sendPrompts: false, startSessions: false },
    },
  }),
  useComputerSessionAccess: () => ({
    data: { capabilities: { sessionList: true, sessionLoad: true, sessionPrompt: false } },
  }),
  useComputerSessionDetail: () => ({
    data: {
      session: { id: `local_${'L'.repeat(43)}`, origin: 'computer', workspaceName: 'Workspace' },
      messages: mockMessages,
      truncated: false,
    },
    isLoading: false,
    isRefetching: false,
    error: null,
    refetch: mockRefetch,
  }),
  useComputerSessionActivity: () => ({ data: undefined }),
  useComputerSessionElicitation: () => ({ data: { interaction: null } }),
  useRespondComputerSessionElicitation: () => ({ mutate: jest.fn(), isPending: false, error: null }),
  usePromptComputerSession: () => ({ mutate: jest.fn(), isPending: false, error: null }),
  useComputerCreateOptions: () => ({
    data: { workspaces: [], models: [], defaultModelId: null, catalogSource: 'recent' },
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
        computerName: 'Studio Mac',
        transportKind: 'tailscale_vpn',
        permissions: ['bridge:health', 'session:metadata:read', 'session:content:read'],
      },
    ],
  }),
}));
jest.mock('../../src/components/sessions/ActivityGroup', () => ({
  ActivityGroup: () => null,
  groupActivity: () => new Map(),
}));
jest.mock('../../src/components/DevinMarkdown', () => ({
  DevinMarkdown: ({ children }: { children: React.ReactNode }) =>
    mockReact.createElement(mockText, null, children),
}));
jest.mock('../../src/components/pets', () => ({ DevinCompanion: () => null }));
jest.mock('../../src/components/sessions/ComputerModelPickerSheets', () => ({
  ComputerModelPickerSheets: () => null,
}));
jest.mock('../../src/components/sessions/ComputerElicitationCard', () => ({
  ComputerElicitationCard: () => null,
}));
jest.mock('../../src/components/sessions/ComputerInteractionDock', () => ({
  ComputerInteractionAnsweredRow: () => null,
  ComputerInteractionDock: () => null,
}));
jest.mock('../../src/components/sessions/ComputerPermissionDockItem', () => ({
  ComputerPermissionDockItem: () => null,
}));
jest.mock('../../src/components/sessions/ComputerTerminalQuestionCard', () => ({
  ComputerTerminalQuestionCard: () => null,
}));
jest.mock('../../src/components/sessions/ModelFamilyMark', () => ({ ModelFamilyMark: () => null }));
jest.mock('../../src/components/KeyboardDismissButton', () => ({
  KeyboardDismissButton: () => null,
}));
jest.mock('../../src/components/VoiceInput', () => ({
  VoiceComposerStatus: () => null,
  VoiceMicButton: () => null,
  useVoiceComposer: () => ({
    inputRef: { current: null },
    onSelectionChange: jest.fn(),
    isRecording: false,
  }),
}));
jest.mock('../../src/theme/index', () => ({
  useTheme: () => ({
    tokens: {
      textMid: { hex: 'gray' },
      textLow: { hex: 'gray' },
      textHi: { hex: 'white' },
      textHiStrong: { hex: 'white' },
      brandText: { hex: 'blue' },
      brand: { hex: 'blue' },
      running: { hex: 'blue' },
      finished: { hex: 'green' },
      textAlwaysWhite: { hex: 'white' },
      composerSurface: { hex: 'black' },
    },
  }),
}));
jest.mock('@/pets/devin/activity', () => ({ activityForComputerSession: () => 'idle' }));

import ComputerSessionDetailScreen from '../../src/app/(main)/computer-session/[bridgeId]/[id]';

describe('Local computer session timestamps', () => {
  const firstTimestamp = new Date(2026, 8, 28, 15, 41).getTime();

  beforeEach(() => {
    mockMessages = [
      { sequence: 1, source: 'user', text: 'Do the tasks.', createdAt: firstTimestamp },
      {
        sequence: 2,
        source: 'devin',
        text: 'Ready.',
        createdAt: firstTimestamp + 60_000,
      },
    ];
    jest.spyOn(Date, 'now').mockReturnValue(firstTimestamp);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders day separators and timestamps, and opens permissions from the header chip', () => {
    const screen = render(<ComputerSessionDetailScreen />);

    expect(screen.getByTestId('message-day-separator').props.children).toBe('Today');
    expect(screen.getByTestId('message-time-1').props.children).toBe('You · 3:41 PM');
    expect(screen.getByTestId('message-time-2').props.children).toBe('Devin · 3:42 PM');
    fireEvent.press(screen.getByTestId('computer-session-permissions-chip'));
    expect(screen.getByText('Permissions on Studio Mac')).toBeTruthy();
  });

  it('leaves messages without timestamps without timestamp labels or separators', () => {
    mockMessages = [
      { sequence: 1, source: 'user', text: 'Do the tasks.' },
      { sequence: 2, source: 'devin', text: 'Ready.' },
    ];
    const screen = render(<ComputerSessionDetailScreen />);

    expect(screen.queryByTestId('message-day-separator')).toBeNull();
    expect(screen.queryByTestId('message-time-1')).toBeNull();
    expect(screen.queryByTestId('message-time-2')).toBeNull();
    expect(screen.getByText('You')).toBeTruthy();
    expect(screen.getByText('Devin')).toBeTruthy();
  });
});
