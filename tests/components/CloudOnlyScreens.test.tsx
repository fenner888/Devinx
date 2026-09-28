import React from 'react';
import { render } from '@testing-library/react-native';
import * as cloudQueries from '@api/devin/queries';
import { useConnections } from '@auth/ConnectionContext';
import AnalyticsScreen from '../../src/app/(main)/analytics';
import AutomationsScreen from '../../src/app/(main)/automations';
import KnowledgeScreen from '../../src/app/(main)/knowledge';
import PlaybooksScreen from '../../src/app/(main)/playbooks';
import RepositoriesScreen from '../../src/app/(main)/repositories';
import ReviewScreen from '../../src/app/(main)/review';
import SecretsScreen from '../../src/app/(main)/secrets';
import SecurityWorkScreen from '../../src/app/(main)/security-work';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@auth/ConnectionContext', () => ({
  useConnections: jest.fn(),
}));

jest.mock('@store/preferences', () => ({
  useAppPreferences: (selector: (state: unknown) => unknown) =>
    selector({ setConnectionMode: jest.fn() }),
}));

jest.mock('@api/devin/queries', () => ({
  useSchedules: jest.fn(),
  useCreateSchedule: jest.fn(),
  useUpdateSchedule: jest.fn(),
  useDeleteSchedule: jest.fn(),
  usePlaybooks: jest.fn(),
  usePrReview: jest.fn(),
  useTriggerPrReview: jest.fn(),
  useSessions: jest.fn(),
  useKnowledge: jest.fn(),
  useKnowledgeFolders: jest.fn(),
  useCreateKnowledgeNote: jest.fn(),
  useUpdateKnowledgeNote: jest.fn(),
  useDeleteKnowledgeNote: jest.fn(),
  useCreatePlaybook: jest.fn(),
  useUpdatePlaybook: jest.fn(),
  useDeletePlaybook: jest.fn(),
  useSecrets: jest.fn(),
  useCreateSecret: jest.fn(),
  useDeleteSecret: jest.fn(),
  useRepositories: jest.fn(),
  useOrgMetrics: jest.fn(),
}));

const mockUseConnections = useConnections as unknown as jest.Mock;
const queryHooks: jest.Mock[] = [
  cloudQueries.useSchedules,
  cloudQueries.useCreateSchedule,
  cloudQueries.useUpdateSchedule,
  cloudQueries.useDeleteSchedule,
  cloudQueries.usePlaybooks,
  cloudQueries.usePrReview,
  cloudQueries.useTriggerPrReview,
  cloudQueries.useSessions,
  cloudQueries.useKnowledge,
  cloudQueries.useKnowledgeFolders,
  cloudQueries.useCreateKnowledgeNote,
  cloudQueries.useUpdateKnowledgeNote,
  cloudQueries.useDeleteKnowledgeNote,
  cloudQueries.useCreatePlaybook,
  cloudQueries.useUpdatePlaybook,
  cloudQueries.useDeletePlaybook,
  cloudQueries.useSecrets,
  cloudQueries.useCreateSecret,
  cloudQueries.useDeleteSecret,
  cloudQueries.useRepositories,
  cloudQueries.useOrgMetrics,
] as unknown as jest.Mock[];

function renderScreen(Component: React.ComponentType) {
  return render(
    <ThemeProvider>
      <Component />
    </ThemeProvider>,
  );
}

function setCloudHookReturnValues() {
  (cloudQueries.useSchedules as unknown as jest.Mock).mockReturnValue({
    data: [],
    isLoading: false,
    isRefetching: false,
    error: null,
    refetch: jest.fn(),
  });
  (cloudQueries.useCreateSchedule as unknown as jest.Mock).mockReturnValue({
    isPending: false,
    mutate: jest.fn(),
  });
  (cloudQueries.useUpdateSchedule as unknown as jest.Mock).mockReturnValue({
    isPending: false,
    mutate: jest.fn(),
  });
  (cloudQueries.useDeleteSchedule as unknown as jest.Mock).mockReturnValue({
    mutate: jest.fn(),
  });
  (cloudQueries.usePlaybooks as unknown as jest.Mock).mockReturnValue({ data: [] });
  (cloudQueries.usePrReview as unknown as jest.Mock).mockReturnValue({
    data: null,
    isLoading: false,
    isRefetching: false,
    error: null,
    refetch: jest.fn(),
  });
  (cloudQueries.useTriggerPrReview as unknown as jest.Mock).mockReturnValue({
    isPending: false,
    mutate: jest.fn(),
  });
}

describe('Cloud-only screens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryHooks.forEach((hook) => hook.mockReset());
    mockUseConnections.mockReturnValue({ mode: 'computer' });
  });

  it('shows the Cloud-required state without calling Cloud hooks in computer mode', () => {
    const screens: React.ComponentType[] = [
      AutomationsScreen,
      ReviewScreen,
      SecurityWorkScreen,
      KnowledgeScreen,
      PlaybooksScreen,
      SecretsScreen,
      RepositoriesScreen,
      AnalyticsScreen,
    ];

    screens.forEach((Component) => {
      const screen = renderScreen(Component);

      expect(screen.getByText('Needs Devin Cloud')).toBeTruthy();
      expect(screen.queryByText('New')).toBeNull();
      expect(screen.queryByLabelText('New automation')).toBeNull();
      expect(screen.queryByText('Trigger review')).toBeNull();
      queryHooks.forEach((hook) => expect(hook).not.toHaveBeenCalled());

      screen.unmount();
      queryHooks.forEach((hook) => hook.mockClear());
    });
  });

  it('renders Cloud automation and review actions in Cloud mode', () => {
    mockUseConnections.mockReturnValue({ mode: 'cloud' });
    setCloudHookReturnValues();

    const automations = renderScreen(AutomationsScreen);
    expect(automations.getByLabelText('New automation')).toBeTruthy();
    automations.unmount();

    const review = renderScreen(ReviewScreen);
    expect(review.getByText('Trigger review')).toBeTruthy();
  });
});
