import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

const mockMutate = jest.fn();
const mockRefetch = jest.fn(async () => {});
const mockCompanionProps = jest.fn();
const mockReact = React;

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
  useComputerSessionAccess: () => ({
    data: {
      capabilities: { sessionList: true, sessionLoad: true, sessionPrompt: true },
    },
  }),
  useComputerSessionDetail: () => ({
    data: {
      session: {
        id: `local_${'L'.repeat(43)}`,
        origin: 'computer',
        workspaceName: 'DevinX',
        model: { id: 'swe-1.7-high', name: 'SWE-1.7 High' },
      },
      messages: [{ sequence: 1, source: 'devin', text: 'Ready.' }],
      truncated: false,
    },
    isLoading: false,
    isRefetching: false,
    error: null,
    refetch: mockRefetch,
  }),
  useComputerSessionActivity: () => ({ data: undefined }),
  usePromptComputerSession: () => ({
    mutate: mockMutate,
    isPending: false,
    error: null,
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
      brandText: { hex: '#0088ff' },
      brand: { hex: '#0088ff' },
      textAlwaysWhite: { hex: '#ffffff' },
    },
  }),
}));

import ComputerSessionDetailScreen, {
  devinReplySignature,
  hasSettledNewDevinReply,
} from '../../src/app/(main)/computer-session/[bridgeId]/[id]';

describe('Computer session detail', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses authoritative Mac capabilities to show and submit the steering composer', () => {
    const screen = render(<ComputerSessionDetailScreen />);

    expect(screen.getByText('Steering enabled')).toBeTruthy();
    const companionDock = screen.getByTestId('computer-session-companion-dock');
    expect(companionDock.props.className).toContain('absolute');
    expect(companionDock.props.className).not.toContain('bg-canvas');
    expect(companionDock.props.pointerEvents).toBe('none');
    expect(screen.getByTestId('computer-session-history').props.contentContainerClassName).toContain(
      'pb-[160px]',
    );
    expect(screen.getByTestId('computer-session-composer-shell')).toBeTruthy();
    expect(screen.getByTestId('computer-session-composer').props.className).toContain(
      'rounded-card',
    );
    expect(screen.getByLabelText('Computer session message').props.textAlignVertical).toBe('top');
    expect(screen.getByLabelText('Computer session message').props.className).toContain(
      'min-h-[44px]',
    );
    expect(screen.getByLabelText('Model: SWE-1.7')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Reasoning and speed: High'));
    fireEvent.press(screen.getByLabelText('Use Medium for SWE-1.7'));
    expect(screen.getByLabelText('Reasoning and speed: Medium')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Computer session message'), 'Continue the task.');
    fireEvent.press(screen.getByLabelText('Send computer session message'));

    expect(screen.getByLabelText('Workspace: DevinX')).toBeTruthy();
    expect(mockMutate).toHaveBeenCalledWith(
      { text: 'Continue the task.', modelId: 'swe-1.7-medium' },
      expect.any(Object),
    );
    expect(screen.getByText('Continue the task.')).toBeTruthy();
    expect(screen.getByText('Devin is working…')).toBeTruthy();
    expect(mockCompanionProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ state: 'thinking', travel: true, travelTrack: true }),
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
});
