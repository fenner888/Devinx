import { createRef } from 'react';
import { TextInput, View } from 'react-native';
import { render } from '@testing-library/react-native';

import {
  VoiceComposerStatus,
  VoiceMicButton,
} from '../../src/components/VoiceInput/VoiceComposerControls';
import type { VoiceComposerController } from '../../src/components/VoiceInput/useVoiceComposer';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

function controller(overrides: Partial<VoiceComposerController> = {}): VoiceComposerController {
  return {
    inputRef: createRef<TextInput>(),
    phase: 'idle',
    isRecording: false,
    elapsedSeconds: 0,
    level: 0,
    reduceMotion: false,
    volatileText: '',
    error: null,
    permissionDenied: false,
    canStructure: false,
    scribePreview: null,
    rawPreview: '',
    onSelectionChange: jest.fn(),
    start: jest.fn(async () => undefined),
    stop: jest.fn(async () => undefined),
    cancel: jest.fn(async () => undefined),
    structure: jest.fn(async () => undefined),
    applyStructured: jest.fn(),
    closePreview: jest.fn(),
    clearError: jest.fn(),
    openSettings: jest.fn(),
    ...overrides,
  };
}

describe('voice composer controls', () => {
  it('shows only the expanded Stop action while recording', () => {
    const voice = controller({ phase: 'recording', isRecording: true, elapsedSeconds: 2 });
    const { getAllByLabelText, getByText, queryByLabelText } = render(
      <ThemeProvider>
        <View>
          <VoiceComposerStatus voice={voice} />
          <VoiceMicButton voice={voice} />
        </View>
      </ThemeProvider>,
    );

    expect(getAllByLabelText('Stop dictation')).toHaveLength(1);
    expect(queryByLabelText('Start on-device dictation')).toBeNull();
    expect(getByText('Listening')).toBeTruthy();
    expect(getByText('0:02 · On device')).toBeTruthy();
  });

  it('describes the optional scribe action as organizing the prompt', () => {
    const voice = controller({ canStructure: true });
    const { getByText, queryByText } = render(
      <ThemeProvider>
        <VoiceComposerStatus voice={voice} />
      </ThemeProvider>,
    );

    expect(getByText('Organize prompt')).toBeTruthy();
    expect(queryByText('Structure into work order')).toBeNull();
  });
});
