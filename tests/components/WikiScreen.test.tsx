import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import type { RepositoryResponse } from '../../src/api/devin/types';
import WikiScreen from '../../src/app/(main)/wiki';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

const mockUseWikiStructure = jest.fn();
const mockUseWikiContents = jest.fn();
const mockUseAskWikiQuestion = jest.fn();
let mockRepositories: RepositoryResponse[] = [];
const mockReact = React;
const mockText = Text;

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
  useLocalSearchParams: () => ({ repo: 'fenner888/DevinX' }),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../../src/auth/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

jest.mock('../../src/api/devin/queries', () => ({
  useRepositories: () => ({
    data: mockRepositories,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

jest.mock('../../src/api/devin/mcpQueries', () => ({
  useWikiStructure: (repoName: string) => mockUseWikiStructure(repoName),
  useWikiContents: (repoName: string, enabled: boolean) => mockUseWikiContents(repoName, enabled),
  useAskWikiQuestion: (repoName: string) => mockUseAskWikiQuestion(repoName),
}));

jest.mock('../../src/components/DevinMarkdown', () => ({
  DevinMarkdown: ({ children }: { children: React.ReactNode }) =>
    mockReact.createElement(mockText, null, children),
}));

function repository(overrides: Partial<RepositoryResponse> = {}): RepositoryResponse {
  return {
    provider_repository_id: 'provider-1',
    git_connection_id: 'connection-1',
    git_connection_host: 'github.com',
    repo_name: 'DevinX',
    repo_path: 'fenner888/DevinX',
    repo_description: null,
    repo_language: 'TypeScript',
    last_updated_at: null,
    indexing_status: {
      indexing_enabled: true,
      latest_completed_wiki_index_job: {
        branch_name: 'main',
        commit: 'commit-1',
        created_at: '2026-07-13T12:00:00Z',
        job_id: 'job-1',
      },
    },
    ...overrides,
  };
}

function queryResult(data: string | undefined = undefined) {
  return {
    data,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  };
}

describe('Wiki screen repository authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepositories = [];
    mockUseWikiStructure.mockReturnValue(queryResult());
    mockUseWikiContents.mockReturnValue(queryResult());
    mockUseAskWikiQuestion.mockReturnValue({
      data: undefined,
      error: null,
      isPending: false,
      mutate: jest.fn(),
    });
  });

  it('does not send a deep-linked repository to MCP unless the Cloud repository list authorizes it', () => {
    mockRepositories = [repository({ repo_path: 'fenner888/another-repo' })];

    const screen = render(
      <ThemeProvider>
        <WikiScreen />
      </ThemeProvider>,
    );

    expect(screen.getByText('Repository unavailable')).toBeTruthy();
    expect(mockUseWikiStructure).toHaveBeenCalledWith('');
    expect(mockUseWikiContents).toHaveBeenCalledWith('', false);
    expect(mockUseAskWikiQuestion).toHaveBeenCalledWith('');
  });

  it('does not expose repositories without supported indexing evidence', () => {
    mockRepositories = [repository({ indexing_status: { indexing_enabled: false } })];

    const screen = render(
      <ThemeProvider>
        <WikiScreen />
      </ThemeProvider>,
    );

    expect(screen.getByText('Repository unavailable')).toBeTruthy();
    expect(mockUseWikiStructure).toHaveBeenCalledWith('');
  });

  it('binds Wiki reads and questions to an authorized indexed repository', () => {
    mockRepositories = [repository()];
    mockUseWikiStructure.mockReturnValue(queryResult('Architecture'));

    const screen = render(
      <ThemeProvider>
        <WikiScreen />
      </ThemeProvider>,
    );

    expect(screen.getByText('Architecture')).toBeTruthy();
    expect(mockUseWikiStructure).toHaveBeenCalledWith('fenner888/DevinX');
    expect(mockUseWikiContents).toHaveBeenCalledWith('fenner888/DevinX', false);
    expect(mockUseAskWikiQuestion).toHaveBeenCalledWith('fenner888/DevinX');
  });
});
