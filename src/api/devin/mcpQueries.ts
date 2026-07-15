import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@auth/AuthContext';
import { shouldRetryQuery } from './client';
import {
  askWikiQuestion,
  listIntegrationCatalog,
  readWikiContents,
  readWikiStructure,
} from './mcp';

export const mcpQueryKeys = {
  integrations: ['devinMcp', 'integrations'] as const,
  wikiStructure: (repoName: string) => ['devinMcp', 'wikiStructure', repoName] as const,
  wikiContents: (repoName: string) => ['devinMcp', 'wikiContents', repoName] as const,
};

export function useIntegrationCatalog() {
  const { provider, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: mcpQueryKeys.integrations,
    queryFn: async () => {
      if (!provider) throw new Error('Not authenticated');
      return listIntegrationCatalog(provider);
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
    retry: shouldRetryQuery,
  });
}

export function useWikiStructure(repoName: string) {
  const { provider, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: mcpQueryKeys.wikiStructure(repoName),
    queryFn: async () => {
      if (!provider) throw new Error('Not authenticated');
      return readWikiStructure(provider, repoName);
    },
    enabled: isAuthenticated && repoName.length > 0,
    staleTime: 10 * 60_000,
    retry: shouldRetryQuery,
  });
}

export function useWikiContents(repoName: string, enabled: boolean) {
  const { provider, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: mcpQueryKeys.wikiContents(repoName),
    queryFn: async () => {
      if (!provider) throw new Error('Not authenticated');
      return readWikiContents(provider, repoName);
    },
    enabled: isAuthenticated && enabled && repoName.length > 0,
    staleTime: 10 * 60_000,
    retry: shouldRetryQuery,
  });
}

export function useAskWikiQuestion(repoName: string) {
  const { provider } = useAuth();
  return useMutation({
    mutationFn: async (question: string) => {
      if (!provider) throw new Error('Not authenticated');
      return askWikiQuestion(provider, repoName, question);
    },
  });
}
