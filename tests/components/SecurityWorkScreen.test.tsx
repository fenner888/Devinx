import { fireEvent, render } from '@testing-library/react-native';
import type { SessionResponse } from '../../src/api/devin/types';
import SecurityWorkScreen from '../../src/app/(main)/security-work';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

const mockBack = jest.fn();
const mockPush = jest.fn();
let mockMode: 'cloud' | 'computer' | 'both' = 'cloud';
let mockSessions: SessionResponse[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('../../src/auth/ConnectionContext', () => ({
  useConnections: () => ({ mode: mockMode }),
}));

jest.mock('../../src/api/devin/queries', () => ({
  useSessions: () => ({
    data: mockSessions,
    isLoading: false,
    isRefetching: false,
    error: null,
    refetch: jest.fn(async () => undefined),
  }),
}));

jest.mock('../../src/lib/haptics', () => ({
  hapticLight: jest.fn(),
}));

function session(overrides: Partial<SessionResponse> = {}): SessionResponse {
  return {
    acus_consumed: 0,
    category: null,
    child_session_ids: null,
    created_at: 1,
    is_archived: false,
    org_id: 'org-1',
    origin: 'code_scan',
    parent_session_id: null,
    playbook_id: null,
    pull_requests: [],
    service_user_id: null,
    session_id: 'security-root',
    status: 'running',
    status_detail: 'working',
    tags: [],
    title: 'Security scan fenner888/DevinX',
    updated_at: 20,
    url: 'https://app.devin.ai/sessions/security-root',
    ...overrides,
  };
}

describe('Security Work screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMode = 'cloud';
    mockSessions = [];
  });

  it('shows and opens supported security sessions and their child agents', () => {
    mockSessions = [
      session({ child_session_ids: ['security-child'] }),
      session({
        session_id: 'security-child',
        category: null,
        parent_session_id: 'security-root',
        title: 'Audit authorization',
      }),
      session({
        session_id: 'generic-security-session',
        category: 'code_quality_and_security',
        origin: 'api',
        tags: ['devinx-security-work', 'security-review'],
        title: 'Review pooled security schemes',
      }),
    ];
    const screen = render(
      <ThemeProvider>
        <SecurityWorkScreen />
      </ThemeProvider>,
    );

    expect(screen.getByText('Security Work')).toBeTruthy();
    expect(screen.getByText('2 agent sessions')).toBeTruthy();
    expect(screen.queryByText('Review pooled security schemes')).toBeNull();
    fireEvent.press(screen.getByLabelText('Show child agents'));
    expect(screen.getByText('Audit authorization')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Open child agent Audit authorization'));
    expect(mockPush).toHaveBeenCalledWith('/(main)/session/security-child');
  });

  it('does not expose an ordinary-session control that claims to create a Code Scan', () => {
    const screen = render(
      <ThemeProvider>
        <SecurityWorkScreen />
      </ThemeProvider>,
    );

    expect(screen.getByText('Genuine Code Scans only')).toBeTruthy();
    expect(screen.queryByLabelText('Start security review')).toBeNull();
    expect(screen.queryByText('New review')).toBeNull();
  });

  it('does not offer Cloud security review controls in computer-only mode', () => {
    mockMode = 'computer';
    const screen = render(
      <ThemeProvider>
        <SecurityWorkScreen />
      </ThemeProvider>,
    );

    expect(screen.getByText('Connect Devin Cloud')).toBeTruthy();
    expect(screen.queryByLabelText('Start security review')).toBeNull();
  });
});
