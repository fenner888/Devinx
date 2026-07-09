jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { AttachmentPickerSheet } from '../../src/components/AttachmentPickerSheet';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

const imagePicker = ImagePicker.launchImageLibraryAsync as jest.MockedFunction<
  typeof ImagePicker.launchImageLibraryAsync
>;
const documentPicker = DocumentPicker.getDocumentAsync as jest.MockedFunction<
  typeof DocumentPicker.getDocumentAsync
>;

function renderSheet(onPick = jest.fn(), onClose = jest.fn()) {
  return {
    ...render(
      <ThemeProvider>
        <AttachmentPickerSheet visible onClose={onClose} onPick={onPick} />
      </ThemeProvider>,
    ),
    onPick,
    onClose,
  };
}

describe('AttachmentPickerSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('selects a photo or video from the media library', async () => {
    imagePicker.mockResolvedValue({
      canceled: false,
      assets: [
        {
          assetId: null,
          base64: null,
          duration: null,
          exif: null,
          fileName: 'clip.mov',
          fileSize: 1024,
          height: 1080,
          mimeType: 'video/quicktime',
          pairedVideoAsset: null,
          type: 'video',
          uri: 'file:///clip.mov',
          width: 1920,
        },
      ],
    });
    const { getByLabelText, onPick, onClose } = renderSheet();

    fireEvent.press(getByLabelText('Choose photo or video'));

    await waitFor(() =>
      expect(onPick).toHaveBeenCalledWith({
        name: 'clip.mov',
        type: 'video/quicktime',
        uri: 'file:///clip.mov',
      }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the sheet mounted until the media picker returns', async () => {
    let resolvePicker!: (
      result: Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>,
    ) => void;
    imagePicker.mockReturnValue(
      new Promise((resolve) => {
        resolvePicker = resolve;
      }),
    );
    const { getByLabelText, onClose } = renderSheet();

    fireEvent.press(getByLabelText('Choose photo or video'));
    expect(onClose).not.toHaveBeenCalled();

    resolvePicker({ canceled: true, assets: null });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('selects a file from the document picker', async () => {
    documentPicker.mockResolvedValue({
      canceled: false,
      assets: [
        {
          name: 'notes.txt',
          size: 12,
          mimeType: 'text/plain',
          uri: 'file:///notes.txt',
          lastModified: 0,
        },
      ],
    });
    const { getByLabelText, onPick } = renderSheet();

    fireEvent.press(getByLabelText('Choose file'));

    await waitFor(() =>
      expect(onPick).toHaveBeenCalledWith({
        name: 'notes.txt',
        type: 'text/plain',
        uri: 'file:///notes.txt',
      }),
    );
  });

  it('rejects attachments larger than 100 MB', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    documentPicker.mockResolvedValue({
      canceled: false,
      assets: [
        {
          name: 'large.mov',
          size: 101 * 1024 * 1024,
          mimeType: 'video/quicktime',
          uri: 'file:///large.mov',
          lastModified: 0,
        },
      ],
    });
    const { getByLabelText, onPick } = renderSheet();

    fireEvent.press(getByLabelText('Choose file'));

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        'File too large',
        'Attachments must be 100 MB or smaller.',
      ),
    );
    expect(onPick).not.toHaveBeenCalled();
    alert.mockRestore();
  });
});
