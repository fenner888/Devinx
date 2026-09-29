import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

const mockReact = React;
const mockRouterPush = jest.fn();
const mockCompanionProps = jest.fn();
const mockCreateComputerSession = jest.fn();
const mockCreateSession = jest.fn();
const mockUseComputerCreateOptions = jest.fn();
let mockConnection: {
  mode: 'cloud' | 'computer' | 'both';
  hasCloudConnection: boolean;
  usesCloud: boolean;
  computers: Array<{ bridgeId: string; computerName: string; permissions?: string[] }>;
} = { mode: 'cloud', hasCloudConnection: true, usesCloud: true, computers: [] };
let mockGrantInfo:
  | {
      grants: { viewSessions: boolean; sendPrompts: boolean; startSessions: boolean };
      source: 'connector' | 'pairing';
    }
  | undefined;
let mockComputerBoard: {
  sessions: Array<Record<string, unknown>>;
  computers: Array<Record<string, unknown>>;
} = { sessions: [], computers: [] };
let mockCloudSessions: Array<Record<string, unknown>> = [];

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(),
  useRouter: () => ({ push: mockRouterPush }),
}));
jest.mock('@api/devin/queries', () => ({
  useSessions: () => ({ data: mockCloudSessions }),
  useCreateSession: () => ({ isPending: false, mutate: mockCreateSession }),
  usePlaybooks: () => ({ data: [] }),
  useRepositories: () => ({ data: [], isLoading: false, error: null, refetch: jest.fn() }),
  useUploadAttachment: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));
jest.mock('@api/bridge/queries', () => ({
  useComputerSessions: () => ({ data: mockComputerBoard }),
  useComputerCreateOptions: (...arguments_: unknown[]) => {
    mockUseComputerCreateOptions(...arguments_);
    return {
      data: {
        workspaces: [{ id: `workspace_${'W'.repeat(43)}`, name: 'DevinX' }],
        models: [],
        defaultModelId: null,
        catalogSource: 'recent',
      },
      isLoading: false,
      error: null,
      refreshCatalog: jest.fn(),
      isRefreshingCatalog: false,
      refreshCatalogError: null,
    };
  },
  useCreateComputerSession: () => ({ isPending: false, mutate: mockCreateComputerSession }),
}));
jest.mock('@api/bridge/presentation', () => ({
  useComputerGrants: () => mockGrantInfo,
}));
jest.mock('@auth/ConnectionContext', () => ({
  useConnections: () => mockConnection,
}));
jest.mock('@components/OfflineBanner', () => ({ OfflineBanner: () => null }));
jest.mock('@components/NavMenu', () => ({ NavMenu: () => null }));
jest.mock('@components/ModeSettings', () => ({ ModeSettings: () => null }));
jest.mock('@components/AttachmentPickerSheet', () => ({ AttachmentPickerSheet: () => null }));
jest.mock('@components/pets', () => ({
  DevinCompanion: (props: unknown) => {
    mockCompanionProps(props);
    return null;
  },
  HomeCompanionStage: ({
    children,
    companionSize,
  }: {
    children: React.ReactNode;
    companionSize: number;
  }) =>
    mockReact.createElement(
      jest.requireActual('react-native').View,
      { testID: 'home-companion-stage', style: { height: companionSize + 24 } },
      children,
    ),
}));
jest.mock('@components/VoiceInput', () => ({
  VoiceComposerStatus: () => null,
  VoiceMicButton: () => null,
  useVoiceComposer: () => ({
    inputRef: { current: null },
    onSelectionChange: jest.fn(),
    isRecording: false,
  }),
}));
jest.mock('@components/sessions/ComputerSessionRow', () => ({
  ComputerDiscoveryNotices: () => null,
  ComputerSessionRow: ({ session }: { session: { title?: string } }) =>
    mockReact.createElement(jest.requireActual('react-native').Text, null, session.title),
}));
jest.mock('@components/sessions/ModelFamilyMark', () => ({ ModelFamilyMark: () => null }));
jest.mock('@components/sessions/ModelCostIndicator', () => ({
  ModelCostIndicator: () => null,
  modelCostLabel: () => '',
}));
jest.mock('../../src/lib/haptics', () => ({
  hapticLight: jest.fn(),
  hapticSuccess: jest.fn(),
  hapticError: jest.fn(),
}));
jest.mock('../../src/lib/session-repository', () => ({
  rememberSessionMode: jest.fn(),
  rememberSessionRepository: jest.fn(),
}));

import HomeScreen from '../../src/app/(main)/index';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

const bridgeId = 'bridge_1234567890';

function localSession(id: string, title: string, updatedAt: string) {
  return {
    id: `local_${id.repeat(43)}`,
    origin: 'computer',
    title,
    hasTitle: true,
    canLoad: true,
    workspaceName: 'DevinX',
    bridgeId,
    computerName: 'Studio Mac',
    updatedAt,
  };
}

function renderHome() {
  return render(
    <ThemeProvider>
      <HomeScreen />
    </ThemeProvider>,
  );
}

describe('Local Home grant priority', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnection = { mode: 'cloud', hasCloudConnection: true, usesCloud: true, computers: [] };
    mockGrantInfo = undefined;
    mockComputerBoard = { sessions: [], computers: [] };
    mockCloudSessions = [];
  });

  it('puts the companion before Recent and read-only guidance without a composer', () => {
    mockConnection = {
      mode: 'computer',
      hasCloudConnection: false,
      usesCloud: false,
      computers: [{ bridgeId, computerName: 'Studio Mac', permissions: ['session:content:read'] }],
    };
    mockGrantInfo = {
      grants: { viewSessions: true, sendPrompts: false, startSessions: false },
      source: 'connector',
    };
    mockComputerBoard = {
      sessions: [
        localSession('L', 'First local session', '2026-07-12T12:00:00.000Z'),
        localSession('M', 'Second local session', '2026-07-12T11:00:00.000Z'),
      ],
      computers: [{ bridgeId, computerName: 'Studio Mac', state: 'ready' }],
    };

    const screen = renderHome();

    expect(screen.getByText('First local session')).toBeTruthy();
    expect(screen.getByText('Second local session')).toBeTruthy();
    expect(
      screen.getByText(
        "This device can view sessions but can't start them — change permissions in DevinX Connector on Studio Mac",
      ),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Session prompt')).toBeNull();
    expect(screen.queryByLabelText('Start session')).toBeNull();
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('"testID":"home-companion-stage"')).toBeLessThan(
      tree.indexOf('"testID":"home-recent"'),
    );
    expect(tree.indexOf('"testID":"home-recent"')).toBeLessThan(
      tree.indexOf('"testID":"home-read-only-card"'),
    );

    fireEvent.press(screen.getByTestId('home-read-only-card'));
    expect(mockRouterPush).toHaveBeenCalledWith('/(main)/computer');
  });

  it('keeps Connector read-only guidance visible when there are no recent sessions', () => {
    mockConnection = {
      mode: 'computer',
      hasCloudConnection: false,
      usesCloud: false,
      computers: [{ bridgeId, computerName: 'Studio Mac', permissions: ['session:content:read'] }],
    };
    mockGrantInfo = {
      grants: { viewSessions: true, sendPrompts: false, startSessions: false },
      source: 'connector',
    };

    const screen = renderHome();

    expect(screen.getByTestId('home-read-only-card')).toBeTruthy();
    expect(screen.getByTestId('home-companion-stage')).toBeTruthy();
    expect(screen.queryByTestId('home-recent')).toBeNull();
    expect(screen.queryByLabelText('Session prompt')).toBeNull();
  });

  it('keeps the composer available when pairing grants do not include session creation', () => {
    mockConnection = {
      mode: 'computer',
      hasCloudConnection: false,
      usesCloud: false,
      computers: [{ bridgeId, computerName: 'Studio Mac', permissions: ['session:content:read'] }],
    };
    mockGrantInfo = {
      grants: { viewSessions: true, sendPrompts: false, startSessions: false },
      source: 'pairing',
    };

    const screen = renderHome();

    expect(screen.getByTestId('home-composer-heading')).toBeTruthy();
    expect(screen.getByLabelText('Session prompt')).toBeTruthy();
    expect(screen.queryByTestId('home-read-only-card')).toBeNull();
    expect(mockUseComputerCreateOptions).toHaveBeenLastCalledWith(bridgeId, true);
  });

  it('shows Recent rows after the full companion and composer', () => {
    mockConnection = {
      mode: 'computer',
      hasCloudConnection: false,
      usesCloud: false,
      computers: [
        {
          bridgeId,
          computerName: 'Studio Mac',
          permissions: ['session:content:read', 'session:create'],
        },
      ],
    };
    mockGrantInfo = {
      grants: { viewSessions: true, sendPrompts: true, startSessions: true },
      source: 'connector',
    };
    mockComputerBoard = {
      sessions: [
        localSession('L', 'Recent one', '2026-07-12T14:00:00.000Z'),
        localSession('M', 'Recent two', '2026-07-12T13:00:00.000Z'),
        localSession('N', 'Recent three', '2026-07-12T12:00:00.000Z'),
        localSession('O', 'Recent four', '2026-07-12T11:00:00.000Z'),
      ],
      computers: [{ bridgeId, computerName: 'Studio Mac', state: 'ready' }],
    };

    const screen = renderHome();

    expect(screen.getByText('Recent one')).toBeTruthy();
    expect(screen.getByText('Recent three')).toBeTruthy();
    expect(screen.getByText('Recent four')).toBeTruthy();
    expect(screen.getByLabelText('Session prompt')).toBeTruthy();
    expect(screen.getByLabelText('Start session')).toBeTruthy();
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('"testID":"home-companion-stage"')).toBeLessThan(
      tree.indexOf('"testID":"home-composer-heading"'),
    );
    expect(tree.indexOf('"testID":"home-composer-heading"')).toBeLessThan(
      tree.indexOf('"testID":"home-recent"'),
    );
  });

  it('keeps Cloud Home Recent after the composer without a read-only card', () => {
    mockCloudSessions = [
      {
        session_id: 'cloud-recent',
        title: 'Cloud recent session',
        status: 'running',
        status_detail: 'working',
        updated_at: 1_800_000_000,
        pull_requests: [],
      },
    ];

    const screen = renderHome();

    expect(screen.getByText('Cloud recent session')).toBeTruthy();
    expect(screen.queryByTestId('home-read-only-card')).toBeNull();
    expect(screen.getByLabelText('Session prompt')).toBeTruthy();
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('"testID":"home-composer-heading"')).toBeLessThan(
      tree.indexOf('"testID":"home-recent"'),
    );
  });
});
