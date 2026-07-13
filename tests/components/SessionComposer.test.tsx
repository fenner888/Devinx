const mockSendMessage = jest.fn();
const mockUploadAttachment = jest.fn();
const mockDevinCompanion = jest.fn((_props: unknown) => null);
const mockSession = {
  acus_consumed: 0,
  category: null,
  child_session_ids: null,
  created_at: 1,
  is_archived: false,
  org_id: 'org-1',
  origin: 'api',
  parent_session_id: null,
  playbook_id: null,
  pull_requests: [],
  service_user_id: null,
  session_id: 'session-1',
  status: 'running',
  status_detail: 'working',
  tags: [],
  title: 'Test session',
  updated_at: 1,
  url: 'https://app.devin.ai/sessions/session-1',
};

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(),
  useLocalSearchParams: jest.fn(() => ({ id: 'session-1' })),
  useRouter: jest.fn(() => ({ back: jest.fn() })),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => {
    if (key === '@devinx/session-repository/session-1') return 'fenner888/Devinx';
    if (key === '@devinx/session-mode/session-1') return 'fast';
    return null;
  }),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('@api/devin/queries', () => ({
  useSession: jest.fn(() => ({
    data: mockSession,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  })),
  useMessages: jest.fn(() => ({ data: { items: [] } })),
  useSendMessage: jest.fn(() => ({
    isPending: false,
    isError: false,
    mutate: mockSendMessage,
  })),
  useUploadAttachment: jest.fn(() => ({
    isPending: false,
    mutateAsync: mockUploadAttachment,
  })),
  useUpdateTags: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  useInsights: jest.fn(() => ({ data: null, isLoading: false })),
  useGenerateInsights: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
}));

jest.mock('expo-video', () => ({
  VideoView: () => null,
  useVideoPlayer: jest.fn(() => ({ loop: false })),
}));

jest.mock('expo-audio', () => ({
  useAudioPlayer: jest.fn(() => ({ play: jest.fn(), pause: jest.fn() })),
  useAudioPlayerStatus: jest.fn(() => ({
    playing: false,
    isLoaded: true,
    currentTime: 0,
    duration: 0,
  })),
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('@lib/haptics', () => ({
  hapticLight: jest.fn(),
  hapticSuccess: jest.fn(),
  hapticError: jest.fn(),
}));

jest.mock('@components/pets', () => ({
  DevinCompanion: (props: unknown) => mockDevinCompanion(props),
}));

import { Keyboard } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import SessionDetailScreen from '../../src/app/(main)/session/[id]';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

const imagePicker = ImagePicker.launchImageLibraryAsync as jest.MockedFunction<
  typeof ImagePicker.launchImageLibraryAsync
>;

describe('active session composer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.status = 'running';
    mockSession.status_detail = 'working';
  });

  it('shows cloud and repository context', async () => {
    const { getByText, getByLabelText, getByTestId } = render(
      <ThemeProvider>
        <SessionDetailScreen />
      </ThemeProvider>,
    );

    expect(getByText('Devin Cloud')).toBeTruthy();
    const companionDock = getByTestId('cloud-session-companion-dock');
    expect(companionDock.props.className).toContain('absolute');
    expect(companionDock.props.className).not.toContain('bg-canvas');
    expect(companionDock.props.pointerEvents).toBe('none');
    expect(getByTestId('cloud-session-timeline').props.contentContainerStyle.paddingBottom).toBe(
      272,
    );
    const composerShell = getByTestId('cloud-session-composer-shell');
    expect(composerShell.props.className).toContain('absolute');
    expect(composerShell.props.className).not.toContain('bg-canvas');
    const composer = getByTestId('cloud-session-composer');
    expect(composer.props.className).toContain('rounded-card');
    expect(composer.props.className).not.toContain('bg-surface1');
    expect(composer.props.style.backgroundColor).toBe('#FFFFFF14');
    expect(getByLabelText('Cloud session message').props.textAlignVertical).toBe('top');
    expect(getByLabelText('Cloud session message').props.className).toContain('min-h-[44px]');
    await waitFor(() => expect(getByLabelText('Repository: fenner888/Devinx')).toBeTruthy());
    expect(getByLabelText('Session mode: Fast')).toBeTruthy();
  });

  it('does not duplicate the sleeping status beside the composer', async () => {
    mockSession.status = 'suspended';
    mockSession.status_detail = 'sleeping';
    const { getByLabelText, queryByText } = render(
      <ThemeProvider>
        <SessionDetailScreen />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByLabelText('Repository: fenner888/Devinx')).toBeTruthy());
    expect(queryByText('Sleeping — sending a message will wake Devin.')).toBeNull();
  });

  it('uploads an image and sends it with the follow-up message', async () => {
    const dismissKeyboard = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
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
    const { getByLabelText, getByPlaceholderText } = render(
      <ThemeProvider>
        <SessionDetailScreen />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByLabelText('Repository: fenner888/Devinx')).toBeTruthy());
    fireEvent.press(getByLabelText('Add attachment'));
    fireEvent.press(getByLabelText('Choose photo or video'));
    await waitFor(() => expect(getByLabelText('Remove photo.jpg')).toBeTruthy());
    fireEvent.changeText(
      getByPlaceholderText('Ask Devin to build features, fix bugs, or work on your code'),
      'Use this screenshot',
    );
    fireEvent.press(getByLabelText('Send message'));

    expect(mockSendMessage).toHaveBeenCalledWith(
      {
        message: 'Use this screenshot',
        attachmentUrls: ['https://api.devin.ai/attachments/photo.jpg'],
      },
      expect.any(Object),
    );
    expect(dismissKeyboard).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      const calls = mockDevinCompanion.mock.calls;
      const props = calls[calls.length - 1]?.[0] as
        { state?: string; travel?: boolean; travelTrack?: boolean } | undefined;
      expect(props).toEqual(
        expect.objectContaining({ state: 'thinking', travel: true, travelTrack: true }),
      );
    });
  });

  it('shows a calm waiting companion for a running session that needs user input', async () => {
    mockSession.status_detail = 'waiting_for_user';

    render(
      <ThemeProvider>
        <SessionDetailScreen />
      </ThemeProvider>,
    );

    await waitFor(() => {
      const calls = mockDevinCompanion.mock.calls;
      const props = calls[calls.length - 1]?.[0] as
        {
          accessibilityLabel?: string;
          size?: number;
          state?: string;
          travel?: boolean;
          travelTrack?: boolean;
        } | undefined;
      expect(props).toEqual(
        expect.objectContaining({ size: 104, state: 'waiting', travel: false, travelTrack: true }),
      );
      expect(props?.accessibilityLabel).toBe('Devin companion, Waiting for your reply');
    });
  });
});
