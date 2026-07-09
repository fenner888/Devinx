const mockUploadAttachment = jest.fn();
const mockCreateSession = jest.fn();

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('@api/devin/queries', () => ({
  useSessions: jest.fn(() => ({ data: [] })),
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

jest.mock('@components/OfflineBanner', () => ({
  OfflineBanner: () => null,
}));

jest.mock('@components/NavMenu', () => ({
  NavMenu: () => null,
}));

jest.mock('@components/ModeSettings', () => ({
  ModeSettings: () => null,
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import HomeScreen from '../../src/app/(main)/index';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

describe('home attachment control', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
