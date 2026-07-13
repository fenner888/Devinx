import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { SessionResponse } from '../../src/api/devin/types';
import SecurityWorkScreen from '../../src/app/(main)/security-work';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockCreate = jest.fn();
const mockRememberRepository = jest.fn(async (_sessionId: string, _repository: string) => undefined);
let mockMode: 'cloud' | 'computer' | 'both' = 'cloud';
let mockSessions: SessionResponse[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: mockReplace }),
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
  useRepositories: () => ({
    data: [
      {
        provider_repository_id: 'repo-1',
        git_connection_id: 'git-1',
        git_connection_host: 'github.com',
        repo_name: 'DevinX',
        repo_path: 'fenner888/DevinX',
        repo_description: null,
        repo_language: 'TypeScript',
        last_updated_at: null,
      },
    ],
    isLoading: false,
    error: null,
  }),
  useCreateSession: () => ({
    mutateAsync: mockCreate,
    isPending: false,
  }),
}));

jest.mock('../../src/lib/haptics', () => ({
  hapticError: jest.fn(),
  hapticLight: jest.fn(),
  hapticSuccess: jest.fn(),
}));

jest.mock('../../src/lib/session-repository', () => ({
  rememberSessionRepository: (sessionId: string, repository: string) =>
    mockRememberRepository(sessionId, repository),
}));

function session(overrides: Partial<SessionResponse> = {}): SessionResponse {
  return {
    acus_consumed: 0,
    category: 'code_quality_and_security',
    child_session_ids: null,
    created_at: 1,
    is_archived: false,
    org_id: 'org-1',
    origin: 'api',
    parent_session_id: null,
    playbook_id: null,
    pull_requests: [],
    service_user_id: null,
    session_id: 'security-root',
    status: 'running',
    status_detail: 'working',
    tags: [],
    title: 'Security review: DevinX',
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
    mockCreate.mockResolvedValue(session({ session_id: 'created-review' }));
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
    ];
    const screen = render(
      <ThemeProvider>
        <SecurityWorkScreen />
      </ThemeProvider>,
    );

    expect(screen.getByText('Security Work')).toBeTruthy();
    expect(screen.getByText('2 agent sessions')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Show child agents'));
    expect(screen.getByText('Audit authorization')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Open child agent Audit authorization'));
    expect(mockPush).toHaveBeenCalledWith('/(main)/session/security-child');
  });

  it('starts a read-only tagged review for a selected validated repository', async () => {
    const screen = render(
      <ThemeProvider>
        <SecurityWorkScreen />
      </ThemeProvider>,
    );

    fireEvent.press(screen.getByLabelText('Start security review'));
    fireEvent.press(screen.getByLabelText('Review DevinX'));
    fireEvent.changeText(screen.getByLabelText('Security review focus'), 'Check tenant isolation');
    fireEvent.press(screen.getByLabelText('Start read-only security review'));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        devin_mode: 'normal',
        repos: ['fenner888/DevinX'],
        tags: ['devinx-security-work', 'security-review'],
        title: 'Security review: DevinX',
      }),
    );
    const request = mockCreate.mock.calls[0]?.[0] as { prompt: string };
    expect(request.prompt).toContain('read-only security review');
    expect(request.prompt).toContain('Check tenant isolation');
    expect(request.prompt).toContain('Do not modify code');
    await waitFor(() => {
      expect(mockRememberRepository).toHaveBeenCalledWith('created-review', 'fenner888/DevinX');
      expect(mockReplace).toHaveBeenCalledWith('/(main)/session/created-review');
    });
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
