const mockUploadAttachment = jest.fn();
const mockCreateSession = jest.fn();
const mockCreateComputerSession = jest.fn();
const mockDevinCompanion = jest.fn((_props: unknown) => null);
let mockConnection = {
  mode: 'cloud',
  hasCloudConnection: true,
  usesCloud: true,
  computers: [] as Array<{ bridgeId: string; computerName: string }>,
};
let mockComputerCreateOptions:
  | {
      workspaces: Array<{ id: string; name: string }>;
      models: Array<{ id: string; name: string }>;
    }
  | undefined = { workspaces: [], models: [] };
let mockComputerCreateOptionsError: Error | null = null;
let mockComputerCreateOptionsLoading = false;
let mockCloudSessions: Array<Record<string, unknown>> = [];
let mockComputerBoard: {
  sessions: Array<Record<string, unknown>>;
  computers: Array<Record<string, unknown>>;
} = { sessions: [], computers: [] };

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(),
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('@api/devin/queries', () => ({
  useSessions: jest.fn(() => ({ data: mockCloudSessions })),
  useCreateSession: jest.fn(() => ({ isPending: false, mutate: mockCreateSession })),
  usePlaybooks: jest.fn(() => ({ data: [] })),
  useRepositories: jest.fn(() => ({
    data: [
      {
        provider_repository_id: 'repo-1',
        git_connection_id: 'git-1',
        git_connection_host: 'github.com',
        repo_name: 'Devinx',
        repo_path: 'fenner888/Devinx',
        repo_description: null,
        repo_language: 'TypeScript',
        last_updated_at: null,
      },
    ],
  })),
  useCodeScanFindings: jest.fn(() => ({ data: [] })),
  useUploadAttachment: jest.fn(() => ({ isPending: false, mutateAsync: mockUploadAttachment })),
}));

jest.mock('@api/bridge/queries', () => ({
  useComputerSessions: () => ({ data: mockComputerBoard }),
  useComputerCreateOptions: () => ({
    data: mockComputerCreateOptions,
    isLoading: mockComputerCreateOptionsLoading,
    error: mockComputerCreateOptionsError,
  }),
  useCreateComputerSession: () => ({
    isPending: false,
    mutate: mockCreateComputerSession,
  }),
}));

jest.mock('@auth/ConnectionContext', () => ({
  useConnections: () => mockConnection,
}));

jest.mock('@components/OfflineBanner', () => ({
  OfflineBanner: () => null,
}));

jest.mock('@components/NavMenu', () => ({
  NavMenu: () => null,
}));

jest.mock('@components/ModeSettings', () => ({
  ModeSettings: () => null,
}));

jest.mock('@components/pets', () => ({
  DevinCompanion: (props: unknown) => mockDevinCompanion(props),
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import HomeScreen from '../../src/app/(main)/index';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

describe('home attachment control', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnection = {
      mode: 'cloud',
      hasCloudConnection: true,
      usesCloud: true,
      computers: [],
    };
    mockComputerCreateOptions = { workspaces: [], models: [] };
    mockComputerCreateOptionsError = null;
    mockComputerCreateOptionsLoading = false;
    mockCloudSessions = [];
    mockComputerBoard = { sessions: [], computers: [] };
  });

  it('uses Devin as the prominent home-screen visual anchor', () => {
    const { getByText, queryByText } = render(
      <ThemeProvider>
        <HomeScreen />
      </ThemeProvider>,
    );

    expect(getByText('Devin is ready to build')).toBeTruthy();
    expect(getByText('What should Devin build?')).toBeTruthy();
    expect(
      queryByText('Describe a task — it runs in the cloud and you can steer it here.'),
    ).toBeNull();
    const props = mockDevinCompanion.mock.calls[0]?.[0] as
      { size?: number; state?: string } | undefined;
    expect(props?.state).toBe('idle');
    expect(props?.size).toBeGreaterThanOrEqual(164);
  });

  it('shows paired-Mac sessions without presenting the Cloud composer as active', () => {
    mockConnection = {
      mode: 'computer',
      hasCloudConnection: false,
      usesCloud: false,
      computers: [{ bridgeId: 'bridge_1234567890', computerName: 'Studio Mac' }],
    };
    mockComputerCreateOptions = {
      workspaces: [{ id: `workspace_${'W'.repeat(43)}`, name: 'DevinX' }],
      models: [{ id: 'gpt-5-6-sol-medium', name: 'GPT 5.6 Sol Medium' }],
    };
    mockComputerBoard = {
      sessions: [
        {
          id: `local_${'L'.repeat(43)}`,
          origin: 'computer',
          workspaceName: 'DevinX',
          hasTitle: false,
          bridgeId: 'bridge_1234567890',
          computerName: 'Studio Mac',
        },
      ],
      computers: [{ bridgeId: 'bridge_1234567890', computerName: 'Studio Mac', state: 'ready' }],
    };
    const screen = render(
      <ThemeProvider>
        <HomeScreen />
      </ThemeProvider>,
    );

    expect(screen.getByText('What should Devin build?')).toBeTruthy();
    expect(screen.getByPlaceholderText(/Ask Devin on your Mac/)).toBeTruthy();
    expect(screen.getAllByText('Studio Mac').length).toBeGreaterThan(0);
    expect(screen.getAllByText('DevinX').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('Execution mode')).toBeNull();
  });

  it('does not render cached sessions from a connection source excluded by the mode', () => {
    mockComputerBoard = {
      sessions: [
        {
          id: `local_${'L'.repeat(43)}`,
          origin: 'computer',
          workspaceName: 'Hidden local workspace',
          hasTitle: false,
          bridgeId: 'bridge_1234567890',
          computerName: 'Hidden Mac',
        },
      ],
      computers: [],
    };
    const cloudScreen = render(
      <ThemeProvider>
        <HomeScreen />
      </ThemeProvider>,
    );
    expect(cloudScreen.queryByText('Hidden Mac')).toBeNull();
    cloudScreen.unmount();

    mockConnection = {
      mode: 'computer',
      hasCloudConnection: true,
      usesCloud: false,
      computers: [],
    };
    mockCloudSessions = [
      {
        session_id: 'devin-hidden',
        title: 'Hidden Cloud session',
        updated_at: 1,
        pull_requests: [],
      },
    ];
    mockComputerBoard = { sessions: [], computers: [] };
    const computerScreen = render(
      <ThemeProvider>
        <HomeScreen />
      </ThemeProvider>,
    );
    expect(computerScreen.queryByText('Hidden Cloud session')).toBeNull();
  });

  it('opens attachment sources without opening the execution mode picker', () => {
    const { getByLabelText, queryByText } = render(
      <ThemeProvider>
        <HomeScreen />
      </ThemeProvider>,
    );

    expect(getByLabelText('Add attachment')).toBeTruthy();
    expect(getByLabelText('Execution mode')).toBeTruthy();

    fireEvent.press(getByLabelText('Add attachment'));

    expect(getByLabelText('Choose photo or video')).toBeTruthy();
    expect(getByLabelText('Choose file')).toBeTruthy();
    expect(queryByText('Session settings')).toBeNull();
  });

  it('keeps Computer workspace and model controls separate from Cloud controls', () => {
    mockConnection = {
      mode: 'computer',
      hasCloudConnection: false,
      usesCloud: false,
      computers: [{ bridgeId: 'bridge_1234567890', computerName: 'Studio Mac' }],
    };
    mockComputerCreateOptions = {
      workspaces: [{ id: `workspace_${'W'.repeat(43)}`, name: 'DevinX' }],
      models: [{ id: 'gpt-5-6-sol-medium', name: 'GPT 5.6 Sol Medium' }],
    };
    const screen = render(
      <ThemeProvider>
        <HomeScreen />
      </ThemeProvider>,
    );

    expect(screen.getByLabelText('Workspace: DevinX')).toBeTruthy();
    expect(screen.getByLabelText('Model: Default')).toBeTruthy();
    expect(screen.queryByLabelText('Execution mode')).toBeNull();
    expect(screen.queryByLabelText('Select playbook')).toBeNull();

    fireEvent.press(screen.getByLabelText('Model: Default'));
    fireEvent.press(screen.getByLabelText('Use model GPT 5.6 Sol Medium'));
    fireEvent.changeText(screen.getByLabelText('Session prompt'), 'Build the local feature');
    fireEvent.press(screen.getByLabelText('Start session'));

    expect(mockCreateComputerSession).toHaveBeenCalledWith(
      {
        workspaceId: `workspace_${'W'.repeat(43)}`,
        modelId: 'gpt-5-6-sol-medium',
        text: 'Build the local feature',
      },
      expect.any(Object),
    );
  });

  it('explains unavailable local options without opening an inescapable empty sheet', () => {
    mockConnection = {
      mode: 'computer',
      hasCloudConnection: false,
      usesCloud: false,
      computers: [{ bridgeId: 'bridge_1234567890', computerName: 'Studio Mac' }],
    };
    mockComputerCreateOptions = undefined;
    mockComputerCreateOptionsError = new Error('not authorized');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const screen = render(
      <ThemeProvider>
        <HomeScreen />
      </ThemeProvider>,
    );

    fireEvent.press(screen.getByLabelText('Workspace: Unavailable'));
    expect(alert).toHaveBeenCalledWith(
      'Connector permission required',
      expect.stringContaining('enable Create new sessions'),
    );
    expect(screen.queryByLabelText('Close workspace picker')).toBeNull();
    fireEvent.press(screen.getByLabelText('Model: Default'));
    expect(alert).toHaveBeenCalledTimes(2);
  });

  it('always provides an explicit close control for local picker sheets', () => {
    mockConnection = {
      mode: 'computer',
      hasCloudConnection: false,
      usesCloud: false,
      computers: [{ bridgeId: 'bridge_1234567890', computerName: 'Studio Mac' }],
    };
    mockComputerCreateOptions = {
      workspaces: [{ id: `workspace_${'W'.repeat(43)}`, name: 'DevinX' }],
      models: [],
    };
    const screen = render(
      <ThemeProvider>
        <HomeScreen />
      </ThemeProvider>,
    );

    fireEvent.press(screen.getByLabelText('Workspace: DevinX'));
    expect(screen.getByLabelText('Close workspace picker')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Close workspace picker'));
    expect(screen.queryByLabelText('Close workspace picker')).toBeNull();

    fireEvent.press(screen.getByLabelText('Model: Default'));
    expect(screen.getByLabelText('Close model menu')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Close model menu'));
    expect(screen.queryByLabelText('Close model menu')).toBeNull();
  });

  it('shows and selects the repository context', () => {
    const { getByLabelText } = render(
      <ThemeProvider>
        <HomeScreen />
      </ThemeProvider>,
    );

    fireEvent.press(getByLabelText('Repository: Any repository'));
    fireEvent.press(getByLabelText('Use repository fenner888/Devinx'));

    expect(getByLabelText('Repository: fenner888/Devinx')).toBeTruthy();
  });

  it('filters repository rows from the picker search field', () => {
    const { getByLabelText, queryByLabelText, getByText } = render(
      <ThemeProvider>
        <HomeScreen />
      </ThemeProvider>,
    );

    fireEvent.press(getByLabelText('Repository: Any repository'));
    fireEvent.changeText(getByLabelText('Search repositories'), 'missing');

    expect(queryByLabelText('Use repository fenner888/Devinx')).toBeNull();
    expect(getByText('No repositories match your search.')).toBeTruthy();
  });

  it('includes the selected repository when starting a session', () => {
    const { getByLabelText } = render(
      <ThemeProvider>
        <HomeScreen />
      </ThemeProvider>,
    );

    fireEvent.press(getByLabelText('Repository: Any repository'));
    fireEvent.press(getByLabelText('Use repository fenner888/Devinx'));
    fireEvent.changeText(getByLabelText('Session prompt'), 'Fix the upload flow');
    fireEvent.press(getByLabelText('Start session'));

    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'Fix the upload flow',
        repos: ['fenner888/Devinx'],
      }),
      expect.any(Object),
    );
  });

  it('shows the selected image after upload completes', async () => {
    const imagePicker = ImagePicker.launchImageLibraryAsync as jest.MockedFunction<
      typeof ImagePicker.launchImageLibraryAsync
    >;
    imagePicker.mockResolvedValue({
      canceled: false,
      assets: [
        {
          assetId: null,
          base64: null,
          duration: null,
          exif: null,
          fileName: 'photo.jpg',
          fileSize: 1024,
          height: 1080,
          mimeType: 'image/jpeg',
          pairedVideoAsset: null,
          type: 'image',
          uri: 'file:///photo.jpg',
          width: 1920,
        },
      ],
    });
    mockUploadAttachment.mockResolvedValue({
      attachment_id: 'att-1',
      name: 'photo.jpg',
      url: 'https://api.devin.ai/attachments/photo.jpg',
    });
    const { getByLabelText } = render(
      <ThemeProvider>
        <HomeScreen />
      </ThemeProvider>,
    );

    fireEvent.press(getByLabelText('Add attachment'));
    fireEvent.press(getByLabelText('Choose photo or video'));

    await waitFor(() => expect(getByLabelText('Remove photo.jpg')).toBeTruthy());
    expect(mockUploadAttachment).toHaveBeenCalledWith({
      name: 'photo.jpg',
      type: 'image/jpeg',
      uri: 'file:///photo.jpg',
    });
  });
});
